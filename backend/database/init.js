/**
 * Supabase 数据库初始化脚本
 * 用于插入种子数据
 *
 * 注意：表结构需要通过 Supabase SQL Editor 执行 supabase-setup.sql 来创建
 */

const db = require('./db');

// 获取当前时间
function now() {
  return new Date().toISOString().split('T')[0];
}

// 生成UUID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// 种子数据
async function seedData() {
  const timestamp = now();
  const { supabase } = db;

  console.log('Starting data seeding...\n');

  // 1. 插入指标体系
  console.log('Seeding indicator_systems...');
  const systems = [
    {
      id: '1',
      name: '义务教育优质均衡发展评估指标体系（2024版）',
      type: '达标类',
      target: '区县',
      tags: JSON.stringify(['义务教育', '优质均衡', '资源配置']),
      description: '根据国家义务教育优质均衡发展督导评估办法制定，用于评估区县级义务教育优质均衡发展水平，包括资源配置、政府保障程度、教育质量等维度。',
      status: 'published',
      created_by: 'AAA',
      created_at: '2024-01-15',
      updated_at: '2024-03-20'
    },
    {
      id: '2',
      name: '教育质量监测指标体系',
      type: '评分类',
      target: '学校',
      tags: JSON.stringify(['教育质量', '学生发展', '监测评估']),
      description: '用于监测学校教育质量的综合指标体系，重点关注学生发展水平、教师专业能力和学校管理效能等方面。',
      status: 'editing',
      created_by: 'BBB',
      created_at: '2024-06-01',
      updated_at: '2024-08-15'
    }
  ];

  const { error: systemsError } = await supabase
    .from('indicator_systems')
    .upsert(systems, { onConflict: 'id' });

  if (systemsError) {
    console.error('Error seeding indicator_systems:', systemsError.message);
  } else {
    console.log('  Inserted indicator_systems.');
  }

  // 2. 插入指标树
  console.log('Seeding indicators...');
  const indicators = [
    // 一级指标
    { id: 'I1', system_id: '1', parent_id: null, code: '1', name: '资源配置', description: '资源配置相关的评估指标', level: 1, is_leaf: 0, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I2', system_id: '1', parent_id: null, code: '2', name: '政府保障程度', description: '政府保障程度相关的评估指标', level: 1, is_leaf: 0, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'I3', system_id: '1', parent_id: null, code: '3', name: '教育质量', description: '教育质量相关的评估指标', level: 1, is_leaf: 0, sort_order: 2, created_at: timestamp, updated_at: timestamp },
    { id: 'I4', system_id: '1', parent_id: null, code: '4', name: '社会认可度', description: '社会认可度相关的评估指标', level: 1, is_leaf: 0, sort_order: 3, created_at: timestamp, updated_at: timestamp },
    // 二级指标 - 资源配置
    { id: 'I1-1', system_id: '1', parent_id: 'I1', code: '1.1', name: '小学学校达标情况', description: '该指标用于评估小学教育资源配置的均衡性', level: 2, is_leaf: 1, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-2', system_id: '1', parent_id: 'I1', code: '1.2', name: '初中学校达标情况', description: '该指标用于评估初中教育资源配置的均衡性', level: 2, is_leaf: 1, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-3', system_id: '1', parent_id: 'I1', code: '1.3', name: '小学校际差异系数', description: '小学校际差异系数相关的评估指标', level: 2, is_leaf: 0, sort_order: 2, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-4', system_id: '1', parent_id: 'I1', code: '1.4', name: '初中校际差异系数', description: '初中校际差异系数相关的评估指标', level: 2, is_leaf: 0, sort_order: 3, created_at: timestamp, updated_at: timestamp },
    // 三级指标 - 小学校际差异系数
    { id: 'I1-3-1', system_id: '1', parent_id: 'I1-3', code: '1.3.1', name: '每百名学生拥有高于规定学历教师数差异系数', description: '该指标用于评估教师学历配置的均衡性', level: 3, is_leaf: 1, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-3-2', system_id: '1', parent_id: 'I1-3', code: '1.3.2', name: '每百名学生拥有县级以上骨干教师数差异系数', description: '该指标用于评估骨干教师配置的均衡性', level: 3, is_leaf: 1, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-3-3', system_id: '1', parent_id: 'I1-3', code: '1.3.3', name: '生均教学及辅助用房面积差异系数', description: '该指标用于评估教学用房配置的均衡性', level: 3, is_leaf: 1, sort_order: 2, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-3-4', system_id: '1', parent_id: 'I1-3', code: '1.3.4', name: '生均体育运动场馆面积差异系数', description: '该指标用于评估体育场馆配置的均衡性', level: 3, is_leaf: 1, sort_order: 3, created_at: timestamp, updated_at: timestamp },
    // 三级指标 - 初中校际差异系数
    { id: 'I1-4-1', system_id: '1', parent_id: 'I1-4', code: '1.4.1', name: '每百名学生拥有高于规定学历教师数差异系数', description: '该指标用于评估教师学历配置的均衡性', level: 3, is_leaf: 1, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I1-4-2', system_id: '1', parent_id: 'I1-4', code: '1.4.2', name: '生均教学仪器设备值差异系数', description: '该指标用于评估教学设备配置的均衡性', level: 3, is_leaf: 1, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    // 二级指标 - 政府保障程度
    { id: 'I2-1', system_id: '1', parent_id: 'I2', code: '2.1', name: '教育经费执行情况', description: '教育经费投入及执行情况', level: 2, is_leaf: 1, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I2-2', system_id: '1', parent_id: 'I2', code: '2.2', name: '教师培训覆盖率', description: '教师参加培训的覆盖程度', level: 2, is_leaf: 1, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'I2-3', system_id: '1', parent_id: 'I2', code: '2.3', name: '集团化办学覆盖率', description: '集团化办学的覆盖程度', level: 2, is_leaf: 1, sort_order: 2, created_at: timestamp, updated_at: timestamp },
    // 二级指标 - 教育质量
    { id: 'I3-1', system_id: '1', parent_id: 'I3', code: '3.1', name: '学生体质健康达标率', description: '学生体质健康测试达标情况', level: 2, is_leaf: 1, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I3-2', system_id: '1', parent_id: 'I3', code: '3.2', name: '义务教育巩固率', description: '义务教育阶段学生巩固情况', level: 2, is_leaf: 1, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'I3-3', system_id: '1', parent_id: 'I3', code: '3.3', name: '控辍保学率', description: '控制辍学保障入学情况', level: 2, is_leaf: 1, sort_order: 2, created_at: timestamp, updated_at: timestamp },
    // 二级指标 - 社会认可度
    { id: 'I4-1', system_id: '1', parent_id: 'I4', code: '4.1', name: '家长满意度调查', description: '家长对教育服务的满意程度', level: 2, is_leaf: 1, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'I4-2', system_id: '1', parent_id: 'I4', code: '4.2', name: '社会参与度', description: '社会各界参与教育的程度', level: 2, is_leaf: 1, sort_order: 1, created_at: timestamp, updated_at: timestamp },
  ];

  const { error: indicatorsError } = await supabase
    .from('indicators')
    .upsert(indicators, { onConflict: 'id' });

  if (indicatorsError) {
    console.error('Error seeding indicators:', indicatorsError.message);
  } else {
    console.log('  Inserted indicators.');
  }

  // 3. 插入数据指标
  console.log('Seeding data_indicators...');
  const dataIndicators = [
    { id: 'D1-1-1', indicator_id: 'I1-1', code: '1.1-D1', name: '师生比', threshold: '小学≤17:1', description: '专任教师数与学生数的比例', sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'D1-1-2', indicator_id: 'I1-1', code: '1.1-D2', name: '生均教学用房面积', threshold: '≥9.75㎡', description: '教学及辅助用房面积除以学生数', sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'D1-2-1', indicator_id: 'I1-2', code: '1.2-D1', name: '师生比', threshold: '初中≤13.5:1', description: '专任教师数与学生数的比例', sort_order: 2, created_at: timestamp, updated_at: timestamp },
    { id: 'D1-2-2', indicator_id: 'I1-2', code: '1.2-D2', name: '生均教学用房面积', threshold: '≥7.5㎡', description: '教学及辅助用房面积除以学生数', sort_order: 3, created_at: timestamp, updated_at: timestamp },
    { id: 'D1-3-1-1', indicator_id: 'I1-3-1', code: '1.3.1-D1', name: '差异系数', threshold: '≤0.50', description: '校际差异系数计算值', sort_order: 4, created_at: timestamp, updated_at: timestamp },
    { id: 'D1-3-2-1', indicator_id: 'I1-3-2', code: '1.3.2-D1', name: '差异系数', threshold: '≤0.50', description: '校际差异系数计算值', sort_order: 5, created_at: timestamp, updated_at: timestamp },
    { id: 'D2-1-1', indicator_id: 'I2-1', code: '2.1-D1', name: '教育经费占比', threshold: '≥4%', description: '教育经费占财政支出的比例', sort_order: 6, created_at: timestamp, updated_at: timestamp },
    { id: 'D2-2-1', indicator_id: 'I2-2', code: '2.2-D1', name: '培训覆盖率', threshold: '≥90%', description: '参加培训教师占比', sort_order: 7, created_at: timestamp, updated_at: timestamp },
    { id: 'D2-3-1', indicator_id: 'I2-3', code: '2.3-D1', name: '集团化覆盖率', threshold: '≥80%', description: '集团化办学覆盖学校比例', sort_order: 8, created_at: timestamp, updated_at: timestamp },
    { id: 'D3-1-1', indicator_id: 'I3-1', code: '3.1-D1', name: '体质达标率', threshold: '≥95%', description: '体质健康测试达标学生占比', sort_order: 9, created_at: timestamp, updated_at: timestamp },
    { id: 'D3-2-1', indicator_id: 'I3-2', code: '3.2-D1', name: '巩固率', threshold: '≥99%', description: '义务教育巩固率', sort_order: 10, created_at: timestamp, updated_at: timestamp },
    { id: 'D3-3-1', indicator_id: 'I3-3', code: '3.3-D1', name: '控辍保学率', threshold: '100%', description: '控辍保学达标率', sort_order: 11, created_at: timestamp, updated_at: timestamp },
    { id: 'D4-1-1', indicator_id: 'I4-1', code: '4.1-D1', name: '满意度', threshold: '≥95%', description: '家长满意度调查结果', sort_order: 12, created_at: timestamp, updated_at: timestamp },
  ];

  const { error: dataIndicatorsError } = await supabase
    .from('data_indicators')
    .upsert(dataIndicators, { onConflict: 'id' });

  if (dataIndicatorsError) {
    console.error('Error seeding data_indicators:', dataIndicatorsError.message);
  } else {
    console.log('  Inserted data_indicators.');
  }

  // 4. 插入采集工具
  console.log('Seeding data_tools...');
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

  const tools = [
    { id: '1', name: '学校基础数据采集表', type: '表单', target: '学校', description: '用于采集学校基本信息、办学条件、师资队伍等基础数据', schema: sampleSchema, status: 'published', created_by: '张伟', created_at: '2024-01-15', updated_at: '2024-03-20' },
    { id: '2', name: '教师专业发展数据表', type: '表单', target: '学校', description: '采集教师的学历结构、职称结构、培训情况等专业发展数据', schema: null, status: 'published', created_by: '李娜', created_at: '2024-02-01', updated_at: '2024-03-18' },
    { id: '3', name: '学校办学条件数据表', type: '表单', target: '学校', description: '采集学校校舍建筑面积、教学设备设施、图书资源等办学条件相关数据', schema: null, status: 'editing', created_by: '王芳', created_at: '2024-02-15', updated_at: '2024-03-25' },
    { id: '4', name: '义务教育优质均衡发展督导评估现场核查表', type: '表单', target: '学校', description: '用于现场核查学校义务教育优质均衡发展情况', schema: null, status: 'published', created_by: '系统管理员', created_at: '2024-11-10', updated_at: '2024-11-14' },
  ];

  const { error: toolsError } = await supabase
    .from('data_tools')
    .upsert(tools, { onConflict: 'id' });

  if (toolsError) {
    console.error('Error seeding data_tools:', toolsError.message);
  } else {
    console.log('  Inserted data_tools.');
  }

  // 5. 插入要素库
  console.log('Seeding element_libraries...');
  const libraries = [
    { id: '1', name: '义务教育优质均衡评估要素库', description: '用于义务教育优质均衡发展督导评估的基础数据要素', status: 'published', created_by: '张伟', created_at: '2024-01-15', updated_at: '2024-03-20' },
    { id: '2', name: '幼儿园普惠督导评估要素库', description: '用于幼儿园普惠性督导评估的数据要素', status: 'published', created_by: '李娜', created_at: '2024-02-10', updated_at: '2024-04-15' },
  ];

  const { error: librariesError } = await supabase
    .from('element_libraries')
    .upsert(libraries, { onConflict: 'id' });

  if (librariesError) {
    console.error('Error seeding element_libraries:', librariesError.message);
  } else {
    console.log('  Inserted element_libraries.');
  }

  // 6. 插入要素
  console.log('Seeding elements...');
  const elements = [
    { id: 'E001', library_id: '1', code: 'E001', name: '学校名称', element_type: '基础要素', data_type: '文本', formula: null, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    { id: 'E002', library_id: '1', code: 'E002', name: '学校类型', element_type: '基础要素', data_type: '文本', formula: null, sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'E003', library_id: '1', code: 'E003', name: '在校学生总数', element_type: '基础要素', data_type: '数字', formula: null, sort_order: 2, created_at: timestamp, updated_at: timestamp },
    { id: 'E004', library_id: '1', code: 'E004', name: '专任教师总数', element_type: '基础要素', data_type: '数字', formula: null, sort_order: 3, created_at: timestamp, updated_at: timestamp },
    { id: 'E005', library_id: '1', code: 'E005', name: '高级职称教师数', element_type: '基础要素', data_type: '数字', formula: null, sort_order: 4, created_at: timestamp, updated_at: timestamp },
    { id: 'E006', library_id: '1', code: 'E006', name: '生师比', element_type: '派生要素', data_type: '数字', formula: 'E003 / E004', sort_order: 5, created_at: timestamp, updated_at: timestamp },
    { id: 'E007', library_id: '1', code: 'E007', name: '高级职称教师占比', element_type: '派生要素', data_type: '数字', formula: '(E005 / E004) * 100', sort_order: 6, created_at: timestamp, updated_at: timestamp },
  ];

  const { error: elementsError } = await supabase
    .from('elements')
    .upsert(elements, { onConflict: 'id' });

  if (elementsError) {
    console.error('Error seeding elements:', elementsError.message);
  } else {
    console.log('  Inserted elements.');
  }

  // 7. 插入项目
  console.log('Seeding projects...');
  const projects = [
    { id: '1', name: '2024年沈阳市义务教育优质均衡发展督导评估', description: '对全市各区县义务教育优质均衡发展情况进行全面督导评估', indicator_system_id: '1', start_date: '2024-03-01', end_date: '2024-12-31', status: '填报中', created_by: 'admin', created_at: '2024-02-15', updated_at: '2024-03-01' },
    { id: '2', name: '2024年幼儿园普惠性督导评估', description: '对全市普惠性幼儿园进行督导评估', indicator_system_id: null, start_date: '2024-04-01', end_date: '2024-11-30', status: '配置中', created_by: 'admin', created_at: '2024-03-01', updated_at: '2024-03-15' },
  ];

  const { error: projectsError } = await supabase
    .from('projects')
    .upsert(projects, { onConflict: 'id' });

  if (projectsError) {
    console.error('Error seeding projects:', projectsError.message);
  } else {
    console.log('  Inserted projects.');
  }

  // 8. 插入项目与采集工具关联
  console.log('Seeding project_tools...');
  const projectTools = [
    { id: 'PT1', project_id: '1', tool_id: '1', sort_order: 0, is_required: 1, created_at: timestamp },
    { id: 'PT2', project_id: '1', tool_id: '2', sort_order: 1, is_required: 1, created_at: timestamp },
    { id: 'PT3', project_id: '1', tool_id: '4', sort_order: 2, is_required: 0, created_at: timestamp },
  ];

  const { error: projectToolsError } = await supabase
    .from('project_tools')
    .upsert(projectTools, { onConflict: 'id' });

  if (projectToolsError) {
    console.error('Error seeding project_tools:', projectToolsError.message);
  } else {
    console.log('  Inserted project_tools.');
  }

  // 9. 插入区县数据
  console.log('Seeding districts...');
  const districts = [
    { id: 'd-001', code: '210102', name: '和平区', type: '市辖区', sort_order: 1, created_at: timestamp, updated_at: timestamp },
    { id: 'd-002', code: '210103', name: '沈河区', type: '市辖区', sort_order: 2, created_at: timestamp, updated_at: timestamp },
    { id: 'd-003', code: '210104', name: '大东区', type: '市辖区', sort_order: 3, created_at: timestamp, updated_at: timestamp },
    { id: 'd-004', code: '210105', name: '皇姑区', type: '市辖区', sort_order: 4, created_at: timestamp, updated_at: timestamp },
    { id: 'd-005', code: '210106', name: '铁西区', type: '市辖区', sort_order: 5, created_at: timestamp, updated_at: timestamp },
    { id: 'd-006', code: '210111', name: '苏家屯区', type: '市辖区', sort_order: 6, created_at: timestamp, updated_at: timestamp },
    { id: 'd-007', code: '210112', name: '浑南区', type: '市辖区', sort_order: 7, created_at: timestamp, updated_at: timestamp },
    { id: 'd-008', code: '210113', name: '沈北新区', type: '市辖区', sort_order: 8, created_at: timestamp, updated_at: timestamp },
    { id: 'd-009', code: '210114', name: '于洪区', type: '市辖区', sort_order: 9, created_at: timestamp, updated_at: timestamp },
    { id: 'd-010', code: '210115', name: '辽中区', type: '市辖区', sort_order: 10, created_at: timestamp, updated_at: timestamp },
    { id: 'd-011', code: '210123', name: '康平县', type: '县', sort_order: 11, created_at: timestamp, updated_at: timestamp },
    { id: 'd-012', code: '210124', name: '法库县', type: '县', sort_order: 12, created_at: timestamp, updated_at: timestamp },
    { id: 'd-013', code: '210181', name: '新民市', type: '县级市', sort_order: 13, created_at: timestamp, updated_at: timestamp },
  ];

  const { error: districtsError } = await supabase
    .from('districts')
    .upsert(districts, { onConflict: 'id' });

  if (districtsError) {
    console.error('Error seeding districts:', districtsError.message);
  } else {
    console.log('  Inserted districts.');
  }

  // 10. 插入学校数据
  console.log('Seeding schools...');
  const schools = [
    { id: 's-001', code: '2101020001', name: '沈阳市和平区南京街第一小学', district_id: 'd-001', school_type: '小学', school_category: '公办', urban_rural: '城区', address: '和平区南京南街100号', student_count: 1200, teacher_count: 85, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-002', code: '2101020002', name: '沈阳市和平区望湖路小学', district_id: 'd-001', school_type: '小学', school_category: '公办', urban_rural: '城区', address: '和平区望湖路50号', student_count: 980, teacher_count: 72, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-003', code: '2101020003', name: '沈阳市第一二六中学', district_id: 'd-001', school_type: '初中', school_category: '公办', urban_rural: '城区', address: '和平区北四马路10号', student_count: 1500, teacher_count: 120, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-004', code: '2101030001', name: '沈阳市沈河区文艺路第二小学', district_id: 'd-002', school_type: '小学', school_category: '公办', urban_rural: '城区', address: '沈河区文艺路88号', student_count: 1100, teacher_count: 78, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-005', code: '2101030002', name: '沈阳市第七中学', district_id: 'd-002', school_type: '初中', school_category: '公办', urban_rural: '城区', address: '沈河区奉天街200号', student_count: 1800, teacher_count: 145, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-006', code: '2101060001', name: '沈阳市铁西区勋望小学', district_id: 'd-005', school_type: '小学', school_category: '公办', urban_rural: '城区', address: '铁西区兴华北街100号', student_count: 1350, teacher_count: 95, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-007', code: '2101060002', name: '沈阳市铁西区启工二小', district_id: 'd-005', school_type: '小学', school_category: '公办', urban_rural: '城区', address: '铁西区启工街80号', student_count: 1050, teacher_count: 75, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-008', code: '2101060003', name: '沈阳市第三十一中学', district_id: 'd-005', school_type: '初中', school_category: '公办', urban_rural: '城区', address: '铁西区景星南街50号', student_count: 1600, teacher_count: 130, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-009', code: '2101150001', name: '沈阳市辽中区第一初级中学', district_id: 'd-010', school_type: '初中', school_category: '公办', urban_rural: '城区', address: '辽中区蒲东街道', student_count: 1200, teacher_count: 95, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-010', code: '2101150002', name: '沈阳市辽中区城郊九年一贯制学校', district_id: 'd-010', school_type: '九年一贯制', school_category: '公办', urban_rural: '镇区', address: '辽中区城郊镇', student_count: 800, teacher_count: 60, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-011', code: '2101150003', name: '沈阳市辽中区茨榆坨中心小学', district_id: 'd-010', school_type: '小学', school_category: '公办', urban_rural: '乡村', address: '辽中区茨榆坨镇', student_count: 450, teacher_count: 35, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-012', code: '2101240001', name: '法库县第一初级中学', district_id: 'd-012', school_type: '初中', school_category: '公办', urban_rural: '城区', address: '法库县法库镇', student_count: 1100, teacher_count: 88, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-013', code: '2101240002', name: '法库县实验小学', district_id: 'd-012', school_type: '小学', school_category: '公办', urban_rural: '城区', address: '法库县法库镇中心路', student_count: 950, teacher_count: 68, status: 'active', created_at: timestamp, updated_at: timestamp },
    { id: 's-014', code: '2101240003', name: '法库县秀水河子中心小学', district_id: 'd-012', school_type: '小学', school_category: '公办', urban_rural: '乡村', address: '法库县秀水河子镇', student_count: 380, teacher_count: 28, status: 'active', created_at: timestamp, updated_at: timestamp },
  ];

  const { error: schoolsError } = await supabase
    .from('schools')
    .upsert(schools, { onConflict: 'id' });

  if (schoolsError) {
    console.error('Error seeding schools:', schoolsError.message);
  } else {
    console.log('  Inserted schools.');
  }

  console.log('\nSeed data insertion complete!');
}

// 主函数
async function main() {
  console.log('='.repeat(50));
  console.log('Supabase Database Initialization');
  console.log('='.repeat(50));
  console.log('\nNOTE: Make sure you have already executed supabase-setup.sql');
  console.log('in the Supabase SQL Editor to create the tables.\n');

  try {
    // 测试连接
    const connected = await db.testConnection();
    if (!connected) {
      console.error('\nFailed to connect to Supabase.');
      console.error('Please check SUPABASE_URL and SUPABASE_KEY environment variables.');
      process.exit(1);
    }

    // 插入种子数据
    await seedData();

    console.log('\n' + '='.repeat(50));
    console.log('Database initialization complete!');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\nDatabase initialization failed:', error.message);
    process.exit(1);
  }
}

// 导出函数供其他模块使用
module.exports = { seedData };

// 如果直接运行此脚本
if (require.main === module) {
  main();
}
