/**
 * 数据采集员工作台
 * 显示项目列表，点击进入填报任务列表
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Tooltip,
  List,
} from 'antd';
import {
  FormOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import * as taskService from '../../services/taskService';
import type { Task, TaskStatus, MyProject } from '../../services/taskService';
import { getSchoolCompliance, SchoolCompliance } from '../../services/schoolService';
import styles from './index.module.css';

const CollectorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // 当前视图: 'projects' 或 'tasks'
  const [currentView, setCurrentView] = useState<'projects' | 'tasks'>('projects');
  const [selectedProject, setSelectedProject] = useState<MyProject | null>(null);

  // 项目列表状态
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projects, setProjects] = useState<MyProject[]>([]);

  // 任务列表状态
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  // 达标情况状态
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceData, setComplianceData] = useState<SchoolCompliance | null>(null);

  // 采集员/学校填报员可能绑定多个范围
  const resolvedScope = useMemo(() => {
    if (!user) return null;
    if (user.currentScope) return user.currentScope;
    const scopes = Array.isArray(user.scopes) ? user.scopes : [];
    const schoolScopes = scopes.filter((s) => s.type === 'school');
    if (schoolScopes.length === 1) return schoolScopes[0];
    const districtScopes = scopes.filter((s) => s.type === 'district');
    if (districtScopes.length === 1) return districtScopes[0];
    return null;
  }, [user]);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await taskService.getMyProjects(
        resolvedScope ? { scopeType: resolvedScope.type, scopeId: resolvedScope.id } : undefined
      );
      setProjects(data);
    } catch (error) {
      console.error('加载项目失败:', error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [resolvedScope]);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const data = await taskService.getMyTasks(
        resolvedScope
          ? { projectId: selectedProject.id, scopeType: resolvedScope.type, scopeId: resolvedScope.id }
          : { projectId: selectedProject.id }
      );
      setTasks(data);
    } catch (error) {
      console.error('加载任务失败:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedScope, selectedProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (currentView === 'tasks' && selectedProject) {
      loadTasks();
    }
  }, [currentView, selectedProject, loadTasks]);

  // 加载达标情况（当有学校scope和任务时）
  const loadCompliance = useCallback(async () => {
    if (!resolvedScope || resolvedScope.type !== 'school' || !selectedProject) {
      setComplianceData(null);
      return;
    }

    setComplianceLoading(true);
    try {
      const data = await getSchoolCompliance(resolvedScope.id, selectedProject.id);
      setComplianceData(data);
    } catch (error) {
      console.error('加载达标情况失败:', error);
      setComplianceData(null);
    } finally {
      setComplianceLoading(false);
    }
  }, [resolvedScope, selectedProject]);

  useEffect(() => {
    if (currentView === 'tasks' && tasks.length > 0) {
      loadCompliance();
    }
  }, [currentView, tasks, loadCompliance]);

  // 进入项目填报
  const handleEnterProject = (project: MyProject) => {
    setSelectedProject(project);
    setCurrentView('tasks');
    setStatusFilter('');
    setKeyword('');
  };

  // 返回项目列表
  const handleBackToProjects = () => {
    setCurrentView('projects');
    setSelectedProject(null);
    setTasks([]);
    setComplianceData(null);
  };

  // 计算统计数据
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  };

  const completionRate = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  // 过滤任务
  const filteredTasks = tasks.filter(t => {
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchKeyword = !keyword ||
      t.toolName?.includes(keyword) ||
      t.targetName?.includes(keyword);
    return matchStatus && matchKeyword;
  });

  // 开始填报
  const handleStartTask = async (task: Task) => {
    try {
      if (task.status === 'pending') {
        await taskService.startTask(task.id);
      }
      navigate(`/home/balanced/entry/${task.projectId}/form/${task.toolId}`);
    } catch (error) {
      message.error('启动任务失败');
    }
  };

  // 状态配置
  const statusConfig = taskService.taskStatusConfig;

  // 表格列定义
  const columns: ColumnsType<Task> = [
    {
      title: '采集工具',
      key: 'tool',
      render: (_, record) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{record.toolName || '未知工具'}</span>
        </Space>
      ),
    },
    {
      title: '填报对象',
      dataIndex: 'targetName',
      key: 'targetName',
      render: (name, record) => name || taskService.targetTypeConfig[record.targetType || 'all'] || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TaskStatus) => {
        const config = statusConfig[status] || statusConfig.pending;
        return <Badge status={config.color as any} text={config.text} />;
      },
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date) => {
        if (!date) return '-';
        const dueDate = new Date(date);
        const now = new Date();
        const isOverdue = dueDate < now;
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
            {dueDate.toLocaleDateString('zh-CN')}
          </span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (record.status === 'completed') {
          return (
            <Button type="link" size="small" onClick={() => handleStartTask(record)}>
              查看
            </Button>
          );
        }
        return (
          <Button
            type="primary"
            size="small"
            icon={<FormOutlined />}
            onClick={() => handleStartTask(record)}
          >
            {record.status === 'pending' ? '开始填报' : '继续填报'}
          </Button>
        );
      },
    },
  ];

  // 项目列表视图
  const renderProjectList = () => {
    // 计算项目总体统计
    const projectStats = {
      total: projects.length,
      totalTasks: projects.reduce((sum, p) => sum + (Number(p.totalTasks) || 0), 0),
      completedTasks: projects.reduce((sum, p) => sum + (Number(p.completedTasks) || 0), 0),
    };
    const overallCompletionRate = projectStats.totalTasks > 0
      ? Math.round((projectStats.completedTasks / projectStats.totalTasks) * 100)
      : 0;

    return (
      <>
        {/* 欢迎区域 */}
        <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>
            欢迎，{user?.username || '采集员'}
          </h1>
          <p className={styles.welcomeSubtitle}>
            您有 <strong>{projects.length}</strong> 个待填报的评估项目
          </p>
        </div>

        {/* 统计卡片 */}
        <Row gutter={16} className={styles.statsRow}>
          <Col span={6}>
            <Card className={styles.statCard}>
              <Statistic
                title="参与项目"
                value={projectStats.total}
                prefix={<ProjectOutlined />}
                suffix="个"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statCard}>
              <Statistic
                title="总任务数"
                value={projectStats.totalTasks}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statCard}>
              <Statistic
                title="已完成"
                value={projectStats.completedTasks}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statCard}>
              <div className={styles.progressStat}>
                <span className={styles.progressLabel}>总完成率</span>
                <Progress
                  type="circle"
                  percent={overallCompletionRate}
                  width={60}
                  strokeColor={overallCompletionRate === 100 ? '#52c41a' : '#1890ff'}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* 项目列表 */}
        <Card
          title={
            <Space>
              <ProjectOutlined />
              评估项目列表
            </Space>
          }
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadProjects}>
              刷新
            </Button>
          }
          className={styles.taskCard}
        >
          <Spin spinning={projectsLoading}>
            {projects.length > 0 ? (
              <div className={styles.projectList}>
                {projects.map(project => {
                  const totalTasks = Number(project.totalTasks) || 0;
                  const completedTasks = Number(project.completedTasks) || 0;
                  const projectCompletionRate = totalTasks > 0
                    ? Math.round((completedTasks / totalTasks) * 100)
                    : 0;
                  const pendingTasks = totalTasks - completedTasks;

                  return (
                    <div key={project.id} className={styles.projectCard}>
                      <div className={styles.projectCardHeader}>
                        <div className={styles.projectMainInfo}>
                          <span className={styles.projectName}>{project.name}</span>
                          <Tag color={project.status === '填报中' ? 'processing' : 'default'}>
                            {project.status}
                          </Tag>
                          {project.indicatorSystemName && (
                            <Tag color="cyan">{project.indicatorSystemName}</Tag>
                          )}
                        </div>
                        <div className={styles.projectProgress}>
                          <Progress
                            percent={projectCompletionRate}
                            size="small"
                            style={{ width: 120 }}
                            strokeColor={projectCompletionRate === 100 ? '#52c41a' : '#1890ff'}
                          />
                        </div>
                      </div>
                      <p className={styles.projectDesc}>
                        {project.description || '暂无描述'}
                      </p>
                      <div className={styles.projectMeta}>
                        <span>时间: {project.startDate || '-'} ~ {project.endDate || '-'}</span>
                        <span style={{ marginLeft: 24 }}>
                          任务: {completedTasks}/{totalTasks} 已完成
                          {pendingTasks > 0 && (
                            <Tag color="warning" style={{ marginLeft: 8 }}>{pendingTasks} 待填报</Tag>
                          )}
                        </span>
                      </div>
                      <div className={styles.projectActions}>
                        <Button
                          type="primary"
                          icon={<FormOutlined />}
                          onClick={() => handleEnterProject(project)}
                        >
                          进入填报
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无评估项目"
              />
            )}
          </Spin>
        </Card>
      </>
    );
  };

  // 任务列表视图
  const renderTaskList = () => (
    <>
      {/* 返回按钮和项目名称 */}
      <div className={styles.taskListHeader}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToProjects}
          style={{ marginRight: 16 }}
        >
          返回项目列表
        </Button>
        <h2 className={styles.currentProjectName}>
          {selectedProject?.name}
          <Tag color="processing" style={{ marginLeft: 12 }}>{selectedProject?.status}</Tag>
        </h2>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={5}>
          <Card className={styles.statCard}>
            <Statistic
              title="总任务数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card className={styles.statCard}>
            <Statistic
              title="待开始"
              value={stats.pending}
              valueStyle={{ color: '#999' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card className={styles.statCard}>
            <Statistic
              title="进行中"
              value={stats.inProgress}
              valueStyle={{ color: '#1890ff' }}
              prefix={<Badge status="processing" />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card className={styles.statCard}>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <div className={styles.progressStat}>
              <span className={styles.progressLabel}>完成率</span>
              <Progress
                type="circle"
                percent={completionRate}
                width={60}
                strokeColor={completionRate === 100 ? '#52c41a' : '#1890ff'}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 达标情况展示（仅学校端显示） */}
      {resolvedScope?.type === 'school' && (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined />
              本校达标情况
              <Tooltip title="显示提交后的指标达标统计，暂存数据不计入">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
          className={styles.taskCard}
          style={{ marginBottom: 16 }}
          extra={
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={loadCompliance}
              loading={complianceLoading}
            >
              刷新
            </Button>
          }
        >
          <Spin spinning={complianceLoading}>
            {complianceData && complianceData.statistics ? (
              <div>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic
                      title="达标率"
                      value={complianceData.complianceRate ? parseFloat(complianceData.complianceRate) : 0}
                      suffix="%"
                      valueStyle={{
                        color: parseFloat(complianceData.complianceRate || '0') >= 80
                          ? '#52c41a'
                          : parseFloat(complianceData.complianceRate || '0') >= 60
                          ? '#faad14'
                          : '#ff4d4f'
                      }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="已评估指标"
                      value={complianceData.statistics.total}
                      suffix="项"
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="达标"
                      value={complianceData.statistics.compliant}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="未达标"
                      value={complianceData.statistics.nonCompliant}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Col>
                </Row>

                {/* 未达标指标列表 */}
                {complianceData.nonCompliantIndicators && complianceData.nonCompliantIndicators.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8, color: '#ff4d4f' }}>
                      <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                      未达标指标详情
                    </div>
                    <List
                      size="small"
                      bordered
                      dataSource={complianceData.nonCompliantIndicators}
                      renderItem={(item) => (
                        <List.Item>
                          <Space>
                            <Tag color="error">{item.code}</Tag>
                            <span>{item.name}</span>
                            <span style={{ color: '#999' }}>
                              (实际值: {item.value}, 阈值: {item.threshold})
                            </span>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                )}

                {/* 全部达标提示 */}
                {complianceData.statistics.total > 0 &&
                  complianceData.statistics.nonCompliant === 0 && (
                  <div style={{ textAlign: 'center', padding: 16, color: '#52c41a' }}>
                    <CheckCircleOutlined style={{ fontSize: 24, marginRight: 8 }} />
                    所有指标均已达标
                  </div>
                )}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无达标数据，请先提交填报内容"
              />
            )}
          </Spin>
        </Card>
      )}

      {/* 任务列表 */}
      <Card
        title={
          <Space>
            <FormOutlined />
            填报任务列表
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
              <Select.Option value="pending">待开始</Select.Option>
              <Select.Option value="in_progress">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="overdue">已逾期</Select.Option>
            </Select>
            <Input
              placeholder="搜索任务"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 180 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadTasks}>
              刷新
            </Button>
          </Space>
        }
        className={styles.taskCard}
      >
        <Spin spinning={loading}>
          {filteredTasks.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredTasks}
              pagination={{
                total: filteredTasks.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条任务`,
              }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                statusFilter || keyword
                  ? '没有符合条件的任务'
                  : '暂无填报任务'
              }
            />
          )}
        </Spin>
      </Card>

      {/* 快捷入口 - 逾期任务提醒 */}
      {stats.overdue > 0 && (
        <Card className={styles.alertCard}>
          <div className={styles.alertContent}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
            <div className={styles.alertText}>
              <h4>逾期任务提醒</h4>
              <p>您有 {stats.overdue} 个任务已逾期，请尽快完成</p>
            </div>
            <Button
              type="primary"
              danger
              onClick={() => setStatusFilter('overdue')}
            >
              查看逾期任务 <RightOutlined />
            </Button>
          </div>
        </Card>
      )}
    </>
  );

  return (
    <div className={styles.collectorDashboard}>
      {currentView === 'projects' ? renderProjectList() : renderTaskList()}
    </div>
  );
};

export default CollectorDashboard;
