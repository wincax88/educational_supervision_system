/**
 * 项目配置页面
 * 按照Figma设计稿重新设计
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
  Space,
  Empty,
  Form,
  Input,
  Select,
  Tabs,
  Checkbox,
  Upload,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  UploadOutlined,
  SearchOutlined,
  UserAddOutlined,
  DownOutlined,
  RightOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as projectService from '../../services/projectService';
import type { Project } from '../../services/projectService';
import styles from './index.module.css';

// Mock 数据导入
import {
  projects as mockProjects,
} from '../../mock/data';

// ==================== Mock 模式开关 ====================
const USE_MOCK = true;

// ==================== 类型定义 ====================

// 人员类型
interface Personnel {
  id: string;
  name: string;
  organization: string;
  phone: string;
  idCard: string;
  role: string;
}

// 样本数据对象配置
interface SampleDataConfig {
  district: boolean;
  school: boolean;
  grade: boolean;
  class: boolean;
  student: boolean;
  parent: boolean;
  department: boolean;
  teacher: boolean;
}

// 教师样本
interface TeacherSample {
  id: string;
  name: string;
  phone: string;
}

// 学校样本
interface SchoolSample {
  id: string;
  name: string;
  type: 'school';
  teacherSampleMode: 'self' | 'assigned'; // 学校自行确定 / 指定具体人员
  teachers: TeacherSample[];
}

// 区县样本
interface DistrictSample {
  id: string;
  name: string;
  type: 'district';
  schools: SchoolSample[];
}

// 导入人员记录状态
type ImportStatus = 'confirmed' | 'new' | 'name_conflict' | 'id_conflict' | 'phone_conflict';

interface ImportRecord {
  id: string;
  status: ImportStatus;
  role: string;
  name: string;
  organization: string;
  phone: string;
  idCard: string;
}

// ==================== Mock 数据 ====================

const mockPersonnel: Record<string, Personnel[]> = {
  'system_admin': [
    { id: '1', name: 'AAA', organization: '沈阳市教育局', phone: '', idCard: '', role: 'system_admin' },
  ],
  'project_manager': [
    { id: '2', name: '111', organization: '沈阳市教育局', phone: '13900000111', idCard: '210100********1111', role: 'project_manager' },
    { id: '3', name: '222', organization: '沈阳市教育督导室', phone: '13900000222', idCard: '210100********2222', role: 'project_manager' },
  ],
  'data_collector': [
    { id: '4', name: '333', organization: '和平区教育局', phone: '13900000333', idCard: '210100********3333', role: 'data_collector' },
    { id: '5', name: '444', organization: '沈河区教育局', phone: '13900000444', idCard: '210100********4444', role: 'data_collector' },
  ],
  'expert': [
    { id: '6', name: '555', organization: '东北大学', phone: '13900000555', idCard: '210100********5555', role: 'expert' },
    { id: '7', name: '666', organization: '辽宁大学', phone: '13900000666', idCard: '210100********6666', role: 'expert' },
  ],
};

const mockSamples: DistrictSample[] = [
  {
    id: 'd1',
    name: '和平区',
    type: 'district',
    schools: [
      {
        id: 's1',
        name: '沈阳市第一中学',
        type: 'school',
        teacherSampleMode: 'self',
        teachers: [],
      },
      {
        id: 's2',
        name: '沈阳市实验学校',
        type: 'school',
        teacherSampleMode: 'assigned',
        teachers: [
          { id: 't1', name: '张老师', phone: '13800138001' },
          { id: 't2', name: '李老师', phone: '13800138002' },
        ],
      },
    ],
  },
  {
    id: 'd2',
    name: '沈河区',
    type: 'district',
    schools: [
      {
        id: 's3',
        name: '沈河区第一小学',
        type: 'school',
        teacherSampleMode: 'self',
        teachers: [],
      },
    ],
  },
];

const mockImportData: ImportRecord[] = [
  { id: '1', status: 'confirmed', role: '数据采集员', name: '王明', organization: '铁西区教育局', phone: '13900001001', idCard: '210100********1001' },
  { id: '2', status: 'name_conflict', role: '数据采集员', name: '李华', organization: '大东区教育局新址', phone: '13900009002', idCard: '210100********1002' },
  { id: '3', status: 'new', role: '项目管理员', name: '陈新', organization: '沈阳市督导办', phone: '13900009001', idCard: '210100********9001' },
  { id: '4', status: 'id_conflict', role: '数据采集员', name: '张丽丽', organization: '沈北新区教育局', phone: '13900001005', idCard: '210100********1005' },
  { id: '5', status: 'confirmed', role: '评估专家', name: '张教授', organization: '东北大学', phone: '13900002001', idCard: '210100********2001' },
  { id: '6', status: 'phone_conflict', role: '数据采集员', name: '孙小磊', organization: '法库县教育局', phone: '13900001010', idCard: '210100********1010' },
  { id: '7', status: 'name_conflict', role: '项目管理员', name: '111', organization: '沈阳市教育局', phone: '13900001111', idCard: '210100********9999' },
  { id: '8', status: 'name_conflict', role: '评估专家', name: '李教授', organization: '沈阳工业大学', phone: '13900002008', idCard: '210100********2008' },
];

// ==================== 组件 ====================

const ProjectConfig: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('sample');

  // 人员配置相关状态
  const [personnel, setPersonnel] = useState<Record<string, Personnel[]>>(mockPersonnel);
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [addPersonModalVisible, setAddPersonModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [importData, setImportData] = useState<ImportRecord[]>([]);
  const [importFilter, setImportFilter] = useState<'all' | 'confirmed' | 'new' | 'conflict'>('all');
  const [morePersonModalVisible, setMorePersonModalVisible] = useState(false);
  const [morePersonRole, setMorePersonRole] = useState<string>('');
  const [addPersonForm] = Form.useForm();

  // 样本配置相关状态
  const [samples, setSamples] = useState<DistrictSample[]>(mockSamples);
  const [sampleDataConfig, setSampleDataConfig] = useState<SampleDataConfig>({
    district: true,
    school: true,
    grade: false,
    class: false,
    student: false,
    parent: false,
    department: false,
    teacher: true,
  });
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>(['d1']);
  const [configSampleModalVisible, setConfigSampleModalVisible] = useState(false);
  const [addSampleModalVisible, setAddSampleModalVisible] = useState(false);
  const [addTeacherModalVisible, setAddTeacherModalVisible] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
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

  useEffect(() => {
    setLoading(true);
    loadProject().finally(() => {
      setLoading(false);
    });
  }, [loadProject]);

  // ==================== 人员配置相关处理 ====================

  // 添加人员
  const handleAddPerson = async (values: any) => {
    const newPerson: Personnel = {
      id: `p-${Date.now()}`,
      name: values.name,
      organization: values.organization,
      phone: values.phone,
      idCard: values.idCard || '',
      role: values.role,
    };

    setPersonnel(prev => ({
      ...prev,
      [values.role]: [...(prev[values.role] || []), newPerson],
    }));

    message.success('添加成功');
    setAddPersonModalVisible(false);
    addPersonForm.resetFields();
  };

  // 删除人员
  const handleDeletePerson = (person: Personnel) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${person.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setPersonnel(prev => ({
          ...prev,
          [person.role]: prev[person.role]?.filter(p => p.id !== person.id) || [],
        }));
        message.success('删除成功');
      },
    });
  };

  // 加载示例数据
  const handleLoadSampleData = () => {
    setImportData(mockImportData);
    setImportStep('preview');
  };

  // 确认导入
  const handleConfirmImport = () => {
    const importableData = importData.filter(r => r.status === 'confirmed' || r.status === 'new');
    // 这里应该调用API导入数据
    message.success(`成功导入 ${importableData.length} 条记录`);
    setImportModalVisible(false);
    setImportStep('upload');
    setImportData([]);
  };

  // 打开更多人员弹窗
  const handleOpenMoreModal = (role: string) => {
    setMorePersonRole(role);
    setMorePersonModalVisible(true);
  };

  // ==================== 样本配置相关处理 ====================

  // 切换区县展开
  const toggleDistrictExpand = (districtId: string) => {
    setExpandedDistricts(prev =>
      prev.includes(districtId)
        ? prev.filter(id => id !== districtId)
        : [...prev, districtId]
    );
  };

  // 保存样本数据对象配置
  const handleSaveSampleConfig = () => {
    message.success('配置保存成功');
    setConfigSampleModalVisible(false);
  };

  // 添加样本（区/学校）
  const handleAddSample = (values: any) => {
    if (values.type === 'district') {
      const newDistrict: DistrictSample = {
        id: `d-${Date.now()}`,
        name: values.name,
        type: 'district',
        schools: [],
      };
      setSamples(prev => [...prev, newDistrict]);
    } else {
      // 这里需要选择添加到哪个区
      // 简化处理：添加到第一个区
      if (samples.length > 0) {
        const newSchool: SchoolSample = {
          id: `s-${Date.now()}`,
          name: values.name,
          type: 'school',
          teacherSampleMode: 'self',
          teachers: [],
        };
        setSamples(prev => prev.map((d, idx) =>
          idx === 0 ? { ...d, schools: [...d.schools, newSchool] } : d
        ));
      }
    }
    message.success('添加成功');
    setAddSampleModalVisible(false);
    addSampleForm.resetFields();
  };

  // 添加教师样本
  const handleAddTeacher = (values: any) => {
    const newTeacher: TeacherSample = {
      id: `t-${Date.now()}`,
      name: values.name,
      phone: values.phone || '',
    };

    setSamples(prev => prev.map(district => ({
      ...district,
      schools: district.schools.map(school =>
        school.id === selectedSchoolId
          ? { ...school, teachers: [...school.teachers, newTeacher] }
          : school
      ),
    })));

    message.success('添加成功');
    setAddTeacherModalVisible(false);
    addTeacherForm.resetFields();
  };

  // 删除样本
  const handleDeleteSample = (type: 'district' | 'school', id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此样本吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        if (type === 'district') {
          setSamples(prev => prev.filter(d => d.id !== id));
        } else {
          setSamples(prev => prev.map(d => ({
            ...d,
            schools: d.schools.filter(s => s.id !== id),
          })));
        }
        message.success('删除成功');
      },
    });
  };

  // 删除教师样本
  const handleDeleteTeacher = (schoolId: string, teacherId: string) => {
    setSamples(prev => prev.map(district => ({
      ...district,
      schools: district.schools.map(school =>
        school.id === schoolId
          ? { ...school, teachers: school.teachers.filter(t => t.id !== teacherId) }
          : school
      ),
    })));
  };

  // 更新学校的教师样本模式
  const handleTeacherModeChange = (schoolId: string, mode: 'self' | 'assigned') => {
    setSamples(prev => prev.map(district => ({
      ...district,
      schools: district.schools.map(school =>
        school.id === schoolId
          ? { ...school, teacherSampleMode: mode }
          : school
      ),
    })));
  };

  // ==================== 渲染辅助函数 ====================

  // 获取角色显示名和描述
  const getRoleInfo = (role: string): { name: string; desc: string } => {
    const roleMap: Record<string, { name: string; desc: string }> = {
      'system_admin': { name: '项目创建者/系统管理员', desc: '项目创建者，拥有本项目的所有权限' },
      'project_manager': { name: '项目管理员', desc: '项目管理者，拥有本项目的所有权限' },
      'data_collector': { name: '数据采集员', desc: '负责项目数据填报和采集' },
      'expert': { name: '评估专家', desc: '负责项目评审和评估' },
    };
    return roleMap[role] || { name: role, desc: '' };
  };

  // 获取导入状态信息
  const getImportStatusInfo = (status: ImportStatus) => {
    const statusMap: Record<ImportStatus, { text: string; color: string; icon: string }> = {
      'confirmed': { text: '已确认', color: 'success', icon: '✓' },
      'new': { text: '新用户', color: 'processing', icon: '⊕' },
      'name_conflict': { text: '重名冲突', color: 'warning', icon: '⚠' },
      'id_conflict': { text: '身份证冲突', color: 'warning', icon: '⚠' },
      'phone_conflict': { text: '手机冲突', color: 'warning', icon: '⚠' },
    };
    return statusMap[status];
  };

  // 人员表格列定义
  const personnelColumns: ColumnsType<Personnel> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100,
      render: (name) => <span className={styles.personName}>{name}</span>
    },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 180 },
    { title: '电话号码', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '身份证件号码', dataIndex: 'idCard', key: 'idCard', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeletePerson(record)}
        />
      ),
    },
  ];

  // 导入预览表格列定义
  const importColumns: ColumnsType<ImportRecord> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ImportStatus) => {
        const info = getImportStatusInfo(status);
        return (
          <Tag color={info.color}>
            {info.icon} {info.text}
          </Tag>
        );
      },
    },
    { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 80 },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 150 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '身份证', dataIndex: 'idCard', key: 'idCard', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.status !== 'confirmed' && record.status !== 'new' && (
            <Button type="link" size="small">修正</Button>
          )}
          <Button type="text" danger size="small">×</Button>
        </Space>
      ),
    },
  ];

  // 过滤导入数据
  const filteredImportData = importData.filter(record => {
    if (importFilter === 'all') return true;
    if (importFilter === 'confirmed') return record.status === 'confirmed';
    if (importFilter === 'new') return record.status === 'new';
    if (importFilter === 'conflict') return ['name_conflict', 'id_conflict', 'phone_conflict'].includes(record.status);
    return true;
  });

  // 统计导入数据
  const importStats = {
    total: importData.length,
    confirmed: importData.filter(r => r.status === 'confirmed').length,
    new: importData.filter(r => r.status === 'new').length,
    conflict: importData.filter(r => ['name_conflict', 'id_conflict', 'phone_conflict'].includes(r.status)).length,
  };

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
            <Tag color="blue" className={styles.statusTag}>配置中</Tag>
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
      </Card>

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
                <div className={styles.sampleTab}>
                  {/* 样本配置标题行 */}
                  <div className={styles.sampleHeader}>
                    <h3 className={styles.sectionTitle}>评估样本配置</h3>
                    <div className={styles.sampleActions}>
                      <Button
                        type="primary"
                        icon={<SettingOutlined />}
                        onClick={() => setConfigSampleModalVisible(true)}
                      >
                        配置样本
                      </Button>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => setAddSampleModalVisible(true)}
                      >
                        添加样本
                      </Button>
                    </div>
                  </div>

                  {/* 当前数据对象配置 */}
                  <div className={styles.dataConfigInfo}>
                    <FileTextOutlined className={styles.configIcon} />
                    <span className={styles.configLabel}>当前数据对象配置：</span>
                    <div className={styles.configTags}>
                      {sampleDataConfig.district && (
                        <Tag color="blue" className={styles.levelTag}>
                          <Checkbox checked disabled /> 区
                        </Tag>
                      )}
                      {sampleDataConfig.school && (
                        <Tag className={styles.levelTag}>
                          <span className={styles.levelLine}>└─</span>
                          <Checkbox checked disabled /> 校
                        </Tag>
                      )}
                      {sampleDataConfig.teacher && (
                        <Tag className={styles.levelTag}>
                          <span className={styles.levelLine}>└─└─</span>
                          <Checkbox checked disabled /> 教师
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* 样本列表 */}
                  <div className={styles.sampleList}>
                    {samples.map(district => (
                      <div key={district.id} className={styles.districtItem}>
                        {/* 区县行 */}
                        <div className={styles.districtRow}>
                          <div className={styles.districtLeft}>
                            <span
                              className={styles.expandIcon}
                              onClick={() => toggleDistrictExpand(district.id)}
                            >
                              {expandedDistricts.includes(district.id) ? <DownOutlined /> : <RightOutlined />}
                            </span>
                            <span className={styles.districtIcon}>🏛️</span>
                            <span className={styles.districtName}>{district.name}</span>
                            <Tag color="blue">区</Tag>
                            <span className={styles.schoolCount}>({district.schools.length} 所学校)</span>
                          </div>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteSample('district', district.id)}
                          >
                            删除
                          </Button>
                        </div>

                        {/* 学校列表 */}
                        {expandedDistricts.includes(district.id) && (
                          <div className={styles.schoolList}>
                            {district.schools.map(school => (
                              <div key={school.id} className={styles.schoolItem}>
                                {/* 学校行 */}
                                <div className={styles.schoolRow}>
                                  <div className={styles.schoolLeft}>
                                    <span className={styles.schoolIcon}>🏫</span>
                                    <span className={styles.schoolName}>{school.name}</span>
                                    <Tag color="green">校</Tag>
                                  </div>
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDeleteSample('school', school.id)}
                                  >
                                    删除
                                  </Button>
                                </div>

                                {/* 教师样本区域 */}
                                <div className={styles.teacherSection}>
                                  <div className={styles.teacherHeader}>
                                    <span className={styles.teacherIcon}>👨‍🏫</span>
                                    <span className={styles.teacherLabel}>教师样本</span>
                                    <Select
                                      value={school.teacherSampleMode}
                                      onChange={(v) => handleTeacherModeChange(school.id, v)}
                                      size="small"
                                      className={styles.teacherModeSelect}
                                    >
                                      <Select.Option value="self">学校自行确定</Select.Option>
                                      <Select.Option value="assigned">指定具体人员</Select.Option>
                                    </Select>
                                    {school.teacherSampleMode === 'assigned' && (
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<UserAddOutlined />}
                                        onClick={() => {
                                          setSelectedSchoolId(school.id);
                                          setAddTeacherModalVisible(true);
                                        }}
                                      >
                                        添加
                                      </Button>
                                    )}
                                  </div>
                                  {school.teacherSampleMode === 'assigned' && school.teachers.length > 0 && (
                                    <div className={styles.teacherList}>
                                      {school.teachers.map(teacher => (
                                        <Tag
                                          key={teacher.id}
                                          closable
                                          onClose={() => handleDeleteTeacher(school.id, teacher.id)}
                                          className={styles.teacherTag}
                                        >
                                          {teacher.name} ({teacher.phone})
                                        </Tag>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              key: 'indicator',
              label: '指标体系',
              children: <Empty description="指标体系配置" />,
            },
            {
              key: 'data',
              label: '数据填报',
              children: <Empty description="数据填报配置" />,
            },
            {
              key: 'review',
              label: '专家评审',
              children: <Empty description="专家评审配置" />,
            },
            {
              key: 'personnel',
              label: '人员配置',
              children: (
                <div className={styles.personnelTab}>
                  {/* 人员配置标题行 */}
                  <div className={styles.personnelHeader}>
                    <h3 className={styles.sectionTitle}>人员配置</h3>
                    <div className={styles.personnelActions}>
                      <Input
                        placeholder="搜索人员"
                        prefix={<SearchOutlined />}
                        value={personnelSearch}
                        onChange={e => setPersonnelSearch(e.target.value)}
                        className={styles.searchInput}
                      />
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setAddPersonModalVisible(true)}
                      >
                        添加人员
                      </Button>
                      <Button
                        icon={<UploadOutlined />}
                        onClick={() => setImportModalVisible(true)}
                      >
                        导入人员
                      </Button>
                    </div>
                  </div>

                  {/* 各角色人员列表 */}
                  {['system_admin', 'project_manager', 'data_collector', 'expert'].map(role => {
                    const roleInfo = getRoleInfo(role);
                    const rolePersonnel = personnel[role] || [];
                    const filteredPersonnel = personnelSearch
                      ? rolePersonnel.filter(p =>
                          p.name.includes(personnelSearch) ||
                          p.organization.includes(personnelSearch) ||
                          p.phone.includes(personnelSearch)
                        )
                      : rolePersonnel;

                    return (
                      <div key={role} className={styles.roleSection}>
                        <div className={styles.roleTitleRow}>
                          <div className={styles.roleTitle}>
                            <span className={styles.roleName}>{roleInfo.name}</span>
                            <span className={styles.roleDesc}>— {roleInfo.desc}</span>
                          </div>
                          <span className={styles.roleCount}>总人数：{rolePersonnel.length} 人</span>
                        </div>
                        <Table
                          rowKey="id"
                          columns={personnelColumns}
                          dataSource={filteredPersonnel.slice(0, 3)}
                          pagination={false}
                          size="small"
                          className={styles.personnelTable}
                        />
                        {rolePersonnel.length > 3 && (
                          <div className={styles.moreLink}>
                            <Button type="link" onClick={() => handleOpenMoreModal(role)}>
                              更多 <RightOutlined />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 添加人员弹窗 */}
      <Modal
        title="添加人员"
        open={addPersonModalVisible}
        onCancel={() => setAddPersonModalVisible(false)}
        footer={null}
        width={480}
      >
        <p className={styles.modalSubtitle}>填写人员信息或从账号库/专家库中选择</p>
        <Form form={addPersonForm} onFinish={handleAddPerson} layout="vertical">
          <Form.Item
            label="角色类型"
            name="role"
            rules={[{ required: true, message: '请选择角色类型' }]}
          >
            <Select placeholder="请选择角色类型">
              <Select.Option value="project_manager">项目管理员</Select.Option>
              <Select.Option value="data_collector">数据采集员</Select.Option>
              <Select.Option value="expert">评估专家</Select.Option>
            </Select>
          </Form.Item>
          <p className={styles.formHint}>将从账号库中选择或新建用户</p>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="输入姓名搜索" />
          </Form.Item>
          <Form.Item
            label="单位"
            name="organization"
            rules={[{ required: true, message: '请输入单位' }]}
          >
            <Input placeholder="请输入单位" />
          </Form.Item>
          <Form.Item
            label="电话号码（登录账号）"
            name="phone"
            rules={[{ required: true, message: '请输入电话号码' }]}
          >
            <Input placeholder="请输入电话号码" />
          </Form.Item>
          <Form.Item label="身份证件号码" name="idCard">
            <Input placeholder="请输入身份证件号码" />
          </Form.Item>
          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setAddPersonModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">确定</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入人员弹窗 */}
      <Modal
        title="导入人员"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportStep('upload');
          setImportData([]);
        }}
        footer={importStep === 'preview' ? [
          <Button key="back" onClick={() => {
            setImportStep('upload');
            setImportData([]);
          }}>重新导入</Button>,
          <Button key="cancel" onClick={() => {
            setImportModalVisible(false);
            setImportStep('upload');
            setImportData([]);
          }}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleConfirmImport}>
            确认导入
          </Button>,
        ] : null}
        width={importStep === 'preview' ? 1000 : 700}
      >
        <p className={styles.modalSubtitle}>批量导入人员信息，系统会自动比对账号库和专家库</p>

        {importStep === 'upload' ? (
          <>
            {/* 导入说明 */}
            <div className={styles.importGuide}>
              <h4 className={styles.guideTitle}>导入说明</h4>
              <ul className={styles.guideList}>
                <li>Excel文件应包含以下字段：<strong>角色类型、姓名、单位、电话号码、身份证件号码</strong></li>
                <li>角色类型可选：<strong>项目管理员、数据采集员、评估专家、报告决策者</strong></li>
                <li>系统会自动比对账号库（项目管理员、数据采集员、报告决策者）和专家库（评估专家）</li>
                <li className={styles.guideItem}>
                  <span className={styles.guideIcon}>✓</span>
                  <strong>已确认</strong>：姓名、手机、单位、身份证全部一致
                </li>
                <li className={styles.guideItem}>
                  <span className={styles.guideIconNew}>⊕</span>
                  <strong>新用户</strong>：姓名、身份证、手机都找不到
                </li>
                <li className={styles.guideItem}>
                  <span className={styles.guideIconWarn}>⚠</span>
                  <strong>重名冲突</strong>：姓名一致，但手机、单位、身份证部分不一致
                </li>
                <li className={styles.guideItem}>
                  <span className={styles.guideIconWarn}>⚠</span>
                  <strong>身份证冲突</strong>：身份证一致，但姓名、手机、单位部分不一致
                </li>
                <li className={styles.guideItem}>
                  <span className={styles.guideIconWarn}>⚠</span>
                  <strong>手机冲突</strong>：手机一致，但姓名、身份证、单位部分不一致
                </li>
              </ul>
              <p className={styles.guideNote}>
                • 冲突记录需要人工修正确认；新用户可直接导入；已确认记录可再次修正
              </p>
            </div>

            {/* 下载模板 */}
            <div className={styles.templateSection}>
              <div className={styles.templateInfo}>
                <h4>下载导入模板</h4>
                <p>包含正确的字段格式和示例数据</p>
              </div>
              <Button icon={<UploadOutlined />}>下载模板</Button>
            </div>

            {/* 文件上传区域 */}
            <div className={styles.uploadSection}>
              <Upload.Dragger
                accept=".xlsx,.xls,.csv"
                showUploadList={false}
                beforeUpload={() => false}
                className={styles.uploadDragger}
              >
                <p className={styles.uploadIcon}>📋</p>
                <p className={styles.uploadText}>点击选择Excel文件或拖拽文件到此处</p>
                <div className={styles.uploadButtons}>
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                  <Button type="primary" icon={<FileTextOutlined />} onClick={(e) => {
                    e.stopPropagation();
                    handleLoadSampleData();
                  }}>加载示例数据</Button>
                </div>
                <p className={styles.uploadHint}>支持 .xlsx、.xls、.csv 格式，文件大小不超过5MB</p>
              </Upload.Dragger>
            </div>
          </>
        ) : (
          <>
            {/* 状态筛选 */}
            <div className={styles.importFilter}>
              <Space>
                <Tag
                  color={importFilter === 'confirmed' ? 'success' : 'default'}
                  className={styles.filterTag}
                  onClick={() => setImportFilter(importFilter === 'confirmed' ? 'all' : 'confirmed')}
                >
                  ✓ 已确认
                </Tag>
                <Tag
                  color={importFilter === 'new' ? 'processing' : 'default'}
                  className={styles.filterTag}
                  onClick={() => setImportFilter(importFilter === 'new' ? 'all' : 'new')}
                >
                  ⊕ 新用户
                </Tag>
                <Tag
                  color={importFilter === 'conflict' ? 'warning' : 'default'}
                  className={styles.filterTag}
                  onClick={() => setImportFilter(importFilter === 'conflict' ? 'all' : 'conflict')}
                >
                  ⚠ 信息冲突
                </Tag>
              </Space>
              <Input
                placeholder="搜索人员"
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
              />
            </div>

            {/* 导入预览表格 */}
            <Table
              rowKey="id"
              columns={importColumns}
              dataSource={filteredImportData}
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
            />

            {/* 统计信息 */}
            <div className={styles.importStats}>
              <span>共 {importStats.total} 条记录，</span>
              <span className={styles.statConfirmed}>{importStats.confirmed} 条已确认</span>
              <span className={styles.statNew}>{importStats.new} 条新用户</span>
              <span className={styles.statConflict}>{importStats.conflict} 条冲突</span>
            </div>
          </>
        )}
      </Modal>

      {/* 查看更多人员弹窗 */}
      <Modal
        title={getRoleInfo(morePersonRole).name}
        open={morePersonModalVisible}
        onCancel={() => setMorePersonModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMorePersonModalVisible(false)}>关闭</Button>
        ]}
        width={800}
      >
        <p className={styles.modalSubtitle}>查看和管理该角色的所有人员</p>
        <div className={styles.moreModalSearch}>
          <Input
            placeholder="搜索人员"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={personnelColumns}
          dataSource={personnel[morePersonRole] || []}
          pagination={{
            total: (personnel[morePersonRole] || []).length,
            pageSize: 10,
            showTotal: (total, range) => `共 ${total} 条记录，第 ${range[0]} / ${range[1]} 页`,
          }}
          size="small"
        />
      </Modal>

      {/* 配置样本数据对象弹窗 */}
      <Modal
        title="配置样本数据对象"
        open={configSampleModalVisible}
        onOk={handleSaveSampleConfig}
        onCancel={() => setConfigSampleModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={520}
      >
        <p className={styles.modalSubtitle}>选择需要采集的数据对象层级，上级对象可能由下级对象计算得出。</p>
        <div className={styles.sampleConfigList}>
          <div className={styles.configItem}>
            <Checkbox
              checked={sampleDataConfig.district}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, district: e.target.checked }))}
            />
            <Tag color="blue">区</Tag>
            <span>表明需要采集区相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 24 }}>
            <Checkbox
              checked={sampleDataConfig.school}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, school: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag color="green">校</Tag>
            <span>表明需要采集校相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 48 }}>
            <Checkbox
              checked={sampleDataConfig.grade}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, grade: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag>年级</Tag>
            <span>表明需要采集年级相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 72 }}>
            <Checkbox
              checked={sampleDataConfig.class}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, class: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag>班级</Tag>
            <span>表明需要采集班级相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 96 }}>
            <Checkbox
              checked={sampleDataConfig.student}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, student: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag>学生</Tag>
            <span>表明需要采集学生相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 96 }}>
            <Checkbox
              checked={sampleDataConfig.parent}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, parent: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag>家长</Tag>
            <span>表明需要采集家长相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 48 }}>
            <Checkbox
              checked={sampleDataConfig.department}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, department: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag>部门</Tag>
            <span>表明需要采集部门相关数据</span>
          </div>
          <div className={styles.configItem} style={{ marginLeft: 48 }}>
            <Checkbox
              checked={sampleDataConfig.teacher}
              onChange={e => setSampleDataConfig(prev => ({ ...prev, teacher: e.target.checked }))}
            />
            <span className={styles.levelLine}>└─</span>
            <Tag color="orange">教师</Tag>
            <span>表明需要采集教师相关数据</span>
          </div>
        </div>
        <div className={styles.configTip}>
          💡 提示：可以跳过中间层级，如直接选择【校】和【学生】，表示不需要年级和班级的数据。
        </div>
      </Modal>

      {/* 添加样本弹窗 */}
      <Modal
        title="添加样本"
        open={addSampleModalVisible}
        onCancel={() => setAddSampleModalVisible(false)}
        footer={null}
        width={400}
      >
        <p className={styles.modalSubtitle}>添加新的评估样本（区或学校）</p>
        <Form form={addSampleForm} onFinish={handleAddSample} layout="vertical">
          <Form.Item
            label="样本类型"
            name="type"
            rules={[{ required: true, message: '请选择样本类型' }]}
          >
            <Select placeholder="请选择">
              <Select.Option value="district">区</Select.Option>
              <Select.Option value="school">学校</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="样本名称"
            name="name"
            rules={[{ required: true, message: '请输入样本名称' }]}
          >
            <Input placeholder="如：和平区" />
          </Form.Item>
          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setAddSampleModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">确定添加</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加教师样本弹窗 */}
      <Modal
        title="添加教师样本"
        open={addTeacherModalVisible}
        onCancel={() => setAddTeacherModalVisible(false)}
        footer={null}
        width={400}
      >
        <p className={styles.modalSubtitle}>
          为 {samples.flatMap(d => d.schools).find(s => s.id === selectedSchoolId)?.name} 添加具体人员
        </p>
        <Form form={addTeacherForm} onFinish={handleAddTeacher} layout="vertical">
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="电话" name="phone">
            <Input placeholder="请输入电话号码" />
          </Form.Item>
          <Form.Item label="身份证号" name="idCard">
            <Input placeholder="请输入身份证号（选填）" />
          </Form.Item>
          <Form.Item className={styles.formFooter}>
            <Button onClick={() => setAddTeacherModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">确定添加</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectConfig;
