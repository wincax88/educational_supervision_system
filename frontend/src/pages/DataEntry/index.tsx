import React, { useState, useEffect } from 'react';
import { Button, Tag, Select, Table, message, Card, Statistic, Row, Col } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getProjects, getSubmissions, Project, Submission } from '../../services/submissionService';
import { getTools, DataTool } from '../../services/toolService';
import styles from './index.module.css';

const DataEntry: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tools, setTools] = useState<DataTool[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadSubmissions(selectedProject);
    }
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, toolsData] = await Promise.all([
        getProjects({ status: '填报中' }),
        getTools({ status: 'published' }),
      ]);
      setProjects(projectsData);
      setTools(toolsData);

      // 默认选择第一个项目
      if (projectsData.length > 0) {
        setSelectedProject(projectsData[0].id);
      }
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (projectId: string) => {
    try {
      const data = await getSubmissions({ projectId });
      setSubmissions(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'draft':
        return <Tag icon={<EditOutlined />} color="default">草稿</Tag>;
      case 'submitted':
        return <Tag icon={<ClockCircleOutlined />} color="processing">待审核</Tag>;
      case 'approved':
        return <Tag icon={<CheckCircleOutlined />} color="success">已通过</Tag>;
      case 'rejected':
        return <Tag icon={<CloseCircleOutlined />} color="error">已驳回</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const getStats = () => {
    const stats = {
      total: submissions.length,
      draft: submissions.filter(s => s.status === 'draft').length,
      submitted: submissions.filter(s => s.status === 'submitted').length,
      approved: submissions.filter(s => s.status === 'approved').length,
      rejected: submissions.filter(s => s.status === 'rejected').length,
    };
    return stats;
  };

  const filteredSubmissions = statusFilter === 'all'
    ? submissions
    : submissions.filter(s => s.status === statusFilter);

  const handleStartEntry = (tool: DataTool) => {
    if (!selectedProject) {
      message.warning('请先选择一个项目');
      return;
    }
    navigate(`/home/balanced/entry/${selectedProject}/form/${tool.id}`);
  };

  const handleViewSubmission = (submission: Submission) => {
    navigate(`/home/balanced/entry/${submission.projectId}/form/${submission.formId}?submissionId=${submission.id}`);
  };

  const columns = [
    {
      title: '表单名称',
      dataIndex: 'formName',
      key: 'formName',
      render: (text: string) => <span className={styles.formName}>{text}</span>,
    },
    {
      title: '填报单位',
      dataIndex: 'submitterOrg',
      key: 'submitterOrg',
    },
    {
      title: '填报人',
      dataIndex: 'submitterName',
      key: 'submitterName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (text: string) => text?.split('T')[0],
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Submission) => (
        <div className={styles.actionButtons}>
          {record.status === 'draft' ? (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleViewSubmission(record)}
            >
              继续填报
            </Button>
          ) : (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewSubmission(record)}
            >
              查看
            </Button>
          )}
        </div>
      ),
    },
  ];

  const stats = getStats();

  return (
    <div className={styles.dataEntryPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate('/home/balanced')}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>数据填报</h1>
        </div>
      </div>

      {/* 项目选择 */}
      <div className={styles.projectSelector}>
        <span className={styles.selectorLabel}>当前项目：</span>
        <Select
          value={selectedProject}
          onChange={setSelectedProject}
          style={{ width: 400 }}
          placeholder="选择填报项目"
        >
          {projects.map(project => (
            <Select.Option key={project.id} value={project.id}>
              {project.name}
            </Select.Option>
          ))}
        </Select>
        {projects.length === 0 && (
          <span className={styles.noProjectHint}>暂无进行中的填报项目</span>
        )}
      </div>

      {selectedProject && (
        <>
          {/* 统计卡片 */}
          <Row gutter={16} className={styles.statsRow}>
            <Col span={4}>
              <Card>
                <Statistic title="总填报数" value={stats.total} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="草稿" value={stats.draft} valueStyle={{ color: '#999' }} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="待审核" value={stats.submitted} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="已驳回" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} />
              </Card>
            </Col>
          </Row>

          {/* 填报工具列表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>
                <FileTextOutlined /> 开始填报
              </h3>
            </div>
            <div className={styles.toolCards}>
              {tools.map(tool => (
                <div key={tool.id} className={styles.toolCard}>
                  <div className={styles.toolInfo}>
                    <h4>{tool.name}</h4>
                    <p>{tool.description}</p>
                    <div className={styles.toolMeta}>
                      <Tag>{tool.type}</Tag>
                      <Tag color="cyan">填报对象: {tool.target}</Tag>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleStartEntry(tool)}
                  >
                    开始填报
                  </Button>
                </div>
              ))}
              {tools.length === 0 && (
                <div className={styles.emptyTools}>
                  <p>暂无可用的填报工具</p>
                </div>
              )}
            </div>
          </div>

          {/* 填报记录列表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>
                <EditOutlined /> 填报记录
              </h3>
              <div className={styles.filterActions}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 120 }}
                >
                  <Select.Option value="all">全部状态</Select.Option>
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="submitted">待审核</Select.Option>
                  <Select.Option value="approved">已通过</Select.Option>
                  <Select.Option value="rejected">已驳回</Select.Option>
                </Select>
              </div>
            </div>
            <Table
              dataSource={filteredSubmissions}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '暂无填报记录' }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DataEntry;
