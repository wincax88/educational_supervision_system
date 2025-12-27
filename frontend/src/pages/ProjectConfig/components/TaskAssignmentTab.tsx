/**
 * 任务分配 Tab 组件
 * 管理项目的数据采集任务分配
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Alert,
  Checkbox,
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
  CheckCircleOutlined,
  CloseCircleOutlined,
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

// 工具范围类型
type ToolScope = '区县' | '学校' | '教师' | '学生' | '家长' | '其他';

// 评估对象选项（带采集员信息）
interface AssessmentTarget {
  id: string;
  name: string;
  type: 'district' | 'school';
  collectorId?: string;
  collectorName?: string;
  collectorPhone?: string;
  districtName?: string;  // 仅学校有
}

interface TaskAssignmentTabProps {
  projectId: string;
  projectStatus: string;
  personnel: Record<string, Personnel[]>;
  disabled?: boolean;
  // 新增：评估对象数据
  submissionDistricts?: Array<{
    id: string;
    name: string;
    collectorId?: string;
    collectorName?: string;
    collectorPhone?: string;
    schools: Array<{
      id: string;
      name: string;
      collectorId?: string;
      collectorName?: string;
      collectorPhone?: string;
    }>;
  }>;
}

const TaskAssignmentTab: React.FC<TaskAssignmentTabProps> = ({
  projectId,
  projectStatus,
  personnel,
  disabled = false,
  submissionDistricts = [],
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

  // 新增状态：当前选择的工具范围和评估对象
  const [currentToolScope, setCurrentToolScope] = useState<ToolScope | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>('');  // 当前选中的工具ID

  // 获取数据采集员列表（支持新旧角色）
  const collectors = useMemo(() => [
    ...(personnel['data_collector'] || []),
    ...(personnel['district_reporter'] || []),
    ...(personnel['school_reporter'] || []),
  ], [personnel]);

  // 获取区县列表
  const districts = samples.filter(s => s.type === 'district');

  // ==================== 前提条件检查 ====================

  // 检查是否有评估对象
  const hasAssessmentObjects = useMemo(() => {
    return submissionDistricts.length > 0 ||
           submissionDistricts.some(d => d.schools.length > 0);
  }, [submissionDistricts]);

  // 检查是否有已关联采集员的评估对象
  const assessmentObjectsWithCollector = useMemo(() => {
    const districtsWithCollector: AssessmentTarget[] = [];
    const schoolsWithCollector: AssessmentTarget[] = [];

    submissionDistricts.forEach(district => {
      // 区县级采集员
      if (district.collectorId) {
        districtsWithCollector.push({
          id: district.id,
          name: district.name,
          type: 'district',
          collectorId: district.collectorId,
          collectorName: district.collectorName,
          collectorPhone: district.collectorPhone,
        });
      }

      // 学校级采集员
      district.schools.forEach(school => {
        if (school.collectorId) {
          schoolsWithCollector.push({
            id: school.id,
            name: school.name,
            type: 'school',
            collectorId: school.collectorId,
            collectorName: school.collectorName,
            collectorPhone: school.collectorPhone,
            districtName: district.name,
          });
        }
      });
    });

    return {
      districts: districtsWithCollector,
      schools: schoolsWithCollector,
      hasAny: districtsWithCollector.length > 0 || schoolsWithCollector.length > 0,
    };
  }, [submissionDistricts]);

  // 前提条件是否满足
  const canAssignTasks = useMemo(() => {
    return hasAssessmentObjects &&
           assessmentObjectsWithCollector.hasAny &&
           tools.length > 0;
  }, [hasAssessmentObjects, assessmentObjectsWithCollector, tools]);

  // 前提条件不满足的原因
  const assignDisabledReason = useMemo(() => {
    const reasons: string[] = [];
    if (!hasAssessmentObjects) {
      reasons.push('评估对象未创建');
    }
    if (!assessmentObjectsWithCollector.hasAny) {
      reasons.push('填报账号未关联评估对象');
    }
    if (tools.length === 0) {
      reasons.push('采集工具未配置');
    }
    return reasons;
  }, [hasAssessmentObjects, assessmentObjectsWithCollector, tools]);

  // ==================== 根据工具范围获取可选的评估对象 ====================

  const getAvailableTargets = useCallback((scope: ToolScope | null): AssessmentTarget[] => {
    if (!scope) return [];

    switch (scope) {
      case '区县':
        // 区县工具只显示有区县采集员的区县
        return assessmentObjectsWithCollector.districts;
      case '学校':
      case '教师':
      case '学生':
      case '家长':
      case '其他':
        // 学校及以下级别的工具，显示有学校采集员的学校
        return assessmentObjectsWithCollector.schools;
      default:
        return [];
    }
  }, [assessmentObjectsWithCollector]);

  // 当前可选的评估对象列表
  const availableTargets = useMemo(() => {
    return getAvailableTargets(currentToolScope);
  }, [currentToolScope, getAvailableTargets]);

  // ==================== 根据选中的评估对象获取可用的填报账号 ====================

  // 从评估对象中直接提取采集员信息（而不是从 personnel 中查找）
  const availableCollectors = useMemo(() => {
    // 构建采集员信息（直接从评估对象中获取）
    const collectorMap = new Map<string, { id: string; name: string; phone?: string }>();

    const targets = selectedTargetIds.length > 0
      ? availableTargets.filter(t => selectedTargetIds.includes(t.id))
      : [...assessmentObjectsWithCollector.districts, ...assessmentObjectsWithCollector.schools];

    targets.forEach(target => {
      if (target.collectorId && target.collectorName) {
        collectorMap.set(target.collectorId, {
          id: target.collectorId,
          name: target.collectorName,
          phone: target.collectorPhone,
        });
      }
    });

    return Array.from(collectorMap.values());
  }, [selectedTargetIds, availableTargets, assessmentObjectsWithCollector]);

  // ==================== 获取当前工具已分配的评估对象 ====================

  // 当前选中工具已分配任务的目标 ID 集合
  const assignedTargetIds = useMemo(() => {
    if (!selectedToolId) return new Set<string>();

    // 筛选出当前工具的所有任务的目标 ID
    const targetIds = tasks
      .filter(task => task.toolId === selectedToolId && task.targetId)
      .map(task => task.targetId as string);

    return new Set(targetIds);
  }, [tasks, selectedToolId]);

  // 当前可选（未分配）的评估对象数量
  const unassignedTargetsCount = useMemo(() => {
    return availableTargets.filter(t => !assignedTargetIds.has(t.id)).length;
  }, [availableTargets, assignedTargetIds]);

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

  // 解析工具范围类型
  const parseToolScope = (toolTarget: string | undefined): ToolScope | null => {
    if (!toolTarget) return null;
    const scopes: ToolScope[] = ['区县', '学校', '教师', '学生', '家长', '其他'];
    return scopes.find(scope => toolTarget.includes(scope)) || null;
  };

  // 当选择工具时，更新工具范围并重置选择
  const handleToolChange = (toolId: string) => {
    const selectedTool = tools.find(t => t.toolId === toolId);
    const scope = parseToolScope(selectedTool?.toolTarget);
    setCurrentToolScope(scope);
    setSelectedTargetIds([]);
    setSelectedToolId(toolId);  // 保存当前选中的工具ID

    // 重置表单
    assignForm.setFieldsValue({
      toolId,
    });
  };

  // 当选择评估对象时更新状态（排除已分配的）
  const handleTargetChange = (targetIds: string[]) => {
    // 过滤掉已分配的目标（防止通过其他方式选中）
    const validTargetIds = targetIds.filter(id => !assignedTargetIds.has(id));
    setSelectedTargetIds(validTargetIds);
  };

  // 打开分配任务弹窗
  const handleOpenAssignModal = () => {
    assignForm.resetFields();
    setSelectedToolId('');  // 重置选中的工具ID
    setCurrentToolScope(null);
    setSelectedTargetIds([]);
    setAssignModalVisible(true);
  };

  // 分配任务
  const handleAssignTasks = async (values: any) => {
    if (!values.toolId) {
      message.warning('请选择采集工具');
      return;
    }

    // 使用 selectedTargetIds 状态而不是 values.targetIds（因为 Form.Item 无法正确绑定自定义结构）
    if (selectedTargetIds.length === 0) {
      message.warning('请选择评估对象');
      return;
    }

    setAssignLoading(true);
    try {
      // 确定目标类型
      const targetType = currentToolScope === '区县' ? 'district' : 'school';

      // 为每个选中的评估对象创建任务（直接使用该对象关联的采集员）
      let createdCount = 0;
      const skippedTargets: string[] = [];

      for (const targetId of selectedTargetIds) {
        // 找到该目标对应的采集员
        const target = availableTargets.find(t => t.id === targetId);
        if (target?.collectorId) {
          // 直接使用评估对象关联的采集员，无需再验证
          await taskService.createTask({
            projectId,
            toolId: values.toolId,
            assigneeId: target.collectorId,
            targetType,
            targetId,
            dueDate: values.dueDate?.format('YYYY-MM-DD'),
          });
          createdCount++;
        } else {
          skippedTargets.push(target?.name || targetId);
        }
      }

      if (createdCount > 0) {
        message.success(`成功分配 ${createdCount} 个任务`);
        if (skippedTargets.length > 0) {
          message.warning(`跳过 ${skippedTargets.length} 个无采集员的评估对象`);
        }
        setAssignModalVisible(false);
        loadData();
      } else {
        message.warning('没有创建任务，所选评估对象均无关联采集员');
      }
    } catch (error) {
      console.error('任务分配失败:', error);
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
      width: 180,
      ellipsis: true,
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
            <Tag
              icon={icon}
              color={color}
              style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {targetName}
            </Tag>
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
            <Tooltip
              title={!canAssignTasks ? assignDisabledReason.join('、') : undefined}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenAssignModal}
                disabled={!canAssignTasks}
              >
                分配任务
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* 前提条件检查提示 */}
      {!canAssignTasks && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="分配任务前需满足以下条件"
          description={
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical" size={4}>
                <div>
                  {hasAssessmentObjects ? (
                    <Space><CheckCircleOutlined style={{ color: '#52c41a' }} /> 评估对象已创建</Space>
                  ) : (
                    <Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 评估对象未创建（请先在"评估对象"中添加区县和学校）</Space>
                  )}
                </div>
                <div>
                  {assessmentObjectsWithCollector.hasAny ? (
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      填报账号已关联
                      <Tag color="blue">{assessmentObjectsWithCollector.districts.length} 个区县</Tag>
                      <Tag color="green">{assessmentObjectsWithCollector.schools.length} 所学校</Tag>
                    </Space>
                  ) : (
                    <Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 填报账号未关联（请先在"填报账号"中为评估对象设置数据采集员）</Space>
                  )}
                </div>
                <div>
                  {tools.length > 0 ? (
                    <Space><CheckCircleOutlined style={{ color: '#52c41a' }} /> 采集工具已配置（{tools.length}个）</Space>
                  ) : (
                    <Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 采集工具未配置（请先在"采集工具"中添加工具）</Space>
                  )}
                </div>
              </Space>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
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
            {!disabled && canAssignTasks && (
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
        width={700}
        destroyOnClose
      >
        <p className={styles.modalSubtitle}>
          选择采集工具后，根据工具范围自动确定可选的评估对象和填报账号。
        </p>
        <Form form={assignForm} onFinish={handleAssignTasks} layout="vertical">
          {/* 第一步：选择采集工具 */}
          <Form.Item
            name="toolId"
            label={
              <Space>
                <span>1. 选择采集工具</span>
                {currentToolScope && (
                  <Tag color="blue">范围：{currentToolScope}</Tag>
                )}
              </Space>
            }
            rules={[{ required: true, message: '请选择采集工具' }]}
          >
            <Select
              placeholder="请选择要分配的采集工具"
              onChange={handleToolChange}
              showSearch
              optionFilterProp="children"
            >
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

          {/* 第二步：选择评估对象（根据工具范围显示） */}
          {currentToolScope && (
            <Form.Item
              label={
                <Space>
                  <span>2. 选择评估对象</span>
                  <Tag color="green">{unassignedTargetsCount} 个可选</Tag>
                  {assignedTargetIds.size > 0 && (
                    <Tag color="default">{assignedTargetIds.size} 个已分配</Tag>
                  )}
                  {selectedTargetIds.length > 0 && (
                    <Tag color="blue">已选 {selectedTargetIds.length} 个</Tag>
                  )}
                </Space>
              }
              required
              extra={
                availableTargets.length === 0
                  ? `暂无已配置采集员的${currentToolScope === '区县' ? '区县' : '学校'}，请先在"填报账号"中设置数据采集员`
                  : unassignedTargetsCount === 0
                    ? `所有${currentToolScope === '区县' ? '区县' : '学校'}均已分配任务`
                    : `仅显示已配置数据采集员的${currentToolScope === '区县' ? '区县' : '学校'}，已分配的显示为灰色`
              }
            >
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
                {availableTargets.length > 0 ? (
                  <>
                    {/* 全选功能 - 放在 Checkbox.Group 外部避免事件冲突 */}
                    {unassignedTargetsCount > 0 && (
                      <Checkbox
                        checked={selectedTargetIds.length === unassignedTargetsCount && unassignedTargetsCount > 0}
                        indeterminate={selectedTargetIds.length > 0 && selectedTargetIds.length < unassignedTargetsCount}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            // 只选择未分配的目标
                            const unassignedIds = availableTargets
                              .filter(t => !assignedTargetIds.has(t.id))
                              .map(t => t.id);
                            handleTargetChange(unassignedIds);
                          } else {
                            handleTargetChange([]);
                          }
                        }}
                        style={{ fontWeight: 'bold', marginBottom: 8, display: 'block' }}
                      >
                        全选未分配（{unassignedTargetsCount}）
                      </Checkbox>
                    )}
                    {/* 评估对象列表 */}
                    <Checkbox.Group
                      style={{ width: '100%' }}
                      value={selectedTargetIds}
                      onChange={(values) => handleTargetChange(values as string[])}
                    >
                      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {availableTargets.map(target => {
                            const isAssigned = assignedTargetIds.has(target.id);
                            return (
                              <Checkbox
                                key={target.id}
                                value={target.id}
                                disabled={isAssigned}
                                style={{ marginLeft: 0, width: '100%', opacity: isAssigned ? 0.6 : 1 }}
                              >
                                <Space>
                                  {target.type === 'district' ? (
                                    <ApartmentOutlined style={{ color: isAssigned ? '#999' : '#1890ff' }} />
                                  ) : (
                                    <BankOutlined style={{ color: isAssigned ? '#999' : '#52c41a' }} />
                                  )}
                                  <span style={{ color: isAssigned ? '#999' : 'inherit' }}>{target.name}</span>
                                  {target.districtName && (
                                    <Tag style={{ fontSize: 11 }}>{target.districtName}</Tag>
                                  )}
                                  {isAssigned ? (
                                    <Tag color="default" style={{ fontSize: 11 }}>已分配</Tag>
                                  ) : (
                                    <span style={{ color: '#999', fontSize: 12 }}>
                                      采集员：{target.collectorName}
                                    </span>
                                  )}
                                </Space>
                              </Checkbox>
                            );
                          })}
                        </Space>
                      </div>
                    </Checkbox.Group>
                  </>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={`暂无已配置采集员的${currentToolScope === '区县' ? '区县' : '学校'}`}
                  />
                )}
              </div>
            </Form.Item>
          )}

          {/* 第三步：确认填报账号（只读展示） */}
          {currentToolScope && selectedTargetIds.length > 0 && (
            <Form.Item
              label={
                <Space>
                  <span>3. 将分配给以下采集员</span>
                  <Tag color="orange">{availableCollectors.length} 人</Tag>
                </Space>
              }
              extra="任务将自动分配给所选评估对象关联的数据采集员"
            >
              <div style={{
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                padding: 8,
                background: '#fafafa'
              }}>
                <Space wrap>
                  {availableCollectors.map(p => (
                    <Tag key={p.id} icon={<UserOutlined />} color="blue">
                      {p.name}
                      {p.phone && <span style={{ marginLeft: 4, opacity: 0.7 }}>({p.phone})</span>}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Form.Item>
          )}

          {/* 第四步：设置截止日期（可选） */}
          <Form.Item
            name="dueDate"
            label="4. 截止日期（可选）"
            extra="设置任务的截止日期，逾期任务会标记为已逾期"
          >
            <DatePicker
              placeholder="选择截止日期"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setAssignModalVisible(false)}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={assignLoading}
              disabled={!currentToolScope || selectedTargetIds.length === 0}
            >
              确认分配
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskAssignmentTab;
