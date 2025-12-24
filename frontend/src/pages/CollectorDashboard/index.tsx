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
  Modal,
  Checkbox,
  Collapse,
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
  EyeOutlined,
  DatabaseOutlined,
  BankOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import * as taskService from '../../services/taskService';
import type { Task, TaskStatus, MyProject, ToolFullSchema } from '../../services/taskService';
import { getSchool, getSchoolCompliance, getSchoolIndicatorData, School, SchoolCompliance, SchoolIndicatorData, SchoolIndicatorItem } from '../../services/schoolService';
import { getDistrictSchoolsIndicatorSummary, DistrictSchoolsIndicatorSummary } from '../../services/districtService';
import { getSamples } from '../../services/sampleService';
import { getResourceIndicatorsSummary, ResourceIndicatorsSummary } from '../../services/statisticsService';
import { getSubmissions, getSubmission, Submission } from '../../services/submissionService';
import styles from './index.module.css';

const CollectorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const { user } = useAuthStore();

  // 根据路由参数决定当前视图
  const currentView = projectId ? 'tasks' : 'projects';
  const [selectedProject, setSelectedProject] = useState<MyProject | null>(null);

  // 项目列表状态
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projects, setProjects] = useState<MyProject[]>([]);

  // 学校信息（用于判断学校类型）
  const [schoolInfo, setSchoolInfo] = useState<School | null>(null);

  // 任务列表状态
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  // 达标情况状态
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceData, setComplianceData] = useState<SchoolCompliance | null>(null);

  // 指标查看状态
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false);
  const [indicatorLoading, setIndicatorLoading] = useState(false);
  const [currentToolSchema, setCurrentToolSchema] = useState<ToolFullSchema | null>(null);
  const [currentTaskForIndicator, setCurrentTaskForIndicator] = useState<Task | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [schoolIndicatorData, setSchoolIndicatorData] = useState<SchoolIndicatorData | null>(null);
  // 指标详情弹窗：是否仅显示已填报字段（区县端默认开启）
  const [onlyShowFilled, setOnlyShowFilled] = useState<boolean>(false);
  // 区县数据按学段分开
  const [districtPrimaryData, setDistrictPrimaryData] = useState<DistrictSchoolsIndicatorSummary | null>(null);
  const [districtMiddleData, setDistrictMiddleData] = useState<DistrictSchoolsIndicatorSummary | null>(null);
  const [districtPrimaryCVData, setDistrictPrimaryCVData] = useState<ResourceIndicatorsSummary | null>(null);
  const [districtMiddleCVData, setDistrictMiddleCVData] = useState<ResourceIndicatorsSummary | null>(null);
  // 区县下的学校列表（按区县分组，用于显示所有学校的任务进度）
  const [districtSchoolsGrouped, setDistrictSchoolsGrouped] = useState<Array<{
    district: { id: string; name: string };
    schools: Array<{ id: string; name: string }>;
  }>>([]);

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

  // 判断项目是否为学前教育项目
  const isPreschoolProject = useCallback((project: MyProject) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${project.name} ${project.indicatorSystemName || ''} ${project.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 加载学校信息（用于判断学校类型）
  const loadSchoolInfo = useCallback(async () => {
    if (resolvedScope?.type === 'school' && resolvedScope.id) {
      try {
        const school = await getSchool(resolvedScope.id);
        setSchoolInfo(school);
      } catch (error) {
        console.error('加载学校信息失败:', error);
        setSchoolInfo(null);
      }
    } else {
      setSchoolInfo(null);
    }
  }, [resolvedScope]);

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

  // 根据学校类型过滤项目列表
  const filteredProjects = useMemo(() => {
    // 如果是学校填报员且学校类型是"幼儿园"，只显示学前教育项目
    if (schoolInfo?.schoolType === '幼儿园') {
      return projects.filter(isPreschoolProject);
    }
    // 如果是小学、初中等义务教育阶段学校，只显示非学前教育项目
    if (schoolInfo?.schoolType && ['小学', '初中', '九年一贯制', '完全中学'].includes(schoolInfo.schoolType)) {
      return projects.filter(project => !isPreschoolProject(project));
    }
    // 其他情况（区县填报员等）显示全部项目
    return projects;
  }, [projects, schoolInfo, isPreschoolProject]);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      // 区县填报员需要加载下属学校的任务（通过 scope 类型或用户角色判断）
      const isDistrictReporter = resolvedScope?.type === 'district' || user?.role === 'district_reporter';
      const data = await taskService.getMyTasks(
        resolvedScope
          ? {
              projectId: selectedProject.id,
              scopeType: resolvedScope.type,
              scopeId: resolvedScope.id,
              includeSubSchools: isDistrictReporter,
            }
          : { projectId: selectedProject.id, includeSubSchools: isDistrictReporter }
      );
      setTasks(data);

      // 区县填报员：同时加载区县下所有学校列表（从项目样本表获取）
      if (isDistrictReporter && selectedProject?.id) {
        try {
          // 获取用户所有区县 scope
          const scopes = (user?.scopes || []) as Array<{ type: string; id: string; name?: string }>;
          const districtScopes = scopes.filter(s => s?.type === 'district' && s?.id);

          // 获取当前 scope 的区县名称
          const districtNames = resolvedScope?.name
            ? [resolvedScope.name]
            : districtScopes.map(s => s.name).filter(Boolean);

          // 获取项目样本树形结构（区县 -> 学校）
          const sampleTree = await getSamples(selectedProject.id).catch(() => []);

          // 从树中提取学校（按区县分组）
          const grouped: Array<{
            district: { id: string; name: string };
            schools: Array<{ id: string; name: string }>;
          }> = [];

          sampleTree.forEach(district => {
            // 如果有区县名称过滤条件，只取匹配的区县下的学校
            // 如果没有（scopes 为空），则取所有区县下的学校
            if (district.type === 'district') {
              const shouldInclude = districtNames.length === 0 || districtNames.includes(district.name);
              if (shouldInclude) {
                const schools: Array<{ id: string; name: string }> = [];
                // 区县的 children 就是学校列表
                (district.children || []).forEach(child => {
                  if (child.type === 'school') {
                    schools.push({ id: child.id, name: child.name });
                  }
                });
                if (schools.length > 0) {
                  grouped.push({
                    district: { id: district.id, name: district.name },
                    schools,
                  });
                }
              }
            }
          });

          setDistrictSchoolsGrouped(grouped);
        } catch (err) {
          console.error('加载区县学校列表失败:', err);
          setDistrictSchoolsGrouped([]);
        }
      }
    } catch (error) {
      console.error('加载任务失败:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedScope, selectedProject, user?.role]);

  // 加载学校信息
  useEffect(() => {
    loadSchoolInfo();
  }, [loadSchoolInfo]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 根据路由参数加载项目信息
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setSelectedProject(project);
      }
    } else if (!projectId) {
      setSelectedProject(null);
      // 返回项目列表时重置过滤条件
      setStatusFilter('');
      setKeyword('');
    }
  }, [projectId, projects]);

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

  // 查看任务指标
  const handleViewIndicators = useCallback(async (task: Task) => {
    setCurrentTaskForIndicator(task);
    setIndicatorModalOpen(true);
    setIndicatorLoading(true);
    // 区县填报端：默认只展示已填报的字段/指标，避免大量“未填写”干扰
    setOnlyShowFilled(resolvedScope?.type === 'district');
    setCurrentSubmission(null);
    setSchoolIndicatorData(null);
    setDistrictPrimaryData(null);
    setDistrictMiddleData(null);
    setDistrictPrimaryCVData(null);
    setDistrictMiddleCVData(null);
    try {
      // 并行加载工具schema、提交数据、以及指标数据（根据范围类型）
      // 区县数据分小学和初中两组
      const promises: [
        Promise<ToolFullSchema>,
        Promise<Submission[]>,
        Promise<SchoolIndicatorData> | null,
        Promise<DistrictSchoolsIndicatorSummary> | null,
        Promise<DistrictSchoolsIndicatorSummary> | null,
        Promise<ResourceIndicatorsSummary> | null,
        Promise<ResourceIndicatorsSummary> | null
      ] = [
        taskService.getToolFullSchema(task.toolId),
        getSubmissions({
          projectId: task.projectId,
          formId: task.toolId,
          submitterOrg: resolvedScope?.name || undefined,
        }),
        resolvedScope?.type === 'school' && selectedProject
          ? getSchoolIndicatorData(resolvedScope.id, selectedProject.id)
          : null,
        resolvedScope?.type === 'district' && selectedProject
          ? getDistrictSchoolsIndicatorSummary(resolvedScope.id, selectedProject.id, '小学')
          : null,
        resolvedScope?.type === 'district' && selectedProject
          ? getDistrictSchoolsIndicatorSummary(resolvedScope.id, selectedProject.id, '初中')
          : null,
        resolvedScope?.type === 'district' && selectedProject
          ? getResourceIndicatorsSummary(resolvedScope.id, selectedProject.id, '小学')
          : null,
        resolvedScope?.type === 'district' && selectedProject
          ? getResourceIndicatorsSummary(resolvedScope.id, selectedProject.id, '初中')
          : null,
      ];

      const [schema, submissions, schoolData, primaryData, middleData, primaryCVData, middleCVData] = await Promise.all([
        promises[0],
        promises[1],
        promises[2] || Promise.resolve(null),
        promises[3] || Promise.resolve(null),
        promises[4] || Promise.resolve(null),
        promises[5] || Promise.resolve(null),
        promises[6] || Promise.resolve(null),
      ]);

      setCurrentToolSchema(schema);
      setSchoolIndicatorData(schoolData);
      setDistrictPrimaryData(primaryData);
      setDistrictMiddleData(middleData);
      setDistrictPrimaryCVData(primaryCVData);
      setDistrictMiddleCVData(middleCVData);

      // 找到当前范围的提交记录（优先已提交的，其次是草稿）
      // 然后获取完整数据（包含 data 字段）
      if (submissions.length > 0) {
        const submitted = submissions.find(s => s.status === 'submitted' || s.status === 'approved');
        const draft = submissions.find(s => s.status === 'draft');
        const targetSubmission = submitted || draft || submissions[0];
        // 列表接口不返回 data 字段，需要单独获取完整数据
        const fullSubmission = await getSubmission(targetSubmission.id);
        setCurrentSubmission(fullSubmission);
      }
    } catch (error) {
      console.error('加载指标数据失败:', error);
      message.error('加载指标数据失败');
      setCurrentToolSchema(null);
    } finally {
      setIndicatorLoading(false);
    }
  }, [resolvedScope, selectedProject]);

  // 关闭指标查看弹窗
  const handleCloseIndicatorModal = useCallback(() => {
    setIndicatorModalOpen(false);
    setCurrentToolSchema(null);
    setCurrentTaskForIndicator(null);
    setCurrentSubmission(null);
    setSchoolIndicatorData(null);
    setDistrictPrimaryData(null);
    setDistrictMiddleData(null);
    setDistrictPrimaryCVData(null);
    setDistrictMiddleCVData(null);
  }, []);

  // 进入项目填报 - 跳转到新路由
  const handleEnterProject = (project: MyProject) => {
    navigate(`/collector/${project.id}`);
  };

  // 返回项目列表 - 跳转回项目列表路由
  const handleBackToProjects = () => {
    navigate('/collector');
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
    rejected: tasks.filter(t => t.status === 'rejected').length,
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

  // 区县填报员：分组任务（区县任务 vs 下属学校任务）
  // 通过 scope 类型或用户角色判断
  const isDistrictScope = resolvedScope?.type === 'district' || user?.role === 'district_reporter';

  // 判断任务是否为区县级任务
  const isDistrictTask = (t: Task) => {
    // 明确标记为区县级
    if (t.targetType === 'district') return true;
    if (t.toolTarget === '区县') return true;
    // 工具名称包含"区县"
    if (t.toolName?.includes('区县')) return true;
    return false;
  };

  // 判断任务是否为学校级任务
  const isSchoolTask = (t: Task) => {
    // 明确标记为学校级
    if (t.targetType === 'school') return true;
    if (t.toolTarget === '学校') return true;
    // 工具名称包含"校"但不包含"区县"
    if (t.toolName && (t.toolName.includes('-校') || t.toolName.endsWith('校'))) return true;
    return false;
  };

  // 我的区县任务
  const myDistrictTasks = useMemo(() => {
    if (!isDistrictScope) return filteredTasks;
    return filteredTasks.filter(t => isDistrictTask(t));
  }, [filteredTasks, isDistrictScope]);

  // 下属学校任务
  const subSchoolTasks = useMemo(() => {
    if (!isDistrictScope) return [];
    return filteredTasks.filter(t => isSchoolTask(t));
  }, [filteredTasks, isDistrictScope]);

  // 其他未分类任务（如问卷等）
  const otherTasks = useMemo(() => {
    if (!isDistrictScope) return [];
    return filteredTasks.filter(t => !isDistrictTask(t) && !isSchoolTask(t));
  }, [filteredTasks, isDistrictScope]);

  // 所有学校名称集合（用于匹配任务）
  const allSchoolNames = useMemo(() => {
    const names = new Set<string>();
    const ids = new Set<string>();
    districtSchoolsGrouped.forEach(d => {
      d.schools.forEach(s => {
        names.add(s.name);
        ids.add(s.id);
      });
    });
    return { names, ids };
  }, [districtSchoolsGrouped]);

  // 按区县->学校分组（包含所有学校，即使没有任务）
  const districtSchoolTasksGrouped = useMemo(() => {
    return districtSchoolsGrouped.map(districtGroup => {
      const schoolsWithTasks = districtGroup.schools.map(school => {
        // 匹配该学校的任务：通过 targetId（学校样本ID）或 targetName/assigneeOrg（学校名称）
        const schoolTasks = subSchoolTasks.filter(task =>
          task.targetId === school.id ||
          task.targetName === school.name ||
          task.assigneeOrg === school.name
        );
        return {
          school,
          tasks: schoolTasks,
          stats: {
            total: schoolTasks.length,
            completed: schoolTasks.filter(t => t.status === 'completed').length,
          },
        };
      });

      // 计算区县整体统计
      const districtStats = {
        totalSchools: schoolsWithTasks.length,
        totalTasks: schoolsWithTasks.reduce((sum, s) => sum + s.stats.total, 0),
        completedTasks: schoolsWithTasks.reduce((sum, s) => sum + s.stats.completed, 0),
      };

      return {
        district: districtGroup.district,
        schools: schoolsWithTasks,
        stats: districtStats,
      };
    });
  }, [subSchoolTasks, districtSchoolsGrouped]);

  // 未匹配到具体学校的学校级任务（通用任务）
  const unmatchedSchoolTasks = useMemo(() => {
    return subSchoolTasks.filter(task => {
      // 如果任务的 targetId 或 targetName 或 assigneeOrg 能匹配到任何学校，则不是未匹配任务
      const matchedById = task.targetId && allSchoolNames.ids.has(task.targetId);
      const matchedByTargetName = task.targetName && allSchoolNames.names.has(task.targetName);
      const matchedByOrg = task.assigneeOrg && allSchoolNames.names.has(task.assigneeOrg);
      return !matchedById && !matchedByTargetName && !matchedByOrg;
    });
  }, [subSchoolTasks, allSchoolNames]);

  // 统计：总学校数和总任务数
  const totalSchoolsCount = useMemo(() =>
    districtSchoolTasksGrouped.reduce((sum, d) => sum + d.schools.length, 0),
    [districtSchoolTasksGrouped]
  );

  const totalSchoolTasksCount = useMemo(() =>
    districtSchoolTasksGrouped.reduce((sum, d) => sum + d.stats.totalTasks, 0),
    [districtSchoolTasksGrouped]
  );

  // 开始填报（可选传入区县名称，用于学校任务场景）
  const handleStartTask = async (task: Task, districtName?: string) => {
    try {
      if (task.status === 'pending') {
        await taskService.startTask(task.id);
      }
      // 构建查询参数，传递目标信息（用于区县填报员没有 scope 时的备用）
      const params = new URLSearchParams();
      if (task.targetId) params.set('targetId', task.targetId);
      if (task.targetName) params.set('targetName', task.targetName);
      if (task.targetType) params.set('targetType', task.targetType);
      if (task.assigneeOrg) params.set('assigneeOrg', task.assigneeOrg);
      // 优先使用传入的区县名称，其次使用任务中的区县字段
      const district = districtName || task.assigneeDistrict;
      if (district) params.set('assigneeDistrict', district);
      // 传递工具目标类型
      if (task.toolTarget) params.set('toolTarget', task.toolTarget);

      const queryString = params.toString();
      const url = `/home/balanced/entry/${task.projectId}/form/${task.toolId}${queryString ? `?${queryString}` : ''}`;

      // 调试日志：打印任务数据和生成的 URL
      console.log('[handleStartTask] 任务数据:', {
        targetId: task.targetId,
        targetName: task.targetName,
        targetType: task.targetType,
        assigneeOrg: task.assigneeOrg,
        assigneeDistrict: district,
        toolTarget: task.toolTarget,
      });
      console.log('[handleStartTask] 跳转 URL:', url);

      navigate(url);
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
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewIndicators(record)}
          >
            查看指标
          </Button>
          {record.status === 'completed' ? (
            <Button type="link" size="small" onClick={() => handleStartTask(record)}>
              查看
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<FormOutlined />}
              onClick={() => handleStartTask(record)}
            >
              {record.status === 'pending' ? '开始填报' : '继续填报'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 项目列表视图
  const renderProjectList = () => {
    // 计算项目总体统计（使用过滤后的项目）
    const projectStats = {
      total: filteredProjects.length,
      totalTasks: filteredProjects.reduce((sum, p) => sum + (Number(p.totalTasks) || 0), 0),
      completedTasks: filteredProjects.reduce((sum, p) => sum + (Number(p.completedTasks) || 0), 0),
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
            您有 <strong>{filteredProjects.length}</strong> 个待填报的评估项目
            {schoolInfo?.schoolType && (
              <span style={{ marginLeft: 8, fontSize: 14, color: '#666' }}>
                ({schoolInfo.schoolType})
              </span>
            )}
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
            {filteredProjects.length > 0 ? (
              <div className={styles.projectList}>
                {filteredProjects.map(project => {
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
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="总任务数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="待开始"
              value={stats.pending}
              valueStyle={{ color: '#999' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="进行中"
              value={stats.inProgress}
              valueStyle={{ color: '#1890ff' }}
              prefix={<Badge status="processing" />}
            />
          </Card>
        </Col>
        <Col span={4}>
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
            <Statistic
              title="已驳回"
              value={stats.rejected}
              valueStyle={{ color: '#faad14' }}
              prefix={<ExclamationCircleOutlined />}
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

      {/* 筛选栏 */}
      <Card className={styles.taskCard} style={{ marginBottom: 16 }}>
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
            <Select.Option value="rejected">已驳回</Select.Option>
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
      </Card>

      {/* 区县填报员：我的区县任务 */}
      {isDistrictScope && (
        <Card
          title={
            <Space>
              <ApartmentOutlined style={{ color: '#1890ff' }} />
              我的区县任务
              <Tag color="blue">{myDistrictTasks.length}</Tag>
            </Space>
          }
          className={styles.taskCard}
          style={{ marginBottom: 16 }}
        >
          <Spin spinning={loading}>
            {myDistrictTasks.length > 0 ? (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={myDistrictTasks}
                pagination={{
                  total: myDistrictTasks.length,
                  pageSize: 10,
                  showTotal: (total) => `共 ${total} 条任务`,
                }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  statusFilter || keyword
                    ? '没有符合条件的区县任务'
                    : '暂无区县级填报任务'
                }
              />
            )}
          </Spin>
        </Card>
      )}

      {/* 区县填报员：未匹配到具体学校的学校级任务 */}
      {isDistrictScope && unmatchedSchoolTasks.length > 0 && (
        <Card
          title={
            <Space>
              <BankOutlined style={{ color: '#faad14' }} />
              学校级填报任务
              <Tag color="warning">{unmatchedSchoolTasks.length}</Tag>
              <Tooltip title="这些任务是学校级别的填报任务，由区县填报员统一完成">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
          className={styles.taskCard}
          style={{ marginBottom: 16 }}
        >
          <Spin spinning={loading}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={unmatchedSchoolTasks}
              pagination={{
                total: unmatchedSchoolTasks.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条任务`,
              }}
            />
          </Spin>
        </Card>
      )}

      {/* 区县填报员：学校任务（按区县->学校分组） */}
      {isDistrictScope && districtSchoolTasksGrouped.length > 0 && totalSchoolTasksCount > 0 && (
        <Card
          title={
            <Space>
              <BankOutlined style={{ color: '#52c41a' }} />
              学校任务
              <Tag color="blue">{districtSchoolTasksGrouped.length} 个区县</Tag>
              <Tag color="green">{totalSchoolsCount} 所学校</Tag>
              <Tag>{totalSchoolTasksCount} 个任务</Tag>
            </Space>
          }
          className={styles.taskCard}
          style={{ marginBottom: 16 }}
        >
          <Spin spinning={loading}>
            <Collapse
              defaultActiveKey={districtSchoolTasksGrouped.map(d => d.district.id)}
              items={districtSchoolTasksGrouped.map(districtGroup => {
                const districtCompletionRate = districtGroup.stats.totalTasks > 0
                  ? Math.round((districtGroup.stats.completedTasks / districtGroup.stats.totalTasks) * 100)
                  : 0;
                return {
                  key: districtGroup.district.id,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Space>
                        <ApartmentOutlined style={{ color: '#1890ff' }} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{districtGroup.district.name}</span>
                        <Tag color="blue">{districtGroup.stats.totalSchools} 所学校</Tag>
                        {districtGroup.stats.totalTasks > 0 && (
                          <Tag color={districtCompletionRate === 100 ? 'success' : 'processing'}>
                            {districtGroup.stats.completedTasks}/{districtGroup.stats.totalTasks} 任务已完成
                          </Tag>
                        )}
                      </Space>
                      {districtGroup.stats.totalTasks > 0 && (
                        <Progress
                          percent={districtCompletionRate}
                          size="small"
                          style={{ width: 120, marginRight: 16 }}
                          strokeColor={districtCompletionRate === 100 ? '#52c41a' : '#1890ff'}
                        />
                      )}
                    </div>
                  ),
                  children: (
                    <div style={{ paddingLeft: 16 }}>
                      {districtGroup.schools.map(schoolData => {
                        const schoolCompletionRate = schoolData.stats.total > 0
                          ? Math.round((schoolData.stats.completed / schoolData.stats.total) * 100)
                          : 0;
                        const hasNoTasks = schoolData.tasks.length === 0;
                        return (
                          <div
                            key={schoolData.school.id}
                            style={{
                              marginBottom: 12,
                              padding: '12px 16px',
                              background: '#fafafa',
                              borderRadius: 6,
                              border: '1px solid #f0f0f0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasNoTasks ? 0 : 8 }}>
                              <Space>
                                <BankOutlined style={{ color: '#52c41a' }} />
                                <span style={{ fontWeight: 500 }}>{schoolData.school.name}</span>
                                {hasNoTasks ? (
                                  <Tag color="default">暂无任务</Tag>
                                ) : (
                                  <Tag color={schoolCompletionRate === 100 ? 'success' : schoolCompletionRate > 0 ? 'processing' : 'default'}>
                                    {schoolData.stats.completed}/{schoolData.stats.total} 已完成
                                  </Tag>
                                )}
                              </Space>
                              {!hasNoTasks && (
                                <Progress
                                  percent={schoolCompletionRate}
                                  size="small"
                                  style={{ width: 100 }}
                                  strokeColor={schoolCompletionRate === 100 ? '#52c41a' : '#1890ff'}
                                />
                              )}
                            </div>
                            {!hasNoTasks && (
                              <List
                                size="small"
                                dataSource={schoolData.tasks}
                                renderItem={(task) => {
                                  const statusCfg = statusConfig[task.status] || statusConfig.pending;
                                  return (
                                    <List.Item
                                      style={{ padding: '8px 0', borderBottom: '1px dashed #e8e8e8' }}
                                      actions={[
                                        <Button
                                          key="view"
                                          type="link"
                                          size="small"
                                          icon={<EyeOutlined />}
                                          onClick={() => handleViewIndicators(task)}
                                        >
                                          查看指标
                                        </Button>,
                                        task.status === 'completed' ? (
                                          <Button
                                            key="check"
                                            type="link"
                                            size="small"
                                            onClick={() => handleStartTask(task, districtGroup.district.name)}
                                          >
                                            查看
                                          </Button>
                                        ) : (
                                          <Button
                                            key="fill"
                                            type="primary"
                                            size="small"
                                            icon={<FormOutlined />}
                                            onClick={() => handleStartTask(task, districtGroup.district.name)}
                                          >
                                            {task.status === 'pending' ? '填报' : '继续'}
                                          </Button>
                                        ),
                                      ]}
                                    >
                                      <List.Item.Meta
                                        avatar={<FileTextOutlined style={{ color: '#1890ff', fontSize: 16 }} />}
                                        title={<span style={{ fontSize: 13 }}>{task.toolName || '未知工具'}</span>}
                                        description={
                                          <Space size="small">
                                            <Badge status={statusCfg.color as any} text={statusCfg.text} />
                                            {task.dueDate && (
                                              <span style={{ color: '#999', fontSize: 12 }}>
                                                截止: {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                                              </span>
                                            )}
                                          </Space>
                                        }
                                      />
                                    </List.Item>
                                  );
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ),
                };
              })}
            />
          </Spin>
        </Card>
      )}

      {/* 区县填报员：其他任务（问卷等） */}
      {isDistrictScope && otherTasks.length > 0 && (
        <Card
          title={
            <Space>
              <FormOutlined style={{ color: '#faad14' }} />
              其他任务
              <Tag color="warning">{otherTasks.length}</Tag>
            </Space>
          }
          className={styles.taskCard}
          style={{ marginBottom: 16 }}
        >
          <Spin spinning={loading}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={otherTasks}
              pagination={{
                total: otherTasks.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条任务`,
              }}
            />
          </Spin>
        </Card>
      )}

      {/* 非区县填报员：原有任务列表 */}
      {!isDistrictScope && (
        <Card
          title={
            <Space>
              <FormOutlined />
              填报任务列表
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
      )}

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

  // 提取指标数据（递归处理嵌套字段）
  const indicatorsList = useMemo(() => {
    if (!currentToolSchema?.schema) return [];

    const extractMappings = (fields: typeof currentToolSchema.schema): Array<{
      fieldId: string;
      fieldLabel: string;
      fieldUnit?: string;
      mappingType: 'data_indicator' | 'element';
      targetInfo: NonNullable<NonNullable<typeof fields[0]['mapping']>['targetInfo']>;
    }> => {
      const results: Array<{
        fieldId: string;
        fieldLabel: string;
        fieldUnit?: string;
        mappingType: 'data_indicator' | 'element';
        targetInfo: NonNullable<NonNullable<typeof fields[0]['mapping']>['targetInfo']>;
      }> = [];

      for (const field of fields) {
        // 如果当前字段有映射，添加到结果
        if (field.mapping?.targetInfo) {
          results.push({
            fieldId: field.id,
            fieldLabel: field.label,
            fieldUnit: (field as any).unit,
            mappingType: field.mapping.mappingType,
            targetInfo: field.mapping.targetInfo,
          });
        }
        // 递归处理子字段
        if ((field as any).children && Array.isArray((field as any).children)) {
          results.push(...extractMappings((field as any).children));
        }
      }
      return results;
    };

    return extractMappings(currentToolSchema.schema);
  }, [currentToolSchema]);

  // 获取提交数据中的字段值
  const getSubmittedValue = useCallback((fieldId: string) => {
    if (!currentSubmission?.data) return undefined;
    return currentSubmission.data[fieldId];
  }, [currentSubmission]);

  const isFilledValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    // number(含0)、boolean(含false) 视为已填写
    return true;
  };

  // 格式化显示提交的值
  const formatSubmittedValue = (value: unknown, unit?: string): string => {
    if (value === undefined || value === null || value === '') return '未填写';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'number') return unit ? `${value} ${unit}` : String(value);
    if (typeof value === 'string') {
      // 处理选择类型的值
      if (value === 'yes') return '是';
      if (value === 'no') return '否';
      return unit ? `${value} ${unit}` : value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '未填写';
      const allPrimitive = value.every(v => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v));
      if (allPrimitive) {
        return value.map(v => (v === null || v === undefined ? '' : String(v))).filter(Boolean).join(', ') || '未填写';
      }
      return `共 ${value.length} 条`;
    }
    return String(value);
  };

  // 渲染指标弹窗内容
  const renderIndicatorContent = () => {
    if (indicatorLoading) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="加载中..." />
        </div>
      );
    }

    if (!currentToolSchema) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无指标数据"
        />
      );
    }

    const dataIndicators = indicatorsList.filter(i => i.mappingType === 'data_indicator');
    const elements = indicatorsList.filter(i => i.mappingType === 'element');
    const displayDataIndicators = onlyShowFilled
      ? dataIndicators.filter((i) => isFilledValue(getSubmittedValue(i.fieldId)))
      : dataIndicators;
    const displayElements = onlyShowFilled
      ? elements.filter((i) => isFilledValue(getSubmittedValue(i.fieldId)))
      : elements;

    return (
      <div>
        {/* 工具基本信息 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Tag color="blue">{currentToolSchema.type}</Tag>
            <Tag color="cyan">目标: {currentToolSchema.target}</Tag>
            <Tag color={currentToolSchema.status === 'published' ? 'green' : 'default'}>
              {currentToolSchema.status === 'published' ? '已发布' : currentToolSchema.status}
            </Tag>
          </Space>
          {currentToolSchema.description && (
            <p style={{ color: '#666', marginTop: 8 }}>{currentToolSchema.description}</p>
          )}
        </div>

        {/* 提交状态提示 */}
        {currentSubmission && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>
                已有填报数据 ({currentSubmission.status === 'submitted' ? '已提交' : currentSubmission.status === 'approved' ? '已通过' : '草稿'})
              </span>
              {currentSubmission.submitterOrg && (
                <Tag>{currentSubmission.submitterOrg}</Tag>
              )}
            </Space>
          </div>
        )}

        {/* 显示模式：区县端默认“仅显示已填报”，也允许手动切换 */}
        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={onlyShowFilled} onChange={(e) => setOnlyShowFilled(e.target.checked)}>
            仅显示已填报
          </Checkbox>
          <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
            {onlyShowFilled ? '已隐藏未填写项' : '包含未填写项'}
          </span>
        </div>

        {/* 已评估指标详情（学校端显示） */}
        {resolvedScope?.type === 'school' && schoolIndicatorData?.indicators && schoolIndicatorData.indicators.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              已评估指标详情 ({schoolIndicatorData.indicators.length})
              {schoolIndicatorData.statistics && (
                <span style={{ fontWeight: 'normal', fontSize: 12, color: '#666', marginLeft: 12 }}>
                  达标 {schoolIndicatorData.statistics.compliant} / 未达标 {schoolIndicatorData.statistics.nonCompliant} / 待评估 {schoolIndicatorData.statistics.pending}
                </span>
              )}
            </h4>
            <List
              size="small"
              bordered
              dataSource={schoolIndicatorData.indicators}
              renderItem={(item: SchoolIndicatorItem) => {
                const isCompliant = item.isCompliant === 1;
                const isPending = item.isCompliant === null;
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color={isCompliant ? 'success' : isPending ? 'default' : 'error'}>
                            {item.indicatorCode}
                          </Tag>
                          <span style={{ fontWeight: 500 }}>{item.indicatorName}</span>
                        </Space>
                        <Space>
                          {isPending ? (
                            <Tag color="default">待评估</Tag>
                          ) : isCompliant ? (
                            <Tag color="success" icon={<CheckCircleOutlined />}>达标</Tag>
                          ) : (
                            <Tag color="error" icon={<CloseCircleOutlined />}>未达标</Tag>
                          )}
                        </Space>
                      </div>
                      {item.indicatorDescription && (
                        <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                          {item.indicatorDescription}
                        </div>
                      )}
                      <div style={{ marginTop: 8, display: 'flex', gap: 24, color: '#666', fontSize: 12 }}>
                        <span>
                          实际值: <strong style={{ color: isCompliant ? '#52c41a' : isPending ? '#999' : '#ff4d4f' }}>
                            {item.value !== null ? item.value : (item.textValue || '未填写')}
                          </strong>
                        </span>
                        <span>
                          阈值: <strong>{item.threshold || '-'}</strong>
                        </span>
                        {item.collectedAt && (
                          <span>采集时间: {new Date(item.collectedAt).toLocaleString('zh-CN')}</span>
                        )}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}

        {/* 区县资源配置指标差异系数（区县端显示）- 小学 */}
        {resolvedScope?.type === 'district' && districtPrimaryCVData && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              小学资源配置指标差异系数 (CV)
              <Tag
                color={districtPrimaryCVData.summary.allCvCompliant ? 'success' : districtPrimaryCVData.summary.allCvCompliant === false ? 'error' : 'default'}
                style={{ marginLeft: 12 }}
              >
                {districtPrimaryCVData.summary.allCvCompliant ? '全部达标' : districtPrimaryCVData.summary.allCvCompliant === false ? '部分未达标' : '待评估'}
              </Tag>
            </h4>
            <div style={{ padding: '16px', background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }}>
              <Row gutter={24}>
                <Col span={6}>
                  <Statistic
                    title="达标项数"
                    value={`${districtPrimaryCVData.summary.compliantCvCount}/${districtPrimaryCVData.summary.totalCvCount}`}
                    suffix="项"
                    valueStyle={{
                      color: districtPrimaryCVData.summary.allCvCompliant ? '#52c41a' : districtPrimaryCVData.summary.allCvCompliant === false ? '#ff4d4f' : '#999'
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="达标阈值"
                    value="≤50"
                    suffix="%"
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="参与学校" value={districtPrimaryCVData.summary.schoolCount} suffix="所" />
                </Col>
                <Col span={6}>
                  <Statistic title="学段" value="小学" />
                </Col>
              </Row>
              {/* 各指标差异系数详情 */}
              {districtPrimaryCVData.summary.cvIndicators && districtPrimaryCVData.summary.cvIndicators.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>资源配置指标差异系数:</div>
                  <Row gutter={[16, 16]}>
                    {districtPrimaryCVData.summary.cvIndicators.map(indicator => (
                      <Col span={8} key={indicator.code}>
                        <div style={{
                          padding: '8px 12px',
                          background: '#fff',
                          borderRadius: 4,
                          border: `1px solid ${indicator.isCompliant ? '#b7eb8f' : indicator.isCompliant === false ? '#ffccc7' : '#f0f0f0'}`
                        }}>
                          <div style={{ color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{indicator.code} {indicator.name}</span>
                            <Tag
                              color={indicator.isCompliant ? 'success' : indicator.isCompliant === false ? 'error' : 'default'}
                              style={{ marginLeft: 4 }}
                            >
                              {indicator.isCompliant ? '达标' : indicator.isCompliant === false ? '未达标' : '-'}
                            </Tag>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
                            {indicator.cv !== null ? (indicator.cv * 100).toFixed(2) + '%' : '-'}
                          </div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            均值: {indicator.mean?.toFixed(2) ?? '-'} |
                            标准差: {indicator.stdDev?.toFixed(2) ?? '-'} |
                            阈值: ≤{(indicator.threshold * 100).toFixed(0)}%
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 区县资源配置指标差异系数（区县端显示）- 初中 */}
        {resolvedScope?.type === 'district' && districtMiddleCVData && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              初中资源配置指标差异系数 (CV)
              <Tag
                color={districtMiddleCVData.summary.allCvCompliant ? 'success' : districtMiddleCVData.summary.allCvCompliant === false ? 'error' : 'default'}
                style={{ marginLeft: 12 }}
              >
                {districtMiddleCVData.summary.allCvCompliant ? '全部达标' : districtMiddleCVData.summary.allCvCompliant === false ? '部分未达标' : '待评估'}
              </Tag>
            </h4>
            <div style={{ padding: '16px', background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }}>
              <Row gutter={24}>
                <Col span={6}>
                  <Statistic
                    title="达标项数"
                    value={`${districtMiddleCVData.summary.compliantCvCount}/${districtMiddleCVData.summary.totalCvCount}`}
                    suffix="项"
                    valueStyle={{
                      color: districtMiddleCVData.summary.allCvCompliant ? '#52c41a' : districtMiddleCVData.summary.allCvCompliant === false ? '#ff4d4f' : '#999'
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="达标阈值"
                    value="≤45"
                    suffix="%"
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="参与学校" value={districtMiddleCVData.summary.schoolCount} suffix="所" />
                </Col>
                <Col span={6}>
                  <Statistic title="学段" value="初中" />
                </Col>
              </Row>
              {/* 各指标差异系数详情 */}
              {districtMiddleCVData.summary.cvIndicators && districtMiddleCVData.summary.cvIndicators.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>资源配置指标差异系数:</div>
                  <Row gutter={[16, 16]}>
                    {districtMiddleCVData.summary.cvIndicators.map(indicator => (
                      <Col span={8} key={indicator.code}>
                        <div style={{
                          padding: '8px 12px',
                          background: '#fff',
                          borderRadius: 4,
                          border: `1px solid ${indicator.isCompliant ? '#b7eb8f' : indicator.isCompliant === false ? '#ffccc7' : '#f0f0f0'}`
                        }}>
                          <div style={{ color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{indicator.code} {indicator.name}</span>
                            <Tag
                              color={indicator.isCompliant ? 'success' : indicator.isCompliant === false ? 'error' : 'default'}
                              style={{ marginLeft: 4 }}
                            >
                              {indicator.isCompliant ? '达标' : indicator.isCompliant === false ? '未达标' : '-'}
                            </Tag>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
                            {indicator.cv !== null ? (indicator.cv * 100).toFixed(2) + '%' : '-'}
                          </div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            均值: {indicator.mean?.toFixed(2) ?? '-'} |
                            标准差: {indicator.stdDev?.toFixed(2) ?? '-'} |
                            阈值: ≤{(indicator.threshold * 100).toFixed(0)}%
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 区县学校指标汇总（区县端显示）- 小学 */}
        {resolvedScope?.type === 'district' && districtPrimaryData?.schools && districtPrimaryData.schools.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              小学指标汇总
              {districtPrimaryData.summary && (
                <span style={{ fontWeight: 'normal', fontSize: 12, color: '#666', marginLeft: 12 }}>
                  {districtPrimaryData.summary.schoolCount} 所学校 |
                  平均达标率 {districtPrimaryData.summary.avgComplianceRate?.toFixed(1) || 0}%
                </span>
              )}
            </h4>
            {/* 汇总统计 */}
            {districtPrimaryData.summary && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 4 }}>
                <Row gutter={24}>
                  <Col span={6}>
                    <Statistic title="学校数" value={districtPrimaryData.summary.schoolCount} suffix="所" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="总指标数" value={districtPrimaryData.summary.totalIndicators} />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="达标"
                      value={districtPrimaryData.summary.totalCompliant}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="未达标"
                      value={districtPrimaryData.summary.totalNonCompliant}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>
              </div>
            )}
            {/* 学校列表 */}
            <List
              size="small"
              bordered
              dataSource={districtPrimaryData.schools}
              renderItem={(schoolItem) => {
                const isFullyCompliant = schoolItem.statistics.nonCompliant === 0 && schoolItem.statistics.total > 0;
                const hasNonCompliant = schoolItem.statistics.nonCompliant > 0;
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color={isFullyCompliant ? 'success' : hasNonCompliant ? 'warning' : 'default'}>
                            {schoolItem.school.schoolType}
                          </Tag>
                          <span style={{ fontWeight: 500 }}>{schoolItem.school.name}</span>
                        </Space>
                        <Space>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            达标率: <strong style={{ color: isFullyCompliant ? '#52c41a' : hasNonCompliant ? '#faad14' : '#999' }}>
                              {schoolItem.complianceRate?.toFixed(1) || 0}%
                            </strong>
                          </span>
                          <span style={{ fontSize: 12, color: '#52c41a' }}>
                            {schoolItem.statistics.compliant} 达标
                          </span>
                          {hasNonCompliant && (
                            <span style={{ fontSize: 12, color: '#ff4d4f' }}>
                              {schoolItem.statistics.nonCompliant} 未达标
                            </span>
                          )}
                        </Space>
                      </div>
                      {/* 未达标指标展示 */}
                      {schoolItem.nonCompliantIndicators && schoolItem.nonCompliantIndicators.length > 0 && (
                        <div style={{ marginTop: 8, paddingLeft: 12 }}>
                          <span style={{ fontSize: 12, color: '#ff4d4f' }}>未达标指标: </span>
                          {schoolItem.nonCompliantIndicators.map((ind, idx) => (
                            <Tag key={idx} color="error" style={{ marginBottom: 4 }}>
                              {ind.indicatorCode}: {ind.indicatorName}
                              (值: {ind.value ?? ind.text_value ?? '-'}, 阈值: {ind.threshold})
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}

        {/* 区县学校指标汇总（区县端显示）- 初中 */}
        {resolvedScope?.type === 'district' && districtMiddleData?.schools && districtMiddleData.schools.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              初中指标汇总
              {districtMiddleData.summary && (
                <span style={{ fontWeight: 'normal', fontSize: 12, color: '#666', marginLeft: 12 }}>
                  {districtMiddleData.summary.schoolCount} 所学校 |
                  平均达标率 {districtMiddleData.summary.avgComplianceRate?.toFixed(1) || 0}%
                </span>
              )}
            </h4>
            {/* 汇总统计 */}
            {districtMiddleData.summary && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 4 }}>
                <Row gutter={24}>
                  <Col span={6}>
                    <Statistic title="学校数" value={districtMiddleData.summary.schoolCount} suffix="所" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="总指标数" value={districtMiddleData.summary.totalIndicators} />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="达标"
                      value={districtMiddleData.summary.totalCompliant}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="未达标"
                      value={districtMiddleData.summary.totalNonCompliant}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>
              </div>
            )}
            {/* 学校列表 */}
            <List
              size="small"
              bordered
              dataSource={districtMiddleData.schools}
              renderItem={(schoolItem) => {
                const isFullyCompliant = schoolItem.statistics.nonCompliant === 0 && schoolItem.statistics.total > 0;
                const hasNonCompliant = schoolItem.statistics.nonCompliant > 0;
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color={isFullyCompliant ? 'success' : hasNonCompliant ? 'warning' : 'default'}>
                            {schoolItem.school.schoolType}
                          </Tag>
                          <span style={{ fontWeight: 500 }}>{schoolItem.school.name}</span>
                        </Space>
                        <Space>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            达标率: <strong style={{ color: isFullyCompliant ? '#52c41a' : hasNonCompliant ? '#faad14' : '#999' }}>
                              {schoolItem.complianceRate?.toFixed(1) || 0}%
                            </strong>
                          </span>
                          <span style={{ fontSize: 12, color: '#52c41a' }}>
                            {schoolItem.statistics.compliant} 达标
                          </span>
                          {hasNonCompliant && (
                            <span style={{ fontSize: 12, color: '#ff4d4f' }}>
                              {schoolItem.statistics.nonCompliant} 未达标
                            </span>
                          )}
                        </Space>
                      </div>
                      {/* 未达标指标展示 */}
                      {schoolItem.nonCompliantIndicators && schoolItem.nonCompliantIndicators.length > 0 && (
                        <div style={{ marginTop: 8, paddingLeft: 12 }}>
                          <span style={{ fontSize: 12, color: '#ff4d4f' }}>未达标指标: </span>
                          {schoolItem.nonCompliantIndicators.map((ind, idx) => (
                            <Tag key={idx} color="error" style={{ marginBottom: 4 }}>
                              {ind.indicatorCode}: {ind.indicatorName}
                              (值: {ind.value ?? ind.text_value ?? '-'}, 阈值: {ind.threshold})
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}

        {/* 数据指标列表 */}
        {displayDataIndicators.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>
              <DatabaseOutlined style={{ marginRight: 8 }} />
              数据指标 ({displayDataIndicators.length}{onlyShowFilled ? ` / ${dataIndicators.length}` : ''})
            </h4>
            <List
              size="small"
              bordered
              dataSource={displayDataIndicators}
              renderItem={(item) => {
                const submittedValue = getSubmittedValue(item.fieldId);
                const hasValue = isFilledValue(submittedValue);
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color="blue">{item.targetInfo.code}</Tag>
                          <span style={{ fontWeight: 500 }}>{item.targetInfo.name}</span>
                        </Space>
                        {item.targetInfo.threshold && (
                          <Tag color="orange">阈值: {item.targetInfo.threshold}</Tag>
                        )}
                      </div>
                      {item.targetInfo.indicatorName && (
                        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                          所属指标: {item.targetInfo.indicatorCode} - {item.targetInfo.indicatorName}
                        </div>
                      )}
                      {item.targetInfo.description && (
                        <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                          {item.targetInfo.description}
                        </div>
                      )}
                      <div style={{ marginTop: 8, padding: '6px 10px', background: hasValue ? '#f0f5ff' : '#fafafa', borderRadius: 4 }}>
                        <span style={{ color: '#666', fontSize: 12 }}>填报值: </span>
                        <span style={{ fontWeight: 500, color: hasValue ? '#1890ff' : '#999' }}>
                          {formatSubmittedValue(submittedValue, item.fieldUnit)}
                        </span>
                        <span style={{ color: '#999', fontSize: 12, marginLeft: 12 }}>
                          (字段: {item.fieldLabel})
                        </span>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}

        {/* 要素列表 */}
        {displayElements.length > 0 && (
          <div>
            <h4 style={{ marginBottom: 12 }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              采集要素 ({displayElements.length}{onlyShowFilled ? ` / ${elements.length}` : ''})
            </h4>
            <List
              size="small"
              bordered
              dataSource={displayElements}
              renderItem={(item) => {
                const submittedValue = getSubmittedValue(item.fieldId);
                const hasValue = isFilledValue(submittedValue);
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color="green">{item.targetInfo.code}</Tag>
                          <span style={{ fontWeight: 500 }}>{item.targetInfo.name}</span>
                        </Space>
                        <Space>
                          {item.targetInfo.elementType && (
                            <Tag>{item.targetInfo.elementType}</Tag>
                          )}
                          {item.targetInfo.dataType && (
                            <Tag color="default">{item.targetInfo.dataType}</Tag>
                          )}
                          {((item.targetInfo as any).collectionLevel || (item.targetInfo as any).collection_level) && (
                            <Tag color="blue">
                              {((item.targetInfo as any).collectionLevel || (item.targetInfo as any).collection_level) === 'school' ? '学校' : 
                               ((item.targetInfo as any).collectionLevel || (item.targetInfo as any).collection_level) === 'district' ? '区县' : 
                               ((item.targetInfo as any).collectionLevel || (item.targetInfo as any).collection_level) === 'auto' ? '自动' : 
                               ((item.targetInfo as any).collectionLevel || (item.targetInfo as any).collection_level)}
                            </Tag>
                          )}
                        </Space>
                      </div>
                      {item.targetInfo.formula && (
                        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                          计算公式: {item.targetInfo.formula}
                        </div>
                      )}
                      <div style={{ marginTop: 8, padding: '6px 10px', background: hasValue ? '#f6ffed' : '#fafafa', borderRadius: 4 }}>
                        <span style={{ color: '#666', fontSize: 12 }}>填报值: </span>
                        <span style={{ fontWeight: 500, color: hasValue ? '#52c41a' : '#999' }}>
                          {formatSubmittedValue(submittedValue, item.fieldUnit)}
                        </span>
                        <span style={{ color: '#999', fontSize: 12, marginLeft: 12 }}>
                          (字段: {item.fieldLabel})
                        </span>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}

        {/* 仅显示已填报时的空态 */}
        {onlyShowFilled &&
          indicatorsList.length > 0 &&
          displayDataIndicators.length === 0 &&
          displayElements.length === 0 && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已填报的指标/要素" />
          )}

        {/* 无映射提示 */}
        {indicatorsList.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="该采集工具暂未配置指标映射"
          />
        )}
      </div>
    );
  };

  return (
    <div className={styles.collectorDashboard}>
      {currentView === 'projects' ? renderProjectList() : renderTaskList()}

      {/* 指标查看弹窗 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            {currentTaskForIndicator?.toolName || '采集工具'} - 指标详情
          </Space>
        }
        open={indicatorModalOpen}
        onCancel={handleCloseIndicatorModal}
        footer={[
          <Button key="close" onClick={handleCloseIndicatorModal}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {renderIndicatorContent()}
      </Modal>
    </div>
  );
};

export default CollectorDashboard;
