-- 教育督导评估系统数据库Schema
-- PostgreSQL数据库
-- 注意：外键约束通过程序层面的 referenceService.js 和 cascadeService.js 实现
-- 注意：枚举约束通过程序层面的 enums.js 和 validate.js 实现

-- 指标体系表
CREATE TABLE IF NOT EXISTS indicator_systems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- 枚举值由程序验证：达标类 | 评分类
  target TEXT NOT NULL,
  tags TEXT,
  description TEXT,
  indicator_count INTEGER DEFAULT 0,
  attachments TEXT,
  status TEXT DEFAULT 'draft',       -- 枚举值由程序验证：draft | editing | published
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 指标表（扁平存储，通过parent_id维护树结构）
CREATE TABLE IF NOT EXISTS indicators (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL,           -- 关联 indicator_systems.id，由程序验证
  parent_id TEXT,                    -- 关联 indicators.id（自引用），由程序验证
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL,            -- 枚举值由程序验证：1 | 2 | 3
  is_leaf INTEGER DEFAULT 0,
  weight REAL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 数据指标表（末级指标关联的数据指标）
CREATE TABLE IF NOT EXISTS data_indicators (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,        -- 关联 indicators.id，由程序验证
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  threshold TEXT,
  description TEXT,
  data_source TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 佐证资料配置表
CREATE TABLE IF NOT EXISTS supporting_materials (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,        -- 关联 indicators.id，由程序验证
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  file_types TEXT,
  max_size TEXT,
  description TEXT,
  required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 采集工具表
CREATE TABLE IF NOT EXISTS data_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- 枚举值由程序验证：表单 | 问卷
  target TEXT,
  description TEXT,
  schema TEXT,
  status TEXT DEFAULT 'draft',       -- 枚举值由程序验证：draft | editing | published
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 要素库表
CREATE TABLE IF NOT EXISTS element_libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  element_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',       -- 枚举值由程序验证：draft | published
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 要素表
CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,          -- 关联 element_libraries.id，由程序验证
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  element_type TEXT NOT NULL,        -- 枚举值由程序验证：基础要素 | 派生要素
  data_type TEXT NOT NULL,
  formula TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT,
  description TEXT,
  indicator_system_id TEXT,          -- 关联 indicator_systems.id，由程序验证
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT '配置中',       -- 枚举值由程序验证：配置中 | 填报中 | 评审中 | 已中止 | 已完成
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 填报记录表
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,          -- 关联 projects.id，由程序验证
  form_id TEXT NOT NULL,             -- 关联 data_tools.id，由程序验证
  submitter_id TEXT,
  submitter_name TEXT,
  submitter_org TEXT,
  status TEXT DEFAULT 'draft',       -- 枚举值由程序验证：draft | submitted | approved | rejected
  data TEXT,
  reject_reason TEXT,
  created_at TEXT,
  updated_at TEXT,
  submitted_at TEXT,
  approved_at TEXT
);

-- 佐证资料上传记录表
CREATE TABLE IF NOT EXISTS submission_materials (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,       -- 关联 submissions.id，由程序验证
  material_config_id TEXT,           -- 关联 supporting_materials.id，由程序验证
  indicator_id TEXT,                 -- 关联 data_indicators.id，由程序验证
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  uploaded_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 项目与采集工具关联表
CREATE TABLE IF NOT EXISTS project_tools (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,          -- 关联 projects.id，由程序验证
  tool_id TEXT NOT NULL,             -- 关联 data_tools.id，由程序验证
  sort_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 1,
  created_at TEXT,
  UNIQUE(project_id, tool_id)
);

-- 表单字段映射表（字段与数据指标/要素的映射关系）
CREATE TABLE IF NOT EXISTS field_mappings (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,             -- 关联 data_tools.id，由程序验证
  field_id TEXT NOT NULL,
  mapping_type TEXT NOT NULL,        -- 枚举值由程序验证：data_indicator | element
  target_id TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tool_id, field_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_indicators_system ON indicators(system_id);
CREATE INDEX IF NOT EXISTS idx_indicators_parent ON indicators(parent_id);
CREATE INDEX IF NOT EXISTS idx_data_indicators_indicator ON data_indicators(indicator_id);
CREATE INDEX IF NOT EXISTS idx_materials_indicator ON supporting_materials(indicator_id);
CREATE INDEX IF NOT EXISTS idx_elements_library ON elements(library_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_form ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_project_tools_project ON project_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_tool ON project_tools(tool_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_tool ON field_mappings(tool_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_target ON field_mappings(target_id);
CREATE INDEX IF NOT EXISTS idx_submission_materials_submission ON submission_materials(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_materials_indicator ON submission_materials(indicator_id);

-- ============================================================================
-- 第一阶段增强：区县、学校、统计分析相关表
-- ============================================================================

-- 区县表
CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,              -- 区县代码 (如 210106)
  name TEXT NOT NULL,                     -- 区县名称 (如 铁西区)
  type TEXT DEFAULT '市辖区',              -- 类型: 市辖区 | 县 | 县级市，由程序验证
  parent_code TEXT,                       -- 上级代码 (市级)
  sort_order INTEGER DEFAULT 0,           -- 排序
  created_at TEXT,
  updated_at TEXT
);

-- 学校表
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,              -- 学校代码
  name TEXT NOT NULL,                     -- 学校名称
  district_id TEXT NOT NULL,              -- 关联 districts.id，由程序验证
  school_type TEXT NOT NULL,              -- 类型，由程序验证: 小学 | 初中 | 九年一贯制 | 完全中学
  school_category TEXT DEFAULT '公办',    -- 办学性质，由程序验证: 公办 | 民办
  urban_rural TEXT DEFAULT '城区',         -- 城乡类型，由程序验证: 城区 | 镇区 | 乡村
  address TEXT,                           -- 地址
  principal TEXT,                         -- 校长姓名
  contact_phone TEXT,                     -- 联系电话
  student_count INTEGER DEFAULT 0,        -- 学生数
  teacher_count INTEGER DEFAULT 0,        -- 教师数
  status TEXT DEFAULT 'active',           -- 状态，由程序验证: active | inactive
  created_at TEXT,
  updated_at TEXT
);

-- 评估年度表
CREATE TABLE IF NOT EXISTS evaluation_years (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,           -- 年度 (如 2024, 2025)
  name TEXT NOT NULL,                     -- 名称 (如 "2024-2025学年")
  start_date TEXT,                        -- 开始日期
  end_date TEXT,                          -- 结束日期
  status TEXT DEFAULT 'active',           -- 状态，由程序验证: active | archived
  created_at TEXT
);

-- 学校指标数据表 (存储每所学校的指标采集数据)
CREATE TABLE IF NOT EXISTS school_indicator_data (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,               -- 关联 projects.id，由程序验证
  school_id TEXT NOT NULL,                -- 关联 schools.id，由程序验证
  data_indicator_id TEXT NOT NULL,        -- 关联 data_indicators.id，由程序验证
  value REAL,                             -- 采集值 (数值型)
  text_value TEXT,                        -- 采集值 (文本型)
  is_compliant INTEGER,                   -- 是否达标: 1=达标, 0=未达标, NULL=未评估
  submission_id TEXT,                     -- 来源填报记录ID
  collected_at TEXT,                      -- 采集时间
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (project_id, school_id, data_indicator_id)
);

-- 区县统计快照表 (定期计算存储)
CREATE TABLE IF NOT EXISTS district_statistics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,               -- 关联 projects.id，由程序验证
  district_id TEXT NOT NULL,              -- 关联 districts.id，由程序验证
  school_type TEXT NOT NULL,              -- 学校类型: 小学 | 初中

  -- 学校统计
  school_count INTEGER DEFAULT 0,         -- 学校数量
  compliant_school_count INTEGER DEFAULT 0, -- 达标学校数

  -- 差异系数 (8项核心指标)
  cv_teacher_ratio REAL,                  -- 生师比差异系数
  cv_teacher_qualification REAL,          -- 高学历教师差异系数
  cv_building_area REAL,                  -- 生均校舍面积差异系数
  cv_sports_area REAL,                    -- 生均体育场地差异系数
  cv_equipment_value REAL,                -- 生均教学设备值差异系数
  cv_computer_count REAL,                 -- 百名学生计算机数差异系数
  cv_book_count REAL,                     -- 生均图书册数差异系数
  cv_class_size REAL,                     -- 平均班额差异系数

  cv_composite REAL,                      -- 综合差异系数
  is_cv_compliant INTEGER,                -- 差异系数是否达标

  -- 各维度达标率
  resource_compliance_rate REAL,          -- 资源配置达标率
  government_compliance_rate REAL,        -- 政府保障达标率
  quality_compliance_rate REAL,           -- 教育质量达标率
  satisfaction_rate REAL,                 -- 社会满意度

  overall_score REAL,                     -- 综合得分
  calculated_at TEXT,                     -- 计算时间
  created_at TEXT,

  UNIQUE (project_id, district_id, school_type)
);

-- 区县、学校相关索引
CREATE INDEX IF NOT EXISTS idx_schools_district ON schools(district_id);
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(school_type);
CREATE INDEX IF NOT EXISTS idx_schools_urban_rural ON schools(urban_rural);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);
CREATE INDEX IF NOT EXISTS idx_school_indicator_project ON school_indicator_data(project_id);
CREATE INDEX IF NOT EXISTS idx_school_indicator_school ON school_indicator_data(school_id);
CREATE INDEX IF NOT EXISTS idx_school_indicator_indicator ON school_indicator_data(data_indicator_id);
CREATE INDEX IF NOT EXISTS idx_district_stats_project ON district_statistics(project_id);
CREATE INDEX IF NOT EXISTS idx_district_stats_district ON district_statistics(district_id);

-- ============================================================================
-- 数据指标与评估要素关联表
-- ============================================================================

-- 数据指标-评估要素关联表 (支持多对多关联)
CREATE TABLE IF NOT EXISTS data_indicator_elements (
  id TEXT PRIMARY KEY,
  data_indicator_id TEXT NOT NULL,        -- 关联 data_indicators.id，由程序验证
  element_id TEXT NOT NULL,               -- 关联 elements.id，由程序验证
  mapping_type TEXT DEFAULT 'primary',    -- 关联类型，由程序验证: primary | reference
  description TEXT,                       -- 关联说明
  created_by TEXT,                        -- 创建人
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (data_indicator_id, element_id)
);

-- 数据指标-要素关联索引
CREATE INDEX IF NOT EXISTS idx_di_elements_indicator ON data_indicator_elements(data_indicator_id);
CREATE INDEX IF NOT EXISTS idx_di_elements_element ON data_indicator_elements(element_id);
CREATE INDEX IF NOT EXISTS idx_di_elements_type ON data_indicator_elements(mapping_type);

-- ============================================================================
-- 达标判定规则引擎相关表
-- ============================================================================

-- 达标规则定义表
CREATE TABLE IF NOT EXISTS compliance_rules (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                -- 规则代码 (如 RULE_001)
  name TEXT NOT NULL,                       -- 规则名称
  rule_type TEXT NOT NULL,                  -- 规则类型，由程序验证: threshold | conditional | validation | aggregation
  indicator_id TEXT,                        -- 关联 data_indicators.id，由程序验证 (可选)
  element_id TEXT,                          -- 关联 elements.id，由程序验证 (可选)
  enabled INTEGER DEFAULT 1,                -- 是否启用: 1=启用, 0=禁用
  priority INTEGER DEFAULT 0,               -- 优先级 (数字越大优先级越高)
  description TEXT,                         -- 规则描述
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 规则条件表 (定义规则何时适用)
CREATE TABLE IF NOT EXISTS rule_conditions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,                    -- 关联 compliance_rules.id，由程序验证
  field TEXT NOT NULL,                      -- 条件字段 (如 institution_type, school_type)
  operator TEXT NOT NULL,                   -- 操作符: equals, not_equals, in, not_in, greater_than, less_than, between, etc.
  value TEXT NOT NULL,                      -- 条件值 (JSON格式，支持数组)
  logical_operator TEXT DEFAULT 'AND',      -- 逻辑运算符: AND, OR
  sort_order INTEGER DEFAULT 0              -- 排序顺序
);

-- 规则动作表 (定义规则的执行动作)
CREATE TABLE IF NOT EXISTS rule_actions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,                    -- 关联 compliance_rules.id，由程序验证
  action_type TEXT NOT NULL,                -- 动作类型，由程序验证: compare | validate | calculate | aggregate
  config TEXT NOT NULL,                     -- 动作配置 (JSON格式)
  result_field TEXT,                        -- 结果存储字段
  pass_message TEXT,                        -- 通过时的消息
  fail_message TEXT,                        -- 失败时的消息
  sort_order INTEGER DEFAULT 0              -- 排序顺序
);

-- 达标判定结果表
CREATE TABLE IF NOT EXISTS compliance_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,                 -- 关联 projects.id，由程序验证
  rule_id TEXT NOT NULL,                    -- 关联 compliance_rules.id，由程序验证
  entity_type TEXT NOT NULL,                -- 实体类型，由程序验证: school | district | county
  entity_id TEXT NOT NULL,                  -- 实体ID (学校ID或区县ID)
  indicator_id TEXT,                        -- 数据指标ID (可选)
  actual_value TEXT,                        -- 实际值
  threshold_value TEXT,                     -- 阈值
  is_compliant INTEGER,                     -- 是否达标: 1=达标, 0=未达标
  message TEXT,                             -- 结果消息
  details TEXT,                             -- 详细信息 (JSON格式)
  calculated_at TEXT                        -- 计算时间
);

-- 数据校验规则配置表 (用于表单字段校验)
CREATE TABLE IF NOT EXISTS validation_configs (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,                -- 目标类型，由程序验证: field | element | indicator
  target_id TEXT NOT NULL,                  -- 目标ID
  validation_type TEXT NOT NULL,            -- 校验类型: required, range, precision, regex, enum, unique
  config TEXT NOT NULL,                     -- 校验配置 (JSON格式)
  error_message TEXT,                       -- 错误消息模板
  enabled INTEGER DEFAULT 1,                -- 是否启用
  created_at TEXT,
  updated_at TEXT
);

-- 阈值标准表 (存储各指标的阈值标准)
CREATE TABLE IF NOT EXISTS threshold_standards (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,               -- 关联 data_indicators.id，由程序验证
  institution_type TEXT NOT NULL,           -- 机构类型: primary, middle, nine_year, complete
  threshold_operator TEXT NOT NULL,         -- 比较运算符: >=, >, <=, <, ==, between
  threshold_value TEXT NOT NULL,            -- 阈值 (数值或JSON格式的区间)
  unit TEXT,                                -- 单位 (如 m2, 元, %)
  source TEXT,                              -- 标准来源 (如 "国家标准")
  effective_date TEXT,                      -- 生效日期
  expiry_date TEXT,                         -- 失效日期
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (indicator_id, institution_type)
);

-- 达标规则引擎相关索引
CREATE INDEX IF NOT EXISTS idx_rules_type ON compliance_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_rules_indicator ON compliance_rules(indicator_id);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON compliance_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_conditions_rule ON rule_conditions(rule_id);
CREATE INDEX IF NOT EXISTS idx_actions_rule ON rule_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_results_project ON compliance_results(project_id);
CREATE INDEX IF NOT EXISTS idx_results_entity ON compliance_results(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_results_rule ON compliance_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_validation_target ON validation_configs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_threshold_indicator ON threshold_standards(indicator_id);
CREATE INDEX IF NOT EXISTS idx_threshold_institution ON threshold_standards(institution_type);
