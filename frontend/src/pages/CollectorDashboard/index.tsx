/**
 * 数据采集员工作台
 * 显示采集员的任务列表和填报入口
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import * as taskService from '../../services/taskService';
import type { Task, TaskStatus } from '../../services/taskService';
import styles from './index.module.css';

const CollectorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  // 采集员/学校填报员可能绑定多个范围：优先使用右上角选择的 currentScope；
  // 如果只有一个 school/district scope，则自动选中，避免“看起来重复”的多范围任务混在一起。
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

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskService.getMyTasks(
        resolvedScope ? { scopeType: resolvedScope.type, scopeId: resolvedScope.id } : undefined
      );
      setTasks(data);
    } catch (error) {
      console.error('加载任务失败:', error);
      // 模拟数据用于开发
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedScope]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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
      // 跳转到填报页面
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

  return (
    <div className={styles.collectorDashboard}>
      {/* 欢迎区域 */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          欢迎，{user?.username || '采集员'}
        </h1>
        <p className={styles.welcomeSubtitle}>
          您有 <strong>{stats.pending + stats.inProgress}</strong> 个待完成的填报任务
        </p>
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

      {/* 任务列表 */}
      <Card
        title={
          <Space>
            <FormOutlined />
            我的填报任务
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
    </div>
  );
};

export default CollectorDashboard;
