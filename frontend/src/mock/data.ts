// Mock data for the educational supervision system

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
  dataType: '文本' | '数字' | '日期' | '选择';
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
  mapping: {
    toolId: string;
    toolName: string;
    fieldId: string;
    fieldLabel: string;
  } | null;
  isMapped: boolean;
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
  { id: 'E001', code: 'E001', name: '学校名称', type: '基础要素', dataType: '文本' },
  { id: 'E002', code: 'E002', name: '学校类型', type: '基础要素', dataType: '文本' },
  { id: 'E003', code: 'E003', name: '在校学生总数', type: '基础要素', dataType: '数字' },
  { id: 'E004', code: 'E004', name: '专任教师总数', type: '基础要素', dataType: '数字' },
  { id: 'E005', code: 'E005', name: '高级职称教师数', type: '基础要素', dataType: '数字' },
  { id: 'E006', code: 'E006', name: '生师比', type: '派生要素', dataType: '数字' },
  { id: 'E007', code: 'E007', name: '高级职称教师占比', type: '派生要素', dataType: '数字' },
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
    tags: ['义务教育', '优质均衡', '资源配置'],
    description: '根据国家义务教育优质均衡发展督导评估办法制定，用于评估区县级义务教育优质均衡发展水平，包括资源配置、政府保障程度、教育质量等维度。',
    indicatorCount: 58,
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
      {
        id: 'D1-1-1',
        code: '1.1-D1',
        name: '师生比',
        threshold: '≥ 0.8',
        description: '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
        indicatorId: 'I1-1',
        indicatorCode: '1.1',
        indicatorName: '小学学校达标情况',
        mapping: {
          toolId: '1',
          toolName: '学校基础数据采集表',
          fieldId: 'f1',
          fieldLabel: '教职工总数',
        },
        isMapped: true,
      },
      {
        id: 'D1-2-1',
        code: '1.2-D1',
        name: '生均教学及辅助用房面积',
        threshold: '≥ 0.8',
        description: '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
        indicatorId: 'I1-2',
        indicatorCode: '1.2',
        indicatorName: '初中学校达标情况',
        mapping: {
          toolId: '4',
          toolName: '义务教育优质均衡发展督导评估现场核查表',
          fieldId: 'f2',
          fieldLabel: '教学用房面积',
        },
        isMapped: true,
      },
      {
        id: 'D1-3-1-1',
        code: '1.3.1-D1',
        name: '每百名学生拥有高于规定学历教师数差异系数',
        threshold: '≤ 0.5',
        description: '根据国家和省级相关标准要求',
        indicatorId: 'I1-3-1',
        indicatorCode: '1.3.1',
        indicatorName: '每百名学生拥有高于规定学历教师数差异系数',
        mapping: null,
        isMapped: false,
      },
      {
        id: 'D1-3-2-1',
        code: '1.3.2-D1',
        name: '每百名学生拥有县级以上骨干教师数差异系数',
        threshold: '≤ 0.5',
        description: '根据国家和省级相关标准要求',
        indicatorId: 'I1-3-2',
        indicatorCode: '1.3.2',
        indicatorName: '每百名学生拥有县级以上骨干教师数差异系数',
        mapping: {
          toolId: '2',
          toolName: '教师专业发展数据表',
          fieldId: 'f3',
          fieldLabel: '骨干教师人数',
        },
        isMapped: true,
      },
      {
        id: 'D2-1-1',
        code: '2.1-D1',
        name: '教育经费投入达标率',
        threshold: '≥ 95%',
        description: '教育经费投入是否达到规定标准',
        indicatorId: 'I2-1',
        indicatorCode: '2.1',
        indicatorName: '教育经费投入',
        mapping: null,
        isMapped: false,
      },
      {
        id: 'D2-2-1',
        code: '2.2-D1',
        name: '教师培训覆盖率',
        threshold: '≥ 90%',
        description: '参加培训教师占比',
        indicatorId: 'I2-2',
        indicatorCode: '2.2',
        indicatorName: '教师培训情况',
        mapping: {
          toolId: '2',
          toolName: '教师专业发展数据表',
          fieldId: 'f4',
          fieldLabel: '参加培训教师数',
        },
        isMapped: true,
      },
    ],
    stats: {
      total: 6,
      mapped: 4,
      unmapped: 2,
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
    {
      id: 'I1',
      code: '1',
      name: '资源配置',
      description: '资源配置相关的评估指标',
      level: 1,
      isLeaf: false,
      children: [
        {
          id: 'I1-1',
          code: '1.1',
          name: '小学学校达标情况',
          description: '该指标用于评估教育资源配置的均衡性',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-1-1',
              code: '1.1-D1',
              name: '师生比',
              threshold: '≥ 0.8',
              description: '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
            },
          ],
          supportingMaterials: [
            {
              id: 'M1-1-1',
              code: '1.1-M1',
              name: '相关证明材料',
              fileTypes: 'PDF, Word',
              maxSize: '10MB',
              description: '需提供能够证明该指标达标情况的相关文件、数据统计表或其他支撑材料',
            },
          ],
        },
        {
          id: 'I1-2',
          code: '1.2',
          name: '初中学校达标情况',
          description: '该指标用于评估教育资源配置的均衡性',
          level: 2,
          isLeaf: true,
          dataIndicators: [
            {
              id: 'D1-2-1',
              code: '1.2-D1',
              name: '生均教学及辅助用房面积',
              threshold: '≥ 0.8',
              description: '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
            },
          ],
          supportingMaterials: [
            {
              id: 'M1-2-1',
              code: '1.2-M1',
              name: '相关证明材料',
              fileTypes: 'PDF, Word',
              maxSize: '10MB',
              description: '需提供能够证明该指标达标情况的相关文件、数据统计表或其他支撑材料',
            },
          ],
        },
        {
          id: 'I1-3',
          code: '1.3',
          name: '小学校际差异系数',
          description: '小学校际差异系数相关的评估指标',
          level: 2,
          isLeaf: false,
          children: [
            {
              id: 'I1-3-1',
              code: '1.3.1',
              name: '每百名学生拥有高于规定学历教师数差异系数',
              description: '该指标用于评估教育资源配置的均衡性',
              level: 3,
              isLeaf: true,
              dataIndicators: [
                {
                  id: 'D1-3-1-1',
                  code: '1.3.1-D1',
                  name: '师生比',
                  threshold: '≥ 0.8',
                  description: '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
                },
              ],
              supportingMaterials: [
                {
                  id: 'M1-3-1-1',
                  code: '1.3.1-M1',
                  name: '相关证明材料',
                  fileTypes: 'PDF, Word',
                  maxSize: '10MB',
                  description: '需提供能够证明该指标达标情况的相关文件、数据统计表或其他支撑材料',
                },
              ],
            },
            {
              id: 'I1-3-2',
              code: '1.3.2',
              name: '每百名学生拥有县级以上骨干教师数差异系数',
              description: '该指标用于评估教育资源配置的均衡性',
              level: 3,
              isLeaf: true,
              dataIndicators: [
                {
                  id: 'D1-3-2-1',
                  code: '1.3.2-D1',
                  name: '生均教学及辅助用房面积',
                  threshold: '≥ 0.8',
                  description: '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
                },
              ],
              supportingMaterials: [
                {
                  id: 'M1-3-2-1',
                  code: '1.3.2-M1',
                  name: '相关证明材料',
                  fileTypes: 'PDF, Word',
                  maxSize: '10MB',
                  description: '需提供能够证明该指标达标情况的相关文件、数据统计表或其他支撑材料',
                },
              ],
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
  '6': [], // 优质均衡采集表-学校，通过导入 JSON 文件初始化
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
