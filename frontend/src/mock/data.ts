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
  startDate: string;
  endDate: string;
  status: '配置中' | '填报中' | '评审中' | '已中止' | '已完成';
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
    startDate: '2024-03-01',
    endDate: '2024-12-31',
    status: '填报中',
  },
  {
    id: '2',
    name: '2024年幼儿园普惠性督导评估',
    keywords: ['幼儿园', '普惠性', '2024年'],
    description: '对全市普惠性幼儿园进行督导评估',
    indicatorSystem: '幼儿园普惠督导评估指标体系',
    startDate: '2024-04-01',
    endDate: '2024-11-30',
    status: '配置中',
  },
];

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
