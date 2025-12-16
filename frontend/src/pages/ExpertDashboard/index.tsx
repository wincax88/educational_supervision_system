/**
 * 专家评审工作台
 * 显示待评审的填报记录和评审入口
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  message,
  Badge,
  Progress,
  Input,
  Select,
  Modal,
  Form,
  Tooltip,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import * as submissionService from '../../services/submissionService';
import type { Submission } from '../../services/submissionService';
import styles from './index.module.css';

const ExpertDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [keyword, setKeyword] = useState('');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  // 加载待审核列表
  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await submissionService.getSubmissions({ status: 'submitted' });
      setSubmissions(data);
    } catch (error) {
      console.error('加载数据失败:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // 计算统计数据
  const stats = {
    total: submissions.length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

  // 过滤数据
  const filteredSubmissions = submissions.filter(s => {
    const matchStatus = !statusFilter || s.status === statusFilter;
    const matchKeyword = !keyword ||
      s.submitterName?.includes(keyword) ||
      s.submitterOrg?.includes(keyword) ||
      s.formName?.includes(keyword);
    return matchStatus && matchKeyword;
  });

  // 批准
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
          loadSubmissions();
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

  // 驳回
  const handleReject = async (values: { reason: string }) => {
    if (!selectedSubmission) return;

    setActionLoading(true);
    try {
      await submissionService.rejectSubmission(selectedSubmission.id, values.reason);
      message.success('驳回成功');
      setRejectModalVisible(false);
      loadSubmissions();
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

  // 状态配置
  const statusConfig: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    submitted: { color: 'processing', text: '待审核' },
    approved: { color: 'success', text: '已通过' },
    rejected: { color: 'error', text: '已驳回' },
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
        return <Tag color={config.color}>{config.text}</Tag>;
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
      title: '操作',
      key: 'action',
      width: 200,
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
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              >
                批准
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenReject(record)}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.expertDashboard}>
      {/* 欢迎区域 */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          欢迎，{user?.username || '专家'}
        </h1>
        <p className={styles.welcomeSubtitle}>
          您有 <strong>{stats.submitted}</strong> 个待审核的填报记录
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="待审核"
              value={stats.submitted}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="已通过"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="已驳回"
              value={stats.rejected}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <div className={styles.progressStat}>
              <span className={styles.progressLabel}>审核完成率</span>
              <Progress
                type="circle"
                percent={
                  stats.total > 0
                    ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100)
                    : 0
                }
                width={60}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 审核列表 */}
      <Card
        title={
          <Space>
            <AuditOutlined />
            待审核列表
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="状态筛选"
              style={{ width: 120 }}
              allowClear
              value={statusFilter || undefined}
              onChange={setStatusFilter}
            >
              <Select.Option value="submitted">待审核</Select.Option>
              <Select.Option value="approved">已通过</Select.Option>
              <Select.Option value="rejected">已驳回</Select.Option>
            </Select>
            <Input
              placeholder="搜索填报人/单位"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 180 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadSubmissions}>
              刷新
            </Button>
          </Space>
        }
        className={styles.reviewCard}
      >
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
              }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                statusFilter || keyword
                  ? '没有符合条件的记录'
                  : '暂无待审核记录'
              }
            />
          )}
        </Spin>
      </Card>

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
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setRejectModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit" loading={actionLoading}>
                确认驳回
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertDashboard;
