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
  Radio,
  TreeSelect,
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
  ApartmentOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as taskService from '../../../services/taskService';
import * as projectToolService from '../../../services/projectToolService';
import * as sampleService from '../../../services/sampleService';
import type { Task, TaskStats, TaskStatus } from '../../../services/taskService';
import type { ProjectTool } from '../../../services/projectToolService';
import type { Sample } from '../../../services/sampleService';
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
  const [samples, setSamples] = useState<Sample[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [toolFilter, setToolFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignForm] = Form.useForm();
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<'all' | 'district' | 'school'>('all');

  // 获取数据采集员列表（支持新旧角色）
  const collectors = [
    ...(personnel['data_collector'] || []),
    ...(personnel['district_reporter'] || []),
    ...(personnel['school_reporter'] || []),
  ];

  // 获取区县列表
  const districts = samples.filter(s => s.type === 'district');

  // 构建区县-学校树形结构（用于TreeSelect）
  const buildSchoolTree = useCallback(() => {
    const tree: any[] = [];
    districts.forEach(district => {
      const schools = samples.filter(s => s.type === 'school' && s.parentId === district.id);
      tree.push({
        value: district.id,
        title: district.name,
        icon: <ApartmentOutlined />,
        selectable: false,
        children: schools.map(school => ({
          value: school.id,
          title: school.name,
          icon: <BankOutlined />,
        })),
      });
    });
    // 添加没有区县的学校
    const orphanSchools = samples.filter(s => s.type === 'school' && !s.parentId);
    if (orphanSchools.length > 0) {
      tree.push({
        value: 'no-district',
        title: '未分配区县',
        selectable: false,
        children: orphanSchools.map(school => ({
          value: school.id,
          title: school.name,
          icon: <BankOutlined />,
        })),
      });
    }
    return tree;
  }, [districts, samples]);

  // 加载任务和统计数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, statsData, toolData, sampleData] = await Promise.all([
        taskService.getProjectTasks(projectId),
        taskService.getTaskStats(projectId),
        projectToolService.getProjectTools(projectId),
        sampleService.getSampleList(projectId).catch(() => []),
      ]);
      setTasks(taskData);
      setStats(statsData);
      setTools(toolData);
      setSamples(sampleData);
    } catch (error) {
      console.error('加载数据失败:', error);
      // 如果API还没实现，使用模拟数据
      setStats({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        rejected: 0,
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

  // 获取所有学校的ID列表
  const allSchoolIds = samples.filter(s => s.type === 'school').map(s => s.id);

  // 当选择工具时，检查采集对象是否包含"学校"
  const handleToolChange = (toolId: string) => {
    const selectedTool = tools.find(t => t.toolId === toolId);
    if (selectedTool?.toolTarget?.includes('学校')) {
      // 如果采集对象包含学校，自动设置为指定学校模式，并选中所有学校
      setTargetType('school');
      assignForm.setFieldsValue({
        toolId,
        targetIds: allSchoolIds
      });
    } else {
      // 否则重置为全部模式
      setTargetType('all');
      assignForm.setFieldsValue({
        toolId,
        targetIds: undefined
      });
    }
  };

  // 打开分配任务弹窗
  const handleOpenAssignModal = () => {
    assignForm.resetFields();
    setTargetType('all');
    setAssignModalVisible(true);
  };

  // 分配任务
  const handleAssignTasks = async (values: any) => {
    if (!values.toolId || !values.assigneeIds?.length) {
      message.warning('请选择工具和采集员');
      return;
    }

    // 如果选择了区县或学校模式，必须选择目标
    if (targetType !== 'all' && (!values.targetIds || values.targetIds.length === 0)) {
      message.warning(targetType === 'district' ? '请选择区县' : '请选择学校');
      return;
    }

    setAssignLoading(true);
    try {
      // 根据目标类型，为每个目标创建任务
      if (targetType === 'all') {
        // 全部模式：只创建一个任务（不指定具体目标）
        await taskService.batchCreateTasks({
          projectId,
          toolId: values.toolId,
          assigneeIds: values.assigneeIds,
          dueDate: values.dueDate?.format('YYYY-MM-DD'),
        });
      } else {
        // 区县/学校模式：为每个目标创建任务
        const targetIds = values.targetIds;
        for (const targetId of targetIds) {
          for (const assigneeId of values.assigneeIds) {
            await taskService.createTask({
              projectId,
              toolId: values.toolId,
              assigneeId,
              targetType,
              targetId,
              dueDate: values.dueDate?.format('YYYY-MM-DD'),
            });
          }
        }
      }
      message.success('任务分配成功');
      setAssignModalVisible(false);
      loadData();
    } catch (error) {
      message.error('任务分配失败');
    } finally {
      setAssignLoading(false);
    }
  };

  // 获取目标名称
  const getTargetName = (task: Task) => {
    if (!task.targetType || !task.targetId) return null;
    const sample = samples.find(s => s.id === task.targetId);
    return sample?.name || task.targetId;
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
      width: 120,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.assigneeName || '未知'}</span>
        </Space>
      ),
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
      title: '填报范围',
      key: 'target',
      width: 400,
      render: (_, record) => {
        const targetName = getTargetName(record);
        if (!targetName) {
          return <Tag>全部</Tag>;
        }
        const icon = record.targetType === 'district' ? <ApartmentOutlined /> : <BankOutlined />;
        const color = record.targetType === 'district' ? 'blue' : 'green';
        const typeText = record.targetType === 'district' ? '区县' : '学校';
        return (
          <Tooltip title={`${typeText}: ${targetName}`}>
            <Tag icon={icon} color={color}>{targetName}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '所属单位',
      dataIndex: 'assigneeOrg',
      key: 'assigneeOrg',
      ellipsis: true,
      width: 150,
      render: (org) => org || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
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
      width: 110,
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
      width: 150,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
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
        width={640}
      >
        <p className={styles.modalSubtitle}>
          选择采集工具、填报范围和填报账号。
        </p>
        <Form form={assignForm} onFinish={handleAssignTasks} layout="vertical">
          <Form.Item
            name="toolId"
            label="采集工具"
            rules={[{ required: true, message: '请选择采集工具' }]}
          >
            <Select placeholder="请选择要分配的采集工具" onChange={handleToolChange}>
              {tools.map(tool => (
                <Select.Option key={tool.toolId} value={tool.toolId}>
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    {tool.toolName}
                    {tool.toolType && <Tag className={styles.toolTypeTag}>{tool.toolType}</Tag>}
                    {tool.toolTarget && <Tag color="cyan">{tool.toolTarget}</Tag>}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* 填报范围类型 */}
          <Form.Item
            label="填报范围"
            extra="选择任务的填报范围类型"
          >
            <Radio.Group
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                assignForm.setFieldsValue({ targetIds: undefined });
              }}
            >
              <Radio.Button value="all">
                全部（按采集员权限）
              </Radio.Button>
              <Radio.Button value="district">
                指定区县
              </Radio.Button>
              <Radio.Button value="school">
                指定学校
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* 区县选择 */}
          {targetType === 'district' && (
            <Form.Item
              name="targetIds"
              label="选择区县"
              rules={[{ required: true, message: '请选择区县' }]}
            >
              <Select
                mode="multiple"
                placeholder="请选择区县（可多选）"
                optionFilterProp="children"
                maxTagCount={3}
              >
                {districts.map(d => (
                  <Select.Option key={d.id} value={d.id}>
                    <Space>
                      <ApartmentOutlined style={{ color: '#1890ff' }} />
                      {d.name}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 学校选择 */}
          {targetType === 'school' && (
            <Form.Item
              name="targetIds"
              label="选择学校"
              rules={[{ required: true, message: '请选择学校' }]}
            >
              <TreeSelect
                multiple
                treeData={buildSchoolTree()}
                placeholder="请选择学校（可多选）"
                treeIcon
                showSearch
                treeNodeFilterProp="title"
                maxTagCount={3}
                style={{ width: '100%' }}
                allowClear
              />
            </Form.Item>
          )}

          <Form.Item
            name="assigneeIds"
            label="填报账号"
            rules={[{ required: true, message: '请选择填报账号' }]}
            extra={targetType === 'all' ? '采集员将根据其关联的区县确定可填报范围' : '指定的填报账号将负责所选范围的数据填报'}
          >
            <Select
              mode="multiple"
              placeholder="请选择填报账号（可多选）"
              optionFilterProp="children"
              maxTagCount={3}
            >
              {collectors.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  <Space>
                    <UserOutlined />
                    {p.name}
                    {p.districtName && (
                      <Tag color="blue" style={{ marginLeft: 4 }}>{p.districtName}</Tag>
                    )}
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
