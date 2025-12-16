/**
 * 任务分配 Tab 组件
 * 管理项目的数据采集任务分配
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
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as taskService from '../../../services/taskService';
import * as projectToolService from '../../../services/projectToolService';
import type { Task, TaskStats, TaskStatus } from '../../../services/taskService';
import type { ProjectTool } from '../../../services/projectToolService';
import type { Personnel } from '../types';
import styles from '../index.module.css';

interface TaskAssignmentTabProps {
  projectId: string;
  projectStatus: string;
  personnel: Record<string, Personnel[]>;
  disabled?: boolean;
}

const TaskAssignmentTab: React.FC<TaskAssignmentTabProps> = ({
  projectId,
  projectStatus,
  personnel,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [tools, setTools] = useState<ProjectTool[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [toolFilter, setToolFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignForm] = Form.useForm();
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // 获取数据采集员列表
  const collectors = personnel['data_collector'] || [];

  // 加载任务和统计数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, statsData, toolData] = await Promise.all([
        taskService.getProjectTasks(projectId),
        taskService.getTaskStats(projectId),
        projectToolService.getProjectTools(projectId),
      ]);
      setTasks(taskData);
      setStats(statsData);
      setTools(toolData);
    } catch (error) {
      console.error('加载数据失败:', error);
      // 如果API还没实现，使用模拟数据
      setStats({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        completionRate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤数据
  const filteredTasks = tasks.filter(t => {
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchTool = !toolFilter || t.toolId === toolFilter;
    const matchKeyword = !keyword ||
      t.assigneeName?.includes(keyword) ||
      t.assigneeOrg?.includes(keyword) ||
      t.toolName?.includes(keyword);
    return matchStatus && matchTool && matchKeyword;
  });

  // 打开分配任务弹窗
  const handleOpenAssignModal = () => {
    assignForm.resetFields();
    setAssignModalVisible(true);
  };

  // 分配任务
  const handleAssignTasks = async (values: any) => {
    if (!values.toolId || !values.assigneeIds?.length) {
      message.warning('请选择工具和采集员');
      return;
    }

    setAssignLoading(true);
    try {
      await taskService.batchCreateTasks({
        projectId,
        toolId: values.toolId,
        assigneeIds: values.assigneeIds,
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
      });
      message.success('任务分配成功');
      setAssignModalVisible(false);
      loadData();
    } catch (error) {
      message.error('任务分配失败');
    } finally {
      setAssignLoading(false);
    }
  };

  // 删除任务
  const handleDeleteTask = (task: Task) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分配给 "${task.assigneeName}" 的 "${task.toolName}" 任务吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await taskService.deleteTask(task.id);
          message.success('删除成功');
          loadData();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 批量删除任务
  const handleBatchDelete = () => {
    if (selectedTaskIds.length === 0) {
      message.warning('请选择要删除的任务');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedTaskIds.length} 个任务吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await taskService.batchDeleteTasks(selectedTaskIds);
          message.success('批量删除成功');
          setSelectedTaskIds([]);
          loadData();
        } catch (error) {
          message.error('批量删除失败');
        }
      },
    });
  };

  // 状态配置
  const statusConfig = taskService.taskStatusConfig;

  // 表格列定义
  const columns: ColumnsType<Task> = [
    {
      title: '采集员',
      key: 'assignee',
      width: 150,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.assigneeName || '未知'}</span>
        </Space>
      ),
    },
    {
      title: '所属单位',
      dataIndex: 'assigneeOrg',
      key: 'assigneeOrg',
      ellipsis: true,
      render: (org) => org || '-',
    },
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TaskStatus) => {
        const config = statusConfig[status] || statusConfig.pending;
        return (
          <Badge status={config.color as any} text={config.text} />
        );
      },
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date) => date ? (
        <Space>
          <CalendarOutlined />
          {new Date(date).toLocaleDateString('zh-CN')}
        </Space>
      ) : '-',
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          {!disabled && record.status === 'pending' && (
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={() => handleDeleteTask(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 项目未到填报阶段
  if (projectStatus === '配置中') {
    return (
      <div className={styles.taskAssignmentTab}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="项目尚在配置中，暂无任务分配"
        >
          <p style={{ color: '#999' }}>请先完成项目配置并启动填报后再分配任务</p>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.taskAssignmentTab}>
      {/* 统计卡片 */}
      {stats && (
        <Card className={styles.statsCard} size="small">
          <Row gutter={24}>
            <Col span={4}>
              <Statistic
                title="总任务数"
                value={stats.total}
                suffix="个"
                prefix={<FileTextOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="待开始"
                value={stats.pending}
                suffix="个"
                valueStyle={{ color: '#999' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="进行中"
                value={stats.inProgress}
                suffix="个"
                valueStyle={{ color: '#1890ff' }}
                prefix={<Badge status="processing" />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="已完成"
                value={stats.completed}
                suffix="个"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="已逾期"
                value={stats.overdue}
                suffix="个"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={4}>
              <div className={styles.progressCard}>
                <span className={styles.progressLabel}>完成率</span>
                <Progress
                  percent={stats.completionRate}
                  status={stats.completionRate === 100 ? 'success' : 'active'}
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
            <Select.Option value="pending">待开始</Select.Option>
            <Select.Option value="in_progress">进行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="overdue">已逾期</Select.Option>
          </Select>
          <Select
            placeholder="工具筛选"
            style={{ width: 180 }}
            allowClear
            value={toolFilter || undefined}
            onChange={setToolFilter}
          >
            {tools.map(tool => (
              <Select.Option key={tool.toolId} value={tool.toolId}>
                {tool.toolName}
              </Select.Option>
            ))}
          </Select>
          <Input
            placeholder="搜索采集员/单位"
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
          {!disabled && selectedTaskIds.length > 0 && (
            <Button danger onClick={handleBatchDelete}>
              批量删除 ({selectedTaskIds.length})
            </Button>
          )}
          {!disabled && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenAssignModal}
              disabled={collectors.length === 0 || tools.length === 0}
            >
              分配任务
            </Button>
          )}
        </Space>
      </div>

      {/* 提示信息 */}
      {collectors.length === 0 && (
        <div className={styles.warningTip}>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          暂无数据采集员，请先在"人员配置"中添加数据采集员
        </div>
      )}

      {/* 任务列表 */}
      <Spin spinning={loading}>
        {filteredTasks.length > 0 ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredTasks}
            pagination={{
              total: filteredTasks.length,
              pageSize: 10,
              showTotal: (total) => `共 ${total} 条记录`,
              showSizeChanger: true,
            }}
            rowSelection={!disabled ? {
              type: 'checkbox',
              selectedRowKeys: selectedTaskIds,
              onChange: (keys) => setSelectedTaskIds(keys as string[]),
              getCheckboxProps: (record) => ({
                disabled: record.status !== 'pending',
              }),
            } : undefined}
            className={styles.taskTable}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              statusFilter || toolFilter || keyword
                ? '没有符合条件的任务'
                : '暂无任务分配'
            }
          >
            {!disabled && collectors.length > 0 && tools.length > 0 && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAssignModal}>
                分配任务
              </Button>
            )}
          </Empty>
        )}
      </Spin>

      {/* 分配任务弹窗 */}
      <Modal
        title={
          <Space>
            <TeamOutlined style={{ color: '#1890ff' }} />
            分配采集任务
          </Space>
        }
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        footer={null}
        width={560}
      >
        <p className={styles.modalSubtitle}>
          选择采集工具和采集员，为他们分配数据采集任务
        </p>
        <Form form={assignForm} onFinish={handleAssignTasks} layout="vertical">
          <Form.Item
            name="toolId"
            label="采集工具"
            rules={[{ required: true, message: '请选择采集工具' }]}
          >
            <Select placeholder="请选择要分配的采集工具">
              {tools.map(tool => (
                <Select.Option key={tool.toolId} value={tool.toolId}>
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    {tool.toolName}
                    {tool.toolType && <Tag className={styles.toolTypeTag}>{tool.toolType}</Tag>}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="assigneeIds"
            label="数据采集员"
            rules={[{ required: true, message: '请选择数据采集员' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择数据采集员（可多选）"
              optionFilterProp="children"
              maxTagCount={3}
            >
              {collectors.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  <Space>
                    <UserOutlined />
                    {p.name}
                    <span style={{ color: '#999' }}>({p.organization})</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="dueDate"
            label="截止日期"
            extra="可选，设置任务的截止日期"
          >
            <DatePicker
              placeholder="选择截止日期"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setAssignModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={assignLoading}>
              确认分配
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskAssignmentTab;
