import React, { useState, useEffect } from 'react';
import { Table, Tag, Select, Card, Row, Col, Statistic, Spin, Empty, Modal, Descriptions, Button, Space, Input, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { getDistrictSubmissions, DistrictSubmission } from '../../../services/districtService';
import { getDistrictSchools } from '../../../services/districtService';
import { getSubmission, approveSubmission, rejectSubmission } from '../../../services/submissionService';

interface SubmissionListProps {
  districtId: string;
  projectId: string;
}

interface School {
  id: string;
  name: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'default', icon: <EditOutlined />, label: '草稿' },
  submitted: { color: 'processing', icon: <ClockCircleOutlined />, label: '待审核' },
  approved: { color: 'success', icon: <CheckCircleOutlined />, label: '已通过' },
  rejected: { color: 'error', icon: <CloseCircleOutlined />, label: '已驳回' },
};

const SubmissionList: React.FC<SubmissionListProps> = ({ districtId, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [stats, setStats] = useState<{
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  } | null>(null);
  const [submissions, setSubmissions] = useState<DistrictSubmission[]>([]);

  // 填报详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState<{
    id: string;
    projectName?: string;
    formName?: string;
    schoolId?: string;
    submitterName?: string;
    submitterOrg?: string;
    status: string;
    data: Record<string, unknown>;
    schema?: Array<{ id: string; label: string; type: string }>;
    createdAt: string;
    submittedAt?: string;
    approvedAt?: string;
    rejectReason?: string;
  } | null>(null);

  // 驳回弹窗
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [currentRejectId, setCurrentRejectId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 加载学校列表
  useEffect(() => {
    if (!districtId) return;

    const loadSchools = async () => {
      try {
        const schoolList = await getDistrictSchools(districtId);
        setSchools(schoolList);
      } catch (error) {
        console.error('加载学校列表失败:', error);
      }
    };

    loadSchools();
  }, [districtId]);

  // 加载填报记录
  useEffect(() => {
    if (!districtId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await getDistrictSubmissions(districtId, projectId || undefined, {
          schoolId: selectedSchool || undefined,
          status: selectedStatus || undefined,
        });
        setStats(result.stats);
        setSubmissions(result.submissions);
      } catch (error) {
        console.error('加载填报记录失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId, selectedSchool, selectedStatus]);

  // 查看填报详情
  const handleViewDetail = async (submissionId: string) => {
    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const detail = await getSubmission(submissionId);
      setSubmissionDetail(detail);
    } catch (error) {
      console.error('加载填报详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 刷新数据
  const refreshData = async () => {
    setLoading(true);
    try {
      const result = await getDistrictSubmissions(districtId, projectId || undefined, {
        schoolId: selectedSchool || undefined,
        status: selectedStatus || undefined,
      });
      setStats(result.stats);
      setSubmissions(result.submissions);
    } catch (error) {
      console.error('加载填报记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 审核通过
  const handleApprove = (submissionId: string) => {
    Modal.confirm({
      title: '确认审核通过',
      icon: <ExclamationCircleOutlined />,
      content: '确定要审核通过该填报记录吗？',
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await approveSubmission(submissionId);
          message.success('审核通过成功');
          refreshData();
        } catch (error) {
          console.error('审核通过失败:', error);
          message.error('审核通过失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 打开驳回弹窗
  const handleOpenReject = (submissionId: string) => {
    setCurrentRejectId(submissionId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  // 确认驳回
  const handleConfirmReject = async () => {
    if (!currentRejectId) return;
    if (!rejectReason.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    setActionLoading(true);
    try {
      await rejectSubmission(currentRejectId, rejectReason);
      message.success('已驳回');
      setRejectModalVisible(false);
      setCurrentRejectId(null);
      setRejectReason('');
      refreshData();
    } catch (error) {
      console.error('驳回失败:', error);
      message.error('驳回失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 列定义
  const columns: ColumnsType<DistrictSubmission> = [
    {
      title: '学校',
      dataIndex: 'schoolName',
      key: 'schoolName',
      width: 180,
      fixed: 'left',
    },
    {
      title: '学校类型',
      dataIndex: 'schoolType',
      key: 'schoolType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === '小学' ? 'blue' : type === '初中' ? 'green' : 'orange'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '采集工具',
      dataIndex: 'formName',
      key: 'formName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '填报人',
      dataIndex: 'submitterName',
      key: 'submitterName',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status] || statusConfig.draft;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (time: string) => time?.replace('T', ' ').substring(0, 19) || '-',
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 170,
      render: (time: string | null) => (time ? time.replace('T', ' ').substring(0, 19) : '-'),
    },
    {
      title: '审核时间',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: 170,
      render: (time: string | null) => (time ? time.replace('T', ' ').substring(0, 19) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <a onClick={() => handleViewDetail(record.id)}>查看</a>
          {record.status === 'submitted' && (
            <>
              <a style={{ color: '#52c41a' }} onClick={() => handleApprove(record.id)}>
                通过
              </a>
              <a style={{ color: '#ff4d4f' }} onClick={() => handleOpenReject(record.id)}>
                驳回
              </a>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 递归提取所有可显示的字段
  const extractFields = (
    fields: Array<{ id: string; label: string; type: string; children?: unknown[]; unit?: string }>,
    data: Record<string, unknown>
  ): Array<{ key: string; label: string; children: React.ReactNode }> => {
    const result: Array<{ key: string; label: string; children: React.ReactNode }> = [];

    for (const field of fields) {
      // 跳过分组和分隔符类型
      if (field.type === 'group' || field.type === 'divider') {
        // 如果有 children，递归处理
        if (field.children && Array.isArray(field.children)) {
          result.push(...extractFields(field.children as typeof fields, data));
        }
        continue;
      }

      // 获取字段值
      const value = data[field.id];
      let displayValue: string;

      if (value === undefined || value === null || value === '') {
        displayValue = '-';
      } else if (typeof value === 'boolean') {
        displayValue = value ? '是' : '否';
      } else if (Array.isArray(value)) {
        displayValue = value.join(', ') || '-';
      } else {
        displayValue = String(value);
        // 添加单位
        if (field.unit && displayValue !== '-') {
          displayValue += ` ${field.unit}`;
        }
      }

      result.push({
        key: field.id,
        label: field.label,
        children: displayValue,
      });
    }

    return result;
  };

  // 渲染填报数据
  const renderFormData = () => {
    if (!submissionDetail?.data) {
      return <Empty description="暂无填报数据" />;
    }

    // 如果没有 schema，直接显示原始数据
    if (!submissionDetail.schema || submissionDetail.schema.length === 0) {
      const items = Object.entries(submissionDetail.data).map(([key, value]) => ({
        key,
        label: key,
        children: value !== null && value !== undefined ? String(value) : '-',
      }));

      if (items.length === 0) {
        return <Empty description="暂无填报数据" />;
      }

      return <Descriptions bordered column={2} items={items} />;
    }

    // 递归提取字段
    const items = extractFields(
      submissionDetail.schema as Array<{ id: string; label: string; type: string; children?: unknown[]; unit?: string }>,
      submissionDetail.data
    );

    if (items.length === 0) {
      return <Empty description="暂无填报数据" />;
    }

    return <Descriptions bordered column={2} items={items} />;
  };

  return (
    <div>
      {/* 筛选条件 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>选择学校：</span>
        <Select
          value={selectedSchool}
          onChange={setSelectedSchool}
          style={{ width: 200 }}
          allowClear
          placeholder="全部学校"
          showSearch
          optionFilterProp="label"
          options={schools.map((s) => ({ value: s.id, label: s.name }))}
        />
        <span style={{ marginLeft: 16 }}>填报状态：</span>
        <Select
          value={selectedStatus}
          onChange={setSelectedStatus}
          style={{ width: 120 }}
          allowClear
          placeholder="全部状态"
          options={[
            { value: 'draft', label: '草稿' },
            { value: 'submitted', label: '待审核' },
            { value: 'approved', label: '已通过' },
            { value: 'rejected', label: '已驳回' },
          ]}
        />
      </div>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="总填报数"
                value={stats.total}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="草稿"
                value={stats.draft}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="待审核"
                value={stats.submitted}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="已通过"
                value={stats.approved}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="已驳回"
                value={stats.rejected}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 填报记录列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : submissions.length > 0 ? (
        <Table
          columns={columns}
          dataSource={submissions}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条填报记录`,
          }}
        />
      ) : (
        <Empty description="暂无填报记录" />
      )}

      {/* 填报详情弹窗 */}
      <Modal
        title="填报详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSubmissionDetail(null);
        }}
        width={800}
        footer={
          submissionDetail?.status === 'submitted' ? [
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>,
            <Button
              key="reject"
              danger
              onClick={() => {
                setDetailModalVisible(false);
                handleOpenReject(submissionDetail.id);
              }}
            >
              驳回
            </Button>,
            <Button
              key="approve"
              type="primary"
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => {
                setDetailModalVisible(false);
                handleApprove(submissionDetail.id);
              }}
            >
              审核通过
            </Button>,
          ] : [
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>,
          ]
        }
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : submissionDetail ? (
          <div>
            {/* 基本信息 */}
            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="项目名称">{submissionDetail.projectName}</Descriptions.Item>
                <Descriptions.Item label="采集工具">{submissionDetail.formName}</Descriptions.Item>
                <Descriptions.Item label="填报人">{submissionDetail.submitterName || '-'}</Descriptions.Item>
                <Descriptions.Item label="填报单位">{submissionDetail.submitterOrg || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {(() => {
                    const config = statusConfig[submissionDetail.status] || statusConfig.draft;
                    return (
                      <Tag color={config.color} icon={config.icon}>
                        {config.label}
                      </Tag>
                    );
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {submissionDetail.createdAt?.replace('T', ' ').substring(0, 19) || '-'}
                </Descriptions.Item>
                {submissionDetail.submittedAt && (
                  <Descriptions.Item label="提交时间">
                    {submissionDetail.submittedAt.replace('T', ' ').substring(0, 19)}
                  </Descriptions.Item>
                )}
                {submissionDetail.approvedAt && (
                  <Descriptions.Item label="审核时间">
                    {submissionDetail.approvedAt.replace('T', ' ').substring(0, 19)}
                  </Descriptions.Item>
                )}
                {submissionDetail.rejectReason && (
                  <Descriptions.Item label="驳回原因" span={2}>
                    <span style={{ color: '#ff4d4f' }}>{submissionDetail.rejectReason}</span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* 填报数据 */}
            <Card title="填报数据" size="small">
              {renderFormData()}
            </Card>
          </div>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Modal>

      {/* 驳回原因弹窗 */}
      <Modal
        title="驳回填报"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          setCurrentRejectId(null);
          setRejectReason('');
        }}
        onOk={handleConfirmReject}
        confirmLoading={actionLoading}
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 8 }}>请输入驳回原因：</div>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入驳回原因，将反馈给填报人"
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
};

export default SubmissionList;
