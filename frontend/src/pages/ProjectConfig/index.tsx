/**
 * 项目配置页面
 * 按照Figma设计稿重新设计
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import * as projectService from '../../services/projectService';
import type { Project } from '../../services/projectService';
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
  AddPersonModal,
  ImportModal,
  MorePersonModal,
  SampleConfigModal,
  AddSampleModal,
  AddTeacherModal,
} from './components';

// Hooks 导入
import { usePersonnel, useSamples } from './hooks';

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
  const [activeTab, setActiveTab] = useState('sample');

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

  // 弹窗状态
  const [addPersonModalVisible, setAddPersonModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [morePersonModalVisible, setMorePersonModalVisible] = useState(false);
  const [morePersonRole, setMorePersonRole] = useState<string>('');
  const [configSampleModalVisible, setConfigSampleModalVisible] = useState(false);
  const [addSampleModalVisible, setAddSampleModalVisible] = useState(false);
  const [addTeacherModalVisible, setAddTeacherModalVisible] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  // 表单实例
  const [addPersonForm] = Form.useForm();
  const [addSampleForm] = Form.useForm();
  const [addTeacherForm] = Form.useForm();

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

  const handleAddPerson = (values: any) => {
    addPerson(values);
    setAddPersonModalVisible(false);
    addPersonForm.resetFields();
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

  // ==================== 项目状态流转处理 ====================

  // 启动填报（配置中 → 填报中）
  const handleStartProject = () => {
    Modal.confirm({
      title: '启动填报',
      icon: <ExclamationCircleOutlined />,
      content: '启动后项目将进入填报阶段，部分配置将无法修改。确定要启动填报吗？',
      okText: '确定启动',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.startProject(projectId!);
          message.success('项目已启动填报');
          loadProject();
        } catch (error: any) {
          message.error(error.message || '启动失败');
        }
      },
    });
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
              icon={<PlayCircleOutlined />}
              onClick={handleStartProject}
            >
              启动填报
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
              key: 'sample',
              label: '评估样本',
              children: (
                <SampleTab
                  samples={samples}
                  sampleDataConfig={sampleDataConfig}
                  expandedDistricts={expandedDistricts}
                  onToggleExpand={toggleDistrictExpand}
                  onConfigSample={() => setConfigSampleModalVisible(true)}
                  onAddSample={() => setAddSampleModalVisible(true)}
                  onDeleteSample={deleteSample}
                  onDeleteTeacher={deleteTeacher}
                  onAddTeacher={handleOpenAddTeacher}
                  onTeacherModeChange={updateTeacherMode}
                  disabled={!isEditable}
                />
              ),
            },
            {
              key: 'indicator',
              label: '指标体系',
              children: (
                <IndicatorTab
                  projectId={projectId || ''}
                  indicatorSystemId={project.indicatorSystemId}
                  indicatorSystemName={project.indicatorSystemName}
                  disabled={!isEditable}
                />
              ),
            },
            {
              key: 'data',
              label: '数据填报',
              children: (
                <DataEntryTab
                  projectId={projectId || ''}
                  disabled={!isEditable}
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
            {
              key: 'review',
              label: '专家评审',
              children: (
                <ExpertReviewTab
                  projectId={projectId || ''}
                  projectStatus={project.status}
                />
              ),
            },
            {
              key: 'personnel',
              label: '人员配置',
              children: (
                <PersonnelTab
                  personnel={personnel}
                  personnelSearch={personnelSearch}
                  onSearchChange={setPersonnelSearch}
                  onAddPerson={() => setAddPersonModalVisible(true)}
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
          ]}
        />
      </Card>

      {/* 弹窗组件 */}
      <AddPersonModal
        visible={addPersonModalVisible}
        onCancel={() => setAddPersonModalVisible(false)}
        onSubmit={handleAddPerson}
        form={addPersonForm}
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
    </div>
  );
};

export default ProjectConfig;
