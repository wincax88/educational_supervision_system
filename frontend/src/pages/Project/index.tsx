import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Select, Modal, Form, DatePicker, message, Spin, Tag, Popconfirm, Empty, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  ToolOutlined,
  FormOutlined,
  SettingOutlined,
  DeleteOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import * as projectService from '../../services/projectService';
import * as indicatorService from '../../services/indicatorService';
import * as toolService from '../../services/toolService';
import * as projectToolService from '../../services/projectToolService';
import * as personnelService from '../../services/personnelService';
import * as taskService from '../../services/taskService';
import type { Project } from '../../services/projectService';
import type { IndicatorSystem } from '../../services/indicatorService';
import type { DataTool, ElementLibrary } from '../../services/toolService';
import { useUserPermissions } from '../../stores/authStore';
import styles from './index.module.css';

const { Text } = Typography;
const { Search } = Input;

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useUserPermissions();
  const [loading, setLoading] = useState(true);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [filteredList, setFilteredList] = useState<Project[]>([]);
  const [indicatorSystems, setIndicatorSystems] = useState<IndicatorSystem[]>([]);
  const [elementLibraries, setElementLibraries] = useState<ElementLibrary[]>([]);
  const [dataTools, setDataTools] = useState<DataTool[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [editInfoModalVisible, setEditInfoModalVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 根据路由判断项目类型
  const projectType = useMemo(() => {
    if (location.pathname.includes('/home/kindergarten')) {
      return 'preschool'; // 学前教育
    }
    return 'balanced'; // 义务教育优质均衡（默认）
  }, [location.pathname]);

  // 页面标题
  const pageTitle = useMemo(() => {
    return projectType === 'preschool' ? '学前教育普及普惠督导评估项目' : '义务教育优质均衡督导评估项目';
  }, [projectType]);

  // 判断项目是否属于学前教育
  const isPreschoolProject = useCallback((project: Project) => {
    // 优先使用 assessmentType 字段判断
    if (project.assessmentType) {
      return project.assessmentType === '普及普惠';
    }
    // 兼容旧数据：根据关键词判断
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${project.name} ${project.indicatorSystemName || ''} ${project.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 判断指标体系是否属于学前教育
  const isPreschoolIndicatorSystem = useCallback((system: IndicatorSystem) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${system.name} ${system.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 判断要素库是否属于学前教育
  const isPreschoolElementLibrary = useCallback((library: ElementLibrary) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${library.name} ${library.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 判断采集工具是否属于学前教育
  const isPreschoolTool = useCallback((tool: DataTool) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${tool.name} ${tool.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 根据项目类型过滤的指标体系列表
  const filteredIndicatorSystems = useMemo(() => {
    return indicatorSystems.filter(system => {
      if (projectType === 'preschool') {
        return isPreschoolIndicatorSystem(system);
      } else {
        return !isPreschoolIndicatorSystem(system);
      }
    });
  }, [indicatorSystems, projectType, isPreschoolIndicatorSystem]);

  // 根据项目类型过滤的要素库列表
  const filteredElementLibraries = useMemo(() => {
    return elementLibraries.filter(library => {
      if (projectType === 'preschool') {
        return isPreschoolElementLibrary(library);
      } else {
        return !isPreschoolElementLibrary(library);
      }
    });
  }, [elementLibraries, projectType, isPreschoolElementLibrary]);

  // 根据项目类型过滤的采集工具列表
  const filteredDataTools = useMemo(() => {
    return dataTools.filter(tool => {
      if (projectType === 'preschool') {
        return isPreschoolTool(tool);
      } else {
        return !isPreschoolTool(tool);
      }
    });
  }, [dataTools, projectType, isPreschoolTool]);

  // 渲染采集工具选项（按填报对象分组）
  const toolOptions = useMemo(() => {
    // 按填报对象类型分组（使用过滤后的工具列表）
    const targetGroups: Record<string, DataTool[]> = {};
    filteredDataTools.forEach(tool => {
      // target 可能是逗号分隔的多个对象，取第一个作为分组依据
      const targets = tool.target ? tool.target.split(',') : ['未分类'];
      const primaryTarget = targets[0] || '未分类';
      if (!targetGroups[primaryTarget]) {
        targetGroups[primaryTarget] = [];
      }
      targetGroups[primaryTarget].push(tool);
    });

    return Object.entries(targetGroups).map(([target, tools]) => (
      <Select.OptGroup key={target} label={`${target}（${tools.length}）`}>
        {tools.map(tool => (
          <Select.Option key={tool.id} value={tool.id} label={tool.name}>
            {tool.name}
            <span style={{ color: '#999', marginLeft: 8 }}>
              [{tool.type}]
            </span>
          </Select.Option>
        ))}
      </Select.OptGroup>
    ));
  }, [filteredDataTools]);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const data = await projectService.getProjects();
      setProjectList(data);
      // filteredList 会通过 useEffect 自动更新
    } catch (error) {
      console.error('加载项目列表失败:', error);
      message.error('加载项目列表失败');
    }
  }, []);

  // 加载指标体系列表
  const loadIndicatorSystems = useCallback(async () => {
    try {
      const data = await indicatorService.getIndicatorSystems();
      setIndicatorSystems(data.filter(s => s.status === 'published'));
    } catch (error) {
      console.error('加载指标体系失败:', error);
    }
  }, []);

  // 加载要素库列表
  const loadElementLibraries = useCallback(async () => {
    try {
      const data = await toolService.getElementLibraries();
      setElementLibraries(data.filter(lib => lib.status === 'published'));
    } catch (error) {
      console.error('加载要素库失败:', error);
    }
  }, []);

  // 加载采集工具列表
  const loadDataTools = useCallback(async () => {
    try {
      const data = await toolService.getTools({ status: 'published' });
      setDataTools(data);
    } catch (error) {
      console.error('加载采集工具失败:', error);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProjects(), loadIndicatorSystems(), loadElementLibraries(), loadDataTools()]).finally(() => {
      setLoading(false);
    });
  }, [loadProjects, loadIndicatorSystems, loadElementLibraries, loadDataTools]);

  // 根据项目类型过滤的项目列表
  const typeFilteredProjects = useMemo(() => {
    return projectList.filter(project => {
      if (projectType === 'preschool') {
        return isPreschoolProject(project);
      } else {
        return !isPreschoolProject(project);
      }
    });
  }, [projectList, projectType, isPreschoolProject]);

  // 当类型过滤的项目列表变化时，更新 filteredList
  useEffect(() => {
    setFilteredList(typeFilteredProjects);
  }, [typeFilteredProjects]);

  // 计算统计数据（基于类型过滤后的列表）
  const projectStats = useMemo(() => ({
    configuring: typeFilteredProjects.filter(p => p.status === '配置中').length,
    filling: typeFilteredProjects.filter(p => p.status === '填报中').length,
    reviewing: typeFilteredProjects.filter(p => p.status === '评审中').length,
    stopped: typeFilteredProjects.filter(p => p.status === '已中止').length,
    completed: typeFilteredProjects.filter(p => p.status === '已完成').length,
  }), [typeFilteredProjects]);

  const handleSearch = (value: string) => {
    if (value) {
      setFilteredList(typeFilteredProjects.filter(proj =>
        proj.name.includes(value) || (proj.description && proj.description.includes(value))
      ));
    } else {
      setFilteredList(typeFilteredProjects);
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  const handleCreate = async (values: any) => {
    setSaving(true);
    try {
      const indicatorSystemIds: string[] = Array.isArray(values.indicatorSystemIds)
        ? values.indicatorSystemIds
        : (values.indicatorSystemIds ? [values.indicatorSystemIds] : []);
      const indicatorSystemId: string | undefined = indicatorSystemIds[0];

      const data = {
        name: values.name,
        keywords: values.keywords ? values.keywords.split(/[,，;；|\s]+/).filter(Boolean) : [],
        description: values.description || '',
        // 向后兼容：后端目前仍以 indicatorSystemId（单选）为主
        indicatorSystemId,
        // 预留：未来支持项目绑定多个指标体系时可直接启用
        indicatorSystemIds,
        // 要素库（单选）
        elementLibraryId: values.elementLibraryId,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
        // 根据当前路由自动设置评估类型
        assessmentType: (projectType === 'preschool' ? '普及普惠' : '优质均衡') as '普及普惠' | '优质均衡',
      };
      const result = await projectService.createProject(data);

      // 关联选中的采集工具
      const toolIds: string[] = values.toolIds || [];
      if (toolIds.length > 0 && result.id) {
        try {
          await projectToolService.batchAddProjectTools(result.id, toolIds);
        } catch (err) {
          console.error('关联采集工具失败:', err);
          // 不阻断流程，工具可以后续在配置页面添加
        }
      }

      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      await loadProjects();
    } catch (error: any) {
      message.error(error.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      await projectService.deleteProject(project.id);
      message.success('删除成功');
      await loadProjects();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handlePublish = async (project: Project) => {
    // 发布前校验
    try {
      // 1. 校验填报账号是否添加
      const personnelStats = await personnelService.getPersonnelStats(project.id);
      if (personnelStats.total === 0) {
        Modal.warning({
          title: '无法发布项目',
          content: '请先添加填报账号后再发布项目。',
          okText: '知道了',
        });
        return;
      }

      // 2. 校验填报任务是否已分配
      const taskStats = await taskService.getTaskStats(project.id);
      if (taskStats.total === 0) {
        Modal.warning({
          title: '无法发布项目',
          content: '请先分配填报任务后再发布项目。',
          okText: '知道了',
        });
        return;
      }

      // 校验通过，显示确认弹窗
      Modal.confirm({
        title: '发布项目',
        content: (
          <div>
            <p>发布后项目将进入填报阶段，部分配置将无法修改。</p>
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              当前配置：{personnelStats.total} 个填报账号，{taskStats.total} 个填报任务
            </Text>
            <Text type="secondary">确定要发布项目吗？</Text>
          </div>
        ),
        okText: '确定发布',
        cancelText: '取消',
        onOk: async () => {
          try {
            // 先发布
            await projectService.publishProject(project.id);
            // 再启动填报
            await projectService.startProject(project.id);
            message.success('项目发布成功，已启动填报');
            await loadProjects();
          } catch (error: any) {
            message.error(error.message || '发布失败');
          }
        },
      });
    } catch (error: any) {
      // 如果是因为 tasks 表不存在导致的错误，给出友好提示
      if (error.message?.includes('tasks')) {
        Modal.confirm({
          title: '发布项目',
          content: `发布后项目 "${project.name}" 将进入填报阶段。确定要发布吗？`,
          okText: '确定发布',
          cancelText: '取消',
          onOk: async () => {
            try {
              await projectService.publishProject(project.id);
              await projectService.startProject(project.id);
              message.success('项目发布成功，已启动填报');
              await loadProjects();
            } catch (err: any) {
              message.error(err.message || '发布失败');
            }
          },
        });
      } else {
        message.error('校验失败：' + (error.message || '未知错误'));
      }
    }
  };

  const handleUnpublish = async (project: Project) => {
    try {
      await projectService.unpublishProject(project.id);
      message.success('取消发布成功');
      await loadProjects();
    } catch (error: any) {
      message.error(error.message || '取消发布失败');
    }
  };

  // 查看项目信息
  const handleViewInfo = (project: Project) => {
    setCurrentProject(project);
    setInfoModalVisible(true);
  };

  // 进入编辑模式
  const handleEditInfo = async () => {
    if (currentProject) {
      // 拉取该项目已关联的采集工具，用于回填
      let toolIds: string[] = [];
      try {
        const projectTools = await projectToolService.getProjectTools(currentProject.id);
        toolIds = (projectTools || []).map(t => t.toolId);
      } catch (e) {
        console.error('加载项目采集工具失败:', e);
      }

      editForm.setFieldsValue({
        name: currentProject.name,
        keywords: Array.isArray(currentProject.keywords)
          ? currentProject.keywords.join(',')
          : currentProject.keywords || '',
        description: currentProject.description,
        indicatorSystemIds: currentProject.indicatorSystemId ? [currentProject.indicatorSystemId] : [],
        elementLibraryId: currentProject.elementLibraryId || undefined,
        toolIds,
        startDate: currentProject.startDate ? dayjs(currentProject.startDate) : null,
        endDate: currentProject.endDate ? dayjs(currentProject.endDate) : null,
      });
      setInfoModalVisible(false);
      setEditInfoModalVisible(true);
    }
  };

  // 保存编辑
  const handleSaveInfo = async (values: any) => {
    if (!currentProject) return;
    setSaving(true);
    try {
      const indicatorSystemIds: string[] = Array.isArray(values.indicatorSystemIds)
        ? values.indicatorSystemIds
        : (values.indicatorSystemIds ? [values.indicatorSystemIds] : []);
      const indicatorSystemId: string | undefined = indicatorSystemIds[0];

      await projectService.updateProject(currentProject.id, {
        name: values.name,
        keywords: values.keywords ? values.keywords.split(/[,，;；|\s]+/).filter(Boolean) : [],
        description: values.description || '',
        indicatorSystemId,
        elementLibraryId: values.elementLibraryId,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      });

      // 同步采集工具关联（保持与“新建弹窗”同样元素与行为）
      const nextToolIds: string[] = Array.isArray(values.toolIds) ? values.toolIds : [];
      try {
        const existing = await projectToolService.getProjectTools(currentProject.id);
        const existingToolIds = new Set((existing || []).map(t => t.toolId));
        const nextSet = new Set(nextToolIds);

        const toAdd = nextToolIds.filter(id => !existingToolIds.has(id));
        const toRemove = (existing || []).map(t => t.toolId).filter(id => !nextSet.has(id));

        if (toRemove.length > 0) {
          await Promise.all(toRemove.map(toolId => projectToolService.removeProjectTool(currentProject.id, toolId)));
        }
        if (toAdd.length > 0) {
          await projectToolService.batchAddProjectTools(currentProject.id, toAdd);
        }
        // 统一按选择顺序排序（如果后端支持排序）
        if (nextToolIds.length > 0) {
          await projectToolService.updateProjectToolsOrder(currentProject.id, nextToolIds);
        }
      } catch (e) {
        console.error('同步采集工具失败:', e);
        message.warning('项目已保存，但采集工具关联同步失败，可在“项目配置”中再次调整');
      }

      setEditInfoModalVisible(false);
      message.success('保存成功');
      await loadProjects();
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 状态颜色映射
  const statusColorMap: Record<string, { tagColor: string; borderColor: string }> = {
    '配置中': { tagColor: 'default', borderColor: '#d9d9d9' },
    '填报中': { tagColor: 'processing', borderColor: '#1890ff' },
    '评审中': { tagColor: 'warning', borderColor: '#fa8c16' },
    '已中止': { tagColor: 'error', borderColor: '#ff4d4f' },
    '已完成': { tagColor: 'success', borderColor: '#52c41a' },
  };

  const getStatusTag = (status: string) => {
    const config = statusColorMap[status] || { tagColor: 'default', borderColor: '#d9d9d9' };
    return <Tag color={config.tagColor}>{status}</Tag>;
  };

  const getStatusBorderColor = (status: string) => {
    return statusColorMap[status]?.borderColor || '#d9d9d9';
  };

  // 生成年份选项
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className={styles.projectPage}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  // 基础路径
  const basePath = projectType === 'preschool' ? '/home/kindergarten' : '/home/balanced';

  return (
    <div className={styles.projectPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
        <div className={styles.headerActions}>
          <Button onClick={() => navigate(`${basePath}/indicators`)}>
            <DatabaseOutlined /> 评估指标体系库
          </Button>
          <Button onClick={() => navigate(`${basePath}/elements`)}>
            <AppstoreOutlined /> 评估要素库
          </Button>
          <Button onClick={() => navigate(`${basePath}/tools`)}>
            <ToolOutlined /> 采集工具库
          </Button>
          {/* <Button type="primary" onClick={() => navigate(`${basePath}/entry`)}>
            <FormOutlined /> 数据填报
          </Button> */}
        </div>
      </div>

      <div className={styles.statsSection}>
        <h3>本年度项目情况</h3>
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>配置中</div>
              <div className={styles.statValue} style={{ color: '#1890ff' }}>{projectStats.configuring}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>填报中</div>
              <div className={styles.statValue} style={{ color: '#52c41a' }}>{projectStats.filling}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>评审中</div>
              <div className={styles.statValue} style={{ color: '#fa8c16' }}>{projectStats.reviewing}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>已中止</div>
              <div className={styles.statValue}>{projectStats.stopped}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>已完成</div>
              <div className={styles.statValue} style={{ color: '#722ed1' }}>{projectStats.completed}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.listHeader}>
        <h3>项目列表</h3>
        <div className={styles.listActions}>
          {/* <Select value={selectedYear} style={{ width: 100 }} onChange={handleYearChange}>
            {yearOptions.map(year => (
              <Select.Option key={year} value={String(year)}>{year}</Select.Option>
            ))}
          </Select> */}
          <Search
            placeholder="搜索项目"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          {permissions.canManageSystem && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建项目
            </Button>
          )}
        </div>
      </div>

      <div className={styles.projectList}>
        {filteredList.length === 0 ? (
          <div className={styles.emptyState}>
            <p>暂无项目数据</p>
          </div>
        ) : (
          filteredList.map(project => (
            <div
              key={project.id}
              className={styles.projectCard}
              style={{ borderLeftColor: getStatusBorderColor(project.status) }}
            >
              <div className={styles.projectCardHeader}>
                <div className={styles.projectTitleRow}>
                  <span className={styles.projectName}>{project.name}</span>
                  {getStatusTag(project.status)}
                  {project.isPublished ? (
                    <Tag color="green">已发布</Tag>
                  ) : (
                    <Tag color="default">未发布</Tag>
                  )}
                </div>
              </div>
              <div className={styles.projectInfoRow}>
                {project.indicatorSystemName && (
                  <span className={styles.infoItem}>
                    <span className={styles.infoLabel}>指标体系:</span>
                    <span className={styles.infoValue}>{project.indicatorSystemName}</span>
                  </span>
                )}
                {project.elementLibraryName && (
                  <span className={styles.infoItem}>
                    <span className={styles.infoLabel}>要素库:</span>
                    <span className={styles.infoValue}>{project.elementLibraryName}</span>
                  </span>
                )}
                <span className={styles.infoItem}>
                  <span className={styles.infoLabel}>时间:</span>
                  <span className={styles.infoValue}>{project.startDate || '-'} ~ {project.endDate || '-'}</span>
                </span>
              </div>
              <p className={styles.projectDesc}>{project.description || '暂无描述'}</p>
              <div className={styles.projectMeta}>
                <span>创建时间: {project.createdAt || '-'}</span>
                <span>创建人: {project.createdBy || '-'}</span>
                <span>更新时间: {project.updatedAt || '-'}</span>
                <span>更新人: {project.createdBy || '-'}</span>
              </div>
              <div className={styles.projectActions}>
                <span className={styles.actionBtn} onClick={() => handleViewInfo(project)}>
                  <InfoCircleOutlined /> 基础信息
                </span>
                {permissions.canConfigProject && (
                  <span className={styles.actionBtn} onClick={() => navigate(`${basePath}/project/${project.id}/config`)}>
                    <SettingOutlined /> 项目配置
                  </span>
                )}
                {/* 未发布状态：发布 + 删除 */}
                {!project.isPublished && (
                  <>
                    {permissions.canConfigProject && (
                      <Popconfirm
                        title="确认发布"
                        description={`确定要发布项目 "${project.name}" 吗？`}
                        onConfirm={() => handlePublish(project)}
                        okText="发布"
                        cancelText="取消"
                      >
                        <span className={styles.actionBtn}>发布</span>
                      </Popconfirm>
                    )}
                    {permissions.canConfigProject && (
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除项目 "${project.name}" 吗？`}
                        onConfirm={() => handleDelete(project)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <span className={`${styles.actionBtn} ${styles.danger}`}>
                          <DeleteOutlined /> 删除
                        </span>
                      </Popconfirm>
                    )}
                  </>
                )}
                {/* 已发布状态：取消发布 + 详情 */}
                {project.isPublished && (
                  <>
                    {permissions.canConfigProject && project.status === '配置中' && (
                      <Popconfirm
                        title="确认取消发布"
                        description={`确定要取消发布项目 "${project.name}" 吗？`}
                        onConfirm={() => handleUnpublish(project)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <span className={styles.actionBtn}>取消发布</span>
                      </Popconfirm>
                    )}
                    <span className={styles.actionBtn} onClick={() => navigate(`${basePath}/project/${project.id}/detail`)}>
                      <EyeOutlined /> 填报详情
                    </span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        title="项目信息编辑"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={560}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>填写项目基本信息</p>
        <Form form={form} onFinish={handleCreate} layout="vertical">
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
            name="indicatorSystemIds"
            rules={[
              {
                required: true,
                message: '请选择评估指标体系',
              },
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="选择评估指标体系（可多选）"
              optionFilterProp="children"
              maxTagCount="responsive"
            >
              {filteredIndicatorSystems.map(sys => (
                <Select.Option key={sys.id} value={sys.id}>{sys.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="要素库"
            name="elementLibraryId"
            rules={[{ required: true, message: '请选择要素库' }]}
          >
            <Select
              allowClear
              showSearch
              placeholder="选择要素库（单选）"
              optionFilterProp="children"
            >
              {filteredElementLibraries.map(lib => (
                <Select.Option key={lib.id} value={lib.id}>
                  {lib.name}
                  <span style={{ color: '#999', marginLeft: 8 }}>
                    （{lib.elementCount || 0}个要素）
                  </span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="采集工具"
            name="toolIds"
            rules={[
              {
                required: true,
                message: '请选择采集工具',
              },
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="选择采集工具（可多选，按填报对象分组）"
              optionFilterProp="label"
              maxTagCount="responsive"
            >
              {toolOptions}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="开始时间"
              name="startDate"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
            <Form.Item
              label="结束时间"
              name="endDate"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setCreateModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              确定
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 项目信息查看弹窗 */}
      <Modal
        open={infoModalVisible}
        onCancel={() => setInfoModalVisible(false)}
        footer={null}
        width={700}
        closeIcon={<CloseOutlined />}
        className={styles.infoModal}
      >
        {currentProject && (
          <div className={styles.infoModalContent}>
            <div className={styles.infoModalHeader}>
              <h2 className={styles.infoModalTitle}>{currentProject.name}</h2>
              <Tag color={currentProject.isPublished ? 'green' : 'default'} className={styles.infoStatusTag}>
                {currentProject.isPublished ? '已发布' : '未发布'}
              </Tag>
            </div>
            <div className={styles.infoModalMeta}>
              创建时间: {currentProject.createdAt || '-'} | 创建人: {currentProject.createdBy || '-'} | 更新时间: {currentProject.updatedAt || '-'} | 更新人: {currentProject.createdBy || '-'}
            </div>
            <div className={styles.infoModalTags}>
              {getStatusTag(currentProject.status)}
              {currentProject.indicatorSystemName && (
                <Tag color="cyan">指标体系: {currentProject.indicatorSystemName}</Tag>
              )}
              {currentProject.elementLibraryName && (
                <Tag color="purple">要素库: {currentProject.elementLibraryName}</Tag>
              )}
            </div>
            <div className={styles.infoModalKeywords}>
              {(Array.isArray(currentProject.keywords) ? currentProject.keywords : (currentProject.keywords || '').split(/[,，;；|\s]+/).filter(Boolean)).map((keyword: string) => (
                <Tag key={keyword} color="blue">{keyword}</Tag>
              ))}
            </div>
            <p className={styles.infoModalDesc}>{currentProject.description || '暂无描述'}</p>
            <div className={styles.infoModalTime}>
              <span>项目时间: {currentProject.startDate || '-'} ~ {currentProject.endDate || '-'}</span>
            </div>

            <div className={styles.infoModalAttachments}>
              <h4>附件 (0)</h4>
              <div className={styles.attachmentList}>
                <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            </div>

            <div className={styles.infoModalFooter}>
              <Button onClick={() => setInfoModalVisible(false)}>关闭</Button>
              {permissions.canManageSystem && (
                <Button type="primary" icon={<EditOutlined />} onClick={handleEditInfo}>编辑</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 项目信息编辑弹窗 */}
      <Modal
        title="项目信息编辑"
        open={editInfoModalVisible}
        onCancel={() => setEditInfoModalVisible(false)}
        footer={null}
        width={600}
        className={styles.editInfoModal}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>编辑项目的基本信息</p>
        <Form form={editForm} onFinish={handleSaveInfo} layout="vertical">
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
            name="indicatorSystemIds"
            rules={[
              {
                required: true,
                message: '请选择评估指标体系',
              }
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="选择评估指标体系（可多选）"
              optionFilterProp="children"
              maxTagCount="responsive"
            >
              {filteredIndicatorSystems.map(sys => (
                <Select.Option key={sys.id} value={sys.id}>{sys.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="要素库"
            name="elementLibraryId"
            rules={[{ required: true, message: '请选择要素库' }]}
          >
            <Select
              allowClear
              showSearch
              placeholder="选择要素库（单选）"
              optionFilterProp="children"
            >
              {filteredElementLibraries.map(lib => (
                <Select.Option key={lib.id} value={lib.id}>
                  {lib.name}
                  <span style={{ color: '#999', marginLeft: 8 }}>
                    （{lib.elementCount || 0}个要素）
                  </span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="采集工具"
            name="toolIds"
            rules={[
              {
                required: true,
                message: '请选择采集工具',
              },
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="选择采集工具（可多选，按填报对象分组）"
              optionFilterProp="label"
              maxTagCount="responsive"
            >
              {toolOptions}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="开始时间"
              name="startDate"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
            <Form.Item
              label="结束时间"
              name="endDate"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setEditInfoModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectPage;
