/**
 * 项目配置页面
 * 按照Figma设计稿重新设计
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Tag,
  Spin,
  Empty,
  Form,
  Tabs,
  Modal,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  SettingOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import * as projectService from '../../services/projectService';
import type { Project } from '../../services/projectService';
import * as personnelService from '../../services/personnelService';
import * as taskService from '../../services/taskService';
import { getUsers, SystemUser } from '../../services/userService';
import styles from './index.module.css';

// 组件导入
import {
  PersonnelTab,
  SampleTab,
  IndicatorTab,
  DataEntryTab,
  TaskAssignmentTab,
  ExpertReviewTab,
  ProgressOverview,
  SubmissionSchoolTab,
  AddPersonModal,
  ImportModal,
  MorePersonModal,
  SampleConfigModal,
  AddSampleModal,
  AddTeacherModal,
  AddSubmissionDistrictModal,
  AddSubmissionSchoolModal,
  ImportSubmissionSchoolModal,
} from './components';

// Hooks 导入
import { usePersonnel, useSamples, useSubmissionSchools } from './hooks';

// Mock 数据导入
import { projects as mockProjects } from '../../mock/data';

// ==================== Mock 模式开关 ====================
// 通过环境变量 REACT_APP_USE_MOCK=true 启用 Mock 模式，默认使用 API
const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true';

// ==================== 组件 ====================

const ProjectConfig: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('indicator');

  // 人员配置 Hook
  const {
    personnel,
    personnelSearch,
    setPersonnelSearch,
    importData,
    importFilter,
    setImportFilter,
    filteredImportData,
    importStats,
    addPerson,
    deletePerson,
    loadSampleImportData,
    parseImportFile,
    confirmImport,
    clearImportData,
    filterPersonnel,
  } = usePersonnel(projectId);

  // 样本配置 Hook
  const {
    samples,
    sampleDataConfig,
    setSampleDataConfig,
    expandedDistricts,
    toggleDistrictExpand,
    saveSampleConfig,
    addSample,
    addTeacher,
    deleteSample,
    deleteTeacher,
    updateTeacherMode,
    getSchoolById,
  } = useSamples(projectId);

  // 填报学校配置 Hook
  const {
    districts: allSubmissionDistricts,
    filteredDistricts: submissionDistricts,
    expandedDistricts: submissionExpandedDistricts,
    schoolTypeFilter,
    setSchoolTypeFilter,
    toggleDistrictExpand: toggleSubmissionDistrictExpand,
    addDistrict: addSubmissionDistrict,
    addSchool: addSubmissionSchool,
    deleteDistrict: deleteSubmissionDistrict,
    deleteSchool: deleteSubmissionSchool,
    getDistrictById,
    statistics: submissionStatistics,
    loading: submissionLoading,
    getAllDistricts,
    getAllSchools,
    importSchools,
  } = useSubmissionSchools(projectId);

  // 弹窗状态
  const [addPersonModalVisible, setAddPersonModalVisible] = useState(false);
  const [addPersonPresetRole, setAddPersonPresetRole] = useState<string | undefined>(undefined);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [morePersonModalVisible, setMorePersonModalVisible] = useState(false);
  const [morePersonRole, setMorePersonRole] = useState<string>('');
  const [configSampleModalVisible, setConfigSampleModalVisible] = useState(false);
  const [addSampleModalVisible, setAddSampleModalVisible] = useState(false);
  const [addTeacherModalVisible, setAddTeacherModalVisible] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  // 填报学校弹窗状态
  const [addDistrictModalVisible, setAddDistrictModalVisible] = useState(false);
  const [addSchoolModalVisible, setAddSchoolModalVisible] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [importSchoolModalVisible, setImportSchoolModalVisible] = useState(false);

  // 表单实例
  const [addPersonForm] = Form.useForm();
  const [addSampleForm] = Form.useForm();
  const [addTeacherForm] = Form.useForm();
  const [addDistrictForm] = Form.useForm();
  const [addSchoolForm] = Form.useForm();

  // 用户列表（用于人员配置选择）
  const [userList, setUserList] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 加载项目信息
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      if (USE_MOCK) {
        const mockProject = mockProjects.find(p => p.id === projectId);
        if (mockProject) {
          setProject(mockProject as unknown as Project);
        }
        return;
      }
      const data = await projectService.getById(projectId);
      setProject(data);
    } catch (error) {
      console.error('加载项目信息失败:', error);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadProject().finally(() => {
      setLoading(false);
    });
  }, [loadProject]);

  // ==================== 人员配置处理 ====================

  // 加载用户列表
  const loadUserList = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const users = await getUsers();
      setUserList(users);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // 打开添加人员弹窗时加载用户列表
  const handleOpenAddPerson = (role?: string) => {
    loadUserList();
    setAddPersonPresetRole(role);
    setAddPersonModalVisible(true);
  };

  const handleAddPerson = (values: any) => {
    addPerson(values);
    setAddPersonModalVisible(false);
    setAddPersonPresetRole(undefined);
    addPersonForm.resetFields();
  };

  // 批量添加人员（从多选账号）
  const handleBatchAddPerson = (users: Array<{ phone: string; name?: string; roles: string[] }>, role: string) => {
    // 逐个添加选中的用户
    users.forEach(user => {
      addPerson({
        role,
        name: user.name || user.phone,
        organization: '',
        phone: user.phone,
        idCard: '',
      });
    });
    setAddPersonModalVisible(false);
    setAddPersonPresetRole(undefined);
  };

  const handleLoadSampleData = () => {
    loadSampleImportData();
    setImportStep('preview');
  };

  const handleConfirmImport = () => {
    confirmImport();
    setImportModalVisible(false);
    setImportStep('upload');
  };

  const handleCloseImportModal = () => {
    setImportModalVisible(false);
    setImportStep('upload');
    clearImportData();
  };

  const handleResetImport = () => {
    setImportStep('upload');
    clearImportData();
  };

  const handleFileChange = async (file: File) => {
    const success = await parseImportFile(file);
    if (success) {
      setImportStep('preview');
    }
  };

  // ==================== 样本配置处理 ====================

  const handleAddSample = (values: any) => {
    addSample(values);
    setAddSampleModalVisible(false);
    addSampleForm.resetFields();
  };

  const handleAddTeacher = (values: any) => {
    addTeacher(selectedSchoolId, values);
    setAddTeacherModalVisible(false);
    addTeacherForm.resetFields();
  };

  const handleOpenAddTeacher = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    setAddTeacherModalVisible(true);
  };

  // ==================== 填报学校配置处理 ====================

  const handleAddDistrict = async (values: { name: string; code?: string }) => {
    await addSubmissionDistrict(values);
    setAddDistrictModalVisible(false);
    addDistrictForm.resetFields();
  };

  const handleOpenAddSchool = (districtId: string) => {
    setSelectedDistrictId(districtId);
    setAddSchoolModalVisible(true);
  };

  const handleAddSchool = async (values: { name: string; code?: string; schoolType: string }) => {
    await addSubmissionSchool(selectedDistrictId, values);
    setAddSchoolModalVisible(false);
    addSchoolForm.resetFields();
  };

  // ==================== 可选组织列表（用于人员配置） ====================

  const availableOrganizations = useMemo(() => {
    const districts = getAllDistricts().map(d => ({
      id: d.id,
      name: d.name,
      type: 'district' as const,
    }));
    const schools = getAllSchools().map(s => ({
      id: s.id,
      name: s.name,
      type: 'school' as const,
      districtName: s.districtName,
    }));
    return [...districts, ...schools];
  }, [getAllDistricts, getAllSchools]);

  // ==================== 项目状态流转处理 ====================

  // 发布项目（配置中 → 发布 + 启动填报）
  const handlePublishProject = async () => {
    // 发布前校验
    try {
      // 1. 校验填报账号是否添加
      const personnelStats = await personnelService.getPersonnelStats(projectId!);
      if (personnelStats.total === 0) {
        Modal.warning({
          title: '无法发布项目',
          content: '请先添加填报账号后再发布项目。',
          okText: '知道了',
        });
        return;
      }

      // 2. 校验填报任务是否已分配
      const taskStats = await taskService.getTaskStats(projectId!);
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
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>发布后项目将进入填报阶段，部分配置将无法修改。</p>
            <p style={{ marginTop: 8, color: '#666' }}>
              当前配置：{personnelStats.total} 个填报账号，{taskStats.total} 个填报任务
            </p>
            <p style={{ color: '#666' }}>确定要发布项目吗？</p>
          </div>
        ),
        okText: '确定发布',
        cancelText: '取消',
        onOk: async () => {
          try {
            // 先发布
            await projectService.publishProject(projectId!);
            // 再启动填报
            await projectService.startProject(projectId!);
            message.success('项目发布成功，已启动填报');
            loadProject();
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
          icon: <ExclamationCircleOutlined />,
          content: '发布后项目将进入填报阶段，部分配置将无法修改。确定要发布项目吗？',
          okText: '确定发布',
          cancelText: '取消',
          onOk: async () => {
            try {
              await projectService.publishProject(projectId!);
              await projectService.startProject(projectId!);
              message.success('项目发布成功，已启动填报');
              loadProject();
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

  // 进入评审（填报中 → 评审中）
  const handleReviewProject = () => {
    Modal.confirm({
      title: '进入评审',
      icon: <ExclamationCircleOutlined />,
      content: '进入评审后将关闭数据填报通道。确定要进入评审阶段吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.reviewProject(projectId!);
          message.success('项目已进入评审阶段');
          loadProject();
        } catch (error: any) {
          message.error(error.message || '操作失败');
        }
      },
    });
  };

  // 完成项目（评审中 → 已完成）
  const handleCompleteProject = () => {
    Modal.confirm({
      title: '完成项目',
      icon: <ExclamationCircleOutlined />,
      content: '确定要完成此项目吗？完成后项目将归档，无法再进行修改。',
      okText: '确定完成',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.completeProject(projectId!);
          message.success('项目已完成');
          loadProject();
        } catch (error: any) {
          message.error(error.message || '操作失败');
        }
      },
    });
  };

  // 中止项目（任意状态 → 已中止）
  const handleStopProject = () => {
    Modal.confirm({
      title: '中止项目',
      icon: <ExclamationCircleOutlined />,
      content: '确定要中止此项目吗？中止后可以重新启动。',
      okText: '确定中止',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.stopProject(projectId!);
          message.success('项目已中止');
          loadProject();
        } catch (error: any) {
          message.error(error.message || '操作失败');
        }
      },
    });
  };

  // 重启项目（已中止 → 配置中）
  const handleRestartProject = () => {
    Modal.confirm({
      title: '重启项目',
      icon: <ExclamationCircleOutlined />,
      content: '确定要重启此项目吗？重启后项目将回到配置阶段。',
      okText: '确定重启',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.restartProject(projectId!);
          message.success('项目已重启');
          loadProject();
        } catch (error: any) {
          message.error(error.message || '操作失败');
        }
      },
    });
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      '配置中': 'default',
      '填报中': 'processing',
      '评审中': 'warning',
      '已中止': 'error',
      '已完成': 'success',
    };
    return colorMap[status] || 'default';
  };

  // ==================== 编辑权限判断 ====================

  // 判断项目是否可编辑（仅配置中状态可以完全编辑）
  const isEditable = project?.status === '配置中';

  // 判断是否为只读模式（已完成或已中止）
  const isReadOnly = project?.status === '已完成' || project?.status === '已中止';

  // ==================== 渲染 ====================

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
          <h1 className={styles.pageTitle}>评估项目配置</h1>
        </div>
        <div className={styles.headerRight}>
          <Button icon={<FileTextOutlined />}>评估指标体系库</Button>
          <Button icon={<SettingOutlined />}>评估要素库</Button>
          <Button icon={<PaperClipOutlined />}>数据采集工具库</Button>
        </div>
      </div>

      {/* 项目信息卡片 */}
      <Card className={styles.projectInfoCard}>
        <div className={styles.projectHeader}>
          <div className={styles.projectTitleRow}>
            <h2 className={styles.projectName}>{project.name}</h2>
            <a href="#" className={styles.indicatorLink}>
              {project.indicatorSystemName || '教育质量监测指标体系'}
            </a>
          </div>
          <div className={styles.projectMeta}>
            <span className={styles.projectPeriod}>
              项目周期：{project.startDate || '2025-04-01'} 至 {project.endDate || '2025-06-30'}
            </span>
            <Tag color={getStatusColor(project.status)} className={styles.statusTag}>
              {project.status}
            </Tag>
          </div>
        </div>
        <div className={styles.projectDesc}>
          {project.description || '针对和平区义务教育阶段学校进行教育质量监测'}
        </div>
        <div className={styles.attachmentList}>
          <Tag icon={<FilePdfOutlined />} className={styles.attachmentTag} color="red">
            政策文件.pdf (512.3 KB)
          </Tag>
          <Tag icon={<FilePdfOutlined />} className={styles.attachmentTag} color="red">
            评估标准.pdf (1.2 MB)
          </Tag>
          <Tag icon={<FileWordOutlined />} className={styles.attachmentTag} color="blue">
            评估说明.docx (245.6 KB)
          </Tag>
        </div>

        {/* 项目状态流转操作 */}
        <div className={styles.statusActions}>
          {project.status === '配置中' && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handlePublishProject}
            >
              发布项目
            </Button>
          )}
          {project.status === '填报中' && (
            <Button
              type="primary"
              icon={<AuditOutlined />}
              onClick={handleReviewProject}
            >
              进入评审
            </Button>
          )}
          {project.status === '评审中' && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleCompleteProject}
            >
              完成项目
            </Button>
          )}
          {project.status === '已中止' && (
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRestartProject}
            >
              重启项目
            </Button>
          )}
          {project.status !== '已完成' && project.status !== '已中止' && (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              onClick={handleStopProject}
            >
              中止项目
            </Button>
          )}
        </div>
      </Card>

      {/* 填报进度概览 - 仅在非配置中状态显示 */}
      <ProgressOverview
        projectId={projectId || ''}
        projectStatus={project.status}
      />

      {/* 主内容区域 - Tab切换 */}
      <Card className={styles.mainCard}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className={styles.mainTabs}
          items={[
            {
              key: 'indicator',
              label: '指标体系',
              children: (
                <IndicatorTab
                  projectId={projectId || ''}
                  indicatorSystemId={project.indicatorSystemId}
                  indicatorSystemName={project.indicatorSystemName}
                  disabled={!isEditable}
                  elementLibraryId={project.elementLibraryId}
                />
              ),
            },
            {
              key: 'data',
              label: '采集工具',
              children: (
                <DataEntryTab
                  projectId={projectId || ''}
                  disabled={!isEditable}
                />
              ),
            },
            {
              key: 'submission-school',
              label: '填报学校',
              children: (
                <SubmissionSchoolTab
                  districts={submissionDistricts}
                  expandedDistricts={submissionExpandedDistricts}
                  schoolTypeFilter={schoolTypeFilter}
                  statistics={submissionStatistics}
                  onSchoolTypeFilterChange={setSchoolTypeFilter}
                  onToggleExpand={toggleSubmissionDistrictExpand}
                  onAddDistrict={() => setAddDistrictModalVisible(true)}
                  onAddSchool={handleOpenAddSchool}
                  onDeleteDistrict={deleteSubmissionDistrict}
                  onDeleteSchool={deleteSubmissionSchool}
                  onImport={() => setImportSchoolModalVisible(true)}
                  disabled={!isEditable}
                  loading={submissionLoading}
                />
              ),
            },
            {
              key: 'personnel',
              label: '填报账号',
              children: (
                <PersonnelTab
                  projectId={projectId || ''}
                  personnel={personnel}
                  personnelSearch={personnelSearch}
                  onSearchChange={setPersonnelSearch}
                  onAddPerson={handleOpenAddPerson}
                  onImport={() => setImportModalVisible(true)}
                  onDeletePerson={deletePerson}
                  onOpenMore={(role) => {
                    setMorePersonRole(role);
                    setMorePersonModalVisible(true);
                  }}
                  filterPersonnel={filterPersonnel}
                  disabled={isReadOnly}
                />
              ),
            },
            {
              key: 'task',
              label: '任务分配',
              children: (
                <TaskAssignmentTab
                  projectId={projectId || ''}
                  projectStatus={project.status}
                  personnel={personnel}
                  disabled={isReadOnly}
                />
              ),
            },
            // {
            //   key: 'sample',
            //   label: '评估样本',
            //   children: (
            //     <SampleTab
            //       samples={samples}
            //       sampleDataConfig={sampleDataConfig}
            //       expandedDistricts={expandedDistricts}
            //       onToggleExpand={toggleDistrictExpand}
            //       onConfigSample={() => setConfigSampleModalVisible(true)}
            //       onAddSample={() => setAddSampleModalVisible(true)}
            //       onDeleteSample={deleteSample}
            //       onDeleteTeacher={deleteTeacher}
            //       onAddTeacher={handleOpenAddTeacher}
            //       onTeacherModeChange={updateTeacherMode}
            //       disabled={!isEditable}
            //     />
            //   ),
            // },
            {
              key: 'review',
              label: '专家评审',
              children: (
                <ExpertReviewTab
                  projectId={projectId || ''}
                  projectStatus={project.status}
                  personnel={personnel}
                  disabled={isReadOnly}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 弹窗组件 */}
      <AddPersonModal
        visible={addPersonModalVisible}
        onCancel={() => {
          setAddPersonModalVisible(false);
          setAddPersonPresetRole(undefined);
        }}
        onSubmit={handleAddPerson}
        onBatchSubmit={handleBatchAddPerson}
        form={addPersonForm}
        userList={userList}
        loadingUsers={loadingUsers}
        presetRole={addPersonPresetRole}
        availableOrganizations={availableOrganizations}
      />

      <ImportModal
        visible={importModalVisible}
        step={importStep}
        importData={importData}
        filteredImportData={filteredImportData}
        importStats={importStats}
        importFilter={importFilter}
        onFilterChange={setImportFilter}
        onCancel={handleCloseImportModal}
        onLoadSample={handleLoadSampleData}
        onConfirm={handleConfirmImport}
        onReset={handleResetImport}
        onFileChange={handleFileChange}
      />

      <MorePersonModal
        visible={morePersonModalVisible}
        role={morePersonRole}
        personnel={personnel[morePersonRole] || []}
        onCancel={() => setMorePersonModalVisible(false)}
        onDeletePerson={deletePerson}
      />

      <SampleConfigModal
        visible={configSampleModalVisible}
        config={sampleDataConfig}
        onChange={setSampleDataConfig}
        onOk={() => {
          saveSampleConfig();
          setConfigSampleModalVisible(false);
        }}
        onCancel={() => setConfigSampleModalVisible(false)}
      />

      <AddSampleModal
        visible={addSampleModalVisible}
        onCancel={() => setAddSampleModalVisible(false)}
        onSubmit={handleAddSample}
        form={addSampleForm}
      />

      <AddTeacherModal
        visible={addTeacherModalVisible}
        schoolName={getSchoolById(selectedSchoolId)?.name || ''}
        onCancel={() => setAddTeacherModalVisible(false)}
        onSubmit={handleAddTeacher}
        form={addTeacherForm}
      />

      {/* 填报学校弹窗 */}
      <AddSubmissionDistrictModal
        visible={addDistrictModalVisible}
        onCancel={() => {
          setAddDistrictModalVisible(false);
          addDistrictForm.resetFields();
        }}
        onSubmit={handleAddDistrict}
        form={addDistrictForm}
      />

      <AddSubmissionSchoolModal
        visible={addSchoolModalVisible}
        districtName={getDistrictById(selectedDistrictId)?.name || ''}
        onCancel={() => {
          setAddSchoolModalVisible(false);
          addSchoolForm.resetFields();
        }}
        onSubmit={handleAddSchool}
        form={addSchoolForm}
      />

      <ImportSubmissionSchoolModal
        visible={importSchoolModalVisible}
        onCancel={() => setImportSchoolModalVisible(false)}
        onImport={importSchools}
        existingDistricts={allSubmissionDistricts.map(d => ({ name: d.name, code: d.code }))}
      />
    </div>
  );
};

export default ProjectConfig;
