-- Supabase 初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- 创建执行原生 SQL 的函数（需要管理员权限）
-- 注意：此函数有安全风险，仅在受信任的环境中使用
CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
  INTO result;
  RETURN result;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;

-- ==================== 创建数据表 ====================

-- 区县表
CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT,
  parent_code TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 学校表
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  district_id TEXT NOT NULL,
  school_type TEXT NOT NULL,
  school_category TEXT,
  urban_rural TEXT,
  student_count INTEGER DEFAULT 0,
  teacher_count INTEGER DEFAULT 0,
  address TEXT,
  principal TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT,
  updated_at TEXT
);

-- 指标体系表
CREATE TABLE IF NOT EXISTS indicator_systems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  attachments TEXT,
  indicator_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 指标表
CREATE TABLE IF NOT EXISTS indicators (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL,
  parent_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL,
  is_leaf INTEGER DEFAULT 0,
  weight REAL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 数据指标表（叶子指标的数据采集配置）
CREATE TABLE IF NOT EXISTS data_indicators (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data_type TEXT,
  unit TEXT,
  threshold TEXT,
  calculation_method TEXT,
  data_source TEXT,
  collection_frequency TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 阈值标准表
CREATE TABLE IF NOT EXISTS threshold_standards (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,
  school_type TEXT,
  institution_type TEXT,
  threshold_value TEXT NOT NULL,
  threshold_operator TEXT DEFAULT '>=',
  operator TEXT DEFAULT '>=',
  unit TEXT,
  source TEXT,
  effective_date TEXT,
  expiry_date TEXT,
  description TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 要素库表
CREATE TABLE IF NOT EXISTS element_libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  element_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 要素表
CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  element_type TEXT NOT NULL,
  data_type TEXT NOT NULL,
  options TEXT,
  validation_rules TEXT,
  formula TEXT,
  formula_elements TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 数据指标与要素关联表
CREATE TABLE IF NOT EXISTS data_indicator_elements (
  id TEXT PRIMARY KEY,
  data_indicator_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  mapping_type TEXT DEFAULT 'primary',
  description TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 采集工具表
CREATE TABLE IF NOT EXISTS data_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  target TEXT,
  description TEXT,
  schema TEXT,
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 字段映射表
CREATE TABLE IF NOT EXISTS field_mappings (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  mapping_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT,
  description TEXT,
  indicator_system_id TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT '配置中',
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 项目-工具关联表
CREATE TABLE IF NOT EXISTS project_tools (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 1,
  created_at TEXT
);

-- 填报记录表
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  school_id TEXT,
  tool_id TEXT,
  form_id TEXT,
  submitter_id TEXT,
  submitter_name TEXT,
  submitter_org TEXT,
  data TEXT,
  status TEXT DEFAULT 'draft',
  submitted_at TEXT,
  submitted_by TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_comment TEXT,
  reject_reason TEXT,
  approved_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 佐证资料表
CREATE TABLE IF NOT EXISTS supporting_materials (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,
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

-- 填报佐证资料表
CREATE TABLE IF NOT EXISTS submission_materials (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  material_config_id TEXT,
  indicator_id TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 学校指标数据表
CREATE TABLE IF NOT EXISTS school_indicator_data (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  data_indicator_id TEXT NOT NULL,
  value REAL,
  text_value TEXT,
  is_compliant INTEGER,
  submission_id TEXT,
  collected_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 区县统计快照表
CREATE TABLE IF NOT EXISTS district_statistics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  district_id TEXT NOT NULL,
  school_type TEXT,
  school_count INTEGER DEFAULT 0,
  compliant_school_count INTEGER DEFAULT 0,
  cv_teacher_ratio REAL,
  cv_area_ratio REAL,
  cv_equipment_ratio REAL,
  cv_book_ratio REAL,
  cv_computer_ratio REAL,
  cv_sport_ratio REAL,
  cv_music_ratio REAL,
  cv_composite REAL,
  is_cv_compliant INTEGER,
  resource_compliance_rate REAL,
  government_compliance_rate REAL,
  quality_compliance_rate REAL,
  recognition_compliance_rate REAL,
  overall_score REAL,
  calculated_at TEXT,
  created_at TEXT
);

-- 合规规则表
CREATE TABLE IF NOT EXISTS compliance_rules (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  indicator_id TEXT,
  element_id TEXT,
  enabled INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 规则条件表
CREATE TABLE IF NOT EXISTS rule_conditions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  condition_type TEXT,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value TEXT NOT NULL,
  logical_operator TEXT DEFAULT 'AND',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT
);

-- 规则动作表
CREATE TABLE IF NOT EXISTS rule_actions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_field TEXT,
  action_value TEXT,
  message TEXT,
  config TEXT,
  result_field TEXT,
  pass_message TEXT,
  fail_message TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT
);

-- 合规检查结果表
CREATE TABLE IF NOT EXISTS compliance_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  indicator_id TEXT,
  actual_value TEXT,
  threshold_value TEXT,
  is_compliant INTEGER,
  message TEXT,
  details TEXT,
  calculated_at TEXT,
  checked_at TEXT,
  created_at TEXT
);

-- ==================== 创建索引 ====================

CREATE INDEX IF NOT EXISTS idx_schools_district ON schools(district_id);
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(school_type);
CREATE INDEX IF NOT EXISTS idx_indicators_system ON indicators(system_id);
CREATE INDEX IF NOT EXISTS idx_indicators_parent ON indicators(parent_id);
CREATE INDEX IF NOT EXISTS idx_data_indicators_indicator ON data_indicators(indicator_id);
CREATE INDEX IF NOT EXISTS idx_elements_library ON elements(library_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_tool ON field_mappings(tool_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_project ON project_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_school ON submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_school_indicator_data_project ON school_indicator_data(project_id);
CREATE INDEX IF NOT EXISTS idx_school_indicator_data_school ON school_indicator_data(school_id);
CREATE INDEX IF NOT EXISTS idx_compliance_results_project ON compliance_results(project_id);

-- 唯一约束索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_rules_code ON compliance_rules(code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_threshold_standards_indicator_institution ON threshold_standards(indicator_id, institution_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_indicator_data_unique ON school_indicator_data(project_id, school_id, data_indicator_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_district_statistics_unique ON district_statistics(project_id, district_id, school_type);

-- ==================== 启用 RLS（行级安全）====================

-- 根据需要为各表启用 RLS
-- ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
-- 等...

-- 创建策略示例（允许所有认证用户访问）
-- CREATE POLICY "Allow all for authenticated" ON districts FOR ALL TO authenticated USING (true);
