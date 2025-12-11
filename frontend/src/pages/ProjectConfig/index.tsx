/**
 * 项目配置页面
 * 管理项目基本信息、关联的采集工具和指标映射
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  message,
  Spin,
  Descriptions,
  Space,
  Tooltip,
  Empty,
  Switch,
  Form,
  Input,
  Select,
  DatePicker,
  Tabs,
  Progress,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  LinkOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import * as projectService from '../../services/projectService';
import * as projectToolService from '../../services/projectToolService';
import * as indicatorService from '../../services/indicatorService';
import type { Project, DataIndicatorMapping, IndicatorMappingSummary } from '../../services/projectService';
import type { ProjectTool, AvailableTool } from '../../services/projectToolService';
import type { IndicatorSystem } from '../../services/indicatorService';
import IndicatorTreeViewer from '../../components/IndicatorTreeViewer';
import styles from './index.module.css';

// Mock 数据导入
import {
  projects as mockProjects,
  projectTools as mockProjectTools,
  availableToolsByProject as mockAvailableTools,
  indicatorMappingSummaries as mockMappingSummaries,
  indicatorSystems as mockIndicatorSystems,
  toolSchemas as mockToolSchemas,
  ToolSchemaField,
} from '../../mock/data';

// ==================== Mock 模式开关 ====================
const USE_MOCK = true;

const ProjectConfig: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [tools, setTools] = useState<ProjectTool[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [indicatorSystems, setIndicatorSystems] = useState<IndicatorSystem[]>([]);
  const [mappingSummary, setMappingSummary] = useState<IndicatorMappingSummary | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [treeViewerVisible, setTreeViewerVisible] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [activeTab, setActiveTab] = useState('tools');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [form] = Form.useForm();

  // 映射弹窗相关状态
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [selectedDataIndicator, setSelectedDataIndicator] = useState<DataIndicatorMapping | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | undefined>(undefined);
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(undefined);
  const [toolFields, setToolFields] = useState<ToolSchemaField[]>([]);
  const [mappingSaving, setMappingSaving] = useState(false);

  // 加载项目信息
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      if (USE_MOCK) {
        // 使用 mock 数据
        const mockProject = mockProjects.find(p => p.id === projectId);
        if (mockProject) {
          setProject(mockProject as unknown as Project);
        } else {
          message.error('项目不存在');
        }
        return;
      }
      const data = await projectService.getById(projectId);
      setProject(data);
    } catch (error) {
      console.error('加载项目信息失败:', error);
      message.error('加载项目信息失败');
    }
  }, [projectId]);

  // 加载关联的工具
  const loadTools = useCallback(async () => {
    if (!projectId) return;
    try {
      if (USE_MOCK) {
        // 使用 mock 数据
        const tools = mockProjectTools[projectId] || [];
        setTools(tools as ProjectTool[]);
        return;
      }
      const data = await projectToolService.getProjectTools(projectId);
      setTools(data);
    } catch (error) {
      console.error('加载关联工具失败:', error);
    }
  }, [projectId]);

  // 加载可用工具
  const loadAvailableTools = useCallback(async () => {
    if (!projectId) return;
    try {
      if (USE_MOCK) {
        // 使用 mock 数据
        const tools = mockAvailableTools[projectId] || [];
        setAvailableTools(tools as AvailableTool[]);
        return;
      }
      const data = await projectToolService.getAvailableTools(projectId);
      setAvailableTools(data);
    } catch (error) {
      console.error('加载可用工具失败:', error);
    }
  }, [projectId]);

  // 加载指标体系列表
  const loadIndicatorSystems = useCallback(async () => {
    try {
      if (USE_MOCK) {
        // 使用 mock 数据
        const systems = mockIndicatorSystems.filter(s => s.status === 'published');
        setIndicatorSystems(systems as unknown as IndicatorSystem[]);
        return;
      }
      const data = await indicatorService.getIndicatorSystems();
      setIndicatorSystems(data.filter(s => s.status === 'published'));
    } catch (error) {
      console.error('加载指标体系失败:', error);
    }
  }, []);

  // 加载指标映射汇总
  const loadMappingSummary = useCallback(async () => {
    if (!projectId) return;
    try {
      if (USE_MOCK) {
        // 使用 mock 数据
        const summary = mockMappingSummaries[projectId];
        if (summary) {
          setMappingSummary(summary as unknown as IndicatorMappingSummary);
        }
        return;
      }
      const data = await projectService.getIndicatorMappingSummary(projectId);
      setMappingSummary(data);
    } catch (error) {
      console.error('加载指标映射失败:', error);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProject(), loadTools(), loadIndicatorSystems()]).finally(() => {
      setLoading(false);
    });
  }, [loadProject, loadTools, loadIndicatorSystems]);

  // 切换到映射 Tab 时加载映射数据
  useEffect(() => {
    if (activeTab === 'mapping' && !mappingSummary) {
      loadMappingSummary();
    }
  }, [activeTab, mappingSummary, loadMappingSummary]);

  // 打开添加工具弹窗
  const handleOpenAddModal = async () => {
    await loadAvailableTools();
    setSelectedToolIds([]);
    setAddModalVisible(true);
  };

  // 打开编辑弹窗
  const handleOpenEditModal = () => {
    if (!project) return;
    form.setFieldsValue({
      name: project.name,
      keywords: Array.isArray(project.keywords) ? project.keywords.join(', ') : project.keywords,
      description: project.description,
      indicatorSystemId: project.indicatorSystemId,
      startDate: project.startDate ? dayjs(project.startDate) : null,
      endDate: project.endDate ? dayjs(project.endDate) : null,
    });
    setEditModalVisible(true);
  };

  // 保存项目编辑
  const handleSaveProject = async (values: any) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const data = {
        name: values.name,
        keywords: values.keywords ? values.keywords.split(/[,，;；|\s]+/).filter(Boolean) : [],
        description: values.description || '',
        indicatorSystemId: values.indicatorSystemId,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
        status: project?.status,
      };

      if (USE_MOCK) {
        // Mock 模式：直接更新本地状态
        const selectedSystem = indicatorSystems.find(s => s.id === values.indicatorSystemId);
        setProject(prev => prev ? {
          ...prev,
          name: data.name,
          keywords: data.keywords,
          description: data.description,
          indicatorSystemId: data.indicatorSystemId,
          indicatorSystemName: selectedSystem?.name,
          startDate: data.startDate,
          endDate: data.endDate,
        } : null);
        message.success('保存成功（Mock 模式）');
        setEditModalVisible(false);
        setMappingSummary(null);
      } else {
        await projectService.updateProject(projectId, data);
        message.success('保存成功');
        setEditModalVisible(false);
        setMappingSummary(null);
        await loadProject();
      }
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 添加工具
  const handleAddTools = async () => {
    if (!projectId || selectedToolIds.length === 0) return;

    setSaving(true);
    try {
      if (USE_MOCK) {
        // Mock 模式：将选中的可用工具添加到关联列表
        const newTools: ProjectTool[] = selectedToolIds.map((toolId, index) => {
          const availTool = availableTools.find(t => t.id === toolId);
          return {
            id: `pt-new-${Date.now()}-${index}`,
            projectId: projectId!,
            toolId: toolId,
            sortOrder: tools.length + index + 1,
            isRequired: 1,
            createdAt: new Date().toISOString(),
            toolName: availTool?.name || '',
            toolType: availTool?.type || '表单',
            toolTarget: availTool?.target || '',
            toolDescription: availTool?.description || '',
            toolStatus: 'published' as const,
          };
        });
        setTools(prev => [...prev, ...newTools]);
        // 从可用工具中移除已添加的
        setAvailableTools(prev => prev.filter(t => !selectedToolIds.includes(t.id)));
        message.success('添加成功（Mock 模式）');
        setAddModalVisible(false);
        setMappingSummary(null);
      } else {
        await projectToolService.batchAddProjectTools(projectId, selectedToolIds);
        message.success('添加成功');
        setAddModalVisible(false);
        setMappingSummary(null);
        await loadTools();
      }
    } catch (error: any) {
      message.error(error.message || '添加失败');
    } finally {
      setSaving(false);
    }
  };

  // 移除工具
  const handleRemoveTool = (tool: ProjectTool) => {
    Modal.confirm({
      title: '确认移除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要移除工具 "${tool.toolName}" 吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!projectId) return;
        try {
          if (USE_MOCK) {
            // Mock 模式：从关联列表中移除
            setTools(prev => prev.filter(t => t.toolId !== tool.toolId));
            // 将移除的工具添加回可用工具列表
            const removedTool: AvailableTool = {
              id: tool.toolId,
              name: tool.toolName,
              type: tool.toolType,
              target: tool.toolTarget,
              description: tool.toolDescription,
              status: tool.toolStatus,
              createdBy: '',
              createdAt: tool.createdAt,
            };
            setAvailableTools(prev => [...prev, removedTool]);
            message.success('移除成功（Mock 模式）');
            setMappingSummary(null);
          } else {
            await projectToolService.removeProjectTool(projectId, tool.toolId);
            message.success('移除成功');
            setMappingSummary(null);
            await loadTools();
          }
        } catch (error: any) {
          message.error(error.message || '移除失败');
        }
      },
    });
  };

  // 切换必填状态
  const handleToggleRequired = async (tool: ProjectTool) => {
    if (!projectId) return;
    try {
      if (USE_MOCK) {
        // Mock 模式：直接更新本地状态
        setTools(prev => prev.map(t =>
          t.toolId === tool.toolId
            ? { ...t, isRequired: t.isRequired === 1 ? 0 : 1 }
            : t
        ));
      } else {
        await projectToolService.updateProjectTool(
          projectId,
          tool.toolId,
          tool.isRequired !== 1
        );
        await loadTools();
      }
    } catch (error: any) {
      message.error(error.message || '更新失败');
    }
  };

  // 状态流转操作
  const handleStatusChange = async (action: 'start' | 'stop' | 'review' | 'complete' | 'restart') => {
    if (!projectId) return;

    const actionMap = {
      start: { fn: projectService.startProject, msg: '启动填报', confirm: '确定要启动填报吗？启动后将开放数据填报。', newStatus: '填报中' as const },
      stop: { fn: projectService.stopProject, msg: '中止项目', confirm: '确定要中止项目吗？中止后项目将暂停。', newStatus: '已中止' as const },
      review: { fn: projectService.reviewProject, msg: '结束填报', confirm: '确定要结束填报吗？结束后将进入评审阶段。', newStatus: '评审中' as const },
      complete: { fn: projectService.completeProject, msg: '完成项目', confirm: '确定要完成项目吗？完成后项目将归档。', newStatus: '已完成' as const },
      restart: { fn: projectService.restartProject, msg: '重新启动', confirm: '确定要重新启动项目吗？', newStatus: '配置中' as const },
    };

    const config = actionMap[action];

    Modal.confirm({
      title: config.msg,
      icon: <ExclamationCircleOutlined />,
      content: config.confirm,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        setStatusChanging(true);
        try {
          if (USE_MOCK) {
            // Mock 模式：直接更新本地状态
            setProject(prev => prev ? { ...prev, status: config.newStatus } : null);
            message.success(`${config.msg}成功（Mock 模式）`);
          } else {
            await config.fn(projectId);
            message.success(`${config.msg}成功`);
            await loadProject();
          }
        } catch (error: any) {
          message.error(error.message || `${config.msg}失败`);
        } finally {
          setStatusChanging(false);
        }
      },
    });
  };

  // 打开映射弹窗
  const handleOpenMappingModal = (record: DataIndicatorMapping) => {
    setSelectedDataIndicator(record);
    // 如果已有映射，预填选择
    if (record.mapping) {
      setSelectedToolId(record.mapping.toolId);
      // 加载工具字段
      const fields = mockToolSchemas[record.mapping.toolId] || [];
      setToolFields(fields);
      setSelectedFieldId(record.mapping.fieldId);
    } else {
      setSelectedToolId(undefined);
      setSelectedFieldId(undefined);
      setToolFields([]);
    }
    setMappingModalVisible(true);
  };

  // 工具选择变化时加载字段
  const handleToolChange = (toolId: string) => {
    setSelectedToolId(toolId);
    setSelectedFieldId(undefined);
    if (USE_MOCK) {
      const fields = mockToolSchemas[toolId] || [];
      setToolFields(fields);
    }
  };

  // 保存映射
  const handleSaveMapping = async () => {
    if (!selectedDataIndicator || !selectedToolId || !selectedFieldId) {
      message.warning('请选择工具和字段');
      return;
    }

    setMappingSaving(true);
    try {
      if (USE_MOCK) {
        // Mock 模式：直接更新本地状态
        const tool = tools.find(t => t.toolId === selectedToolId);
        const field = toolFields.find(f => f.id === selectedFieldId);

        if (tool && field) {
          setMappingSummary(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              dataIndicators: prev.dataIndicators.map(item => {
                if (item.id === selectedDataIndicator.id) {
                  return {
                    ...item,
                    mapping: {
                      toolId: selectedToolId,
                      toolName: tool.toolName,
                      fieldId: selectedFieldId,
                      fieldLabel: field.label,
                    },
                    isMapped: true,
                  };
                }
                return item;
              }),
              stats: {
                ...prev.stats,
                mapped: prev.stats.mapped + (selectedDataIndicator.isMapped ? 0 : 1),
                unmapped: prev.stats.unmapped - (selectedDataIndicator.isMapped ? 0 : 1),
              },
            };
          });
          message.success('关联成功（Mock 模式）');
        }
      } else {
        // 调用实际 API
        // await toolService.addFieldMapping(selectedToolId, selectedFieldId, 'data_indicator', selectedDataIndicator.id);
        message.success('关联成功');
        await loadMappingSummary();
      }
      setMappingModalVisible(false);
    } catch (error: any) {
      message.error(error.message || '关联失败');
    } finally {
      setMappingSaving(false);
    }
  };

  // 取消映射
  const handleRemoveMapping = (record: DataIndicatorMapping) => {
    Modal.confirm({
      title: '确认取消关联',
      icon: <ExclamationCircleOutlined />,
      content: `确定要取消数据指标 "${record.name}" 的字段关联吗？`,
      okText: '取消关联',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        try {
          if (USE_MOCK) {
            // Mock 模式：直接更新本地状态
            setMappingSummary(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                dataIndicators: prev.dataIndicators.map(item => {
                  if (item.id === record.id) {
                    return {
                      ...item,
                      mapping: null,
                      isMapped: false,
                    };
                  }
                  return item;
                }),
                stats: {
                  ...prev.stats,
                  mapped: prev.stats.mapped - 1,
                  unmapped: prev.stats.unmapped + 1,
                },
              };
            });
            message.success('已取消关联（Mock 模式）');
          } else {
            // 调用实际 API
            // await toolService.deleteFieldMapping(record.mapping!.toolId, record.mapping!.fieldId);
            message.success('已取消关联');
            await loadMappingSummary();
          }
        } catch (error: any) {
          message.error(error.message || '取消关联失败');
        }
      },
    });
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      '配置中': { color: 'default', text: '配置中' },
      '填报中': { color: 'processing', text: '填报中' },
      '评审中': { color: 'warning', text: '评审中' },
      '已中止': { color: 'error', text: '已中止' },
      '已完成': { color: 'success', text: '已完成' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 渲染状态操作按钮
  const renderStatusActions = () => {
    if (!project) return null;

    const status = project.status;
    const buttons: React.ReactNode[] = [];

    switch (status) {
      case '配置中':
        buttons.push(
          <Button
            key="start"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handleStatusChange('start')}
            loading={statusChanging}
          >
            启动填报
          </Button>
        );
        buttons.push(
          <Button
            key="stop"
            danger
            icon={<PauseCircleOutlined />}
            onClick={() => handleStatusChange('stop')}
            loading={statusChanging}
          >
            中止项目
          </Button>
        );
        break;
      case '填报中':
        buttons.push(
          <Button
            key="review"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => handleStatusChange('review')}
            loading={statusChanging}
          >
            结束填报
          </Button>
        );
        buttons.push(
          <Button
            key="stop"
            danger
            icon={<PauseCircleOutlined />}
            onClick={() => handleStatusChange('stop')}
            loading={statusChanging}
          >
            中止项目
          </Button>
        );
        break;
      case '评审中':
        buttons.push(
          <Button
            key="complete"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => handleStatusChange('complete')}
            loading={statusChanging}
          >
            完成项目
          </Button>
        );
        buttons.push(
          <Button
            key="stop"
            danger
            icon={<PauseCircleOutlined />}
            onClick={() => handleStatusChange('stop')}
            loading={statusChanging}
          >
            中止项目
          </Button>
        );
        break;
      case '已中止':
        buttons.push(
          <Button
            key="restart"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => handleStatusChange('restart')}
            loading={statusChanging}
          >
            重新启动
          </Button>
        );
        break;
      case '已完成':
        break;
    }

    return buttons;
  };

  // 工具表格列
  const toolColumns: ColumnsType<ProjectTool> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '工具名称',
      dataIndex: 'toolName',
      key: 'toolName',
      render: (name, record) => (
        <div>
          <div className={styles.toolName}>{name}</div>
          <div className={styles.toolDesc}>{record.toolDescription}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'toolType',
      key: 'toolType',
      width: 80,
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '对象',
      dataIndex: 'toolTarget',
      key: 'toolTarget',
      width: 100,
    },
    {
      title: '必填',
      key: 'isRequired',
      width: 80,
      render: (_, record) => (
        <Switch
          checked={record.isRequired === 1}
          size="small"
          onChange={() => handleToggleRequired(record)}
          disabled={project?.status !== '配置中'}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'toolStatus',
      key: 'toolStatus',
      width: 80,
      render: (status) => (
        <Tag color={status === 'published' ? 'success' : 'default'}>
          {status === 'published' ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑表单">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/home/balanced/tools/${record.toolId}/edit`)}
            />
          </Tooltip>
          {project?.status === '配置中' && (
            <Tooltip title="移除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveTool(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 可用工具表格列
  const availableToolColumns: ColumnsType<AvailableTool> = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <div className={styles.toolName}>{name}</div>
          <div className={styles.toolDesc}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '对象',
      dataIndex: 'target',
      key: 'target',
      width: 100,
    },
  ];

  // 指标映射表格列
  const mappingColumns: ColumnsType<DataIndicatorMapping> = [
    {
      title: '数据指标',
      key: 'indicator',
      render: (_, record) => (
        <div>
          <div className={styles.indicatorCode}>{record.code}</div>
          <div className={styles.indicatorName}>{record.name}</div>
        </div>
      ),
    },
    {
      title: '所属指标',
      key: 'parent',
      render: (_, record) => (
        <span>{record.indicatorCode} {record.indicatorName}</span>
      ),
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 120,
      render: (threshold) => threshold ? <Tag color="orange">{threshold}</Tag> : '-',
    },
    {
      title: '关联工具',
      key: 'tool',
      width: 150,
      render: (_, record) => record.mapping ? record.mapping.toolName : '-',
    },
    {
      title: '关联字段',
      key: 'field',
      width: 150,
      render: (_, record) => record.mapping ? record.mapping.fieldLabel : '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        record.isMapped ? (
          <Tag icon={<LinkOutlined />} color="success">已映射</Tag>
        ) : (
          <Tag icon={<DisconnectOutlined />} color="warning">未映射</Tag>
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title={record.isMapped ? '修改关联' : '关联字段'}>
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => handleOpenMappingModal(record)}
              disabled={tools.length === 0}
            />
          </Tooltip>
          {record.isMapped && (
            <Tooltip title="取消关联">
              <Button
                type="text"
                danger
                icon={<DisconnectOutlined />}
                onClick={() => handleRemoveMapping(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 过滤映射数据
  const filteredMappings = mappingSummary?.dataIndicators.filter(item => {
    if (mappingFilter === 'mapped') return item.isMapped;
    if (mappingFilter === 'unmapped') return !item.isMapped;
    return true;
  }) || [];

  if (loading) {
    return (
      <div className={styles.projectConfigPage}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.projectConfigPage}>
        <Empty description="项目不存在" />
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  return (
    <div className={styles.projectConfigPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>项目配置</h1>
        </div>
        <div className={styles.headerRight}>
          <Space>
            {renderStatusActions()}
          </Space>
        </div>
      </div>

      {/* 项目信息卡片 */}
      <Card
        className={styles.projectCard}
        extra={
          project.status === '配置中' && (
            <Button icon={<EditOutlined />} onClick={handleOpenEditModal}>
              编辑
            </Button>
          )
        }
      >
        <Descriptions column={3}>
          <Descriptions.Item label="项目名称" span={2}>
            {project.name}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {getStatusTag(project.status)}
          </Descriptions.Item>
          <Descriptions.Item label="指标体系" span={3}>
            {project.indicatorSystemId ? (
              <Space>
                <span>{project.indicatorSystemName || project.indicatorSystemId}</span>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => setTreeViewerVisible(true)}
                >
                  查看指标
                </Button>
              </Space>
            ) : (
              <span style={{ color: '#999' }}>未关联指标体系</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="项目描述" span={3}>
            {project.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {project.startDate || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结束日期">
            {project.endDate || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {project.createdAt || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 采集工具和指标映射 Tabs */}
      <Card className={styles.toolsCard}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'tools',
              label: `采集工具 (${tools.length})`,
              children: (
                <>
                  {project.status === '配置中' && (
                    <div className={styles.tabActions}>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenAddModal}
                      >
                        添加工具
                      </Button>
                    </div>
                  )}
                  {tools.length === 0 ? (
                    <Empty description="暂无关联的采集工具" />
                  ) : (
                    <Table
                      rowKey="id"
                      columns={toolColumns}
                      dataSource={tools}
                      pagination={false}
                      className={styles.toolsTable}
                    />
                  )}
                </>
              ),
            },
            {
              key: 'mapping',
              label: (
                <span>
                  指标映射
                  {mappingSummary?.stats && (
                    <Tag className={styles.tabTag} color={mappingSummary.stats.unmapped > 0 ? 'warning' : 'success'}>
                      {mappingSummary.stats.mapped}/{mappingSummary.stats.total}
                    </Tag>
                  )}
                </span>
              ),
              children: (
                <>
                  {!project.indicatorSystemId ? (
                    <Empty description="请先关联指标体系" />
                  ) : !mappingSummary || !mappingSummary.stats ? (
                    <div className={styles.loadingContainer}>
                      <Spin tip="加载映射数据..." />
                    </div>
                  ) : (
                    <>
                      {/* 映射统计 */}
                      <div className={styles.mappingStats}>
                        <div className={styles.statsItem}>
                          <span>映射完成度</span>
                          <Progress
                            percent={mappingSummary.stats.total > 0 ? Math.round((mappingSummary.stats.mapped / mappingSummary.stats.total) * 100) : 0}
                            status={mappingSummary.stats.unmapped > 0 ? 'active' : 'success'}
                            style={{ width: 200 }}
                          />
                        </div>
                        <div className={styles.filterGroup}>
                          <Select
                            value={mappingFilter}
                            onChange={setMappingFilter}
                            style={{ width: 120 }}
                          >
                            <Select.Option value="all">全部 ({mappingSummary.stats.total})</Select.Option>
                            <Select.Option value="mapped">已映射 ({mappingSummary.stats.mapped})</Select.Option>
                            <Select.Option value="unmapped">未映射 ({mappingSummary.stats.unmapped})</Select.Option>
                          </Select>
                        </div>
                      </div>

                      {/* 映射表格 */}
                      {filteredMappings.length === 0 ? (
                        <Empty description="暂无数据指标" />
                      ) : (
                        <Table
                          rowKey="id"
                          columns={mappingColumns}
                          dataSource={filteredMappings}
                          pagination={false}
                          className={styles.mappingTable}
                        />
                      )}

                      <div className={styles.mappingTip}>
                        提示：点击操作列的关联按钮可手动关联表单字段，也可在「采集工具」的表单设计器中配置「评价依据」
                      </div>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 添加工具弹窗 */}
      <Modal
        title="添加采集工具"
        open={addModalVisible}
        onOk={handleAddTools}
        onCancel={() => setAddModalVisible(false)}
        confirmLoading={saving}
        okText="添加"
        cancelText="取消"
        width={700}
      >
        {availableTools.length === 0 ? (
          <Empty description="没有可添加的工具" />
        ) : (
          <Table
            rowKey="id"
            columns={availableToolColumns}
            dataSource={availableTools}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedToolIds,
              onChange: (keys) => setSelectedToolIds(keys as string[]),
            }}
            scroll={{ y: 400 }}
          />
        )}
      </Modal>

      {/* 编辑项目弹窗 */}
      <Modal
        title="编辑项目信息"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={560}
      >
        <Form form={form} onFinish={handleSaveProject} layout="vertical">
          <Form.Item
            label="项目名称"
            name="name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item label="关键字" name="keywords">
            <Input placeholder="用逗号、分号、|或空格分割" />
          </Form.Item>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea placeholder="请输入项目描述" rows={3} />
          </Form.Item>
          <Form.Item
            label="指标体系"
            name="indicatorSystemId"
            rules={[{ required: true, message: '请选择评估指标体系' }]}
          >
            <Select placeholder="选择评估指标体系">
              {indicatorSystems.map(sys => (
                <Select.Option key={sys.id} value={sys.id}>{sys.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item label="开始时间" name="startDate" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
            <Form.Item label="结束时间" name="endDate" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setEditModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 字段映射弹窗 */}
      <Modal
        title="关联表单字段"
        open={mappingModalVisible}
        onOk={handleSaveMapping}
        onCancel={() => setMappingModalVisible(false)}
        confirmLoading={mappingSaving}
        okText="确定"
        cancelText="取消"
        width={560}
      >
        {selectedDataIndicator && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="数据指标">
                <span style={{ fontWeight: 500 }}>{selectedDataIndicator.code} {selectedDataIndicator.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label="所属指标">
                {selectedDataIndicator.indicatorCode} {selectedDataIndicator.indicatorName}
              </Descriptions.Item>
              {selectedDataIndicator.threshold && (
                <Descriptions.Item label="阈值">
                  <Tag color="orange">{selectedDataIndicator.threshold}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>选择采集工具</label>
              <Select
                placeholder="请选择采集工具"
                value={selectedToolId}
                onChange={handleToolChange}
                style={{ width: '100%' }}
              >
                {tools.filter(t => t.toolType === '表单').map(tool => (
                  <Select.Option key={tool.toolId} value={tool.toolId}>
                    {tool.toolName}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>选择表单字段</label>
              <Select
                placeholder={selectedToolId ? '请选择表单字段' : '请先选择采集工具'}
                value={selectedFieldId}
                onChange={setSelectedFieldId}
                style={{ width: '100%' }}
                disabled={!selectedToolId}
              >
                {toolFields.map(field => (
                  <Select.Option key={field.id} value={field.id}>
                    {field.label}
                    <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                      ({field.type})
                    </span>
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>

      {/* 指标树查看器 */}
      {project.indicatorSystemId && (
        <IndicatorTreeViewer
          visible={treeViewerVisible}
          onClose={() => setTreeViewerVisible(false)}
          systemId={project.indicatorSystemId}
          systemName={project.indicatorSystemName}
        />
      )}
    </div>
  );
};

export default ProjectConfig;
