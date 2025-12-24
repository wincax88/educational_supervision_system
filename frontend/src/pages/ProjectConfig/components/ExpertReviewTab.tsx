/**
 * 专家评审 Tab 组件
 * 管理审核任务分配和查看评审统计
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Table,
  Tag,
  Card,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  message,
  Space,
  Progress,
  Select,
  Input,
  Modal,
  Form,
  Tooltip,
  Badge,
  Divider,
  Tabs,
  List,
  Avatar,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as reviewAssignmentService from '../../../services/reviewAssignmentService';
import type {
  PendingSubmission,
  ReviewAssignment,
  ReviewAssignmentStats,
} from '../../../services/reviewAssignmentService';
import type { Personnel } from '../types';
import ManualAssignModal from './ManualAssignModal';
import ReviewerScopeModal from './ReviewerScopeModal';
import styles from '../index.module.css';

interface ExpertReviewTabProps {
  projectId: string;
  projectStatus: string;
  personnel?: Record<string, Personnel[]>;
  disabled?: boolean;
}

const ExpertReviewTab: React.FC<ExpertReviewTabProps> = ({
  projectId,
  projectStatus,
  personnel = {},
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [stats, setStats] = useState<ReviewAssignmentStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<string>('pending');

  // 手动分配弹窗
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  // 审核范围配置弹窗
  const [scopeModalVisible, setScopeModalVisible] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<Personnel | null>(null);

  // 驳回原因弹窗
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ReviewAssignment | null>(null);
  const [rejectForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  // 获取专家列表
  const experts = personnel['project_expert'] || [];

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingData, assignmentData, statsData] = await Promise.all([
        reviewAssignmentService.getPendingSubmissions(projectId),
        reviewAssignmentService.getReviewAssignments(projectId),
        reviewAssignmentService.getReviewStats(projectId),
      ]);
      setPendingSubmissions(pendingData);
      setAssignments(assignmentData);
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      // 初始化默认统计
      setStats({
        total: 0,
        unassigned: 0,
        pending: 0,
        completed: 0,
        approved: 0,
        rejected: 0,
        byReviewer: [],
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤待分配的填报记录（只显示未分配的）
  const unassignedSubmissions = pendingSubmissions.filter(
    s => s.assignmentStatus === 'unassigned'
  );

  // 过滤已分配的审核任务
  const filteredAssignments = assignments.filter(a => {
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchKeyword = !keyword ||
      a.submitterName?.includes(keyword) ||
      a.submitterOrg?.includes(keyword) ||
      a.reviewerName?.includes(keyword);
    return matchStatus && matchKeyword;
  });

  // 获取选中的待分配记录
  const selectedPendingSubmissions = unassignedSubmissions.filter(
    s => selectedPendingIds.includes(s.submissionId)
  );

  // 打开分配弹窗
  const handleOpenAssignModal = () => {
    if (selectedPendingIds.length === 0) {
      message.warning('请先选择要分配的填报记录');
      return;
    }
    if (experts.length === 0) {
      message.warning('暂无评审专家，请先在"人员配置"中添加');
      return;
    }
    setAssignModalVisible(true);
  };

  // 分配成功回调
  const handleAssignSuccess = () => {
    setAssignModalVisible(false);
    setSelectedPendingIds([]);
    loadData();
  };

  // 打开审核范围配置弹窗
  const handleOpenScopeModal = (reviewer: Personnel) => {
    setSelectedReviewer(reviewer);
    setScopeModalVisible(true);
  };

  // 范围配置成功回调
  const handleScopeSuccess = () => {
    setScopeModalVisible(false);
    setSelectedReviewer(null);
    loadData();
  };

  // 批准审核
  const handleApprove = async (assignment: ReviewAssignment) => {
    Modal.confirm({
      title: '确认批准',
      content: `确定批准 "${assignment.submitterName || '未知'}" 的填报记录吗？`,
      okText: '批准',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await reviewAssignmentService.submitReview(assignment.id, {
            result: 'approved',
            comment: '',
          });
          message.success('批准成功');
          loadData();
        } catch (error) {
          message.error('批准失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 打开驳回弹窗
  const handleOpenReject = (assignment: ReviewAssignment) => {
    setSelectedAssignment(assignment);
    rejectForm.resetFields();
    setRejectModalVisible(true);
  };

  // 驳回审核
  const handleReject = async (values: { reason: string }) => {
    if (!selectedAssignment) return;

    setActionLoading(true);
    try {
      await reviewAssignmentService.submitReview(selectedAssignment.id, {
        result: 'rejected',
        comment: values.reason,
      });
      message.success('驳回成功');
      setRejectModalVisible(false);
      loadData();
    } catch (error) {
      message.error('驳回失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 取消分配
  const handleCancelAssignment = (assignment: ReviewAssignment) => {
    Modal.confirm({
      title: '确认取消分配',
      content: `确定取消 "${assignment.reviewerName}" 对该填报记录的审核任务吗？`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await reviewAssignmentService.cancelAssignment(projectId, assignment.id);
          message.success('取消分配成功');
          loadData();
        } catch (error) {
          message.error('取消分配失败');
        }
      },
    });
  };

  // 待分配表格列
  const pendingColumns: ColumnsType<PendingSubmission> = [
    {
      title: '采集工具',
      key: 'tool',
      render: (_, record) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>{record.toolName || '未知工具'}</span>
        </Space>
      ),
    },
    {
      title: '填报人',
      key: 'submitter',
      width: 150,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.submitterName || '未知'}</span>
        </Space>
      ),
    },
    {
      title: '填报单位',
      dataIndex: 'submitterOrg',
      key: 'submitterOrg',
      ellipsis: true,
      render: (org) => org || '-',
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
  ];

  // 已分配表格列
  const assignmentColumns: ColumnsType<ReviewAssignment> = [
    {
      title: '采集工具',
      key: 'tool',
      render: (_, record) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>{record.toolName || '未知工具'}</span>
        </Space>
      ),
    },
    {
      title: '填报人',
      key: 'submitter',
      width: 120,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.submitterName || '未知'}</span>
        </Space>
      ),
    },
    {
      title: '填报单位',
      dataIndex: 'submitterOrg',
      key: 'submitterOrg',
      ellipsis: true,
      width: 150,
      render: (org) => org || '-',
    },
    {
      title: '审核专家',
      key: 'reviewer',
      width: 120,
      render: (_, record) => (
        <Tag icon={<UserOutlined />} color="blue">
          {record.reviewerName || '未知'}
        </Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.status === 'completed') {
          if (record.reviewResult === 'approved') {
            return <Tag color="success" icon={<CheckCircleOutlined />}>已通过</Tag>;
          } else {
            return <Tag color="error" icon={<CloseCircleOutlined />}>已驳回</Tag>;
          }
        }
        return <Tag color="processing" icon={<ClockCircleOutlined />}>待审核</Tag>;
      },
    },
    {
      title: '分配时间',
      dataIndex: 'assignedAt',
      key: 'assignedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && !disabled && (
            <>
              <Tooltip title="批准">
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ color: '#52c41a' }}
                  onClick={() => handleApprove(record)}
                />
              </Tooltip>
              <Tooltip title="驳回">
                <Button
                  type="link"
                  size="small"
                  icon={<CloseCircleOutlined />}
                  danger
                  onClick={() => handleOpenReject(record)}
                />
              </Tooltip>
              <Tooltip title="取消分配">
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => handleCancelAssignment(record)}
                >
                  取消
                </Button>
              </Tooltip>
            </>
          )}
          {record.status === 'completed' && record.reviewComment && (
            <Tooltip title={`审核意见: ${record.reviewComment}`}>
              <Button type="link" size="small" icon={<EyeOutlined />} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 项目未到评审阶段
  if (projectStatus === '配置中') {
    return (
      <div className={styles.expertReviewTab}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="项目尚在配置中，暂无评审数据"
        >
          <p style={{ color: '#999' }}>请先完成项目配置并启动填报后再进行评审</p>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.expertReviewTab}>
      {/* 统计卡片 */}
      {stats && (
        <Card className={styles.statsCard} size="small">
          <Row gutter={24}>
            <Col span={4}>
              <Statistic
                title="待分配"
                value={stats.unassigned}
                suffix="条"
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="待审核"
                value={stats.pending}
                suffix="条"
                valueStyle={{ color: '#1890ff' }}
                prefix={<Badge status="processing" />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="已通过"
                value={stats.approved}
                suffix="条"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="已驳回"
                value={stats.rejected}
                suffix="条"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="专家数"
                value={experts.length}
                suffix="人"
                prefix={<TeamOutlined />}
              />
            </Col>
            <Col span={4}>
              <div className={styles.progressCard}>
                <span className={styles.progressLabel}>审核完成度</span>
                <Progress
                  percent={
                    stats.total > 0
                      ? Math.round((stats.completed / stats.total) * 100)
                      : 0
                  }
                  status={stats.pending > 0 ? 'active' : 'success'}
                  size="small"
                />
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 专家列表 */}
      {experts.length > 0 && (
        <Card
          title={
            <Space>
              <TeamOutlined />
              评审专家
            </Space>
          }
          size="small"
          className={styles.expertListCard}
          extra={
            <span style={{ color: '#999', fontSize: 12 }}>
              点击「配置范围」可设置专家的审核范围
            </span>
          }
        >
          <List
            grid={{ gutter: 16, column: 4 }}
            dataSource={experts}
            renderItem={(expert) => {
              const reviewerStats = stats?.byReviewer.find(r => r.reviewerId === expert.id);
              return (
                <List.Item>
                  <Card size="small" hoverable>
                    <Card.Meta
                      avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                      title={expert.name}
                      description={expert.organization}
                    />
                    <div style={{ marginTop: 12 }}>
                      <Space split={<Divider type="vertical" />}>
                        <span>
                          待审: <strong>{reviewerStats?.pending || 0}</strong>
                        </span>
                        <span>
                          已完成: <strong>{reviewerStats?.completed || 0}</strong>
                        </span>
                      </Space>
                    </div>
                    {!disabled && (
                      <Button
                        type="link"
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={() => handleOpenScopeModal(expert)}
                        style={{ marginTop: 8, padding: 0 }}
                      >
                        配置范围
                      </Button>
                    )}
                  </Card>
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {/* 提示信息 */}
      {experts.length === 0 && (
        <div className={styles.warningTip}>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          暂无评审专家，请先在"人员配置"中添加评审专家
        </div>
      )}

      {/* 任务分配标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'pending',
            label: (
              <Space>
                待分配
                <Badge count={unassignedSubmissions.length} style={{ backgroundColor: '#faad14' }} />
              </Space>
            ),
            children: (
              <>
                {/* 筛选和操作栏 */}
                <div className={styles.filterBar}>
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                      刷新
                    </Button>
                  </Space>
                  <Space>
                    {!disabled && selectedPendingIds.length > 0 && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenAssignModal}
                      >
                        分配给专家 ({selectedPendingIds.length})
                      </Button>
                    )}
                  </Space>
                </div>

                <Spin spinning={loading}>
                  {unassignedSubmissions.length > 0 ? (
                    <Table
                      rowKey="submissionId"
                      columns={pendingColumns}
                      dataSource={unassignedSubmissions}
                      pagination={{
                        total: unassignedSubmissions.length,
                        pageSize: 10,
                        showTotal: (total) => `共 ${total} 条待分配`,
                        showSizeChanger: true,
                      }}
                      rowSelection={!disabled ? {
                        type: 'checkbox',
                        selectedRowKeys: selectedPendingIds,
                        onChange: (keys) => setSelectedPendingIds(keys as string[]),
                      } : undefined}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无待分配的填报记录"
                    />
                  )}
                </Spin>
              </>
            ),
          },
          {
            key: 'assigned',
            label: (
              <Space>
                已分配
                <Badge count={assignments.length} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            ),
            children: (
              <>
                {/* 筛选和操作栏 */}
                <div className={styles.filterBar}>
                  <Space>
                    <Select
                      placeholder="状态筛选"
                      style={{ width: 120 }}
                      allowClear
                      value={statusFilter || undefined}
                      onChange={setStatusFilter}
                    >
                      <Select.Option value="pending">待审核</Select.Option>
                      <Select.Option value="completed">已完成</Select.Option>
                    </Select>
                    <Input
                      placeholder="搜索填报人/专家"
                      prefix={<SearchOutlined />}
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      style={{ width: 200 }}
                      allowClear
                    />
                  </Space>
                  <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                    刷新
                  </Button>
                </div>

                <Spin spinning={loading}>
                  {filteredAssignments.length > 0 ? (
                    <Table
                      rowKey="id"
                      columns={assignmentColumns}
                      dataSource={filteredAssignments}
                      pagination={{
                        total: filteredAssignments.length,
                        pageSize: 10,
                        showTotal: (total) => `共 ${total} 条记录`,
                        showSizeChanger: true,
                      }}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        statusFilter || keyword
                          ? '没有符合条件的记录'
                          : '暂无已分配的审核任务'
                      }
                    />
                  )}
                </Spin>
              </>
            ),
          },
        ]}
      />

      {/* 手动分配弹窗 */}
      <ManualAssignModal
        visible={assignModalVisible}
        projectId={projectId}
        selectedSubmissions={selectedPendingSubmissions}
        experts={experts}
        onClose={() => setAssignModalVisible(false)}
        onSuccess={handleAssignSuccess}
      />

      {/* 审核范围配置弹窗 */}
      <ReviewerScopeModal
        visible={scopeModalVisible}
        projectId={projectId}
        reviewer={selectedReviewer}
        onClose={() => {
          setScopeModalVisible(false);
          setSelectedReviewer(null);
        }}
        onSuccess={handleScopeSuccess}
      />

      {/* 驳回原因弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            驳回填报
          </Space>
        }
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
        width={480}
      >
        <p style={{ marginBottom: 16 }}>
          驳回 <strong>{selectedAssignment?.submitterName}</strong> 的填报记录，请填写驳回原因：
        </p>
        <Form form={rejectForm} onFinish={handleReject} layout="vertical">
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea
              placeholder="请输入驳回原因，填报人将收到此反馈"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setRejectModalVisible(false)}>取消</Button>
            <Button type="primary" danger htmlType="submit" loading={actionLoading}>
              确认驳回
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertReviewTab;
