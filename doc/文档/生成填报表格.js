const XLSX = require('xlsx');

// 学校填报数据字段
const schoolFields = [
  // 基本信息
  { category: '基本信息', field: '学校名称', unit: '', required: true },
  { category: '基本信息', field: '学校类型', unit: '小学/初中/九年一贯制/十二年一贯制/完全中学', required: true },
  { category: '基本信息', field: '学校代码', unit: '', required: true },
  { category: '基本信息', field: '建校时间', unit: '年', required: true },
  { category: '基本信息', field: '是否2010年及之前规划并建成', unit: '是/否', required: true },
  { category: '基本信息', field: '是否2016年及之前规划并建成', unit: '是/否', required: true },
  { category: '基本信息', field: '是否人口密度过高的大城市中心城区学校', unit: '是/否', required: true },
  { category: '基本信息', field: '是否50人及以上但不足100人的乡村小规模学校和教学点', unit: '是/否', required: true },
  { category: '基本信息', field: '是否最大班额低于30人的农村小规模学校', unit: '是/否', required: true },

  // 学生信息
  { category: '学生信息', field: '小学学生人数', unit: '人', required: true },
  { category: '学生信息', field: '初中学生人数', unit: '人', required: true },
  { category: '学生信息', field: '进城务工人员随迁子女在校生人数', unit: '人', required: true },
  { category: '学生信息', field: '家庭住址在划片范围内的在校学生人数（小学）', unit: '人', required: true },
  { category: '学生信息', field: '家庭住址在划片范围内的在校学生人数（初中）', unit: '人', required: true },

  // 班级信息
  { category: '班级信息', field: '班级总数', unit: '个', required: true },
  { category: '班级信息', field: '每班25人以下班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班26-30人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班31-35人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班36-40人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班41-45人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班46-50人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班51-55人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班56-60人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班61-65人班级个数', unit: '个', required: true },
  { category: '班级信息', field: '每班66人以上班级个数', unit: '个', required: true },

  // 教师学历信息
  { category: '教师学历信息', field: '专任教师总人数', unit: '人', required: true },
  { category: '教师学历信息', field: '专科学历教师人数（小学）', unit: '人', required: true },
  { category: '教师学历信息', field: '本科学历教师人数（小学）', unit: '人', required: true },
  { category: '教师学历信息', field: '本科学历教师人数（初中）', unit: '人', required: true },
  { category: '教师学历信息', field: '硕士学历教师人数（小学）', unit: '人', required: true },
  { category: '教师学历信息', field: '硕士学历教师人数（初中）', unit: '人', required: true },
  { category: '教师学历信息', field: '博士研究生学历教师人数（小学）', unit: '人', required: true },
  { category: '教师学历信息', field: '博士研究生学历教师人数（初中）', unit: '人', required: true },
  { category: '教师学历信息', field: '县级及以上骨干教师数', unit: '人', required: true },
  { category: '教师学历信息', field: '持有教师资格证的专任教师人数', unit: '人', required: true },
  { category: '教师学历信息', field: '近5年培训满360学时专任教师人数', unit: '人', required: true },

  // 体育艺术教师信息
  { category: '体育艺术教师', field: '体育专任教师人数', unit: '人', required: true },
  { category: '体育艺术教师', field: '音乐专任教师人数', unit: '人', required: true },
  { category: '体育艺术教师', field: '美术专任教师人数', unit: '人', required: true },
  { category: '体育艺术教师', field: '艺术专任教师人数', unit: '人', required: true },
  { category: '体育艺术教师', field: '体育交流轮岗/兼职/走教教师人数', unit: '人', required: false, remark: '仅50-100人乡村小规模学校填写' },
  { category: '体育艺术教师', field: '音乐交流轮岗/兼职/走教教师人数', unit: '人', required: false, remark: '仅50-100人乡村小规模学校填写' },
  { category: '体育艺术教师', field: '美术交流轮岗/兼职/走教教师人数', unit: '人', required: false, remark: '仅50-100人乡村小规模学校填写' },
  { category: '体育艺术教师', field: '艺术交流轮岗/兼职/走教教师人数', unit: '人', required: false, remark: '仅50-100人乡村小规模学校填写' },

  // 教学用房面积
  { category: '教学用房面积', field: '教学及辅助用房总面积', unit: '平方米', required: true },
  { category: '教学用房面积', field: '室内体育用房面积', unit: '平方米', required: true },

  // 体育场馆面积
  { category: '体育场馆面积', field: '学校体育馆面积', unit: '平方米', required: true },
  { category: '体育场馆面积', field: '校内体育场面积', unit: '平方米', required: true },
  { category: '体育场馆面积', field: '校外租赁场馆面积', unit: '平方米', required: false, remark: '仅人口密度过高的中心城区学校填写' },
  { category: '体育场馆面积', field: '校内其他体育场面积', unit: '平方米', required: false, remark: '仅人口密度过高的中心城区学校填写' },

  // 教学设备
  { category: '教学设备', field: '教学仪器设备资产值（账面原值）', unit: '万元', required: true },
  { category: '教学设备', field: '网络多媒体教室间数', unit: '间', required: true },

  // 音乐美术教室
  { category: '音乐美术教室', field: '音乐教室总间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '单间面积≥96㎡的音乐教室间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '73㎡≤单间面积＜96㎡的音乐教室间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '61㎡≤单间面积＜73㎡的音乐教室间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '美术教室总间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '单间面积≥90㎡的美术教室间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '67㎡≤单间面积＜90㎡的美术教室间数', unit: '间', required: true },
  { category: '音乐美术教室', field: '61㎡≤单间面积＜67㎡的美术教室间数', unit: '间', required: true },

  // 经费信息
  { category: '经费信息', field: '上一年度公用经费预算总额', unit: '万元', required: true },
  { category: '经费信息', field: '上一年度公用经费决算总额', unit: '万元', required: true },
  { category: '经费信息', field: '上一年度教师培训经费预算总额', unit: '万元', required: true },

  // 巩固率相关（初中）
  { category: '巩固率数据', field: '本届毕业学生人数', unit: '人', required: true, remark: '初中填写' },
  { category: '巩固率数据', field: '毕业年级初一时在校学生数', unit: '人', required: true, remark: '初中填写' },
  { category: '巩固率数据', field: '毕业年级三年转入学生数', unit: '人', required: true, remark: '初中填写' },
  { category: '巩固率数据', field: '毕业年级三年转出学生数', unit: '人', required: true, remark: '初中填写' },
  { category: '巩固率数据', field: '毕业年级三年死亡学生数', unit: '人', required: true, remark: '初中填写' },
];

// 区县填报数据字段
const countyFields = [
  // 基本信息
  { category: '基本信息', field: '区县名称', unit: '', required: true },
  { category: '基本信息', field: '区县代码', unit: '', required: true },
  { category: '基本信息', field: '填报年度', unit: '', required: true },

  // 经费标准
  { category: '经费标准', field: '规定的小学生均公用经费标准', unit: '元', required: true, remark: '市级1150' },
  { category: '经费标准', field: '规定的初中生均公用经费标准', unit: '元', required: true, remark: '市级1350' },
  { category: '经费标准', field: '特殊教育学校经费总额', unit: '元', required: true },
  { category: '经费标准', field: '特殊教育学校学生人数', unit: '人', required: true },

  // 工资收入
  { category: '工资收入', field: '上年度义务教育学校教师年平均工资收入水平（不含民办学校）', unit: '万元', required: true },
  { category: '工资收入', field: '当地公务员年平均工资收入', unit: '万元', required: true },

  // 教师交流轮岗
  { category: '教师交流轮岗', field: '符合交流条件教师总数', unit: '人', required: true },
  { category: '教师交流轮岗', field: '实际交流轮岗教师数', unit: '人', required: true },
  { category: '教师交流轮岗', field: '实际交流骨干教师数量', unit: '人', required: true },

  // 优质高中招生
  { category: '优质高中招生', field: '优质高中招生计划总人数', unit: '人', required: true },
  { category: '优质高中招生', field: '优质高中招生分配指标数', unit: '人', required: true },
  { category: '优质高中招生', field: '向农村学校分配指标数', unit: '人', required: true },

  // 随迁子女
  { category: '随迁子女', field: '符合条件的随迁子女总人数', unit: '人', required: true },
  { category: '随迁子女', field: '在县域内公办学校就读的随迁子女人数', unit: '人', required: true },
  { category: '随迁子女', field: '在政府购买服务的民办学校就读随迁子女人数', unit: '人', required: true },

  // 残疾儿童
  { category: '残疾儿童入学', field: '适龄残疾儿童少年总数', unit: '人', required: true },
  { category: '残疾儿童入学', field: '适龄残疾儿童少年入学总人数', unit: '人', required: true },
];

// 创建学校填报Excel
function createSchoolExcel() {
  const wb = XLSX.utils.book_new();

  // 创建表头
  const headers = ['序号', '类别', '填报项目', '单位', '填报值', '是否必填', '备注说明'];
  const data = [headers];

  // 添加数据行
  schoolFields.forEach((field, index) => {
    data.push([
      index + 1,
      field.category,
      field.field,
      field.unit,
      '',  // 填报值为空
      field.required ? '是' : '否',
      field.remark || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 设置列宽
  ws['!cols'] = [
    { wch: 6 },   // 序号
    { wch: 16 },  // 类别
    { wch: 45 },  // 填报项目
    { wch: 15 },  // 单位
    { wch: 15 },  // 填报值
    { wch: 10 },  // 是否必填
    { wch: 35 },  // 备注说明
  ];

  XLSX.utils.book_append_sheet(wb, ws, '学校填报数据');

  // 添加指标说明sheet
  const indicatorData = [
    ['指标名称', '计算公式', '达标标准'],
    ['每百名学生拥有高于规定学历教师数', '小学：(大专+本科+硕士+博士及以上专任教师数÷学生人数)*100\n初中：(本科+硕士+博士及以上专任教师数÷学生人数)*100', '小学>=4.2人\n初中>=5.3人'],
    ['每百名学生拥有县级以上骨干教师数', '(骨干教师数÷学生数)*100', '小学>=1人\n初中>=1人'],
    ['每百名学生拥有体育、艺术专任教师数', '(体育+音乐+美术+艺术专任教师数)÷学生数', '小学>=0.9人\n初中>=0.9人'],
    ['生均教学及辅助用房面积', '(教学及辅助用房总面积-室内体育用房面积)÷学生人数', '小学>=4.5平方米\n初中>=5.8平方米'],
    ['生均体育运动场馆面积', '(学校体育馆面积+校内体育场面积)÷学生人数', '小学>=7.5平方米\n初中>=10.2平方米'],
    ['生均教学仪器设备值', '教学仪器设备资产值÷学生人数', '小学>=2000元\n初中>=2500元'],
    ['每百名学生拥有网络多媒体教室数', '(网络多媒体教室间数÷学生人数)*100', '小学>=2.3间\n初中>=2.4间'],
    ['音乐、美术专用教室配置', '所需教室数=班级个数÷12（向上取整）', '参见详细标准'],
    ['学校规模', '学生总人数', '小学/初中<=2000人\n九年/十二年一贯制<=2500人'],
    ['班级学生数', '每班学生数', '小学<=45人\n初中<=50人'],
    ['生均公用经费', '上一年度公用经费预算总额÷学生人数', '>=规定标准'],
    ['教师培训经费占比', '(教师培训经费预算总额÷公用经费预算总额)×100%', '>=5%'],
    ['教师持证上岗率', '(持有教师资格证专任教师人数÷专任教师总数)×100%', '=100%'],
    ['就近划片入学比例', '(划片范围内在校学生人数÷学生人数)×100%', '小学=100%\n初中>=95%'],
    ['初中三年巩固率', '(毕业学生人数-转入+转出)÷(初一时在校生数-死亡)×100%', '>=95%'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(indicatorData);
  ws2['!cols'] = [
    { wch: 35 },
    { wch: 60 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '指标计算说明');

  // 添加特殊情况说明sheet
  const specialData = [
    ['特殊情况处理说明'],
    [''],
    ['一、一贯制学校和完全中学资源拆分计算'],
    ['九年一贯制学校：按照"小学生:初中生=1:1.1"的比例进行拆分'],
    ['完全中学：按照"初中生:高中生=1:1.2"的比例进行拆分'],
    ['十二年一贯制学校：按照"小学生:初中生:高中生=1:1.1:1.32"的比例进行拆分'],
    [''],
    ['二、50-100人乡村小规模学校体育艺术教师特殊处理'],
    ['可包含交流轮岗、兼职、走教的体育和艺术教师'],
    [''],
    ['三、人口密度过高的中心城区学校体育场馆特殊处理'],
    ['可包括经改造后能够满足学生运动需要的校园内部地下、楼顶等区域设立的专用运动场地'],
    ['可包括由当地政府签订租赁合同的校外周边体育场馆（可步行10分钟内到达）'],
    [''],
    ['四、音乐美术教室面积标准特殊处理'],
    ['2016年及之前建成的学校：音乐教室不低于73㎡，美术教室不低于67㎡'],
    ['最大班额低于30人的农村小规模学校：小学音乐、美术教室不低于54㎡，初中不低于61㎡'],
    [''],
    ['五、学校规模特殊处理'],
    ['2010年及之前建成的学校或随迁子女占比超过50%的学校：规模上限为2400人'],
    ['九年一贯制学校：规模上限为3000人'],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(specialData);
  ws3['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws3, '特殊情况说明');

  XLSX.writeFile(wb, 'doc/文档/学校填报表格.xlsx');
  console.log('学校填报Excel已生成: doc/文档/学校填报表格.xlsx');
}

// 创建区县填报Excel
function createCountyExcel() {
  const wb = XLSX.utils.book_new();

  // 创建表头
  const headers = ['序号', '类别', '填报项目', '单位', '填报值', '是否必填', '备注说明'];
  const data = [headers];

  // 添加数据行
  countyFields.forEach((field, index) => {
    data.push([
      index + 1,
      field.category,
      field.field,
      field.unit,
      '',  // 填报值为空
      field.required ? '是' : '否',
      field.remark || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 设置列宽
  ws['!cols'] = [
    { wch: 6 },   // 序号
    { wch: 16 },  // 类别
    { wch: 55 },  // 填报项目
    { wch: 10 },  // 单位
    { wch: 15 },  // 填报值
    { wch: 10 },  // 是否必填
    { wch: 20 },  // 备注说明
  ];

  XLSX.utils.book_append_sheet(wb, ws, '区县填报数据');

  // 添加指标说明sheet
  const indicatorData = [
    ['指标名称', '计算公式', '达标标准'],
    ['城乡统一标准', '生均公用经费基准定额', '小学>=1150\n初中>=1350'],
    ['特殊教育学校生均公用经费', '特殊教育学校经费总额÷学生人数', '>=8000元'],
    ['教师工资不低于公务员', '义务教育学校教师年平均工资 vs 公务员年平均工资', '教师>=公务员'],
    ['教师交流轮岗比例', '(实际交流轮岗教师数÷符合交流条件教师总数)×100%', '>=10%'],
    ['骨干教师交流比例', '(实际交流骨干教师数÷实际交流轮岗教师数)×100%', '>=20%'],
    ['优质高中招生名额分配比例', '(优质高中招生分配指标数÷优质高中招生计划总人数)×100%', '>=50%'],
    ['随迁子女就读比例', '((公办学校随迁子女+政府购买服务民办学校随迁子女)÷符合条件随迁子女总数)×100%', '>=85%'],
    ['残疾儿童少年入学率', '(适龄残疾儿童少年入学总人数÷适龄残疾儿童少年总数)×100%', '>=95%'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(indicatorData);
  ws2['!cols'] = [
    { wch: 30 },
    { wch: 60 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '指标计算说明');

  // 添加政府保障程度需上传材料说明
  const uploadData = [
    ['政府保障程度指标 - 需上传佐证材料清单'],
    [''],
    ['序号', '指标内容', '需上传材料'],
    ['1', '县域内义务教育学校规划布局合理，符合国家规定要求', '学校布局规划图、相关文件等'],
    ['2', '县域内城乡义务教育学校建设标准统一、教师编制标准统一、生均公用经费基准定额统一', '相关政策文件、标准文件等'],
    ['3', '县级教育行政部门在核定的教职工编制总额和岗位总量内，统筹分配各校教职工编制和岗位数量', '编制分配文件、岗位设置方案等'],
    [''],
    ['教育质量指标 - 需上传佐证材料清单'],
    [''],
    ['序号', '指标内容', '需上传材料'],
    ['1', '所有学校制定章程，实现学校管理与教学信息化', '学校章程、信息化建设方案等'],
    ['2', '教师能熟练运用信息化手段组织教学，设施设备利用率达到较高水平', '教师信息化培训记录、设备使用记录等'],
    ['3', '所有学校德育工作、校园文化建设水平达到良好以上', '德育工作方案、校园文化建设材料等'],
    ['4', '课程开齐开足，教学秩序规范，综合实践活动有效开展', '课程表、教学检查记录、综合实践活动记录等'],
    ['5', '无过重课业负担', '作业管理制度、课后服务方案等'],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(uploadData);
  ws3['!cols'] = [
    { wch: 8 },
    { wch: 60 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, '需上传材料说明');

  XLSX.writeFile(wb, 'doc/文档/区县填报表格.xlsx');
  console.log('区县填报Excel已生成: doc/文档/区县填报表格.xlsx');
}

// 执行生成
createSchoolExcel();
createCountyExcel();

console.log('\n填报表格生成完成！');
