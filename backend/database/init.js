const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 数据库文件路径
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'education.db');

// 创建或打开数据库
function createDatabase() {
  const db = new Database(DB_PATH);

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 读取并执行schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  console.log('Database schema created successfully.');
  return db;
}

// 获取当前时间
function now() {
  return new Date().toISOString().split('T')[0];
}

// 生成UUID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// 种子数据
function seedData(db) {
  const timestamp = now();

  // 1. 插入指标体系
  const insertSystem = db.prepare(`
    INSERT OR REPLACE INTO indicator_systems
    (id, name, type, target, tags, description, indicator_count, attachments, status, created_by, created_at, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const systems = [
    {
      id: '1',
      name: '义务教育优质均衡发展评估指标体系（2024版）',
      type: '达标类',
      target: '区县',
      tags: JSON.stringify(['义务教育', '优质均衡', '资源配置']),
      description: '根据国家义务教育优质均衡发展督导评估办法制定，用于评估区县级义务教育优质均衡发展水平，包括资源配置、政府保障程度、教育质量等维度。',
      indicatorCount: 58,
      attachments: JSON.stringify([
        { name: '义务教育优质均衡发展评估实施细则.pdf', size: '2.3 MB' },
        { name: '评估指标解读说明.docx', size: '856 KB' }
      ]),
      status: 'published',
      createdBy: 'AAA',
      createdAt: '2024-01-15',
      updatedBy: 'AAA',
      updatedAt: '2024-03-20'
    },
    {
      id: '2',
      name: '教育质量监测指标体系',
      type: '评分类',
      target: '学校',
      tags: JSON.stringify(['教育质量', '学生发展', '监测评估']),
      description: '用于监测学校教育质量的综合指标体系，重点关注学生发展水平、教师专业能力和学校管理效能等方面。',
      indicatorCount: 3,
      attachments: JSON.stringify([{ name: '教育质量监测工作方案.pdf', size: '1.2 MB' }]),
      status: 'editing',
      createdBy: 'BBB',
      createdAt: '2024-06-01',
      updatedBy: 'BBB',
      updatedAt: '2024-08-15'
    }
  ];

  systems.forEach(sys => {
    insertSystem.run(
      sys.id, sys.name, sys.type, sys.target, sys.tags, sys.description,
      sys.indicatorCount, sys.attachments, sys.status, sys.createdBy,
      sys.createdAt, sys.updatedBy, sys.updatedAt
    );
  });
  console.log('Inserted indicator systems.');

  // 2. 插入指标树（指标体系1的指标）
  const insertIndicator = db.prepare(`
    INSERT OR REPLACE INTO indicators
    (id, system_id, parent_id, code, name, description, level, is_leaf, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const indicators = [
    // 一级指标
    { id: 'I1', systemId: '1', parentId: null, code: '1', name: '资源配置', description: '资源配置相关的评估指标', level: 1, isLeaf: 0, sortOrder: 0 },
    { id: 'I2', systemId: '1', parentId: null, code: '2', name: '政府保障程度', description: '政府保障程度相关的评估指标', level: 1, isLeaf: 0, sortOrder: 1 },
    { id: 'I3', systemId: '1', parentId: null, code: '3', name: '教育质量', description: '教育质量相关的评估指标', level: 1, isLeaf: 0, sortOrder: 2 },
    { id: 'I4', systemId: '1', parentId: null, code: '4', name: '社会认可度', description: '社会认可度相关的评估指标', level: 1, isLeaf: 0, sortOrder: 3 },

    // 二级指标 - 资源配置
    { id: 'I1-1', systemId: '1', parentId: 'I1', code: '1.1', name: '小学学校达标情况', description: '该指标用于评估小学教育资源配置的均衡性', level: 2, isLeaf: 1, sortOrder: 0 },
    { id: 'I1-2', systemId: '1', parentId: 'I1', code: '1.2', name: '初中学校达标情况', description: '该指标用于评估初中教育资源配置的均衡性', level: 2, isLeaf: 1, sortOrder: 1 },
    { id: 'I1-3', systemId: '1', parentId: 'I1', code: '1.3', name: '小学校际差异系数', description: '小学校际差异系数相关的评估指标', level: 2, isLeaf: 0, sortOrder: 2 },
    { id: 'I1-4', systemId: '1', parentId: 'I1', code: '1.4', name: '初中校际差异系数', description: '初中校际差异系数相关的评估指标', level: 2, isLeaf: 0, sortOrder: 3 },

    // 三级指标 - 小学校际差异系数
    { id: 'I1-3-1', systemId: '1', parentId: 'I1-3', code: '1.3.1', name: '每百名学生拥有高于规定学历教师数差异系数', description: '该指标用于评估教师学历配置的均衡性', level: 3, isLeaf: 1, sortOrder: 0 },
    { id: 'I1-3-2', systemId: '1', parentId: 'I1-3', code: '1.3.2', name: '每百名学生拥有县级以上骨干教师数差异系数', description: '该指标用于评估骨干教师配置的均衡性', level: 3, isLeaf: 1, sortOrder: 1 },
    { id: 'I1-3-3', systemId: '1', parentId: 'I1-3', code: '1.3.3', name: '生均教学及辅助用房面积差异系数', description: '该指标用于评估教学用房配置的均衡性', level: 3, isLeaf: 1, sortOrder: 2 },
    { id: 'I1-3-4', systemId: '1', parentId: 'I1-3', code: '1.3.4', name: '生均体育运动场馆面积差异系数', description: '该指标用于评估体育场馆配置的均衡性', level: 3, isLeaf: 1, sortOrder: 3 },

    // 三级指标 - 初中校际差异系数
    { id: 'I1-4-1', systemId: '1', parentId: 'I1-4', code: '1.4.1', name: '每百名学生拥有高于规定学历教师数差异系数', description: '该指标用于评估教师学历配置的均衡性', level: 3, isLeaf: 1, sortOrder: 0 },
    { id: 'I1-4-2', systemId: '1', parentId: 'I1-4', code: '1.4.2', name: '生均教学仪器设备值差异系数', description: '该指标用于评估教学设备配置的均衡性', level: 3, isLeaf: 1, sortOrder: 1 },

    // 二级指标 - 政府保障程度
    { id: 'I2-1', systemId: '1', parentId: 'I2', code: '2.1', name: '教育经费执行情况', description: '教育经费投入及执行情况', level: 2, isLeaf: 1, sortOrder: 0 },
    { id: 'I2-2', systemId: '1', parentId: 'I2', code: '2.2', name: '教师培训覆盖率', description: '教师参加培训的覆盖程度', level: 2, isLeaf: 1, sortOrder: 1 },
    { id: 'I2-3', systemId: '1', parentId: 'I2', code: '2.3', name: '集团化办学覆盖率', description: '集团化办学的覆盖程度', level: 2, isLeaf: 1, sortOrder: 2 },

    // 二级指标 - 教育质量
    { id: 'I3-1', systemId: '1', parentId: 'I3', code: '3.1', name: '学生体质健康达标率', description: '学生体质健康测试达标情况', level: 2, isLeaf: 1, sortOrder: 0 },
    { id: 'I3-2', systemId: '1', parentId: 'I3', code: '3.2', name: '义务教育巩固率', description: '义务教育阶段学生巩固情况', level: 2, isLeaf: 1, sortOrder: 1 },
    { id: 'I3-3', systemId: '1', parentId: 'I3', code: '3.3', name: '控辍保学率', description: '控制辍学保障入学情况', level: 2, isLeaf: 1, sortOrder: 2 },

    // 二级指标 - 社会认可度
    { id: 'I4-1', systemId: '1', parentId: 'I4', code: '4.1', name: '家长满意度调查', description: '家长对教育服务的满意程度', level: 2, isLeaf: 1, sortOrder: 0 },
    { id: 'I4-2', systemId: '1', parentId: 'I4', code: '4.2', name: '社会参与度', description: '社会各界参与教育的程度', level: 2, isLeaf: 1, sortOrder: 1 },
  ];

  indicators.forEach(ind => {
    insertIndicator.run(
      ind.id, ind.systemId, ind.parentId, ind.code, ind.name, ind.description,
      ind.level, ind.isLeaf, ind.sortOrder, timestamp, timestamp
    );
  });
  console.log('Inserted indicators.');

  // 3. 插入数据指标
  const insertDataIndicator = db.prepare(`
    INSERT OR REPLACE INTO data_indicators
    (id, indicator_id, code, name, threshold, description, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const dataIndicators = [
    { id: 'D1-1-1', indicatorId: 'I1-1', code: '1.1-D1', name: '师生比', threshold: '小学≤17:1', description: '专任教师数与学生数的比例' },
    { id: 'D1-1-2', indicatorId: 'I1-1', code: '1.1-D2', name: '生均教学用房面积', threshold: '≥9.75㎡', description: '教学及辅助用房面积除以学生数' },
    { id: 'D1-2-1', indicatorId: 'I1-2', code: '1.2-D1', name: '师生比', threshold: '初中≤13.5:1', description: '专任教师数与学生数的比例' },
    { id: 'D1-2-2', indicatorId: 'I1-2', code: '1.2-D2', name: '生均教学用房面积', threshold: '≥7.5㎡', description: '教学及辅助用房面积除以学生数' },
    { id: 'D1-3-1-1', indicatorId: 'I1-3-1', code: '1.3.1-D1', name: '差异系数', threshold: '≤0.50', description: '校际差异系数计算值' },
    { id: 'D1-3-2-1', indicatorId: 'I1-3-2', code: '1.3.2-D1', name: '差异系数', threshold: '≤0.50', description: '校际差异系数计算值' },
    { id: 'D2-1-1', indicatorId: 'I2-1', code: '2.1-D1', name: '教育经费占比', threshold: '≥4%', description: '教育经费占财政支出的比例' },
    { id: 'D2-2-1', indicatorId: 'I2-2', code: '2.2-D1', name: '培训覆盖率', threshold: '≥90%', description: '参加培训教师占比' },
    { id: 'D2-3-1', indicatorId: 'I2-3', code: '2.3-D1', name: '集团化覆盖率', threshold: '≥80%', description: '集团化办学覆盖学校比例' },
    { id: 'D3-1-1', indicatorId: 'I3-1', code: '3.1-D1', name: '体质达标率', threshold: '≥95%', description: '体质健康测试达标学生占比' },
    { id: 'D3-2-1', indicatorId: 'I3-2', code: '3.2-D1', name: '巩固率', threshold: '≥99%', description: '义务教育巩固率' },
    { id: 'D3-3-1', indicatorId: 'I3-3', code: '3.3-D1', name: '控辍保学率', threshold: '100%', description: '控辍保学达标率' },
    { id: 'D4-1-1', indicatorId: 'I4-1', code: '4.1-D1', name: '满意度', threshold: '≥95%', description: '家长满意度调查结果' },
  ];

  dataIndicators.forEach((di, idx) => {
    insertDataIndicator.run(
      di.id, di.indicatorId, di.code, di.name, di.threshold, di.description, idx, timestamp, timestamp
    );
  });
  console.log('Inserted data indicators.');

  // 4. 插入佐证资料配置
  const insertMaterial = db.prepare(`
    INSERT OR REPLACE INTO supporting_materials
    (id, indicator_id, code, name, file_types, max_size, description, required, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const materials = [
    { id: 'M1-1-1', indicatorId: 'I1-1', code: '1.1-M1', name: '学校基本情况统计表', fileTypes: 'PDF,Excel', maxSize: '10MB', description: '包含师生数、用房面积等基础数据', required: 1 },
    { id: 'M1-2-1', indicatorId: 'I1-2', code: '1.2-M1', name: '学校基本情况统计表', fileTypes: 'PDF,Excel', maxSize: '10MB', description: '包含师生数、用房面积等基础数据', required: 1 },
    { id: 'M2-1-1', indicatorId: 'I2-1', code: '2.1-M1', name: '教育经费决算报表', fileTypes: 'PDF,Excel', maxSize: '20MB', description: '年度教育经费决算情况', required: 1 },
    { id: 'M2-2-1', indicatorId: 'I2-2', code: '2.2-M1', name: '教师培训记录汇总表', fileTypes: 'PDF,Excel', maxSize: '10MB', description: '年度教师培训统计', required: 1 },
    { id: 'M3-1-1', indicatorId: 'I3-1', code: '3.1-M1', name: '学生体质健康测试汇总', fileTypes: 'PDF,Excel', maxSize: '10MB', description: '学生体质健康测试结果统计', required: 1 },
    { id: 'M4-1-1', indicatorId: 'I4-1', code: '4.1-M1', name: '满意度调查报告', fileTypes: 'PDF,Word', maxSize: '20MB', description: '第三方满意度调查报告', required: 1 },
  ];

  materials.forEach((m, idx) => {
    insertMaterial.run(
      m.id, m.indicatorId, m.code, m.name, m.fileTypes, m.maxSize, m.description, m.required, idx, timestamp, timestamp
    );
  });
  console.log('Inserted supporting materials.');

  // 5. 插入采集工具
  const insertTool = db.prepare(`
    INSERT OR REPLACE INTO data_tools
    (id, name, type, target, description, schema, status, created_by, created_at, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tools = [
    { id: '1', name: '学校基础数据采集表', type: '表单', target: '学校', description: '用于采集学校基本信息、办学条件、师资队伍等基础数据', status: 'published', createdBy: '张伟', createdAt: '2024-01-15', updatedBy: '张伟', updatedAt: '2024-03-20' },
    { id: '2', name: '教师专业发展数据表', type: '表单', target: '学校', description: '采集教师的学历结构、职称结构、培训情况等专业发展数据', status: 'published', createdBy: '李娜', createdAt: '2024-02-01', updatedBy: '李娜', updatedAt: '2024-03-18' },
    { id: '3', name: '学校办学条件数据表', type: '表单', target: '学校', description: '采集学校校舍建筑面积、教学设备设施、图书资源等办学条件相关数据', status: 'editing', createdBy: '王芳', createdAt: '2024-02-15', updatedBy: '赵强', updatedAt: '2024-03-25' },
    { id: '4', name: '义务教育优质均衡发展督导评估现场核查表', type: '表单', target: '学校', description: '用于现场核查学校义务教育优质均衡发展情况', status: 'published', createdBy: '系统管理员', createdAt: '2024-11-10', updatedBy: '系统管理员', updatedAt: '2024-11-14' },
  ];

  // 示例表单schema
  const sampleSchema = JSON.stringify([
    { id: 'f1', type: 'text', label: '学校名称', placeholder: '请输入学校名称', width: '100%', required: true },
    { id: 'f2', type: 'select', label: '学校类型', placeholder: '请选择', width: '50%', required: true, options: [{ label: '小学', value: '小学' }, { label: '初中', value: '初中' }, { label: '九年一贯制', value: '九年一贯制' }] },
    { id: 'f3', type: 'number', label: '在校学生总数', placeholder: '请输入', width: '50%', required: true, unit: '人' },
    { id: 'f4', type: 'number', label: '专任教师总数', placeholder: '请输入', width: '50%', required: true, unit: '人' },
    { id: 'f5', type: 'number', label: '教学及辅助用房面积', placeholder: '请输入', width: '50%', required: true, unit: '㎡', decimalPlaces: '2位小数' },
    { id: 'f6', type: 'number', label: '体育运动场馆面积', placeholder: '请输入', width: '50%', required: true, unit: '㎡', decimalPlaces: '2位小数' },
    { id: 'f7', type: 'number', label: '教学仪器设备总值', placeholder: '请输入', width: '50%', required: true, unit: '万元', decimalPlaces: '2位小数' },
    { id: 'f8', type: 'number', label: '图书总册数', placeholder: '请输入', width: '50%', required: true, unit: '册' },
    { id: 'f9', type: 'number', label: '计算机总台数', placeholder: '请输入', width: '50%', required: true, unit: '台' },
  ]);

  tools.forEach(tool => {
    insertTool.run(
      tool.id, tool.name, tool.type, tool.target, tool.description,
      tool.id === '1' ? sampleSchema : null,
      tool.status, tool.createdBy, tool.createdAt, tool.updatedBy, tool.updatedAt
    );
  });
  console.log('Inserted data tools.');

  // 6. 插入要素库
  const insertLibrary = db.prepare(`
    INSERT OR REPLACE INTO element_libraries
    (id, name, description, element_count, status, created_by, created_at, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const libraries = [
    { id: '1', name: '义务教育优质均衡评估要素库', description: '用于义务教育优质均衡发展督导评估的基础数据要素', elementCount: 15, status: 'published', createdBy: '张伟', createdAt: '2024-01-15', updatedBy: '张伟', updatedAt: '2024-03-20' },
    { id: '2', name: '幼儿园普惠督导评估要素库', description: '用于幼儿园普惠性督导评估的数据要素', elementCount: 13, status: 'published', createdBy: '李娜', createdAt: '2024-02-10', updatedBy: '王芳', updatedAt: '2024-04-15' },
  ];

  libraries.forEach(lib => {
    insertLibrary.run(lib.id, lib.name, lib.description, lib.elementCount, lib.status, lib.createdBy, lib.createdAt, lib.updatedBy, lib.updatedAt);
  });
  console.log('Inserted element libraries.');

  // 7. 插入要素
  const insertElement = db.prepare(`
    INSERT OR REPLACE INTO elements
    (id, library_id, code, name, element_type, data_type, formula, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const elements = [
    { id: 'E001', libraryId: '1', code: 'E001', name: '学校名称', elementType: '基础要素', dataType: '文本', formula: null },
    { id: 'E002', libraryId: '1', code: 'E002', name: '学校类型', elementType: '基础要素', dataType: '文本', formula: null },
    { id: 'E003', libraryId: '1', code: 'E003', name: '在校学生总数', elementType: '基础要素', dataType: '数字', formula: null },
    { id: 'E004', libraryId: '1', code: 'E004', name: '专任教师总数', elementType: '基础要素', dataType: '数字', formula: null },
    { id: 'E005', libraryId: '1', code: 'E005', name: '高级职称教师数', elementType: '基础要素', dataType: '数字', formula: null },
    { id: 'E006', libraryId: '1', code: 'E006', name: '生师比', elementType: '派生要素', dataType: '数字', formula: 'E003 / E004' },
    { id: 'E007', libraryId: '1', code: 'E007', name: '高级职称教师占比', elementType: '派生要素', dataType: '数字', formula: '(E005 / E004) * 100' },
  ];

  elements.forEach((el, idx) => {
    insertElement.run(el.id, el.libraryId, el.code, el.name, el.elementType, el.dataType, el.formula, idx, timestamp, timestamp);
  });
  console.log('Inserted elements.');

  // 8. 插入项目
  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects
    (id, name, keywords, description, indicator_system_id, start_date, end_date, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const projects = [
    { id: '1', name: '2024年沈阳市义务教育优质均衡发展督导评估', keywords: JSON.stringify(['义务教育', '优质均衡', '2024年']), description: '对全市各区县义务教育优质均衡发展情况进行全面督导评估', indicatorSystemId: '1', startDate: '2024-03-01', endDate: '2024-12-31', status: '填报中', createdBy: 'admin', createdAt: '2024-02-15', updatedAt: '2024-03-01' },
    { id: '2', name: '2024年幼儿园普惠性督导评估', keywords: JSON.stringify(['幼儿园', '普惠性', '2024年']), description: '对全市普惠性幼儿园进行督导评估', indicatorSystemId: null, startDate: '2024-04-01', endDate: '2024-11-30', status: '配置中', createdBy: 'admin', createdAt: '2024-03-01', updatedAt: '2024-03-15' },
  ];

  projects.forEach(proj => {
    insertProject.run(proj.id, proj.name, proj.keywords, proj.description, proj.indicatorSystemId, proj.startDate, proj.endDate, proj.status, proj.createdBy, proj.createdAt, proj.updatedAt);
  });
  console.log('Inserted projects.');

  // 9. 插入项目与采集工具关联
  const insertProjectTool = db.prepare(`
    INSERT OR REPLACE INTO project_tools
    (id, project_id, tool_id, sort_order, is_required, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const projectTools = [
    { id: 'PT1', projectId: '1', toolId: '1', sortOrder: 0, isRequired: 1 },
    { id: 'PT2', projectId: '1', toolId: '2', sortOrder: 1, isRequired: 1 },
    { id: 'PT3', projectId: '1', toolId: '4', sortOrder: 2, isRequired: 0 },
  ];

  projectTools.forEach(pt => {
    insertProjectTool.run(pt.id, pt.projectId, pt.toolId, pt.sortOrder, pt.isRequired, timestamp);
  });
  console.log('Inserted project tools.');

  // 10. 插入字段映射（示例：将表单字段映射到数据指标）
  const insertFieldMapping = db.prepare(`
    INSERT OR REPLACE INTO field_mappings
    (id, tool_id, field_id, mapping_type, target_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const fieldMappings = [
    // 表单1的字段映射到数据指标
    { id: 'FM1', toolId: '1', fieldId: 'f3', mappingType: 'data_indicator', targetId: 'D1-1-1' },  // 学生数 -> 师生比指标
    { id: 'FM2', toolId: '1', fieldId: 'f4', mappingType: 'data_indicator', targetId: 'D1-1-1' },  // 教师数 -> 师生比指标
    { id: 'FM3', toolId: '1', fieldId: 'f5', mappingType: 'data_indicator', targetId: 'D1-1-2' },  // 教学用房 -> 生均教学用房指标
    // 表单1的字段映射到要素
    { id: 'FM4', toolId: '1', fieldId: 'f1', mappingType: 'element', targetId: 'E001' },  // 学校名称
    { id: 'FM5', toolId: '1', fieldId: 'f2', mappingType: 'element', targetId: 'E002' },  // 学校类型
  ];

  fieldMappings.forEach(fm => {
    insertFieldMapping.run(fm.id, fm.toolId, fm.fieldId, fm.mappingType, fm.targetId, timestamp, timestamp);
  });
  console.log('Inserted field mappings.');

  // 11. 插入区县数据（沈阳市13个区县）
  const insertDistrict = db.prepare(`
    INSERT OR REPLACE INTO districts
    (id, code, name, type, parent_code, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const districts = [
    { id: 'd-001', code: '210102', name: '和平区', type: '市辖区', parentCode: '210100', sortOrder: 1 },
    { id: 'd-002', code: '210103', name: '沈河区', type: '市辖区', parentCode: '210100', sortOrder: 2 },
    { id: 'd-003', code: '210104', name: '大东区', type: '市辖区', parentCode: '210100', sortOrder: 3 },
    { id: 'd-004', code: '210105', name: '皇姑区', type: '市辖区', parentCode: '210100', sortOrder: 4 },
    { id: 'd-005', code: '210106', name: '铁西区', type: '市辖区', parentCode: '210100', sortOrder: 5 },
    { id: 'd-006', code: '210111', name: '苏家屯区', type: '市辖区', parentCode: '210100', sortOrder: 6 },
    { id: 'd-007', code: '210112', name: '浑南区', type: '市辖区', parentCode: '210100', sortOrder: 7 },
    { id: 'd-008', code: '210113', name: '沈北新区', type: '市辖区', parentCode: '210100', sortOrder: 8 },
    { id: 'd-009', code: '210114', name: '于洪区', type: '市辖区', parentCode: '210100', sortOrder: 9 },
    { id: 'd-010', code: '210115', name: '辽中区', type: '市辖区', parentCode: '210100', sortOrder: 10 },
    { id: 'd-011', code: '210123', name: '康平县', type: '县', parentCode: '210100', sortOrder: 11 },
    { id: 'd-012', code: '210124', name: '法库县', type: '县', parentCode: '210100', sortOrder: 12 },
    { id: 'd-013', code: '210181', name: '新民市', type: '县级市', parentCode: '210100', sortOrder: 13 },
  ];

  districts.forEach(d => {
    insertDistrict.run(d.id, d.code, d.name, d.type, d.parentCode, d.sortOrder, timestamp, timestamp);
  });
  console.log('Inserted districts.');

  // 12. 插入示例学校数据
  const insertSchool = db.prepare(`
    INSERT OR REPLACE INTO schools
    (id, code, name, district_id, school_type, school_category, urban_rural, address, principal, contact_phone, student_count, teacher_count, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const schools = [
    // 和平区学校
    { id: 's-001', code: '2101020001', name: '沈阳市和平区南京街第一小学', districtId: 'd-001', schoolType: '小学', schoolCategory: '公办', urbanRural: '城区', address: '和平区南京南街100号', principal: '张明', contactPhone: '024-23456001', studentCount: 1200, teacherCount: 85 },
    { id: 's-002', code: '2101020002', name: '沈阳市和平区望湖路小学', districtId: 'd-001', schoolType: '小学', schoolCategory: '公办', urbanRural: '城区', address: '和平区望湖路50号', principal: '李红', contactPhone: '024-23456002', studentCount: 980, teacherCount: 72 },
    { id: 's-003', code: '2101020003', name: '沈阳市第一二六中学', districtId: 'd-001', schoolType: '初中', schoolCategory: '公办', urbanRural: '城区', address: '和平区北四马路10号', principal: '王强', contactPhone: '024-23456003', studentCount: 1500, teacherCount: 120 },

    // 沈河区学校
    { id: 's-004', code: '2101030001', name: '沈阳市沈河区文艺路第二小学', districtId: 'd-002', schoolType: '小学', schoolCategory: '公办', urbanRural: '城区', address: '沈河区文艺路88号', principal: '刘芳', contactPhone: '024-24567001', studentCount: 1100, teacherCount: 78 },
    { id: 's-005', code: '2101030002', name: '沈阳市第七中学', districtId: 'd-002', schoolType: '初中', schoolCategory: '公办', urbanRural: '城区', address: '沈河区奉天街200号', principal: '陈伟', contactPhone: '024-24567002', studentCount: 1800, teacherCount: 145 },

    // 铁西区学校
    { id: 's-006', code: '2101060001', name: '沈阳市铁西区勋望小学', districtId: 'd-005', schoolType: '小学', schoolCategory: '公办', urbanRural: '城区', address: '铁西区兴华北街100号', principal: '赵丽', contactPhone: '024-25678001', studentCount: 1350, teacherCount: 95 },
    { id: 's-007', code: '2101060002', name: '沈阳市铁西区启工二小', districtId: 'd-005', schoolType: '小学', schoolCategory: '公办', urbanRural: '城区', address: '铁西区启工街80号', principal: '孙杰', contactPhone: '024-25678002', studentCount: 1050, teacherCount: 75 },
    { id: 's-008', code: '2101060003', name: '沈阳市第三十一中学', districtId: 'd-005', schoolType: '初中', schoolCategory: '公办', urbanRural: '城区', address: '铁西区景星南街50号', principal: '周明', contactPhone: '024-25678003', studentCount: 1600, teacherCount: 130 },

    // 辽中区学校（城乡结合）
    { id: 's-009', code: '2101150001', name: '沈阳市辽中区第一初级中学', districtId: 'd-010', schoolType: '初中', schoolCategory: '公办', urbanRural: '城区', address: '辽中区蒲东街道', principal: '吴刚', contactPhone: '024-87882001', studentCount: 1200, teacherCount: 95 },
    { id: 's-010', code: '2101150002', name: '沈阳市辽中区城郊九年一贯制学校', districtId: 'd-010', schoolType: '九年一贯制', schoolCategory: '公办', urbanRural: '镇区', address: '辽中区城郊镇', principal: '郑华', contactPhone: '024-87882002', studentCount: 800, teacherCount: 60 },
    { id: 's-011', code: '2101150003', name: '沈阳市辽中区茨榆坨中心小学', districtId: 'd-010', schoolType: '小学', schoolCategory: '公办', urbanRural: '乡村', address: '辽中区茨榆坨镇', principal: '马超', contactPhone: '024-87882003', studentCount: 450, teacherCount: 35 },

    // 法库县学校
    { id: 's-012', code: '2101240001', name: '法库县第一初级中学', districtId: 'd-012', schoolType: '初中', schoolCategory: '公办', urbanRural: '城区', address: '法库县法库镇', principal: '韩磊', contactPhone: '024-87122001', studentCount: 1100, teacherCount: 88 },
    { id: 's-013', code: '2101240002', name: '法库县实验小学', districtId: 'd-012', schoolType: '小学', schoolCategory: '公办', urbanRural: '城区', address: '法库县法库镇中心路', principal: '杨帆', contactPhone: '024-87122002', studentCount: 950, teacherCount: 68 },
    { id: 's-014', code: '2101240003', name: '法库县秀水河子中心小学', districtId: 'd-012', schoolType: '小学', schoolCategory: '公办', urbanRural: '乡村', address: '法库县秀水河子镇', principal: '田野', contactPhone: '024-87122003', studentCount: 380, teacherCount: 28 },
  ];

  schools.forEach(s => {
    insertSchool.run(s.id, s.code, s.name, s.districtId, s.schoolType, s.schoolCategory, s.urbanRural, s.address, s.principal, s.contactPhone, s.studentCount, s.teacherCount, 'active', timestamp, timestamp);
  });
  console.log('Inserted schools.');

  // 13. 插入评估年度
  const insertEvalYear = db.prepare(`
    INSERT OR REPLACE INTO evaluation_years
    (id, year, name, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const evalYears = [
    { id: 'ey-2024', year: 2024, name: '2023-2024学年', startDate: '2023-09-01', endDate: '2024-08-31', status: 'archived' },
    { id: 'ey-2025', year: 2025, name: '2024-2025学年', startDate: '2024-09-01', endDate: '2025-08-31', status: 'active' },
  ];

  evalYears.forEach(ey => {
    insertEvalYear.run(ey.id, ey.year, ey.name, ey.startDate, ey.endDate, ey.status, timestamp);
  });
  console.log('Inserted evaluation years.');

  console.log('\nSeed data inserted successfully!');
}

// 主函数
function main() {
  console.log('Initializing database...\n');

  // 如果数据库已存在，先删除
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Removed existing database.');
  }

  const db = createDatabase();
  seedData(db);
  db.close();

  console.log('\nDatabase initialization complete!');
  console.log(`Database file: ${DB_PATH}`);
}

// 导出函数供其他模块使用
module.exports = { createDatabase, DB_PATH };

// 如果直接运行此脚本
if (require.main === module) {
  main();
}
