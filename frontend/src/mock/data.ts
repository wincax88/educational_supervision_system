// Mock data for the educational supervision system
import schoolSchema from './schema-school.json';

export interface ElementLibrary {
  id: string;
  name: string;
  description: string;
  elementCount: number;
  status: 'published' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Element {
  id: string;
  code: string;
  name: string;
  type: '基础要素' | '派生要素';
  dataType: '文本' | '数字' | '日期' | '选择' | '数组' | '文件';
  formula?: string;       // 派生要素的计算公式
  toolId?: string;        // 关联的采集工具ID（仅基础要素）
  fieldId?: string;       // 关联的表单控件ID（仅基础要素）
  fieldLabel?: string;    // 关联的表单控件标签
}

export interface DataTool {
  id: string;
  name: string;
  type: '表单' | '问卷';
  target: string;
  description: string;
  status: 'published' | 'editing' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface IndicatorSystem {
  id: string;
  name: string;
  type: '达标类' | '评分类';
  target: string;
  tags: string[];
  description: string;
  indicatorCount: number;
  attachments: { name: string; size: string }[];
  status: 'published' | 'editing' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  indicatorSystem: string;
  indicatorSystemId?: string;
  indicatorSystemName?: string;
  startDate: string;
  endDate: string;
  status: '配置中' | '填报中' | '评审中' | '已中止' | '已完成';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 项目工具关联类型
export interface ProjectTool {
  id: string;
  projectId: string;
  toolId: string;
  sortOrder: number;
  isRequired: number;
  createdAt: string;
  toolName: string;
  toolType: '表单' | '问卷';
  toolTarget: string;
  toolDescription: string;
  toolStatus: 'published' | 'editing' | 'draft';
}

// 可用工具类型
export interface AvailableTool {
  id: string;
  name: string;
  type: '表单' | '问卷';
  target: string;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

// 数据指标映射信息
export interface DataIndicatorMappingMock {
  id: string;
  code: string;
  name: string;
  threshold?: string;
  description?: string;
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  // 要素关联信息
  elementId?: string;          // 关联的要素ID
  elementCode?: string;        // 关联的要素编码
  elementName?: string;        // 关联的要素名称
  elementLibraryId?: string;   // 要素所属库ID
  elementLibraryName?: string; // 要素所属库名称
  // 字段映射信息
  mapping: {
    toolId: string;
    toolName: string;
    fieldId: string;
    fieldLabel: string;
  } | null;
  isMapped: boolean;
  mappingSource?: 'direct' | 'element'; // 映射来源：直接映射或通过要素映射
}

// 指标映射汇总
export interface IndicatorMappingSummaryMock {
  project: {
    id: string;
    name: string;
    indicatorSystemId: string;
    indicatorSystemName: string;
  };
  dataIndicators: DataIndicatorMappingMock[];
  stats: {
    total: number;
    mapped: number;
    unmapped: number;
  };
}

// 数据指标
export interface DataIndicator {
  id: string;
  code: string;
  name: string;
  threshold: string;
  description: string;
}

// 佐证资料
export interface SupportingMaterial {
  id: string;
  code: string;
  name: string;
  fileTypes: string;
  maxSize: string;
  description: string;
}

// 指标项
export interface Indicator {
  id: string;
  code: string;
  name: string;
  description: string;
  level: number; // 1, 2, 3 表示一级、二级、三级指标
  isLeaf: boolean; // 是否为末级指标
  dataIndicators?: DataIndicator[]; // 末级指标的数据指标
  supportingMaterials?: SupportingMaterial[]; // 末级指标的佐证资料
  children?: Indicator[];
}

// Element Libraries
export const elementLibraries: ElementLibrary[] = [
  {
    id: '1',
    name: '义务教育优质均衡评估要素库',
    description: '用于义务教育优质均衡发展督导评估的基础数据要素和派生计算要素，包含学校基本信息、师资配置、办学条件等核心要素。',
    elementCount: 15,
    status: 'published',
    createdBy: '张伟',
    createdAt: '2024-01-15',
    updatedBy: '张伟',
    updatedAt: '2024-03-20',
  },
  {
    id: '2',
    name: '幼儿园普惠督导评估要素库',
    description: '用于幼儿园普惠性督导评估的数据要素，涵盖办园条件、师资队伍、保教质量、收费标准等关键要素。',
    elementCount: 13,
    status: 'published',
    createdBy: '李娜',
    createdAt: '2024-02-10',
    updatedBy: '王芳',
    updatedAt: '2024-04-15',
  },
  {
    id: '3',
    name: '教育经费统计要素库',
    description: '用于教育经费投入与使用情况统计分析的数据要素，包含预算、支出、专项经费等财务数据。',
    elementCount: 8,
    status: 'draft',
    createdBy: '赵敏',
    createdAt: '2024-03-01',
    updatedBy: '赵敏',
    updatedAt: '2024-03-01',
  },
];

// Elements in a library
export const elements: Element[] = [
  // 基础要素 - 关联到优质均衡采集表-学校 (toolId: '6')
  { id: 'E001', code: 'E001', name: '学校名称', type: '基础要素', dataType: '文本' },
  { id: 'E002', code: 'E002', name: '学校类型', type: '基础要素', dataType: '文本' },
  { id: 'E003', code: 'E003', name: '在校学生总数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'student_count', fieldLabel: '二、资源配置 > 学生人数（在校人数）' },
  { id: 'E004', code: 'E004', name: '专任教师总数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'full_time_teacher_count', fieldLabel: '二、资源配置 > 专任教师总人数' },
  { id: 'E005', code: 'E005', name: '高级职称教师数', type: '基础要素', dataType: '数字' },
  // 学历相关要素
  { id: 'E008', code: 'E008', name: '专科学历教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'college_degree_teacher_count', fieldLabel: '二、资源配置 > 专科学历教师人数' },
  { id: 'E009', code: 'E009', name: '本科学历教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'bachelor_degree_teacher_count', fieldLabel: '二、资源配置 > 本科学历教师人数' },
  { id: 'E010', code: 'E010', name: '硕士学历教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'master_degree_teacher_count', fieldLabel: '二、资源配置 > 硕士研究生毕业学历教师人数' },
  { id: 'E011', code: 'E011', name: '博士学历教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'doctor_degree_teacher_count', fieldLabel: '二、资源配置 > 博士研究生毕业学历教师人数' },
  // 骨干教师和体艺教师
  { id: 'E012', code: 'E012', name: '县级及以上骨干教师数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'county_backbone_teacher_count', fieldLabel: '二、资源配置 > 县级及以上骨干教师人数' },
  { id: 'E013', code: 'E013', name: '体育专任教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'pe_teacher_count', fieldLabel: '二、资源配置 > 体育专任教师人数' },
  { id: 'E014', code: 'E014', name: '音乐专任教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'music_teacher_count', fieldLabel: '二、资源配置 > 音乐专任教师人数' },
  { id: 'E015', code: 'E015', name: '美术专任教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'art_teacher_count', fieldLabel: '二、资源配置 > 美术专任教师人数' },
  { id: 'E016', code: 'E016', name: '艺术专任教师人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'arts_teacher_count', fieldLabel: '二、资源配置 > 艺术专任教师人数' },
  // 场地设施
  { id: 'E017', code: 'E017', name: '教学及辅助用房总面积', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'teaching_auxiliary_area', fieldLabel: '二、资源配置 > 教学及辅助用房总面积' },
  { id: 'E018', code: 'E018', name: '运动场地面积', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'sports_field_area', fieldLabel: '二、资源配置 > 运动场地面积' },
  { id: 'E019', code: 'E019', name: '室内体育用房面积', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'indoor_sports_area', fieldLabel: '二、资源配置 > 室内体育用房面积' },
  { id: 'E020', code: 'E020', name: '教学仪器设备资产值', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'teaching_equipment_value', fieldLabel: '二、资源配置 > 教学仪器设备资产值（账面原值）' },
  { id: 'E021', code: 'E021', name: '网络多媒体教室间数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'multimedia_classroom_count', fieldLabel: '二、资源配置 > 网络多媒体教室间数' },
  // 培训和资格证
  { id: 'E022', code: 'E022', name: '近5年培训满360学时教师数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'trained_teacher_count', fieldLabel: '三、政府保障 > 近5年培训满360学时专任教师人数' },
  { id: 'E023', code: 'E023', name: '持有教师资格证的专任教师数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'certified_teacher_count', fieldLabel: '二、资源配置 > 持有教师资格证的专任教师人数' },
  { id: 'E024', code: 'E024', name: '划片范围内在校学生人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'local_student_count', fieldLabel: '三、政府保障 > 家庭住址（在）划片范围内的在校学生人数' },
  // 教育质量
  { id: 'E025', code: 'E025', name: '毕业学生人数', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'graduate_count', fieldLabel: '四、教育质量 > 毕业学生人数' },
  { id: 'E026', code: 'E026', name: '教师培训经费决算总额', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'teacher_training_funding', fieldLabel: '四、教育质量 > 上年度教师培训经费决算总额' },
  { id: 'E027', code: 'E027', name: '公用经费决算总额', type: '基础要素', dataType: '数字', toolId: '6', fieldId: 'public_funding_settlement', fieldLabel: '四、教育质量 > 上年度公用经费决算总额' },
  // 派生要素 - 计算公式
  { id: 'E006', code: 'E006', name: '生师比', type: '派生要素', dataType: '数字', formula: 'E003 / E004' },
  { id: 'E007', code: 'E007', name: '高级职称教师占比', type: '派生要素', dataType: '数字', formula: '(E005 / E004) * 100' },
  { id: 'E028', code: 'E028', name: '每百名学生拥有高于规定学历教师数(小学)', type: '派生要素', dataType: '数字', formula: '((E008 + E009 + E010 + E011) / E003) * 100' },
  { id: 'E029', code: 'E029', name: '每百名学生拥有高于规定学历教师数(初中)', type: '派生要素', dataType: '数字', formula: '((E009 + E010 + E011) / E003) * 100' },
  { id: 'E030', code: 'E030', name: '每百名学生拥有骨干教师数', type: '派生要素', dataType: '数字', formula: '(E012 / E003) * 100' },
  { id: 'E031', code: 'E031', name: '每百名学生拥有体育艺术教师数', type: '派生要素', dataType: '数字', formula: '((E013 + E014 + E015 + E016) / E003) * 100' },
  { id: 'E032', code: 'E032', name: '生均教学及辅助用房面积', type: '派生要素', dataType: '数字', formula: '(E017 - E019) / E003' },
  { id: 'E033', code: 'E033', name: '生均体育运动场馆面积', type: '派生要素', dataType: '数字', formula: '(E018 + E019) / E003' },
  { id: 'E034', code: 'E034', name: '生均教学仪器设备值', type: '派生要素', dataType: '数字', formula: '(E020 * 10000) / E003' },
  { id: 'E035', code: 'E035', name: '每百名学生拥有网络多媒体教室数', type: '派生要素', dataType: '数字', formula: '(E021 / E003) * 100' },
  { id: 'E036', code: 'E036', name: '教师培训完成率', type: '派生要素', dataType: '数字', formula: '(E022 / E004) * 100' },
  { id: 'E037', code: 'E037', name: '教师资格证上岗率', type: '派生要素', dataType: '数字', formula: '(E023 / E004) * 100' },
  { id: 'E038', code: 'E038', name: '就近划片入学比例', type: '派生要素', dataType: '数字', formula: '(E024 / E003) * 100' },
  { id: 'E039', code: 'E039', name: '培训经费占比', type: '派生要素', dataType: '数字', formula: '(E026 / E027) * 100' },
];

// Data Collection Tools
export const dataTools: DataTool[] = [
  {
    id: '1',
    name: '学校基础数据采集表',
    type: '表单',
    target: '学校',
    description: '用于采集学校基本信息、办学条件、师资队伍等基础数据，包括学校基本情况、学生规模、教职工配置、校舍建筑、设施设备等内容。',
    status: 'published',
    createdBy: '张伟',
    createdAt: '2024-01-15',
    updatedBy: '张伟',
    updatedAt: '2024-03-20',
  },
  {
    id: '2',
    name: '教师专业发展数据表',
    type: '表单',
    target: '学校',
    description: '采集教师的学历结构、职称结构、培训情况、教学能力等专业发展数据，为教师队伍建设提供数据支持。',
    status: 'published',
    createdBy: '李娜',
    createdAt: '2024-02-01',
    updatedBy: '李娜',
    updatedAt: '2024-03-18',
  },
  {
    id: '3',
    name: '学校办学条件数据表',
    type: '表单',
    target: '学校',
    description: '采集学校校舍建筑面积、教学设备设施、图书资源、体育场馆等办学条件相关数据。',
    status: 'editing',
    createdBy: '王芳',
    createdAt: '2024-02-15',
    updatedBy: '赵强',
    updatedAt: '2024-03-25',
  },
  {
    id: '4',
    name: '义务教育优质均衡发展督导评估现场核查表',
    type: '表单',
    target: '学校',
    description: '用于现场核查学校义务教育优质均衡发展情况，包括资源配置、政府保障程度、教育质量、社会认可度等方面的详细数据采集，涵盖基本信息、学校规模、师资配置、办学条件、设施设备、经费投入等31项核心指标。',
    status: 'published',
    createdBy: '系统管理员',
    createdAt: '2024-11-10',
    updatedBy: '系统管理员',
    updatedAt: '2024-11-14',
  },
  {
    id: '5',
    name: '教师满意度调查问卷',
    type: '问卷',
    target: '教师',
    description: '调查教师对学校管理、工作环境、专业发展、薪酬待遇等方面的满意度，了解教师的真实感受和需求。',
    status: 'published',
    createdBy: '刘洋',
    createdAt: '2024-03-01',
    updatedBy: '刘洋',
    updatedAt: '2024-03-15',
  },
  {
    id: '6',
    name: '优质均衡采集表-学校',
    type: '表单',
    target: '学校',
    description: '用于义务教育优质均衡发展督导评估的学校数据采集表，包含基本指标、资源配置、政府保障、教育质量等五大类数据采集项目。',
    status: 'published',
    createdBy: '系统管理员',
    createdAt: '2024-12-01',
    updatedBy: '系统管理员',
    updatedAt: '2024-12-13',
  },
  {
    id: '7',
    name: '优质均衡采集表-区县',
    type: '表单',
    target: '区县',
    description: '用于义务教育优质均衡发展督导评估的区县数据采集表，包含基础信息、政府保障程度、教育质量、社会认可度等四大类数据采集项目。',
    status: 'published',
    createdBy: '系统管理员',
    createdAt: '2024-12-01',
    updatedBy: '系统管理员',
    updatedAt: '2024-12-13',
  },
  {
    id: '8',
    name: '优质均衡数据采集表单-学校',
    type: '表单',
    target: '学校',
    description: '用于义务教育优质均衡发展督导评估的学校端数据采集表单，涵盖学校基本信息、办学条件、师资队伍、教育教学质量等核心数据项，支持学校层面的资源配置和发展水平评估。',
    status: 'published',
    createdBy: '系统管理员',
    createdAt: '2024-12-10',
    updatedBy: '系统管理员',
    updatedAt: '2024-12-13',
  },
  {
    id: '9',
    name: '优质均衡数据采集表单-区县',
    type: '表单',
    target: '区县',
    description: '用于义务教育优质均衡发展督导评估的区县端数据采集表单，涵盖区域教育概况、政府保障程度、资源配置均衡度、教育质量和社会认可度等综合数据项，支持区县层面的整体评估。',
    status: 'published',
    createdBy: '系统管理员',
    createdAt: '2024-12-10',
    updatedBy: '系统管理员',
    updatedAt: '2024-12-13',
  },
];

// Indicator Systems
export const indicatorSystems: IndicatorSystem[] = [
  {
    id: '1',
    name: '义务教育优质均衡发展评估指标体系（2024版）',
    type: '达标类',
    target: '区县',
    tags: ['义务教育', '优质均衡', '资源配置', '政府保障', '教育质量'],
    description: '根据国家义务教育优质均衡发展督导评估办法制定，用于评估区县级义务教育优质均衡发展水平。包含四个维度：资源配置（7项，需计算差异系数）、政府保障程度（15项）、教育质量（9项）、社会认可度（1项），共32项核心指标。',
    indicatorCount: 32,
    attachments: [
      { name: '义务教育优质均衡发展评估实施细则.pdf', size: '2.3 MB' },
      { name: '评估指标解读说明.docx', size: '856 KB' },
      { name: '数据采集工作手册.pdf', size: '1.5 MB' },
    ],
    status: 'published',
    createdBy: 'AAA',
    createdAt: '2024-01-15',
    updatedBy: 'AAA',
    updatedAt: '2024-03-20',
  },
  {
    id: '2',
    name: '教育质量监测指标体系',
    type: '评分类',
    target: '学校',
    tags: ['教育质量', '学生发展', '监测评估'],
    description: '用于监测学校教育质量的综合指标体系，重点关注学生发展水平、教师专业能力和学校管理效能等方面。',
    indicatorCount: 3,
    attachments: [
      { name: '教育质量监测工作方案.pdf', size: '1.2 MB' },
    ],
    status: 'editing',
    createdBy: 'BBB',
    createdAt: '2024-06-01',
    updatedBy: 'BBB',
    updatedAt: '2024-08-15',
  },
];

// Projects
export const projects: Project[] = [
  {
    id: '1',
    name: '2024年沈阳市义务教育优质均衡发展督导评估',
    keywords: ['义务教育', '优质均衡', '2024年'],
    description: '对全市各区县义务教育优质均衡发展情况进行全面督导评估',
    indicatorSystem: '义务教育优质均衡发展评估指标体系（2024版）',
    indicatorSystemId: '1',
    indicatorSystemName: '义务教育优质均衡发展评估指标体系（2024版）',
    startDate: '2024-03-01',
    endDate: '2024-12-31',
    status: '配置中',
    createdBy: '张伟',
    createdAt: '2024-02-15 10:30:00',
    updatedAt: '2024-03-01 14:20:00',
  },
  {
    id: '2',
    name: '2024年幼儿园普惠性督导评估',
    keywords: ['幼儿园', '普惠性', '2024年'],
    description: '对全市普惠性幼儿园进行督导评估',
    indicatorSystem: '幼儿园普惠督导评估指标体系',
    indicatorSystemId: '2',
    indicatorSystemName: '教育质量监测指标体系',
    startDate: '2024-04-01',
    endDate: '2024-11-30',
    status: '填报中',
    createdBy: '李娜',
    createdAt: '2024-03-01 09:00:00',
    updatedAt: '2024-04-01 16:45:00',
  },
];

// 项目关联的采集工具
export const projectTools: { [projectId: string]: ProjectTool[] } = {
  '1': [
    {
      id: 'pt-1',
      projectId: '1',
      toolId: '1',
      sortOrder: 1,
      isRequired: 1,
      createdAt: '2024-02-20 10:00:00',
      toolName: '学校基础数据采集表',
      toolType: '表单',
      toolTarget: '学校',
      toolDescription: '用于采集学校基本信息、办学条件、师资队伍等基础数据',
      toolStatus: 'published',
    },
    {
      id: 'pt-2',
      projectId: '1',
      toolId: '2',
      sortOrder: 2,
      isRequired: 1,
      createdAt: '2024-02-20 10:05:00',
      toolName: '教师专业发展数据表',
      toolType: '表单',
      toolTarget: '学校',
      toolDescription: '采集教师的学历结构、职称结构、培训情况、教学能力等专业发展数据',
      toolStatus: 'published',
    },
    {
      id: 'pt-3',
      projectId: '1',
      toolId: '4',
      sortOrder: 3,
      isRequired: 1,
      createdAt: '2024-02-20 10:10:00',
      toolName: '义务教育优质均衡发展督导评估现场核查表',
      toolType: '表单',
      toolTarget: '学校',
      toolDescription: '用于现场核查学校义务教育优质均衡发展情况',
      toolStatus: 'published',
    },
    {
      id: 'pt-4',
      projectId: '1',
      toolId: '5',
      sortOrder: 4,
      isRequired: 0,
      createdAt: '2024-02-20 10:15:00',
      toolName: '教师满意度调查问卷',
      toolType: '问卷',
      toolTarget: '教师',
      toolDescription: '调查教师对学校管理、工作环境、专业发展、薪酬待遇等方面的满意度',
      toolStatus: 'published',
    },
  ],
  '2': [
    {
      id: 'pt-5',
      projectId: '2',
      toolId: '1',
      sortOrder: 1,
      isRequired: 1,
      createdAt: '2024-03-05 09:00:00',
      toolName: '学校基础数据采集表',
      toolType: '表单',
      toolTarget: '学校',
      toolDescription: '用于采集学校基本信息、办学条件、师资队伍等基础数据',
      toolStatus: 'published',
    },
  ],
};

// 可用工具（未关联到项目的工具）
export const availableToolsByProject: { [projectId: string]: AvailableTool[] } = {
  '1': [
    {
      id: '3',
      name: '学校办学条件数据表',
      type: '表单',
      target: '学校',
      description: '采集学校校舍建筑面积、教学设备设施、图书资源、体育场馆等办学条件相关数据',
      status: 'published',
      createdBy: '王芳',
      createdAt: '2024-02-15',
    },
  ],
  '2': [
    {
      id: '2',
      name: '教师专业发展数据表',
      type: '表单',
      target: '学校',
      description: '采集教师的学历结构、职称结构、培训情况、教学能力等专业发展数据',
      status: 'published',
      createdBy: '李娜',
      createdAt: '2024-02-01',
    },
    {
      id: '4',
      name: '义务教育优质均衡发展督导评估现场核查表',
      type: '表单',
      target: '学校',
      description: '用于现场核查学校义务教育优质均衡发展情况',
      status: 'published',
      createdBy: '系统管理员',
      createdAt: '2024-11-10',
    },
    {
      id: '5',
      name: '教师满意度调查问卷',
      type: '问卷',
      target: '教师',
      description: '调查教师对学校管理、工作环境、专业发展、薪酬待遇等方面的满意度',
      status: 'published',
      createdBy: '刘洋',
      createdAt: '2024-03-01',
    },
  ],
};

// 指标映射汇总数据
export const indicatorMappingSummaries: { [projectId: string]: IndicatorMappingSummaryMock } = {
  '1': {
    project: {
      id: '1',
      name: '2024年沈阳市义务教育优质均衡发展督导评估',
      indicatorSystemId: '1',
      indicatorSystemName: '义务教育优质均衡发展评估指标体系（2024版）',
    },
    dataIndicators: [
      // 资源配置指标
      {
        id: 'D1-1-1',
        code: '1.1-D1',
        name: '学生人数',
        threshold: '',
        description: '在校学生总人数',
        indicatorId: 'I1-1',
        indicatorCode: '1.1',
        indicatorName: '每百名学生拥有高于规定学历教师数',
        // 要素关联
        elementId: 'E003',
        elementCode: 'E003',
        elementName: '在校学生总数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'student_count',
          fieldLabel: '学生人数（在校人数）',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-1-3',
        code: '1.1-D3',
        name: '本科学历教师人数',
        threshold: '',
        description: '小学和初中适用',
        indicatorId: 'I1-1',
        indicatorCode: '1.1',
        indicatorName: '每百名学生拥有高于规定学历教师数',
        elementId: 'E009',
        elementCode: 'E009',
        elementName: '本科学历教师人数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'bachelor_degree_teacher_count',
          fieldLabel: '本科学历教师人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-2-2',
        code: '1.2-D2',
        name: '县级及以上骨干教师数',
        threshold: '',
        description: '县级及以上认定的骨干教师人数',
        indicatorId: 'I1-2',
        indicatorCode: '1.2',
        indicatorName: '每百名学生拥有县级以上骨干教师数',
        elementId: 'E012',
        elementCode: 'E012',
        elementName: '县级及以上骨干教师数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'county_backbone_teacher_count',
          fieldLabel: '县级及以上骨干教师人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-3-2',
        code: '1.3-D2',
        name: '体育专任教师人数',
        threshold: '',
        description: '',
        indicatorId: 'I1-3',
        indicatorCode: '1.3',
        indicatorName: '每百名学生拥有体育、艺术专任教师数',
        elementId: 'E013',
        elementCode: 'E013',
        elementName: '体育专任教师人数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'pe_teacher_count',
          fieldLabel: '体育专任教师人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-4-2',
        code: '1.4-D2',
        name: '教学及辅助用房总面积',
        threshold: '',
        description: '单位：平方米',
        indicatorId: 'I1-4',
        indicatorCode: '1.4',
        indicatorName: '生均教学及辅助用房面积',
        elementId: 'E017',
        elementCode: 'E017',
        elementName: '教学及辅助用房总面积',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'teaching_auxiliary_area',
          fieldLabel: '教学及辅助用房总面积',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-5-2',
        code: '1.5-D2',
        name: '运动场地面积',
        threshold: '',
        description: '校内体育场面积，单位：平方米',
        indicatorId: 'I1-5',
        indicatorCode: '1.5',
        indicatorName: '生均体育运动场馆面积',
        elementId: 'E018',
        elementCode: 'E018',
        elementName: '运动场地面积',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'sports_field_area',
          fieldLabel: '运动场地面积',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-6-2',
        code: '1.6-D2',
        name: '教学仪器设备资产值',
        threshold: '',
        description: '账面原值，单位：万元',
        indicatorId: 'I1-6',
        indicatorCode: '1.6',
        indicatorName: '生均教学仪器设备值',
        elementId: 'E020',
        elementCode: 'E020',
        elementName: '教学仪器设备资产值',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'teaching_equipment_value',
          fieldLabel: '教学仪器设备资产值（账面原值）',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D1-7-2',
        code: '1.7-D2',
        name: '网络多媒体教室间数',
        threshold: '',
        description: '配备网络和多媒体设备的教室数量',
        indicatorId: 'I1-7',
        indicatorCode: '1.7',
        indicatorName: '每百名学生拥有网络多媒体教室数',
        elementId: 'E021',
        elementCode: 'E021',
        elementName: '网络多媒体教室间数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'multimedia_classroom_count',
          fieldLabel: '网络多媒体教室间数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      // 政府保障程度指标
      {
        id: 'D2-9-1',
        code: '2.9-D1',
        name: '近5年培训满360学时专任教师人数',
        threshold: '',
        description: '',
        indicatorId: 'I2-9',
        indicatorCode: '2.9',
        indicatorName: '教师5年360学时培训完成率',
        elementId: 'E022',
        elementCode: 'E022',
        elementName: '近5年培训满360学时教师数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'trained_teacher_count',
          fieldLabel: '近5年培训满360学时专任教师人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D2-9-2',
        code: '2.9-D2',
        name: '专任教师总人数',
        threshold: '',
        description: '',
        indicatorId: 'I2-9',
        indicatorCode: '2.9',
        indicatorName: '教师5年360学时培训完成率',
        elementId: 'E004',
        elementCode: 'E004',
        elementName: '专任教师总数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'full_time_teacher_count',
          fieldLabel: '专任教师总人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D2-12-2',
        code: '2.12-D2',
        name: '持有教师资格证的专任教师总数',
        threshold: '',
        description: '',
        indicatorId: 'I2-12',
        indicatorCode: '2.12',
        indicatorName: '教师资格证上岗率',
        elementId: 'E023',
        elementCode: 'E023',
        elementName: '持有教师资格证的专任教师数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'certified_teacher_count',
          fieldLabel: '持有教师资格证的专任教师人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D2-13-2',
        code: '2.13-D2',
        name: '家庭住址在划片范围内的在校学生人数',
        threshold: '',
        description: '',
        indicatorId: 'I2-13',
        indicatorCode: '2.13',
        indicatorName: '就近划片入学比例',
        elementId: 'E024',
        elementCode: 'E024',
        elementName: '划片范围内在校学生人数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'local_student_count',
          fieldLabel: '家庭住址（在）划片范围内的在校学生人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      // 教育质量指标
      {
        id: 'D3-1-1',
        code: '3.1-D1',
        name: '毕业学生人数',
        threshold: '',
        description: '',
        indicatorId: 'I3-1',
        indicatorCode: '3.1',
        indicatorName: '初中三年巩固率',
        elementId: 'E025',
        elementCode: 'E025',
        elementName: '毕业学生人数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'graduate_count',
          fieldLabel: '毕业学生人数',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      {
        id: 'D3-4-1',
        code: '3.4-D1',
        name: '上年度教师培训经费决算总额',
        threshold: '',
        description: '单位：万元',
        indicatorId: 'I3-4',
        indicatorCode: '3.4',
        indicatorName: '教师培训经费',
        elementId: 'E026',
        elementCode: 'E026',
        elementName: '教师培训经费决算总额',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: {
          toolId: '6',
          toolName: '优质均衡采集表-学校',
          fieldId: 'teacher_training_funding',
          fieldLabel: '上年度教师培训经费决算总额',
        },
        isMapped: true,
        mappingSource: 'element',
      },
      // 未映射的指标 - 已有要素关联，但还未设置字段映射
      {
        id: 'D1-1-2',
        code: '1.1-D2',
        name: '专科学历教师人数',
        threshold: '',
        description: '小学适用',
        indicatorId: 'I1-1',
        indicatorCode: '1.1',
        indicatorName: '每百名学生拥有高于规定学历教师数',
        elementId: 'E008',
        elementCode: 'E008',
        elementName: '专科学历教师人数',
        elementLibraryId: '1',
        elementLibraryName: '义务教育优质均衡评估要素库',
        mapping: null,
        isMapped: false,
      },
      {
        id: 'D2-8-1',
        code: '2.8-D1',
        name: '上年度义务教育学校教师年平均工资收入水平',
        threshold: '',
        description: '不含民办学校，单位：万元',
        indicatorId: 'I2-8',
        indicatorCode: '2.8',
        indicatorName: '教师工资不低于公务员',
        mapping: null,
        isMapped: false,
      },
      {
        id: 'D2-11-1',
        code: '2.11-D1',
        name: '符合交流条件教师总数',
        threshold: '',
        description: '',
        indicatorId: 'I2-11',
        indicatorCode: '2.11',
        indicatorName: '交流轮岗教师比例',
        mapping: null,
        isMapped: false,
      },
    ],
    stats: {
      total: 17,
      mapped: 14,
      unmapped: 3,
    },
  },
  '2': {
    project: {
      id: '2',
      name: '2024年幼儿园普惠性督导评估',
      indicatorSystemId: '2',
      indicatorSystemName: '教育质量监测指标体系',
    },
    dataIndicators: [
      {
        id: 'DQ-1',
        code: 'Q1-D1',
        name: '班额达标率',
        threshold: '≤ 30人/班',
        description: '每班幼儿人数',
        indicatorId: 'IQ-1',
        indicatorCode: 'Q1',
        indicatorName: '班级规模',
        mapping: null,
        isMapped: false,
      },
      {
        id: 'DQ-2',
        code: 'Q2-D1',
        name: '师幼比',
        threshold: '≥ 1:7',
        description: '教师与幼儿的比例',
        indicatorId: 'IQ-2',
        indicatorCode: 'Q2',
        indicatorName: '师资配置',
        mapping: {
          toolId: '1',
          toolName: '学校基础数据采集表',
          fieldId: 'f5',
          fieldLabel: '教职工人数',
        },
        isMapped: true,
      },
    ],
    stats: {
      total: 2,
      mapped: 1,
      unmapped: 1,
    },
  },
};

// 指标体系的指标树数据
export const indicatorTrees: { [systemId: string]: Indicator[] } = {
  '1': [
    // 一、资源配置（7项，需计算差异系数）
    {
      id: 'I1',
      code: '1',
      name: '资源配置',
      description: '资源配置相关的评估指标，所有指标校际差异系数小学≤0.50，初中≤0.45',
      level: 1,
      isLeaf: false,
      children: [
        {
          id: 'I1-1',
          code: '1.1',
          name: '每百名学生拥有高于规定学历教师数',
          description: '小学、初中分别达到4.2人以上、5.3人以上。小学：大专及以上学历；初中：本科及以上学历',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-1-1',
              code: '1.1-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-1-2',
              code: '1.1-D2',
              name: '专科学历教师人数',
              threshold: '',
              description: '小学适用',
            },
            {
              id: 'D1-1-3',
              code: '1.1-D3',
              name: '本科学历教师人数',
              threshold: '',
              description: '小学和初中适用',
            },
            {
              id: 'D1-1-4',
              code: '1.1-D4',
              name: '硕士学历教师人数',
              threshold: '',
              description: '小学和初中适用',
            },
            {
              id: 'D1-1-5',
              code: '1.1-D5',
              name: '博士学历教师人数',
              threshold: '',
              description: '小学和初中适用',
            },
            {
              id: 'D1-1-6',
              code: '1.1-D6',
              name: '每百名学生拥有高于规定学历教师数',
              threshold: '小学≥4.2人，初中≥5.3人',
              description: '小学：((专科+本科+硕士+博士)÷学生人数)×100；初中：((本科+硕士+博士)÷学生人数)×100',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I1-2',
          code: '1.2',
          name: '每百名学生拥有县级以上骨干教师数',
          description: '小学、初中均达到1人以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-2-1',
              code: '1.2-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-2-2',
              code: '1.2-D2',
              name: '县级及以上骨干教师数',
              threshold: '',
              description: '县级及以上认定的骨干教师人数',
            },
            {
              id: 'D1-2-3',
              code: '1.2-D3',
              name: '每百名学生拥有骨干教师数',
              threshold: '小学≥1人，初中≥1人',
              description: '(骨干教师数÷学生数)×100',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I1-3',
          code: '1.3',
          name: '每百名学生拥有体育、艺术专任教师数',
          description: '小学、初中均达到0.9人以上。50人及以上但不足100人的农村小规模学校可包含交流轮岗、兼职、走教教师',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-3-1',
              code: '1.3-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-3-2',
              code: '1.3-D2',
              name: '体育专任教师人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D1-3-3',
              code: '1.3-D3',
              name: '音乐专任教师人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D1-3-4',
              code: '1.3-D4',
              name: '美术专任教师人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D1-3-5',
              code: '1.3-D5',
              name: '艺术专任教师人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D1-3-6',
              code: '1.3-D6',
              name: '是否50人及以上但不足100人的乡村小规模学校',
              threshold: '',
              description: '选择是/否',
            },
            {
              id: 'D1-3-7',
              code: '1.3-D7',
              name: '体育到校交流轮岗&兼职&走教教师人数',
              threshold: '',
              description: '仅乡村小规模学校填写',
            },
            {
              id: 'D1-3-8',
              code: '1.3-D8',
              name: '音乐到校交流轮岗&兼职&走教教师人数',
              threshold: '',
              description: '仅乡村小规模学校填写',
            },
            {
              id: 'D1-3-9',
              code: '1.3-D9',
              name: '美术到校交流轮岗&兼职&走教教师人数',
              threshold: '',
              description: '仅乡村小规模学校填写',
            },
            {
              id: 'D1-3-10',
              code: '1.3-D10',
              name: '艺术到校交流轮岗&兼职&走教教师人数',
              threshold: '',
              description: '仅乡村小规模学校填写',
            },
            {
              id: 'D1-3-11',
              code: '1.3-D11',
              name: '每百名学生拥有体育艺术专任教师数',
              threshold: '小学≥0.9人，初中≥0.9人',
              description: '普通学校：(体育+音乐+美术+艺术)÷学生数×100；乡村小规模学校可加上交流轮岗教师',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I1-4',
          code: '1.4',
          name: '生均教学及辅助用房面积',
          description: '小学、初中分别达到4.5平方米以上、5.8平方米以上（不含室内体育用房面积）',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-4-1',
              code: '1.4-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-4-2',
              code: '1.4-D2',
              name: '教学及辅助用房总面积',
              threshold: '',
              description: '单位：平方米',
            },
            {
              id: 'D1-4-3',
              code: '1.4-D3',
              name: '室内体育用房面积',
              threshold: '',
              description: '单位：平方米，需从教学及辅助用房总面积中扣除',
            },
            {
              id: 'D1-4-4',
              code: '1.4-D4',
              name: '生均教学及辅助用房面积',
              threshold: '小学≥4.5平方米，初中≥5.8平方米',
              description: '(教学及辅助用房总面积-室内体育用房面积)÷学生人数',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I1-5',
          code: '1.5',
          name: '生均体育运动场馆面积',
          description: '小学、初中分别达到7.5平方米以上、10.2平方米以上。人口密度过高的中心城区学校可包含校外周边体育场馆',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-5-1',
              code: '1.5-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-5-2',
              code: '1.5-D2',
              name: '运动场地面积',
              threshold: '',
              description: '校内体育场面积，单位：平方米',
            },
            {
              id: 'D1-5-3',
              code: '1.5-D3',
              name: '室内体育用房面积',
              threshold: '',
              description: '学校体育馆面积，单位：平方米',
            },
            {
              id: 'D1-5-4',
              code: '1.5-D4',
              name: '是否人口密度过高的大城市中心城区学校',
              threshold: '',
              description: '选择是/否',
            },
            {
              id: 'D1-5-5',
              code: '1.5-D5',
              name: '校内其他专用运动场地面积',
              threshold: '',
              description: '仅中心城区学校填写，单位：平方米',
            },
            {
              id: 'D1-5-6',
              code: '1.5-D6',
              name: '就近便利到达的校外周边体育场馆面积',
              threshold: '',
              description: '仅中心城区学校填写，需有租赁合同，步行10分钟内可达',
            },
            {
              id: 'D1-5-7',
              code: '1.5-D7',
              name: '生均体育运动场馆面积',
              threshold: '小学≥7.5平方米，初中≥10.2平方米',
              description: '普通学校：(运动场地+体育馆)÷学生数；中心城区学校可加上校外场馆',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I1-6',
          code: '1.6',
          name: '生均教学仪器设备值',
          description: '小学、初中分别达到2000元以上、2500元以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-6-1',
              code: '1.6-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-6-2',
              code: '1.6-D2',
              name: '教学仪器设备资产值（账面原值）',
              threshold: '',
              description: '单位：万元',
            },
            {
              id: 'D1-6-3',
              code: '1.6-D3',
              name: '生均教学仪器设备值',
              threshold: '小学≥2000元，初中≥2500元',
              description: '教学仪器设备资产值÷学生人数',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I1-7',
          code: '1.7',
          name: '每百名学生拥有网络多媒体教室数',
          description: '小学、初中分别达到2.3间以上、2.4间以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-7-1',
              code: '1.7-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D1-7-2',
              code: '1.7-D2',
              name: '网络多媒体教室间数',
              threshold: '',
              description: '配备网络和多媒体设备的教室数量',
            },
            {
              id: 'D1-7-3',
              code: '1.7-D3',
              name: '每百名学生拥有网络多媒体教室数',
              threshold: '小学≥2.3间，初中≥2.4间',
              description: '(网络多媒体教室间数÷学生人数)×100',
            },
          ],
          supportingMaterials: [],
        },
      ],
    },
    // 二、政府保障程度（15项）
    {
      id: 'I2',
      code: '2',
      name: '政府保障程度',
      description: '政府保障程度相关的评估指标，15项指标均要达到要求',
      level: 1,
      isLeaf: false,
      children: [
        {
          id: 'I2-1',
          code: '2.1',
          name: '县域内义务教育学校规划布局合理',
          description: '符合国家规定要求',
          level: 2,
          isLeaf: true,
          dataIndicators: [],
          supportingMaterials: [],
        },
        {
          id: 'I2-2',
          code: '2.2',
          name: '城乡义务教育学校建设标准统一',
          description: '教师编制标准统一、生均公用经费基准定额统一且不低于沈阳市标准、基本装备配置标准统一',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-2-1',
              code: '2.2-D1',
              name: '生均公用经费基准定额',
              threshold: '小学≥1150元，初中≥1350元',
              description: '省级标准：小学935元，初中1155元',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-3',
          code: '2.3',
          name: '音乐、美术专用教室配备',
          description: '每12个班级配备音乐、美术专用教室1间以上；音乐教室≥96㎡，美术教室≥90㎡（2016年及之前建校分别≥73㎡、≥67㎡）',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-3-1',
              code: '2.3-D1',
              name: '班级个数',
              threshold: '',
              description: '学校教学班总数',
            },
            {
              id: 'D2-3-2',
              code: '2.3-D2',
              name: '音乐教室间数及面积',
              threshold: '',
              description: '音乐教室数量及各教室面积',
            },
            {
              id: 'D2-3-3',
              code: '2.3-D3',
              name: '美术教室间数及面积',
              threshold: '',
              description: '美术教室数量及各教室面积',
            },
            {
              id: 'D2-3-4',
              code: '2.3-D4',
              name: '建校时间是否在2016年及之前',
              threshold: '',
              description: '选择是/否',
            },
            {
              id: 'D2-3-5',
              code: '2.3-D5',
              name: '是否最大班额低于30人的农村小规模学校',
              threshold: '',
              description: '选择是/否',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-4',
          code: '2.4',
          name: '学校规模不超标',
          description: '小学、初中规模不超过2000人，九年一贯制学校不超过2500人；2010年及之前建校或随迁子女>50%的学校可放宽至2400人',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-4-1',
              code: '2.4-D1',
              name: '学生人数',
              threshold: '',
              description: '在校学生总人数',
            },
            {
              id: 'D2-4-2',
              code: '2.4-D2',
              name: '进城务工人员随迁子女在校生人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-4-3',
              code: '2.4-D3',
              name: '建校时间是否在2010年及之前',
              threshold: '',
              description: '选择是/否',
            },
            {
              id: 'D2-4-4',
              code: '2.4-D4',
              name: '学校规模是否达标',
              threshold: '小学、初中≤2000人，九年一贯制≤2500人',
              description: '特殊情况可放宽至2400人或3000人',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-5',
          code: '2.5',
          name: '班级人数不超标',
          description: '小学、初中所有班级学生数分别不超过45人、50人',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-5-1',
              code: '2.5-D1',
              name: '各班级人数',
              threshold: '小学≤45人/班，初中≤50人/班',
              description: '填写各班级人数明细',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-6',
          code: '2.6',
          name: '公用经费保障',
          description: '不足100人的规模较小学校按不低于100人核定公用经费',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-6-1',
              code: '2.6-D1',
              name: '学生人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-6-2',
              code: '2.6-D2',
              name: '上一年度公用经费预算总额',
              threshold: '',
              description: '单位：万元',
            },
            {
              id: 'D2-6-3',
              code: '2.6-D3',
              name: '生均公用经费',
              threshold: '≥规定标准（市级小学1150，初中1350）',
              description: '上一年度公用经费预算总额÷学生人数',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-7',
          code: '2.7',
          name: '特殊教育学校生均公用经费',
          description: '特殊教育学校生均公用经费不低于8000元',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-7-1',
              code: '2.7-D1',
              name: '特殊教育学校经费总额',
              threshold: '',
              description: '单位：元',
            },
            {
              id: 'D2-7-2',
              code: '2.7-D2',
              name: '特殊教育学生人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-7-3',
              code: '2.7-D3',
              name: '特殊教育生均公用经费',
              threshold: '≥8000元',
              description: '特殊教育学校经费总额÷学生人数',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-8',
          code: '2.8',
          name: '教师工资不低于公务员',
          description: '全县义务教育学校教师平均工资收入水平不低于当地公务员平均工资收入水平',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-8-1',
              code: '2.8-D1',
              name: '上年度义务教育学校教师年平均工资收入水平',
              threshold: '',
              description: '不含民办学校，单位：万元',
            },
            {
              id: 'D2-8-2',
              code: '2.8-D2',
              name: '当地公务员平均工资收入',
              threshold: '',
              description: '单位：万元',
            },
            {
              id: 'D2-8-3',
              code: '2.8-D3',
              name: '教师工资是否达标',
              threshold: '教师工资≥公务员工资',
              description: '',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-9',
          code: '2.9',
          name: '教师5年360学时培训完成率',
          description: '教师5年360学时培训完成率达到100%',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-9-1',
              code: '2.9-D1',
              name: '近5年培训满360学时专任教师人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-9-2',
              code: '2.9-D2',
              name: '专任教师总人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-9-3',
              code: '2.9-D3',
              name: '培训完成率',
              threshold: '=100%',
              description: '(近5年培训满360学时专任教师人数÷专任教师总人数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-11',
          code: '2.11',
          name: '交流轮岗教师比例',
          description: '全县每年交流轮岗教师的比例不低于符合交流条件教师总数的10%；骨干教师不低于交流轮岗教师总数的20%',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-11-1',
              code: '2.11-D1',
              name: '符合交流条件教师总数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-11-2',
              code: '2.11-D2',
              name: '实际交流轮岗教师数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-11-3',
              code: '2.11-D3',
              name: '实际交流骨干教师数量',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-11-4',
              code: '2.11-D4',
              name: '交流轮岗教师占比',
              threshold: '>10%',
              description: '(实际交流轮岗教师数÷符合交流条件教师总数)×100%',
            },
            {
              id: 'D2-11-5',
              code: '2.11-D5',
              name: '交流轮岗骨干教师占比',
              threshold: '>20%',
              description: '(实际交流骨干教师数量÷实际交流轮岗教师数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-12',
          code: '2.12',
          name: '教师资格证上岗率',
          description: '专任教师持有教师资格证上岗率达到100%',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-12-1',
              code: '2.12-D1',
              name: '专任教师总数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-12-2',
              code: '2.12-D2',
              name: '持有教师资格证的专任教师总数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-12-3',
              code: '2.12-D3',
              name: '教师资格证上岗率',
              threshold: '=100%',
              description: '(持有教师资格证的专任教师数÷专任教师总数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-13',
          code: '2.13',
          name: '就近划片入学比例',
          description: '城区和镇区公办小学、初中（均不含寄宿制学校）就近划片入学比例分别达到100%、95%以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-13-1',
              code: '2.13-D1',
              name: '学生人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-13-2',
              code: '2.13-D2',
              name: '家庭住址在划片范围内的在校学生人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-13-3',
              code: '2.13-D3',
              name: '就近划片入学比例',
              threshold: '小学=100%，初中≥95%',
              description: '(家庭住址在划片范围内的学生人数÷学生人数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-14',
          code: '2.14',
          name: '优质高中招生名额分配',
          description: '全县优质高中招生名额分配比例不低于50%，并向农村初中倾斜',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-14-1',
              code: '2.14-D1',
              name: '优质高中招生计划总人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-14-2',
              code: '2.14-D2',
              name: '优质高中招生分配指标数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-14-3',
              code: '2.14-D3',
              name: '向农村学校分配指标数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-14-4',
              code: '2.14-D4',
              name: '优质高中招生名额分配比例',
              threshold: '≥50%',
              description: '(优质高中招生分配指标数÷优质高中招生计划总人数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I2-15',
          code: '2.15',
          name: '随迁子女就读比例',
          description: '留守儿童关爱体系健全，全县符合条件的随迁子女在公办学校和政府购买服务的民办学校就读的比例不低于85%',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D2-15-1',
              code: '2.15-D1',
              name: '符合条件的随迁子女人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-15-2',
              code: '2.15-D2',
              name: '在县域内公办学校就读的随迁子女人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-15-3',
              code: '2.15-D3',
              name: '在政府购买服务的民办学校就读随迁子女人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D2-15-4',
              code: '2.15-D4',
              name: '随迁子女就读比例',
              threshold: '≥85%',
              description: '((公办学校就读人数+政府购买服务民办学校就读人数)÷符合条件的随迁子女总数)×100%',
            },
          ],
          supportingMaterials: [],
        },
      ],
    },
    // 三、教育质量（9项）
    {
      id: 'I3',
      code: '3',
      name: '教育质量',
      description: '教育质量相关的评估指标，9项指标均要达到要求',
      level: 1,
      isLeaf: false,
      children: [
        {
          id: 'I3-1',
          code: '3.1',
          name: '初中三年巩固率',
          description: '全县初中三年巩固率达到95%以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D3-1-1',
              code: '3.1-D1',
              name: '毕业学生人数',
              threshold: '',
              description: '',
            },
            {
              id: 'D3-1-2',
              code: '3.1-D2',
              name: '毕业年级三年前初一时在校学生数',
              threshold: '',
              description: '',
            },
            {
              id: 'D3-1-3',
              code: '3.1-D3',
              name: '毕业年级三年转入学生数',
              threshold: '',
              description: '',
            },
            {
              id: 'D3-1-4',
              code: '3.1-D4',
              name: '毕业年级三年转出学生数',
              threshold: '',
              description: '',
            },
            {
              id: 'D3-1-5',
              code: '3.1-D5',
              name: '毕业年级三年死亡学生数',
              threshold: '',
              description: '',
            },
            {
              id: 'D3-1-6',
              code: '3.1-D6',
              name: '初中三年巩固率',
              threshold: '≥95%',
              description: '(毕业学生人数-转入学生数+转出学生数)÷(初一时在校生数-死亡学生数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I3-2',
          code: '3.2',
          name: '残疾儿童少年入学率',
          description: '全县残疾儿童少年入学率达到95%以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D3-2-1',
              code: '3.2-D1',
              name: '适龄残疾儿童少年入学总人数',
              threshold: '',
              description: '包括随班就读、送教上门、特教学校就读',
            },
            {
              id: 'D3-2-2',
              code: '3.2-D2',
              name: '适龄残疾儿童少年总数',
              threshold: '',
              description: '',
            },
            {
              id: 'D3-2-3',
              code: '3.2-D3',
              name: '残疾儿童少年入学率',
              threshold: '≥95%',
              description: '(适龄残疾儿童少年入学总人数÷适龄残疾儿童少年总数)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I3-3',
          code: '3.3',
          name: '学校制定章程，实现管理与教学信息化',
          description: '所有学校制定章程，实现学校管理与教学信息化',
          level: 2,
          isLeaf: true,
          dataIndicators: [],
          supportingMaterials: [
            {
              id: 'M3-3-1',
              code: '3.3-M1',
              name: '学校章程和信息化材料',
              fileTypes: 'PDF, Word',
              maxSize: '20MB',
              description: '提供学校章程及信息化建设情况说明',
            },
          ],
        },
        {
          id: 'I3-4',
          code: '3.4',
          name: '教师培训经费',
          description: '全县所有学校按照不低于学校年度公用经费预算总额的5%安排教师培训经费',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D3-4-1',
              code: '3.4-D1',
              name: '上年度教师培训经费决算总额',
              threshold: '',
              description: '单位：万元',
            },
            {
              id: 'D3-4-2',
              code: '3.4-D2',
              name: '上年度公用经费预算总额',
              threshold: '',
              description: '单位：万元',
            },
            {
              id: 'D3-4-3',
              code: '3.4-D3',
              name: '上年度公用经费决算总额',
              threshold: '',
              description: '单位：万元',
            },
            {
              id: 'D3-4-4',
              code: '3.4-D4',
              name: '培训经费占比',
              threshold: '≥5%',
              description: '(上年度教师培训经费决算总额÷上年度公用经费预算/决算总额)×100%',
            },
          ],
          supportingMaterials: [],
        },
        {
          id: 'I3-5',
          code: '3.5',
          name: '教师信息化手段教学',
          description: '教师能熟练运用信息化手段组织教学，设施设备利用率达到较高水平',
          level: 2,
          isLeaf: true,
          dataIndicators: [],
          supportingMaterials: [
            {
              id: 'M3-5-1',
              code: '3.5-M1',
              name: '信息化教学材料',
              fileTypes: 'PDF, Word, 图片, 视频',
              maxSize: '20MB',
              description: '提供教师信息化教学能力证明材料',
            },
          ],
        },
        {
          id: 'I3-6',
          code: '3.6',
          name: '德育工作、校园文化',
          description: '所有学校德育工作、校园文化建设水平达到良好以上',
          level: 2,
          isLeaf: true,
          dataIndicators: [],
          supportingMaterials: [
            {
              id: 'M3-6-1',
              code: '3.6-M1',
              name: '德育校园文化材料',
              fileTypes: 'PDF, Word, 图片',
              maxSize: '20MB',
              description: '提供德育工作和校园文化建设情况材料',
            },
          ],
        },
        {
          id: 'I3-7',
          code: '3.7',
          name: '课程开齐开足',
          description: '课程开齐开足，教学秩序规范，综合实践活动有效开展',
          level: 2,
          isLeaf: true,
          dataIndicators: [],
          supportingMaterials: [
            {
              id: 'M3-7-1',
              code: '3.7-M1',
              name: '课程开设材料',
              fileTypes: 'PDF, Word',
              maxSize: '20MB',
              description: '提供课程表、教学计划及综合实践活动材料',
            },
          ],
        },
        {
          id: 'I3-8',
          code: '3.8',
          name: '无过重课业负担',
          description: '无过重课业负担',
          level: 2,
          isLeaf: true,
          dataIndicators: [],
          supportingMaterials: [
            {
              id: 'M3-8-1',
              code: '3.8-M1',
              name: '课业负担材料',
              fileTypes: 'PDF, Word',
              maxSize: '20MB',
              description: '提供作业管理和课业负担情况说明',
            },
          ],
        },
      ],
    },
  ],
  '2': [],
};

// Statistics
export const elementLibraryStats = {
  total: 4,
  published: 2,
  draft: 2,
  elementCount: 44,
};

export const indicatorSystemStats = {
  total: 4,
  published: 2,
  editing: 2,
  standard: 2,
  scoring: 2,
};

export const projectStats = {
  configuring: 0,
  filling: 0,
  reviewing: 0,
  stopped: 0,
  completed: 0,
};

// 工具字段类型定义
export interface ToolSchemaField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  width: string;
}

// 工具的 Schema（字段列表）
export const toolSchemas: { [toolId: string]: ToolSchemaField[] } = {
  '1': [
    { id: 'f1', type: 'text', label: '学校名称', required: true, width: '100%' },
    { id: 'f2', type: 'select', label: '学校类型', required: true, width: '50%' },
    { id: 'f3', type: 'number', label: '在校学生总数', required: true, width: '50%' },
    { id: 'f4', type: 'number', label: '教职工总数', required: true, width: '50%' },
    { id: 'f5', type: 'number', label: '专任教师数', required: true, width: '50%' },
    { id: 'f6', type: 'number', label: '高级职称教师数', required: false, width: '50%' },
    { id: 'f7', type: 'number', label: '生师比', required: false, width: '50%' },
  ],
  '2': [
    { id: 'f1', type: 'number', label: '教师总数', required: true, width: '50%' },
    { id: 'f2', type: 'number', label: '本科学历教师数', required: true, width: '50%' },
    { id: 'f3', type: 'number', label: '骨干教师人数', required: true, width: '50%' },
    { id: 'f4', type: 'number', label: '参加培训教师数', required: true, width: '50%' },
    { id: 'f5', type: 'number', label: '高级职称教师数', required: false, width: '50%' },
    { id: 'f6', type: 'number', label: '中级职称教师数', required: false, width: '50%' },
  ],
  '3': [
    { id: 'f1', type: 'number', label: '校舍总面积', required: true, width: '50%' },
    { id: 'f2', type: 'number', label: '教学用房面积', required: true, width: '50%' },
    { id: 'f3', type: 'number', label: '图书馆面积', required: false, width: '50%' },
    { id: 'f4', type: 'number', label: '体育场馆面积', required: false, width: '50%' },
  ],
  '4': [
    { id: 'f1', type: 'text', label: '学校名称', required: true, width: '100%' },
    { id: 'f2', type: 'number', label: '教学用房面积', required: true, width: '50%' },
    { id: 'f3', type: 'number', label: '生均教学面积', required: true, width: '50%' },
    { id: 'f4', type: 'number', label: '教学设备总值', required: true, width: '50%' },
    { id: 'f5', type: 'number', label: '图书总册数', required: false, width: '50%' },
    { id: 'f6', type: 'number', label: '计算机数量', required: false, width: '50%' },
  ],
  '5': [
    { id: 'f1', type: 'radio', label: '对学校管理满意度', required: true, width: '100%' },
    { id: 'f2', type: 'radio', label: '对工作环境满意度', required: true, width: '100%' },
    { id: 'f3', type: 'radio', label: '对薪酬待遇满意度', required: true, width: '100%' },
    { id: 'f4', type: 'textarea', label: '意见和建议', required: false, width: '100%' },
  ],
  '6': [
    { id: 'is_rural_small_school', type: 'select', label: '是否50人及以上但不足100人的乡村小规模学校和教学点', required: false, width: '50%' },
    { id: 'founding_year', type: 'date', label: '建校年份', required: true, width: '25%' },
    { id: 'building_area', type: 'number', label: '校舍建筑面积', required: false, width: '25%' },
    { id: 'student_count', type: 'number', label: '学生人数（在校人数）', required: true, width: '25%' },
    { id: 'full_time_teacher_count', type: 'number', label: '专任教师总人数', required: true, width: '25%' },
    { id: 'county_backbone_teacher_count', type: 'number', label: '县级及以上骨干教师人数', required: true, width: '25%' },
    { id: 'teaching_auxiliary_area', type: 'number', label: '教学及辅助用房总面积', required: true, width: '25%' },
    { id: 'sports_field_area', type: 'number', label: '运动场地面积', required: true, width: '25%' },
    { id: 'teaching_equipment_value', type: 'number', label: '教学仪器设备资产值', required: true, width: '25%' },
    { id: 'multimedia_classroom_count', type: 'number', label: '网络多媒体教室间数', required: true, width: '25%' },
  ],
  '7': [
    { id: 'total_population', type: 'number', label: '人口总数', required: false, width: '25%' },
    { id: 'primary_school_count', type: 'number', label: '普通小学', required: false, width: '25%' },
    { id: 'junior_high_count', type: 'number', label: '独立初中', required: false, width: '25%' },
    { id: 'primary_student_count', type: 'number', label: '小学在校学生数', required: false, width: '25%' },
    { id: 'junior_student_count', type: 'number', label: '初中在校学生数', required: false, width: '25%' },
    { id: 'teacher_avg_salary', type: 'number', label: '上年度义务教育学校教师年平均工资收入水平', required: true, width: '50%' },
    { id: 'civil_servant_avg_salary', type: 'number', label: '上年度公务员年平均工资收入水平', required: true, width: '50%' },
    { id: 'exchange_eligible_teacher_count', type: 'number', label: '符合交流轮岗条件教师总数', required: true, width: '25%' },
    { id: 'disabled_children_population', type: 'number', label: '适龄残疾儿童少年人口总数', required: true, width: '50%' },
    { id: 'social_recognition_over_85', type: 'select', label: '社会认可度达到85％以上', required: true, width: '50%' },
  ],
  '8': [
    { id: 'school_name', type: 'text', label: '学校名称', required: true, width: '50%' },
    { id: 'school_code', type: 'text', label: '学校代码', required: true, width: '50%' },
    { id: 'school_type', type: 'select', label: '学校类型', required: true, width: '25%' },
    { id: 'school_nature', type: 'select', label: '学校性质', required: true, width: '25%' },
    { id: 'founding_year', type: 'date', label: '建校年份', required: false, width: '25%' },
    { id: 'campus_area', type: 'number', label: '校园占地面积（平方米）', required: true, width: '25%' },
    { id: 'building_area', type: 'number', label: '校舍建筑面积（平方米）', required: true, width: '25%' },
    { id: 'student_count', type: 'number', label: '在校学生总数', required: true, width: '25%' },
    { id: 'class_count', type: 'number', label: '教学班数', required: true, width: '25%' },
    { id: 'full_time_teacher_count', type: 'number', label: '专任教师总数', required: true, width: '25%' },
    { id: 'senior_teacher_count', type: 'number', label: '高级职称教师数', required: false, width: '25%' },
    { id: 'bachelor_teacher_count', type: 'number', label: '本科及以上学历教师数', required: false, width: '25%' },
    { id: 'backbone_teacher_count', type: 'number', label: '县级以上骨干教师数', required: false, width: '25%' },
    { id: 'teaching_area', type: 'number', label: '教学及辅助用房面积（平方米）', required: true, width: '25%' },
    { id: 'sports_area', type: 'number', label: '体育运动场地面积（平方米）', required: true, width: '25%' },
    { id: 'equipment_value', type: 'number', label: '教学仪器设备值（万元）', required: true, width: '25%' },
    { id: 'book_count', type: 'number', label: '图书总册数', required: false, width: '25%' },
    { id: 'computer_count', type: 'number', label: '计算机数量', required: false, width: '25%' },
    { id: 'multimedia_classroom_count', type: 'number', label: '网络多媒体教室数', required: false, width: '25%' },
  ],
  '9': [
    { id: 'region_name', type: 'text', label: '区县名称', required: true, width: '50%' },
    { id: 'region_code', type: 'text', label: '区县代码', required: true, width: '50%' },
    { id: 'total_population', type: 'number', label: '常住人口总数', required: true, width: '25%' },
    { id: 'school_age_population', type: 'number', label: '义务教育适龄人口', required: true, width: '25%' },
    { id: 'primary_school_count', type: 'number', label: '小学学校数', required: true, width: '25%' },
    { id: 'junior_high_count', type: 'number', label: '初中学校数', required: true, width: '25%' },
    { id: 'primary_student_count', type: 'number', label: '小学在校学生数', required: true, width: '25%' },
    { id: 'junior_student_count', type: 'number', label: '初中在校学生数', required: true, width: '25%' },
    { id: 'primary_teacher_count', type: 'number', label: '小学专任教师数', required: true, width: '25%' },
    { id: 'junior_teacher_count', type: 'number', label: '初中专任教师数', required: true, width: '25%' },
    { id: 'education_budget', type: 'number', label: '教育经费预算（万元）', required: true, width: '25%' },
    { id: 'education_expenditure', type: 'number', label: '教育经费支出（万元）', required: true, width: '25%' },
    { id: 'teacher_avg_salary', type: 'number', label: '义务教育教师年平均工资', required: true, width: '25%' },
    { id: 'civil_servant_avg_salary', type: 'number', label: '公务员年平均工资', required: true, width: '25%' },
    { id: 'exchange_teacher_count', type: 'number', label: '符合交流轮岗教师数', required: false, width: '25%' },
    { id: 'actual_exchange_count', type: 'number', label: '实际交流轮岗人数', required: false, width: '25%' },
    { id: 'disabled_children_count', type: 'number', label: '适龄残疾儿童少年数', required: false, width: '25%' },
    { id: 'enrolled_disabled_count', type: 'number', label: '已入学残疾儿童少年数', required: false, width: '25%' },
    { id: 'social_recognition_rate', type: 'number', label: '社会认可度（%）', required: true, width: '25%' },
  ],
};

// 完整表单 Schema（用于 FormToolEdit 初始化）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formSchemas: { [toolId: string]: any[] } = {
  '6': schoolSchema, // 优质均衡采集表-学校
  '7': [], // 优质均衡采集表-区县，通过导入 JSON 文件初始化
  '8': [
    {
      "id": "group_basic",
      "type": "group",
      "label": "一、基本指标",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "is_rural_small_school",
          "type": "select",
          "label": "是否50人及以上但不足100人的乡村小规模学校和教学点",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "is_high_density_city_school",
          "type": "select",
          "label": "是否人口密度过高的大城市中心城区学校",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ],
          "showWhen": {
            "field": "is_rural_small_school",
            "value": "no"
          }
        },
        {
          "id": "is_small_class_rural_school",
          "type": "select",
          "label": "是否最大班额低于30人的农村小规模学校",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ],
          "showWhen": {
            "field": "is_rural_small_school",
            "value": "no"
          }
        },
        {
          "id": "founding_year",
          "type": "date",
          "label": "建校年份",
          "placeholder": "请选择学校建校的具体年份",
          "width": "25%",
          "required": true
        },
        {
          "id": "building_area",
          "type": "number",
          "label": "校舍建筑面积",
          "placeholder": "请输入学校校舍的建筑总面积",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "平方米"
        },
        {
          "id": "physics_chemistry_biology_lab_count",
          "type": "number",
          "label": "理化生实验室教室间数",
          "placeholder": "请输入学校内理化生实验室教室总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "间"
        },
        {
          "id": "physics_chemistry_biology_lab_auxiliary_count",
          "type": "number",
          "label": "理化生实验室辅房间数",
          "placeholder": "请输入学校内理化生实验室辅房总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "间"
        },
        {
          "id": "comprehensive_practice_room_count",
          "type": "number",
          "label": "综合实践活动室（科技教室）套数",
          "placeholder": "请输入学校综合实践活动室（科技教室）总套数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "套"
        },
        {
          "id": "computer_total_count",
          "type": "number",
          "label": "学校计算机总台数",
          "placeholder": "请输入学校学校计算机总台数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "台"
        },
        {
          "id": "library_books_count",
          "type": "number",
          "label": "阅览室拥有的正式出版书籍册数",
          "placeholder": "请输入学校阅览室拥有的正式出版书籍册数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "册"
        },
        {
          "id": "counseling_room_individual_area_qualified",
          "type": "select",
          "label": "个别心理辅导室面积是否在10~15平方米",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "counseling_room_group_area_qualified",
          "type": "select",
          "label": "心理辅导室团体活动室面积≥20平方米",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "counseling_room_office_area_qualified",
          "type": "select",
          "label": "心理辅导室办公接待区面积是否≥15平方米",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "network_speed_qualified",
          "type": "select",
          "label": "校园网计算机网络接入传输速率≥10M",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "network_coverage_qualified",
          "type": "select",
          "label": "网络信息点覆盖全校所有场所，网络到桌面传输速率≥100M",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "security_room_area_qualified",
          "type": "select",
          "label": "安防监控室面积≥32平方米",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "security_system_qualified",
          "type": "select",
          "label": "监控系统在重要场所和出入口无盲点；人防、技防、物防达到省定标准；工作制度健全，制度上墙",
          "width": "50%",
          "required": false,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        }
      ]
    },
    {
      "id": "group_resource",
      "type": "group",
      "label": "二、资源配置",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "divider_student",
          "type": "divider",
          "label": "学生信息",
          "width": "100%",
          "required": false
        },
        {
          "id": "student_count",
          "type": "number",
          "label": "学生人数（在校人数）",
          "placeholder": "请输入学校内在校的学生总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "migrant_student_count",
          "type": "number",
          "label": "随迁子女在校生人数",
          "placeholder": "请输入学校内在校的学生总人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "migrant_worker_student_count",
          "type": "number",
          "label": "进城务工人员随迁子女在校生人数",
          "placeholder": "请输入学校内在校的学生总人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "inclusive_student_count",
          "type": "number",
          "label": "随班就读在校生人数",
          "placeholder": "请输入学校内在校的学生总人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "home_teaching_student_count",
          "type": "number",
          "label": "送教上门在校生人数",
          "placeholder": "请输入学校内在校的学生总人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "special_education_student_count",
          "type": "number",
          "label": "残疾儿童、少年特殊教育班在校生人数",
          "placeholder": "请输入学校内在校的学生总人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "divider_teacher",
          "type": "divider",
          "label": "教师信息",
          "width": "100%",
          "required": false
        },
        {
          "id": "college_degree_teacher_count",
          "type": "number",
          "label": "专科学历教师人数",
          "placeholder": "请输入学校内专科学历教师总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "bachelor_degree_teacher_count",
          "type": "number",
          "label": "本科学历教师人数",
          "placeholder": "请输入学校内本科学历教师总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "master_degree_teacher_count",
          "type": "number",
          "label": "硕士研究生毕业学历教师人数",
          "placeholder": "请输入学校内硕士研究生毕业学历教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "doctor_degree_teacher_count",
          "type": "number",
          "label": "博士研究生毕业学历教师人数",
          "placeholder": "请输入学校内博士研究生毕业学历教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "county_backbone_teacher_count",
          "type": "number",
          "label": "县级及以上骨干教师人数",
          "placeholder": "请输入学校内县级及以上骨干教师总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "full_time_teacher_count",
          "type": "number",
          "label": "专任教师总人数",
          "placeholder": "请输入学校内专任教师总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "certified_teacher_count",
          "type": "number",
          "label": "持有教师资格证的专任教师人数",
          "placeholder": "请输入学校内持有教师资格证的专任教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "pe_teacher_count",
          "type": "number",
          "label": "体育专任教师人数",
          "placeholder": "请输入学校内体育专任教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "music_teacher_count",
          "type": "number",
          "label": "音乐专任教师人数",
          "placeholder": "请输入学校内音乐专任教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "art_teacher_count",
          "type": "number",
          "label": "美术专任教师人数",
          "placeholder": "请输入学校内美术专任教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "arts_teacher_count",
          "type": "number",
          "label": "艺术专任教师人数",
          "placeholder": "请输入学校内艺术专任教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "pe_exchange_teacher_count",
          "type": "number",
          "label": "体育到校交流轮岗&兼职&走教教师人数",
          "placeholder": "请输入学校内体育到校交流轮岗&兼职&走教教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "music_exchange_teacher_count",
          "type": "number",
          "label": "音乐到校交流轮岗&兼职&走教教师人数",
          "placeholder": "请输入学校内音乐到校交流轮岗&兼职&走教教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "art_exchange_teacher_count",
          "type": "number",
          "label": "美术到校交流轮岗&兼职&走教教师人数",
          "placeholder": "请输入学校内美术到校交流轮岗&兼职&走教教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "arts_exchange_teacher_count",
          "type": "number",
          "label": "艺术到校交流轮岗&兼职&走教教师人数",
          "placeholder": "请输入学校内艺术到校交流轮岗&兼职&走教教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "divider_facility",
          "type": "divider",
          "label": "场地设施",
          "width": "100%",
          "required": false
        },
        {
          "id": "teaching_auxiliary_area",
          "type": "number",
          "label": "教学及辅助用房总面积",
          "placeholder": "请输入学校教学及辅助用房总面积",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "平方米"
        },
        {
          "id": "sports_field_area",
          "type": "number",
          "label": "运动场地面积",
          "placeholder": "请输入学校运动场地面积",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "平方米"
        },
        {
          "id": "other_sports_field_area",
          "type": "number",
          "label": "校内其他专用运动场地面积",
          "placeholder": "请输入学校校内其他专用运动场地面积",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "平方米"
        },
        {
          "id": "indoor_sports_area",
          "type": "number",
          "label": "室内体育用房面积",
          "placeholder": "请输入学校室内体育用房面积",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "平方米"
        },
        {
          "id": "nearby_sports_venue_area",
          "type": "number",
          "label": "就近便利到达的校外周边体育场馆面积",
          "placeholder": "请输入学校就近便利到达的校外周边体育场馆面积",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "平方米"
        },
        {
          "id": "teaching_equipment_value",
          "type": "number",
          "label": "教学仪器设备资产值（账面原值）",
          "placeholder": "请输入学校教学仪器设备资产值（账面原值）",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "万元"
        },
        {
          "id": "multimedia_classroom_count",
          "type": "number",
          "label": "网络多媒体教室间数",
          "placeholder": "请输入学校内网络多媒体教室间数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "间"
        }
      ]
    },
    {
      "id": "group_government",
      "type": "group",
      "label": "三、政府保障",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "music_classroom_list",
          "type": "dynamicList",
          "label": "音乐教室面积",
          "width": "100%",
          "required": true,
          "minRows": 1,
          "maxRows": 100,
          "headers": ["序号", "教室名称", "教室面积（平方米）"],
          "fields": [
            {
              "id": "music_room_index",
              "type": "number",
              "label": "序号",
              "width": "20%",
              "required": true,
              "decimalPlaces": "整数"
            },
            {
              "id": "music_room_name",
              "type": "text",
              "label": "教室名称",
              "width": "40%",
              "required": true
            },
            {
              "id": "music_room_area",
              "type": "number",
              "label": "教室面积",
              "width": "40%",
              "required": true,
              "decimalPlaces": "2位小数",
              "unit": "平方米"
            }
          ]
        },
        {
          "id": "art_classroom_list",
          "type": "dynamicList",
          "label": "美术教室面积",
          "width": "100%",
          "required": true,
          "minRows": 1,
          "maxRows": 100,
          "headers": ["序号", "教室名称", "教室面积（平方米）"],
          "fields": [
            {
              "id": "art_room_index",
              "type": "number",
              "label": "序号",
              "width": "20%",
              "required": true,
              "decimalPlaces": "整数"
            },
            {
              "id": "art_room_name",
              "type": "text",
              "label": "教室名称",
              "width": "40%",
              "required": true
            },
            {
              "id": "art_room_area",
              "type": "number",
              "label": "教室面积",
              "width": "40%",
              "required": true,
              "decimalPlaces": "2位小数",
              "unit": "平方米"
            }
          ]
        },
        {
          "id": "migrant_student_over_50_percent",
          "type": "select",
          "label": "进城务工人员随迁子女在校学生占比是否＞50%",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "class_student_list",
          "type": "dynamicList",
          "label": "班级人数",
          "width": "100%",
          "required": true,
          "minRows": 1,
          "maxRows": 100,
          "headers": ["序号", "年级", "班级名称", "人数（人）"],
          "fields": [
            {
              "id": "class_index",
              "type": "number",
              "label": "序号",
              "width": "15%",
              "required": true,
              "decimalPlaces": "整数"
            },
            {
              "id": "class_grade",
              "type": "text",
              "label": "年级",
              "width": "25%",
              "required": true
            },
            {
              "id": "class_name",
              "type": "text",
              "label": "班级名称",
              "width": "30%",
              "required": true
            },
            {
              "id": "class_student_count",
              "type": "number",
              "label": "人数",
              "width": "30%",
              "required": true,
              "decimalPlaces": "整数",
              "unit": "人"
            }
          ]
        },
        {
          "id": "special_education_funding",
          "type": "number",
          "label": "上年度特殊教育学生生均公用经费拨付总金额",
          "placeholder": "请输入上年度特殊教育学生生均公用经费拨付总金额",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "元"
        },
        {
          "id": "divider_staff",
          "type": "divider",
          "label": "教职工编制",
          "width": "100%",
          "required": false
        },
        {
          "id": "staff_total_count",
          "type": "number",
          "label": "教职工总人数",
          "placeholder": "请输入学校教职工总人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "staff_quota",
          "type": "number",
          "label": "教职工编制总额",
          "placeholder": "请输入学校教职工编制总额",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "staff_position_total",
          "type": "number",
          "label": "教职工岗位总量",
          "placeholder": "请输入学校教职工岗位总量",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "staff_in_quota_count",
          "type": "number",
          "label": "在编教职工数",
          "placeholder": "请输入学校在编教职工数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_in_quota_on_post_count",
          "type": "number",
          "label": "在编在校（岗）人数",
          "placeholder": "请输入学校在编在校（岗）人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_in_quota_teacher_count",
          "type": "number",
          "label": "在编专任教师人数",
          "placeholder": "请输入学校在编专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_in_quota_other_count",
          "type": "number",
          "label": "在编行政、教辅、工勤等其他人数",
          "placeholder": "请输入学校在编行政、教辅、工勤等其他人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_in_quota_off_post_count",
          "type": "number",
          "label": "在编不在校（岗）人数",
          "placeholder": "请输入学校在编不在校（岗）人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_in_quota_off_post_teacher_count",
          "type": "number",
          "label": "在编不在校（岗）专任教师人数",
          "placeholder": "请输入学校在编不在校（岗）专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_in_quota_off_post_other_count",
          "type": "number",
          "label": "在编不在校（岗）行政、教辅、工勤等其他人数",
          "placeholder": "请输入学校在编不在校（岗）行政、教辅、工勤等其他人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "staff_total_count",
            "condition": "filled"
          }
        },
        {
          "id": "staff_on_post_off_quota_count",
          "type": "number",
          "label": "在校（岗）不在编人数",
          "placeholder": "请输入学校在校（岗）不在编人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "staff_in_quota_off_post_explanation",
          "type": "upload",
          "label": "在编不在校（岗）情况说明",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "staff_on_post_off_quota_explanation",
          "type": "upload",
          "label": "在校（岗）不在编情况说明",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "divider_training",
          "type": "divider",
          "label": "培训与入学",
          "width": "100%",
          "required": false
        },
        {
          "id": "trained_teacher_count",
          "type": "number",
          "label": "近5年培训满360学时专任教师人数",
          "placeholder": "请输入学校近5年培训满360学时专任教师人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "local_student_count",
          "type": "number",
          "label": "家庭住址（在）划片范围内的在校学生人数",
          "placeholder": "请输入学校家庭住址（在）划片范围内的在校学生人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        }
      ]
    },
    {
      "id": "group_quality",
      "type": "group",
      "label": "四、教育质量",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "graduate_count",
          "type": "number",
          "label": "毕业学生人数",
          "placeholder": "请输入学校今年毕业学生总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "grade7_student_count_3years_ago",
          "type": "number",
          "label": "毕业年级三年前初一时在校学生人数",
          "placeholder": "请输入学校毕业年级三年前初一时在校学生总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "transfer_in_count_3years",
          "type": "number",
          "label": "毕业年级三年转入学生人数",
          "placeholder": "请输入学校毕业年级三年转入学生总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "deceased_count_3years",
          "type": "number",
          "label": "毕业年级三年死亡学生人数",
          "placeholder": "请输入学校毕业年级三年死亡学生总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "transfer_out_count_3years",
          "type": "number",
          "label": "毕业年级三年转出学生人数",
          "placeholder": "请输入学校毕业年级三年转出学生总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "public_funding_total",
          "type": "number",
          "label": "校公用经费总数",
          "placeholder": "请输入学校校公用经费总数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "万元"
        },
        {
          "id": "teacher_training_funding",
          "type": "number",
          "label": "上年度教师培训经费决算总额",
          "placeholder": "请输入学校上年度教师培训经费决算总额",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "万元"
        },
        {
          "id": "public_funding_settlement",
          "type": "number",
          "label": "上年度公用经费决算总额",
          "placeholder": "请输入学校上年度公用经费决算总额",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "万元"
        }
      ]
    },
    {
      "id": "group_other",
      "type": "group",
      "label": "五、其他",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "divider_health",
          "type": "divider",
          "label": "学生体质健康",
          "width": "100%",
          "required": false
        },
        {
          "id": "health_test_student_count",
          "type": "number",
          "label": "上学年参加国家学生体质健康标准测试人数",
          "placeholder": "请输入学校上学年参加国家学生体质健康标准测试人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "health_excellent_count",
          "type": "number",
          "label": "学生学年总分评定等级优秀学生人数",
          "placeholder": "请输入学校学生学年总分评定等级优秀学生人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "health_test_student_count",
            "condition": "filled"
          }
        },
        {
          "id": "health_good_count",
          "type": "number",
          "label": "学生学年总分评定等级良好学生人数",
          "placeholder": "请输入学校学生学年总分评定等级良好学生人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "health_test_student_count",
            "condition": "filled"
          }
        },
        {
          "id": "health_pass_count",
          "type": "number",
          "label": "学生学年总分评定等级及格学生人数",
          "placeholder": "请输入学校学生学年总分评定等级及格学生人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "health_test_student_count",
            "condition": "filled"
          }
        },
        {
          "id": "health_fail_count",
          "type": "number",
          "label": "学生学年总分评定等级不及格学生人数",
          "placeholder": "请输入学校学生学年总分评定等级不及格学生人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "health_test_student_count",
            "condition": "filled"
          }
        },
        {
          "id": "divider_teacher_age",
          "type": "divider",
          "label": "教师年龄分布",
          "width": "100%",
          "required": false
        },
        {
          "id": "teacher_age_under_24",
          "type": "number",
          "label": "24岁以下专任教师人数",
          "placeholder": "请输入学校24岁以下专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_25_29",
          "type": "number",
          "label": "25-29岁专任教师人数",
          "placeholder": "请输入学校25-29岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_30_34",
          "type": "number",
          "label": "30-34岁专任教师人数",
          "placeholder": "请输入学校30-34岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_35_39",
          "type": "number",
          "label": "35-39岁专任教师人数",
          "placeholder": "请输入学校35-39岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_40_44",
          "type": "number",
          "label": "40-44岁专任教师人数",
          "placeholder": "请输入学校40-44岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_45_49",
          "type": "number",
          "label": "45-49岁专任教师人数",
          "placeholder": "请输入学校45-49岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_50_54",
          "type": "number",
          "label": "50-54岁专任教师人数",
          "placeholder": "请输入学校50-54岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_55_59",
          "type": "number",
          "label": "55-59岁专任教师人数",
          "placeholder": "请输入学校55-59岁专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "teacher_age_over_60",
          "type": "number",
          "label": "60岁以上专任教师人数",
          "placeholder": "请输入学校60岁以上专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "divider_grade_student",
          "type": "divider",
          "label": "各年级在校人数",
          "width": "100%",
          "required": false
        },
        {
          "id": "grade_student_list",
          "type": "dynamicList",
          "label": "各年级在校人数",
          "width": "100%",
          "required": false,
          "minRows": 1,
          "maxRows": 100,
          "headers": ["年级名称", "学生人数（人）"],
          "fields": [
            {
              "id": "grade_name",
              "type": "text",
              "label": "年级名称",
              "width": "50%",
              "required": true
            },
            {
              "id": "grade_student_count",
              "type": "number",
              "label": "学生人数",
              "width": "50%",
              "required": true,
              "decimalPlaces": "整数",
              "unit": "人"
            }
          ]
        },
        {
          "id": "divider_seats",
          "type": "divider",
          "label": "学位信息",
          "width": "100%",
          "required": false
        },
        {
          "id": "government_purchased_seats",
          "type": "number",
          "label": "政府购买学位数",
          "placeholder": "请输入政府购买学位数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "migrant_worker_seats",
          "type": "number",
          "label": "用于进城务工人员随迁子女学位数",
          "placeholder": "请输入用于进城务工人员随迁子女学位数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "divider_digital",
          "type": "divider",
          "label": "数字化设备",
          "width": "100%",
          "required": false
        },
        {
          "id": "digital_terminal_count",
          "type": "number",
          "label": "数字终端数",
          "placeholder": "请输入数字终端数数量",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "teacher_terminal_count",
          "type": "number",
          "label": "教师终端数",
          "placeholder": "请输入教师终端数数量",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "student_terminal_count",
          "type": "number",
          "label": "学生终端数",
          "placeholder": "请输入学生终端数数量",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "divider_title",
          "type": "divider",
          "label": "职称分布",
          "width": "100%",
          "required": false
        },
        {
          "id": "senior_positive_teacher_count",
          "type": "number",
          "label": "正高级专任教师人数",
          "placeholder": "请输入正高级专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "senior_deputy_teacher_count",
          "type": "number",
          "label": "副高级专任教师人数",
          "placeholder": "请输入副高级专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "intermediate_teacher_count",
          "type": "number",
          "label": "中级专任教师人数",
          "placeholder": "请输入中级专任教师人数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "divider_materials",
          "type": "divider",
          "label": "佐证材料",
          "width": "100%",
          "required": false
        },
        {
          "id": "school_charter_material",
          "type": "upload",
          "label": "所有学校制定章程，实现学校管理与教学信息化",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "teacher_it_skill_material",
          "type": "upload",
          "label": "教师能熟练运用信息化手段组织教学，设施设备利用率达到较高水平",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "moral_education_material",
          "type": "upload",
          "label": "所有学校德育工作、校园文化建设水平达到良好以上",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "curriculum_material",
          "type": "upload",
          "label": "课程开齐开足，教学秩序规范，综合实践活动有效开展",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "workload_material",
          "type": "upload",
          "label": "无过重课业负担",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        }
      ]
    }
  ],
  '9': [
    {
      "id": "group_basic_info",
      "type": "group",
      "label": "一、基础信息",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "divider_population",
          "type": "divider",
          "label": "人口与行政区划",
          "width": "100%",
          "required": false
        },
        {
          "id": "total_population",
          "type": "number",
          "label": "人口总数",
          "placeholder": "请输入区县人口总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "万人"
        },
        {
          "id": "agricultural_population",
          "type": "number",
          "label": "农业人口数",
          "placeholder": "请输入区县农业人口数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "万人"
        },
        {
          "id": "township_count",
          "type": "number",
          "label": "乡镇数",
          "placeholder": "请输入区县乡镇数量",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "village_count",
          "type": "number",
          "label": "行政村数",
          "placeholder": "请输入区县行政村数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "divider_economy",
          "type": "divider",
          "label": "经济指标",
          "width": "100%",
          "required": false
        },
        {
          "id": "gdp_per_capita",
          "type": "number",
          "label": "年人均国内生产总值",
          "placeholder": "请输入年人均国内生产总值",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "元"
        },
        {
          "id": "fiscal_revenue_per_capita",
          "type": "number",
          "label": "年人均地方财政收入",
          "placeholder": "请输入年人均地方财政收入",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "元"
        },
        {
          "id": "farmer_income_per_capita",
          "type": "number",
          "label": "农民年人均纯收入",
          "placeholder": "请输入农民年人均纯收入",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "元"
        },
        {
          "id": "urban_income_per_capita",
          "type": "number",
          "label": "城镇居民年人均可支配收入",
          "placeholder": "请输入城镇居民可年人均可支配收入",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "元"
        },
        {
          "id": "divider_school_type",
          "type": "divider",
          "label": "学校类型分布",
          "width": "100%",
          "required": false
        },
        {
          "id": "primary_school_count",
          "type": "number",
          "label": "普通小学",
          "placeholder": "请输入普通小学总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "所"
        },
        {
          "id": "junior_high_count",
          "type": "number",
          "label": "独立初中",
          "placeholder": "请输入独立初中总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "所"
        },
        {
          "id": "nine_year_school_count",
          "type": "number",
          "label": "九年一贯制学校",
          "placeholder": "请输入九年一贯制学校总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "所"
        },
        {
          "id": "twelve_year_school_count",
          "type": "number",
          "label": "十二年一贯制学校",
          "placeholder": "请输入十二年一贯制学校总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "所"
        },
        {
          "id": "complete_high_school_count",
          "type": "number",
          "label": "完全中学",
          "placeholder": "请输入完全中学总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "所"
        },
        {
          "id": "special_education_school_count",
          "type": "number",
          "label": "特殊教育学校",
          "placeholder": "请输入特殊教育学校总数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "所"
        },
        {
          "id": "divider_school_stats",
          "type": "divider",
          "label": "学校统计数据",
          "width": "100%",
          "required": false
        },
        {
          "id": "primary_teaching_point_count",
          "type": "number",
          "label": "小学教学点数",
          "placeholder": "请输入小学教学点数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "primary_teaching_point_50_plus",
          "type": "number",
          "label": "50人及以上小学教学点数",
          "placeholder": "请输入50人及以上小学教学点数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "primary_class_count",
          "type": "number",
          "label": "小学教学班数",
          "placeholder": "请输入小学教学班数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "primary_student_count",
          "type": "number",
          "label": "小学在校学生数",
          "placeholder": "请输入小学在校学生数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "primary_staff_count",
          "type": "number",
          "label": "小学教职工数",
          "placeholder": "请输入小学教职工数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "primary_teacher_count",
          "type": "number",
          "label": "小学专任教师数",
          "placeholder": "请输入小学专任教师数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "junior_class_count",
          "type": "number",
          "label": "初中教学班数",
          "placeholder": "请输入初中教学班数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "个"
        },
        {
          "id": "junior_student_count",
          "type": "number",
          "label": "初中在校学生数",
          "placeholder": "请输入初中在校学生数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "junior_staff_count",
          "type": "number",
          "label": "初中教职工数",
          "placeholder": "请输入初中教职工数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "junior_teacher_count",
          "type": "number",
          "label": "初中专任教师数",
          "placeholder": "请输入初中专任教师数",
          "width": "25%",
          "required": false,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "district_plan_approval_date",
          "type": "date",
          "label": "区县规划通过时间",
          "width": "25%",
          "required": false
        }
      ]
    },
    {
      "id": "group_government_guarantee",
      "type": "group",
      "label": "二、政府保障程度",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "divider_salary",
          "type": "divider",
          "label": "工资收入",
          "width": "100%",
          "required": false
        },
        {
          "id": "teacher_avg_salary",
          "type": "number",
          "label": "上年度义务教育学校教师年平均工资收入水平（不含民办学校）",
          "placeholder": "请输入上年度义务教育学校教师年平均工资收入水平（不含民办学校）",
          "width": "50%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "万元"
        },
        {
          "id": "civil_servant_avg_salary",
          "type": "number",
          "label": "上年度公务员年平均工资收入水平",
          "placeholder": "请输入上年度公务员年平均工资收入水平",
          "width": "50%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "万元"
        },
        {
          "id": "divider_exchange",
          "type": "divider",
          "label": "教师交流轮岗",
          "width": "100%",
          "required": false
        },
        {
          "id": "exchange_eligible_teacher_count",
          "type": "number",
          "label": "符合交流轮岗条件教师总数",
          "placeholder": "请输入符合交流轮岗条件教师总数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "actual_exchange_teacher_count",
          "type": "number",
          "label": "实际交流轮岗教师数",
          "placeholder": "请输入实际交流轮岗教师数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "exchange_eligible_teacher_count",
            "condition": "filled"
          }
        },
        {
          "id": "actual_exchange_backbone_count",
          "type": "number",
          "label": "实际交流骨干教师数量",
          "placeholder": "请输入实际交流骨干教师数量",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "exchange_eligible_teacher_count",
            "condition": "filled"
          }
        },
        {
          "id": "divider_high_school",
          "type": "divider",
          "label": "优质高中招生",
          "width": "100%",
          "required": false
        },
        {
          "id": "quality_high_school_enrollment_plan",
          "type": "number",
          "label": "优质高中招生计划总人数",
          "placeholder": "请输入优质高中招生计划总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "quality_high_school_quota_allocation",
          "type": "number",
          "label": "优质高中招生分配指标数",
          "placeholder": "请输入优质高中招生分配指标数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "quality_high_school_enrollment_plan",
            "condition": "filled"
          }
        },
        {
          "id": "quality_high_school_rural_quota",
          "type": "number",
          "label": "优质高中招生向农村学校分配指标数",
          "placeholder": "请输入优质高中招生向农村学校分配指标数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "quality_high_school_enrollment_plan",
            "condition": "filled"
          }
        },
        {
          "id": "divider_migrant",
          "type": "divider",
          "label": "随迁子女就学",
          "width": "100%",
          "required": false
        },
        {
          "id": "eligible_migrant_children_count",
          "type": "number",
          "label": "符合条件的随迁子女总人数",
          "placeholder": "请输入符合条件的随迁子女总人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "migrant_in_public_school_count",
          "type": "number",
          "label": "在县域内公办学校就读的随迁子女人数",
          "placeholder": "请输入在县域内公办学校就读的随迁子女人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "eligible_migrant_children_count",
            "condition": "filled"
          }
        },
        {
          "id": "migrant_in_private_school_count",
          "type": "number",
          "label": "在政府购买服务的县域内民办学校就读的随迁子女人数",
          "placeholder": "请输入在政府购买服务的县域内民办学校就读的随迁子女人数",
          "width": "25%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人",
          "showWhen": {
            "field": "eligible_migrant_children_count",
            "condition": "filled"
          }
        },
        {
          "id": "divider_enrollment",
          "type": "divider",
          "label": "就近入学",
          "width": "100%",
          "required": false
        },
        {
          "id": "primary_nearby_enrollment_rate",
          "type": "number",
          "label": "小学就近划片入学比例",
          "placeholder": "请输入小学就近划片入学比例",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "junior_nearby_enrollment_rate",
          "type": "number",
          "label": "初中就近划片入学比例",
          "placeholder": "请输入初中就近划片入学比例",
          "width": "25%",
          "required": true,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "divider_materials_gov",
          "type": "divider",
          "label": "佐证材料",
          "width": "100%",
          "required": false
        },
        {
          "id": "school_layout_material",
          "type": "upload",
          "label": "县域内义务教育学校规划布局合理,符合国家规定要求",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        },
        {
          "id": "unified_standard_material",
          "type": "upload",
          "label": "县域内城乡义务教育学校建设标准统一、教师编制标准统一、生均公用经费基准定额统一且不低于沈阳市标准、基本装备配置标准统一",
          "placeholder": "上传佐证材料",
          "helpText": "5个文件，单个文件大小不超过20M",
          "width": "50%",
          "required": true
        }
      ]
    },
    {
      "id": "group_education_quality",
      "type": "group",
      "label": "三、教育质量",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "divider_disabled",
          "type": "divider",
          "label": "残疾儿童少年入学",
          "width": "100%",
          "required": false
        },
        {
          "id": "disabled_children_population",
          "type": "number",
          "label": "适龄残疾儿童少年人口总数",
          "placeholder": "请输入适龄残疾儿童少年人口总数",
          "width": "50%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "disabled_children_enrollment",
          "type": "number",
          "label": "适龄残疾儿童少年入学总人数",
          "placeholder": "请输入适龄残疾儿童少年入学总人数",
          "width": "50%",
          "required": true,
          "decimalPlaces": "整数",
          "unit": "人"
        },
        {
          "id": "divider_quality_monitor",
          "type": "divider",
          "label": "国家义务教育质量监测",
          "width": "100%",
          "required": false
        },
        {
          "id": "chinese_achievement_level",
          "type": "text",
          "label": "国家义务教育质量监测语文学业水平",
          "placeholder": "请输入语文学业水平",
          "width": "25%",
          "required": false,
          "unit": "级"
        },
        {
          "id": "chinese_difference_rate",
          "type": "number",
          "label": "语文校际差异率",
          "placeholder": "请输入语文校际差异率",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "math_achievement_level",
          "type": "text",
          "label": "国家义务教育质量监测数学学业水平",
          "placeholder": "请输入数学学业水平",
          "width": "25%",
          "required": false,
          "unit": "级"
        },
        {
          "id": "math_difference_rate",
          "type": "number",
          "label": "数学校际差异率",
          "placeholder": "请输入数学校际差异率",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "science_achievement_level",
          "type": "text",
          "label": "国家义务教育质量监测科学学业水平",
          "placeholder": "请输入科学学业水平",
          "width": "25%",
          "required": false,
          "unit": "级"
        },
        {
          "id": "science_difference_rate",
          "type": "number",
          "label": "科学校际差异率",
          "placeholder": "请输入科学校际差异率",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "pe_achievement_level",
          "type": "text",
          "label": "国家义务教育质量监测体育学业水平",
          "placeholder": "请输入体育学业水平",
          "width": "25%",
          "required": false,
          "unit": "级"
        },
        {
          "id": "pe_difference_rate",
          "type": "number",
          "label": "体育校际差异率",
          "placeholder": "请输入体育校际差异率",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "art_achievement_level",
          "type": "text",
          "label": "国家义务教育质量监测艺术学业水平",
          "placeholder": "请输入艺术学业水平",
          "width": "25%",
          "required": false,
          "unit": "级"
        },
        {
          "id": "art_difference_rate",
          "type": "number",
          "label": "艺术校际差异率",
          "placeholder": "请输入艺术校际差异率",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "%"
        },
        {
          "id": "moral_achievement_level",
          "type": "text",
          "label": "国家义务教育质量监测德育学业水平",
          "placeholder": "请输入德育学业水平",
          "width": "25%",
          "required": false,
          "unit": "级"
        },
        {
          "id": "moral_difference_rate",
          "type": "number",
          "label": "德育校际差异率",
          "placeholder": "请输入德育校际差异率",
          "width": "25%",
          "required": false,
          "decimalPlaces": "2位小数",
          "unit": "%"
        }
      ]
    },
    {
      "id": "group_social_recognition",
      "type": "group",
      "label": "四、社会认可度",
      "width": "100%",
      "required": false,
      "children": [
        {
          "id": "social_recognition_over_85",
          "type": "select",
          "label": "社会认可度达到85％以上",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "has_exam_enrollment",
          "type": "select",
          "label": "存在以考试方式招生",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "has_illegal_school_choice",
          "type": "select",
          "label": "存在违规择校行为",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "has_key_school_or_class",
          "type": "select",
          "label": "存在重点学校或重点班",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "has_unfilled_positions",
          "type": "select",
          "label": "存在\"有编不补\"或长期聘用编外教师的情况",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "has_major_incident",
          "type": "select",
          "label": "教育系统存在重大安全责任事故和严重违纪违规事件;有弄虚作假行为",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        },
        {
          "id": "has_training_regulation_failure",
          "type": "select",
          "label": "规范治理校外培训机构及减轻中小学课外负担不力",
          "width": "50%",
          "required": true,
          "options": [
            { "label": "是", "value": "yes" },
            { "label": "否", "value": "no" }
          ]
        }
      ]
    }
  ],
};

// ==================== 数据指标-评估要素关联 Mock 数据 ====================
// 将指标体系中的数据指标与要素库中的评估要素进行关联

export interface DataIndicatorElementAssociation {
  id: string;
  dataIndicatorId: string;
  elementId: string;
  mappingType: 'primary' | 'reference';
  description: string;
  createdBy?: string;
  createdAt?: string;
  // 关联的要素信息
  elementCode: string;
  elementName: string;
  elementType: '基础要素' | '派生要素';
  dataType: string;
  formula?: string;
  libraryId: string;
  libraryName: string;
}

export interface DataIndicatorWithElements {
  id: string;
  code: string;
  name: string;
  threshold: string;
  description: string;
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  elements: DataIndicatorElementAssociation[];
}

// 数据指标-要素关联映射（按指标体系ID分组）
export const dataIndicatorElements: { [systemId: string]: DataIndicatorWithElements[] } = {
  '1': [
    // 1.1 每百名学生拥有高于规定学历教师数 - 关联的数据指标
    {
      id: 'D1-1-1',
      code: '1.1-D1',
      name: '学生人数',
      threshold: '',
      description: '在校学生总人数',
      indicatorId: 'I1-1',
      indicatorCode: '1.1',
      indicatorName: '每百名学生拥有高于规定学历教师数',
      elements: [
        {
          id: 'die-1',
          dataIndicatorId: 'D1-1-1',
          elementId: 'E003',
          mappingType: 'primary',
          description: '直接对应要素库中的在校学生总数',
          elementCode: 'E003',
          elementName: '在校学生总数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-1-2',
      code: '1.1-D2',
      name: '专科学历教师人数',
      threshold: '',
      description: '小学适用',
      indicatorId: 'I1-1',
      indicatorCode: '1.1',
      indicatorName: '每百名学生拥有高于规定学历教师数',
      elements: [
        {
          id: 'die-2',
          dataIndicatorId: 'D1-1-2',
          elementId: 'E008',
          mappingType: 'primary',
          description: '专科学历教师人数',
          elementCode: 'E008',
          elementName: '专科学历教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-1-3',
      code: '1.1-D3',
      name: '本科学历教师人数',
      threshold: '',
      description: '小学和初中适用',
      indicatorId: 'I1-1',
      indicatorCode: '1.1',
      indicatorName: '每百名学生拥有高于规定学历教师数',
      elements: [
        {
          id: 'die-3',
          dataIndicatorId: 'D1-1-3',
          elementId: 'E009',
          mappingType: 'primary',
          description: '本科学历教师人数',
          elementCode: 'E009',
          elementName: '本科学历教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-1-4',
      code: '1.1-D4',
      name: '硕士学历教师人数',
      threshold: '',
      description: '小学和初中适用',
      indicatorId: 'I1-1',
      indicatorCode: '1.1',
      indicatorName: '每百名学生拥有高于规定学历教师数',
      elements: [
        {
          id: 'die-4',
          dataIndicatorId: 'D1-1-4',
          elementId: 'E010',
          mappingType: 'primary',
          description: '硕士学历教师人数',
          elementCode: 'E010',
          elementName: '硕士学历教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-1-5',
      code: '1.1-D5',
      name: '博士学历教师人数',
      threshold: '',
      description: '小学和初中适用',
      indicatorId: 'I1-1',
      indicatorCode: '1.1',
      indicatorName: '每百名学生拥有高于规定学历教师数',
      elements: [
        {
          id: 'die-5',
          dataIndicatorId: 'D1-1-5',
          elementId: 'E011',
          mappingType: 'primary',
          description: '博士学历教师人数',
          elementCode: 'E011',
          elementName: '博士学历教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-1-6',
      code: '1.1-D6',
      name: '每百名学生拥有高于规定学历教师数',
      threshold: '小学≥4.2人，初中≥5.3人',
      description: '小学：((专科+本科+硕士+博士)÷学生人数)×100；初中：((本科+硕士+博士)÷学生人数)×100',
      indicatorId: 'I1-1',
      indicatorCode: '1.1',
      indicatorName: '每百名学生拥有高于规定学历教师数',
      elements: [
        {
          id: 'die-6a',
          dataIndicatorId: 'D1-1-6',
          elementId: 'E028',
          mappingType: 'primary',
          description: '小学计算公式',
          elementCode: 'E028',
          elementName: '每百名学生拥有高于规定学历教师数(小学)',
          elementType: '派生要素',
          dataType: '数字',
          formula: '((E008 + E009 + E010 + E011) / E003) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
        {
          id: 'die-6b',
          dataIndicatorId: 'D1-1-6',
          elementId: 'E029',
          mappingType: 'reference',
          description: '初中计算公式',
          elementCode: 'E029',
          elementName: '每百名学生拥有高于规定学历教师数(初中)',
          elementType: '派生要素',
          dataType: '数字',
          formula: '((E009 + E010 + E011) / E003) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 1.2 每百名学生拥有县级以上骨干教师数
    {
      id: 'D1-2-1',
      code: '1.2-D1',
      name: '学生人数',
      threshold: '',
      description: '在校学生总人数',
      indicatorId: 'I1-2',
      indicatorCode: '1.2',
      indicatorName: '每百名学生拥有县级以上骨干教师数',
      elements: [
        {
          id: 'die-7',
          dataIndicatorId: 'D1-2-1',
          elementId: 'E003',
          mappingType: 'primary',
          description: '',
          elementCode: 'E003',
          elementName: '在校学生总数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-2-2',
      code: '1.2-D2',
      name: '县级及以上骨干教师数',
      threshold: '',
      description: '县级及以上认定的骨干教师人数',
      indicatorId: 'I1-2',
      indicatorCode: '1.2',
      indicatorName: '每百名学生拥有县级以上骨干教师数',
      elements: [
        {
          id: 'die-8',
          dataIndicatorId: 'D1-2-2',
          elementId: 'E012',
          mappingType: 'primary',
          description: '',
          elementCode: 'E012',
          elementName: '县级及以上骨干教师数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-2-3',
      code: '1.2-D3',
      name: '每百名学生拥有骨干教师数',
      threshold: '小学≥1人，初中≥1人',
      description: '(骨干教师数÷学生数)×100',
      indicatorId: 'I1-2',
      indicatorCode: '1.2',
      indicatorName: '每百名学生拥有县级以上骨干教师数',
      elements: [
        {
          id: 'die-9',
          dataIndicatorId: 'D1-2-3',
          elementId: 'E030',
          mappingType: 'primary',
          description: '派生要素计算',
          elementCode: 'E030',
          elementName: '每百名学生拥有骨干教师数',
          elementType: '派生要素',
          dataType: '数字',
          formula: '(E012 / E003) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 1.3 每百名学生拥有体育、艺术专任教师数
    {
      id: 'D1-3-1',
      code: '1.3-D1',
      name: '学生人数',
      threshold: '',
      description: '在校学生总人数',
      indicatorId: 'I1-3',
      indicatorCode: '1.3',
      indicatorName: '每百名学生拥有体育、艺术专任教师数',
      elements: [
        {
          id: 'die-10',
          dataIndicatorId: 'D1-3-1',
          elementId: 'E003',
          mappingType: 'primary',
          description: '',
          elementCode: 'E003',
          elementName: '在校学生总数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-3-2',
      code: '1.3-D2',
      name: '体育专任教师人数',
      threshold: '',
      description: '',
      indicatorId: 'I1-3',
      indicatorCode: '1.3',
      indicatorName: '每百名学生拥有体育、艺术专任教师数',
      elements: [
        {
          id: 'die-11',
          dataIndicatorId: 'D1-3-2',
          elementId: 'E013',
          mappingType: 'primary',
          description: '',
          elementCode: 'E013',
          elementName: '体育专任教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-3-3',
      code: '1.3-D3',
      name: '音乐专任教师人数',
      threshold: '',
      description: '',
      indicatorId: 'I1-3',
      indicatorCode: '1.3',
      indicatorName: '每百名学生拥有体育、艺术专任教师数',
      elements: [
        {
          id: 'die-12',
          dataIndicatorId: 'D1-3-3',
          elementId: 'E014',
          mappingType: 'primary',
          description: '',
          elementCode: 'E014',
          elementName: '音乐专任教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-3-4',
      code: '1.3-D4',
      name: '美术专任教师人数',
      threshold: '',
      description: '',
      indicatorId: 'I1-3',
      indicatorCode: '1.3',
      indicatorName: '每百名学生拥有体育、艺术专任教师数',
      elements: [
        {
          id: 'die-13',
          dataIndicatorId: 'D1-3-4',
          elementId: 'E015',
          mappingType: 'primary',
          description: '',
          elementCode: 'E015',
          elementName: '美术专任教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-3-5',
      code: '1.3-D5',
      name: '艺术专任教师人数',
      threshold: '',
      description: '',
      indicatorId: 'I1-3',
      indicatorCode: '1.3',
      indicatorName: '每百名学生拥有体育、艺术专任教师数',
      elements: [
        {
          id: 'die-14',
          dataIndicatorId: 'D1-3-5',
          elementId: 'E016',
          mappingType: 'primary',
          description: '',
          elementCode: 'E016',
          elementName: '艺术专任教师人数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-3-11',
      code: '1.3-D11',
      name: '每百名学生拥有体育艺术专任教师数',
      threshold: '小学≥0.9人，初中≥0.9人',
      description: '普通学校：(体育+音乐+美术+艺术)÷学生数×100',
      indicatorId: 'I1-3',
      indicatorCode: '1.3',
      indicatorName: '每百名学生拥有体育、艺术专任教师数',
      elements: [
        {
          id: 'die-15',
          dataIndicatorId: 'D1-3-11',
          elementId: 'E031',
          mappingType: 'primary',
          description: '派生要素计算',
          elementCode: 'E031',
          elementName: '每百名学生拥有体育艺术教师数',
          elementType: '派生要素',
          dataType: '数字',
          formula: '((E013 + E014 + E015 + E016) / E003) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 1.4 生均教学及辅助用房面积
    {
      id: 'D1-4-1',
      code: '1.4-D1',
      name: '教学及辅助用房总面积',
      threshold: '',
      description: '',
      indicatorId: 'I1-4',
      indicatorCode: '1.4',
      indicatorName: '生均教学及辅助用房面积',
      elements: [
        {
          id: 'die-16',
          dataIndicatorId: 'D1-4-1',
          elementId: 'E017',
          mappingType: 'primary',
          description: '',
          elementCode: 'E017',
          elementName: '教学及辅助用房总面积',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-4-4',
      code: '1.4-D4',
      name: '生均教学及辅助用房面积',
      threshold: '小学≥4.5㎡，初中≥5.8㎡',
      description: '(教学及辅助用房总面积-室内体育用房面积)÷学生数',
      indicatorId: 'I1-4',
      indicatorCode: '1.4',
      indicatorName: '生均教学及辅助用房面积',
      elements: [
        {
          id: 'die-17',
          dataIndicatorId: 'D1-4-4',
          elementId: 'E032',
          mappingType: 'primary',
          description: '派生要素',
          elementCode: 'E032',
          elementName: '生均教学及辅助用房面积',
          elementType: '派生要素',
          dataType: '数字',
          formula: '(E017 - E019) / E003',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 1.5 生均体育运动场馆面积
    {
      id: 'D1-5-1',
      code: '1.5-D1',
      name: '运动场地面积',
      threshold: '',
      description: '',
      indicatorId: 'I1-5',
      indicatorCode: '1.5',
      indicatorName: '生均体育运动场馆面积',
      elements: [
        {
          id: 'die-18',
          dataIndicatorId: 'D1-5-1',
          elementId: 'E018',
          mappingType: 'primary',
          description: '',
          elementCode: 'E018',
          elementName: '运动场地面积',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-5-2',
      code: '1.5-D2',
      name: '室内体育用房面积',
      threshold: '',
      description: '',
      indicatorId: 'I1-5',
      indicatorCode: '1.5',
      indicatorName: '生均体育运动场馆面积',
      elements: [
        {
          id: 'die-19',
          dataIndicatorId: 'D1-5-2',
          elementId: 'E019',
          mappingType: 'primary',
          description: '',
          elementCode: 'E019',
          elementName: '室内体育用房面积',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-5-4',
      code: '1.5-D4',
      name: '生均体育运动场馆面积',
      threshold: '小学≥7.5㎡，初中≥10.2㎡',
      description: '(运动场地面积+室内体育用房面积)÷学生数',
      indicatorId: 'I1-5',
      indicatorCode: '1.5',
      indicatorName: '生均体育运动场馆面积',
      elements: [
        {
          id: 'die-20',
          dataIndicatorId: 'D1-5-4',
          elementId: 'E033',
          mappingType: 'primary',
          description: '派生要素',
          elementCode: 'E033',
          elementName: '生均体育运动场馆面积',
          elementType: '派生要素',
          dataType: '数字',
          formula: '(E018 + E019) / E003',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 1.6 生均教学仪器设备值
    {
      id: 'D1-6-1',
      code: '1.6-D1',
      name: '教学仪器设备资产值',
      threshold: '',
      description: '',
      indicatorId: 'I1-6',
      indicatorCode: '1.6',
      indicatorName: '生均教学仪器设备值',
      elements: [
        {
          id: 'die-21',
          dataIndicatorId: 'D1-6-1',
          elementId: 'E020',
          mappingType: 'primary',
          description: '',
          elementCode: 'E020',
          elementName: '教学仪器设备资产值',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-6-3',
      code: '1.6-D3',
      name: '生均教学仪器设备值',
      threshold: '小学≥2000元，初中≥2500元',
      description: '教学仪器设备资产值(万元)×10000÷学生数',
      indicatorId: 'I1-6',
      indicatorCode: '1.6',
      indicatorName: '生均教学仪器设备值',
      elements: [
        {
          id: 'die-22',
          dataIndicatorId: 'D1-6-3',
          elementId: 'E034',
          mappingType: 'primary',
          description: '派生要素',
          elementCode: 'E034',
          elementName: '生均教学仪器设备值',
          elementType: '派生要素',
          dataType: '数字',
          formula: '(E020 * 10000) / E003',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 1.7 每百名学生拥有网络多媒体教室数
    {
      id: 'D1-7-1',
      code: '1.7-D1',
      name: '网络多媒体教室间数',
      threshold: '',
      description: '',
      indicatorId: 'I1-7',
      indicatorCode: '1.7',
      indicatorName: '每百名学生拥有网络多媒体教室数',
      elements: [
        {
          id: 'die-23',
          dataIndicatorId: 'D1-7-1',
          elementId: 'E021',
          mappingType: 'primary',
          description: '',
          elementCode: 'E021',
          elementName: '网络多媒体教室间数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D1-7-3',
      code: '1.7-D3',
      name: '每百名学生拥有网络多媒体教室数',
      threshold: '小学、初中均≥2.3间',
      description: '网络多媒体教室间数÷学生数×100',
      indicatorId: 'I1-7',
      indicatorCode: '1.7',
      indicatorName: '每百名学生拥有网络多媒体教室数',
      elements: [
        {
          id: 'die-24',
          dataIndicatorId: 'D1-7-3',
          elementId: 'E035',
          mappingType: 'primary',
          description: '派生要素',
          elementCode: 'E035',
          elementName: '每百名学生拥有网络多媒体教室数',
          elementType: '派生要素',
          dataType: '数字',
          formula: '(E021 / E003) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // ========== 二、政府保障 ==========
    // 2.1 城乡义务教育公用经费基准定额
    {
      id: 'D2-1-1',
      code: '2.1-D1',
      name: '当年公用经费执行基准定额',
      threshold: '',
      description: '',
      indicatorId: 'I2-1',
      indicatorCode: '2.1',
      indicatorName: '城乡义务教育公用经费基准定额',
      elements: [
        {
          id: 'die-25',
          dataIndicatorId: 'D2-1-1',
          elementId: 'E036',
          mappingType: 'primary',
          description: '公用经费基准定额',
          elementCode: 'E036',
          elementName: '当年公用经费执行基准定额',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.2 学校规模
    {
      id: 'D2-2-3',
      code: '2.2-D3',
      name: '学校规模是否达标',
      threshold: '小学/初中≤2000人,九年一贯制≤2500人',
      description: '',
      indicatorId: 'I2-2',
      indicatorCode: '2.2',
      indicatorName: '学校规模',
      elements: [
        {
          id: 'die-26',
          dataIndicatorId: 'D2-2-3',
          elementId: 'E003',
          mappingType: 'primary',
          description: '学校学生总数',
          elementCode: 'E003',
          elementName: '在校学生总数',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.3 班额
    {
      id: 'D2-3-1',
      code: '2.3-D1',
      name: '小学平均班额',
      threshold: '≤45人',
      description: '',
      indicatorId: 'I2-3',
      indicatorCode: '2.3',
      indicatorName: '班额',
      elements: [
        {
          id: 'die-27',
          dataIndicatorId: 'D2-3-1',
          elementId: 'E037',
          mappingType: 'primary',
          description: '小学平均班额',
          elementCode: 'E037',
          elementName: '小学平均班额',
          elementType: '派生要素',
          dataType: '数字',
          formula: 'E003_小学 / E038',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D2-3-2',
      code: '2.3-D2',
      name: '初中平均班额',
      threshold: '≤50人',
      description: '',
      indicatorId: 'I2-3',
      indicatorCode: '2.3',
      indicatorName: '班额',
      elements: [
        {
          id: 'die-28',
          dataIndicatorId: 'D2-3-2',
          elementId: 'E039',
          mappingType: 'primary',
          description: '初中平均班额',
          elementCode: 'E039',
          elementName: '初中平均班额',
          elementType: '派生要素',
          dataType: '数字',
          formula: 'E003_初中 / E040',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.6 公用经费保障
    {
      id: 'D2-6-3',
      code: '2.6-D3',
      name: '生均公用经费',
      threshold: '≥规定标准（市级小学1150，初中1350）',
      description: '上一年度公用经费预算总额÷学生人数',
      indicatorId: 'I2-6',
      indicatorCode: '2.6',
      indicatorName: '公用经费保障',
      elements: [
        {
          id: 'die-29',
          dataIndicatorId: 'D2-6-3',
          elementId: 'E041',
          mappingType: 'primary',
          description: '生均公用经费',
          elementCode: 'E041',
          elementName: '生均公用经费',
          elementType: '派生要素',
          dataType: '数字',
          formula: 'E042 * 10000 / E003',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.7 特殊教育学校生均公用经费
    {
      id: 'D2-7-3',
      code: '2.7-D3',
      name: '特殊教育生均公用经费',
      threshold: '≥8000元',
      description: '特殊教育学校经费总额÷学生人数',
      indicatorId: 'I2-7',
      indicatorCode: '2.7',
      indicatorName: '特殊教育学校生均公用经费',
      elements: [
        {
          id: 'die-30',
          dataIndicatorId: 'D2-7-3',
          elementId: 'E043',
          mappingType: 'primary',
          description: '特殊教育生均公用经费',
          elementCode: 'E043',
          elementName: '特殊教育生均公用经费',
          elementType: '派生要素',
          dataType: '数字',
          formula: 'E044 / E045',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.8 教师工资不低于公务员
    {
      id: 'D2-8-3',
      code: '2.8-D3',
      name: '教师工资是否达标',
      threshold: '教师工资≥公务员工资',
      description: '',
      indicatorId: 'I2-8',
      indicatorCode: '2.8',
      indicatorName: '教师工资不低于公务员',
      elements: [
        {
          id: 'die-31',
          dataIndicatorId: 'D2-8-3',
          elementId: 'E046',
          mappingType: 'primary',
          description: '教师年均工资',
          elementCode: 'E046',
          elementName: '义务教育教师年均工资收入',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
        {
          id: 'die-32',
          dataIndicatorId: 'D2-8-3',
          elementId: 'E047',
          mappingType: 'reference',
          description: '公务员年均工资（对比参照）',
          elementCode: 'E047',
          elementName: '当地公务员年均工资收入',
          elementType: '基础要素',
          dataType: '数字',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.9 教师5年360学时培训完成率
    {
      id: 'D2-9-3',
      code: '2.9-D3',
      name: '培训完成率',
      threshold: '=100%',
      description: '(近5年培训满360学时专任教师人数÷专任教师总人数)×100%',
      indicatorId: 'I2-9',
      indicatorCode: '2.9',
      indicatorName: '教师5年360学时培训完成率',
      elements: [
        {
          id: 'die-33',
          dataIndicatorId: 'D2-9-3',
          elementId: 'E048',
          mappingType: 'primary',
          description: '培训完成率',
          elementCode: 'E048',
          elementName: '教师培训完成率',
          elementType: '派生要素',
          dataType: '百分比',
          formula: '(E049 / E007) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 2.11 交流轮岗教师比例
    {
      id: 'D2-11-3',
      code: '2.11-D3',
      name: '教师交流轮岗比例',
      threshold: '≥10%',
      description: '实际交流轮岗教师数÷符合交流条件教师总数',
      indicatorId: 'I2-11',
      indicatorCode: '2.11',
      indicatorName: '交流轮岗教师比例',
      elements: [
        {
          id: 'die-34',
          dataIndicatorId: 'D2-11-3',
          elementId: 'E050',
          mappingType: 'primary',
          description: '教师交流比例',
          elementCode: 'E050',
          elementName: '教师交流轮岗比例',
          elementType: '派生要素',
          dataType: '百分比',
          formula: '(E051 / E052) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    {
      id: 'D2-11-5',
      code: '2.11-D5',
      name: '骨干教师交流比例',
      threshold: '≥20%',
      description: '交流的骨干教师数÷交流轮岗教师数',
      indicatorId: 'I2-11',
      indicatorCode: '2.11',
      indicatorName: '交流轮岗教师比例',
      elements: [
        {
          id: 'die-35',
          dataIndicatorId: 'D2-11-5',
          elementId: 'E053',
          mappingType: 'primary',
          description: '骨干教师交流比例',
          elementCode: 'E053',
          elementName: '骨干教师交流比例',
          elementType: '派生要素',
          dataType: '百分比',
          formula: '(E054 / E051) * 100',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // ========== 三、教育质量 ==========
    // 3.1 学业水平
    {
      id: 'D3-1-3',
      code: '3.1-D3',
      name: '学生学业水平综合评价',
      threshold: '各学科合格率达标',
      description: '',
      indicatorId: 'I3-1',
      indicatorCode: '3.1',
      indicatorName: '学生学业水平',
      elements: [
        {
          id: 'die-36',
          dataIndicatorId: 'D3-1-3',
          elementId: 'E055',
          mappingType: 'primary',
          description: '语文学科合格率',
          elementCode: 'E055',
          elementName: '语文学科合格率',
          elementType: '派生要素',
          dataType: '百分比',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
        {
          id: 'die-37',
          dataIndicatorId: 'D3-1-3',
          elementId: 'E056',
          mappingType: 'reference',
          description: '数学学科合格率',
          elementCode: 'E056',
          elementName: '数学学科合格率',
          elementType: '派生要素',
          dataType: '百分比',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // 3.2 综合素质
    {
      id: 'D3-2-1',
      code: '3.2-D1',
      name: '体质健康合格率',
      threshold: '≥85%',
      description: '',
      indicatorId: 'I3-2',
      indicatorCode: '3.2',
      indicatorName: '学生综合素质',
      elements: [
        {
          id: 'die-38',
          dataIndicatorId: 'D3-2-1',
          elementId: 'E057',
          mappingType: 'primary',
          description: '体质健康合格率',
          elementCode: 'E057',
          elementName: '学生体质健康合格率',
          elementType: '派生要素',
          dataType: '百分比',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
    // ========== 四、社会认可 ==========
    // 4.1 社会认可度调查
    {
      id: 'D4-1-3',
      code: '4.1-D3',
      name: '社会认可度',
      threshold: '≥85%',
      description: '国家出具的社会认可度调查结果',
      indicatorId: 'I4-1',
      indicatorCode: '4.1',
      indicatorName: '社会认可度调查',
      elements: [
        {
          id: 'die-39',
          dataIndicatorId: 'D4-1-3',
          elementId: 'E058',
          mappingType: 'primary',
          description: '社会认可度调查结果',
          elementCode: 'E058',
          elementName: '社会认可度',
          elementType: '基础要素',
          dataType: '百分比',
          libraryId: '1',
          libraryName: '义务教育优质均衡评估要素库',
        },
      ],
    },
  ],
};
