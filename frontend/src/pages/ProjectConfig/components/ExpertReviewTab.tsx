/**
 * 专家评审 Tab 组件
 * 配置评审规则和查看评审统计
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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as submissionService from '../../../services/submissionService';
import type { Submission, SubmissionStats } from '../../../services/submissionService';
import styles from '../index.module.css';

interface ExpertReviewTabProps {
  projectId: string;
  projectStatus: string;
}

const ExpertReviewTab: React.FC<ExpertReviewTabProps> = ({
  projectId,
  projectStatus,
}) => {
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<SubmissionStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  // 批量审核相关状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchReviewModalVisible, setBatchReviewModalVisible] = useState(false);
  const [batchRejectModalVisible, setBatchRejectModalVisible] = useState(false);
  const [batchRejectForm] = Form.useForm();

  // 加载填报记录和统计
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [submissionData, statsData] = await Promise.all([
        submissionService.getProjectSubmissions(projectId),
        submissionService.getProjectStats(projectId),
      ]);
      setSubmissions(submissionData);
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤数据
  const filteredSubmissions = submissions.filter(s => {
    const matchStatus = !statusFilter || s.status === statusFilter;
    const matchKeyword = !keyword ||
      s.submitterName?.includes(keyword) ||
      s.submitterOrg?.includes(keyword);
    return matchStatus && matchKeyword;
  });

  // 批准填报
  const handleApprove = async (submission: Submission) => {
    Modal.confirm({
      title: '确认批准',
      content: `确定批准 "${submission.submitterName || '未知'}" 的填报记录吗？`,
      okText: '批准',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await submissionService.approveSubmission(submission.id);
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
  const handleOpenReject = (submission: Submission) => {
    setSelectedSubmission(submission);
    rejectForm.resetFields();
    setRejectModalVisible(true);
  };

  // 驳回填报
  const handleReject = async (values: { reason: string }) => {
    if (!selectedSubmission) return;

    setActionLoading(true);
    try {
      await submissionService.rejectSubmission(selectedSubmission.id, values.reason);
      message.success('驳回成功');
      setRejectModalVisible(false);
      loadData();
    } catch (error) {
      message.error('驳回失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 查看详情
  const handleViewDetail = (submission: Submission) => {
    window.open(`/data-entry/${submission.id}`, '_blank');
  };

  // 获取待审核的选中记录
  const selectedSubmittedRecords = submissions.filter(
    s => selectedRowKeys.includes(s.id) && s.status === 'submitted'
  );

  // 批量批准
  const handleBatchApprove = async () => {
    if (selectedSubmittedRecords.length === 0) {
      message.warning('请选择待审核的记录');
      return;
    }

    setActionLoading(true);
    try {
      await Promise.all(
        selectedSubmittedRecords.map(s => submissionService.approveSubmission(s.id))
      );
      message.success(`成功批准 ${selectedSubmittedRecords.length} 条记录`);
      setBatchReviewModalVisible(false);
      setSelectedRowKeys([]);
      loadData();
    } catch (error) {
      message.error('批量批准失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 批量驳回
  const handleBatchReject = async (values: { reason: string }) => {
    if (selectedSubmittedRecords.length === 0) {
      message.warning('请选择待审核的记录');
      return;
    }

    setActionLoading(true);
    try {
      await Promise.all(
        selectedSubmittedRecords.map(s => submissionService.rejectSubmission(s.id, values.reason))
      );
      message.success(`成功驳回 ${selectedSubmittedRecords.length} 条记录`);
      setBatchRejectModalVisible(false);
      setSelectedRowKeys([]);
      batchRejectForm.resetFields();
      loadData();
    } catch (error) {
      message.error('批量驳回失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 打开批量审核弹窗
  const handleOpenBatchReview = () => {
    if (selectedSubmittedRecords.length === 0) {
      message.warning('请先选择待审核的记录');
      return;
    }
    setBatchReviewModalVisible(true);
  };

  // 状态配置
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    draft: { color: 'default', icon: <EditOutlined />, text: '草稿' },
    submitted: { color: 'processing', icon: <ClockCircleOutlined />, text: '待审核' },
    approved: { color: 'success', icon: <CheckCircleOutlined />, text: '已通过' },
    rejected: { color: 'error', icon: <CloseCircleOutlined />, text: '已驳回' },
  };

  // 表格列定义
  const columns: ColumnsType<Submission> = [
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
      title: '表单',
      dataIndex: 'formName',
      key: 'formName',
      ellipsis: true,
      render: (name) => (
        <Space>
          <FileTextOutlined />
          <span>{name || '未知表单'}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusConfig[status] || statusConfig.draft;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '驳回原因',
      dataIndex: 'rejectReason',
      key: 'rejectReason',
      ellipsis: true,
      render: (reason, record) =>
        record.status === 'rejected' && reason ? (
          <Tooltip title={reason}>
            <span style={{ color: '#ff4d4f' }}>{reason}</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'submitted' && (
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
            </>
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
                title="总填报数"
                value={stats.total}
                suffix="份"
                prefix={<FileTextOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="草稿"
                value={stats.draft}
                suffix="份"
                valueStyle={{ color: '#999' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="待审核"
                value={stats.submitted}
                suffix="份"
                valueStyle={{ color: '#1890ff' }}
                prefix={<Badge status="processing" />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="已通过"
                value={stats.approved}
                suffix="份"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="已驳回"
                value={stats.rejected}
                suffix="份"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={4}>
              <div className={styles.progressCard}>
                <span className={styles.progressLabel}>审核完成度</span>
                <Progress
                  percent={
                    stats.total > 0
                      ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100)
                      : 0
                  }
                  status={stats.submitted > 0 ? 'active' : 'success'}
                  size="small"
                />
              </div>
            </Col>
          </Row>
        </Card>
      )}

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
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="submitted">待审核</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="rejected">已驳回</Select.Option>
          </Select>
          <Input
            placeholder="搜索填报人/单位"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<TeamOutlined />}
              onClick={handleOpenBatchReview}
            >
              批量审核 ({selectedSubmittedRecords.length})
            </Button>
          )}
        </Space>
      </div>

      {/* 填报记录表格 */}
      <Spin spinning={loading}>
        {filteredSubmissions.length > 0 ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredSubmissions}
            pagination={{
              total: filteredSubmissions.length,
              pageSize: 10,
              showTotal: (total) => `共 ${total} 条记录`,
              showSizeChanger: true,
            }}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as string[]),
              getCheckboxProps: (record) => ({
                disabled: record.status !== 'submitted',
              }),
            }}
            className={styles.submissionTable}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              statusFilter || keyword
                ? '没有符合条件的填报记录'
                : '暂无填报记录'
            }
          />
        )}
      </Spin>

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
          驳回 <strong>{selectedSubmission?.submitterName}</strong> 的填报记录，请填写驳回原因：
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

      {/* 批量审核弹窗 */}
      <Modal
        title={
          <Space>
            <TeamOutlined style={{ color: '#1890ff' }} />
            批量审核
          </Space>
        }
        open={batchReviewModalVisible}
        onCancel={() => setBatchReviewModalVisible(false)}
        footer={null}
        width={500}
      >
        <p style={{ marginBottom: 16 }}>
          已选择 <strong>{selectedSubmittedRecords.length}</strong> 条待审核记录，请选择操作：
        </p>
        <div className={styles.batchReviewList}>
          {selectedSubmittedRecords.slice(0, 5).map(s => (
            <div key={s.id} className={styles.batchReviewItem}>
              <UserOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              <span>{s.submitterName || '未知'}</span>
              <span style={{ color: '#999', marginLeft: 8 }}>({s.submitterOrg || '-'})</span>
              <span style={{ color: '#666', marginLeft: 'auto' }}>{s.formName}</span>
            </div>
          ))}
          {selectedSubmittedRecords.length > 5 && (
            <div className={styles.batchReviewMore}>
              ... 等共 {selectedSubmittedRecords.length} 条记录
            </div>
          )}
        </div>
        <Divider />
        <div className={styles.batchReviewActions}>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleBatchApprove}
            loading={actionLoading}
            style={{ marginRight: 12 }}
          >
            全部批准
          </Button>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setBatchReviewModalVisible(false);
              batchRejectForm.resetFields();
              setBatchRejectModalVisible(true);
            }}
          >
            全部驳回
          </Button>
          <Button
            onClick={() => setBatchReviewModalVisible(false)}
            style={{ marginLeft: 'auto' }}
          >
            取消
          </Button>
        </div>
      </Modal>

      {/* 批量驳回原因弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            批量驳回
          </Space>
        }
        open={batchRejectModalVisible}
        onCancel={() => setBatchRejectModalVisible(false)}
        footer={null}
        width={480}
      >
        <p style={{ marginBottom: 16 }}>
          即将驳回 <strong>{selectedSubmittedRecords.length}</strong> 条记录，请填写统一驳回原因：
        </p>
        <Form form={batchRejectForm} onFinish={handleBatchReject} layout="vertical">
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea
              placeholder="请输入驳回原因，所有选中的填报人将收到此反馈"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setBatchRejectModalVisible(false)}>取消</Button>
            <Button type="primary" danger htmlType="submit" loading={actionLoading}>
              确认批量驳回
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertReviewTab;
