-- 项目级指标体系/要素/采集工具副本表
-- 用于在项目内独立编辑，不影响原模板

-- 1. 项目指标体系（每个项目一份副本）
CREATE TABLE IF NOT EXISTS project_indicator_systems (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,              -- 达标类 | 评分类
  target TEXT,
  description TEXT,
  tags TEXT,              -- JSON数组
  attachments TEXT,       -- JSON数组
  indicator_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(project_id)
);

-- 2. 项目指标（树形结构）
CREATE TABLE IF NOT EXISTS project_indicators (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  parent_id TEXT,         -- 自引用，树形结构
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

-- 3. 项目数据指标（末级指标的具体数据项）
CREATE TABLE IF NOT EXISTS project_data_indicators (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  indicator_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  threshold TEXT,
  data_type TEXT,         -- 文本|数字|日期|时间|逻辑|数组|文件
  unit TEXT,
  description TEXT,
  data_source TEXT,
  calculation_method TEXT,
  collection_frequency TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 4. 项目阈值标准
CREATE TABLE IF NOT EXISTS project_threshold_standards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  indicator_id TEXT NOT NULL,
  institution_type TEXT,
  threshold_operator TEXT, -- >=|>|<=|<|==|between
  threshold_value TEXT,
  unit TEXT,
  source TEXT,
  effective_date TEXT,
  expiry_date TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- 5. 项目佐证资料配置
CREATE TABLE IF NOT EXISTS project_supporting_materials (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  indicator_id TEXT NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  file_types TEXT,        -- JSON数组，如 ["pdf", "doc", "jpg"]
  max_size INTEGER,       -- 单位：MB
  required INTEGER DEFAULT 0,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 6. 项目要素库
CREATE TABLE IF NOT EXISTS project_element_libraries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  element_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(project_id)
);

-- 7. 项目要素
CREATE TABLE IF NOT EXISTS project_elements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  library_id TEXT NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  element_type TEXT,       -- 基础要素 | 派生要素
  data_type TEXT,
  tool_id TEXT,            -- 关联项目采集工具
  field_id TEXT,
  field_label TEXT,
  formula TEXT,
  collection_level TEXT,   -- school | district | auto
  calculation_level TEXT,  -- school | district
  data_source TEXT,
  aggregation TEXT,        -- JSON: { enabled, method, scope, overwrite }
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 8. 项目数据指标-要素关联
CREATE TABLE IF NOT EXISTS project_data_indicator_elements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  data_indicator_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  mapping_type TEXT,       -- primary | reference
  description TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(data_indicator_id, element_id)
);

-- 9. 项目佐证资料-要素关联
CREATE TABLE IF NOT EXISTS project_supporting_material_elements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  supporting_material_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  mapping_type TEXT,       -- primary | reference
  description TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(supporting_material_id, element_id)
);

-- 10. 项目采集工具
CREATE TABLE IF NOT EXISTS project_data_tools (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_tool_id TEXT,     -- 来源模板工具ID（用于追踪和同步删除）
  name TEXT NOT NULL,
  type TEXT,               -- 表单 | 问卷
  target TEXT,
  description TEXT,
  schema TEXT,             -- JSON格式表单配置
  status TEXT DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 1,
  require_review INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

-- 11. 项目字段映射
CREATE TABLE IF NOT EXISTS project_field_mappings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  field_label TEXT,
  mapping_type TEXT,       -- data_indicator | element
  target_id TEXT,          -- 指向 project_data_indicators 或 project_elements
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tool_id, field_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_indicator_systems_project ON project_indicator_systems(project_id);
CREATE INDEX IF NOT EXISTS idx_project_indicators_project ON project_indicators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_indicators_system ON project_indicators(system_id);
CREATE INDEX IF NOT EXISTS idx_project_indicators_parent ON project_indicators(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_data_indicators_project ON project_data_indicators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_data_indicators_indicator ON project_data_indicators(indicator_id);
CREATE INDEX IF NOT EXISTS idx_project_threshold_standards_project ON project_threshold_standards(project_id);
CREATE INDEX IF NOT EXISTS idx_project_threshold_standards_indicator ON project_threshold_standards(indicator_id);
CREATE INDEX IF NOT EXISTS idx_project_supporting_materials_project ON project_supporting_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_supporting_materials_indicator ON project_supporting_materials(indicator_id);
CREATE INDEX IF NOT EXISTS idx_project_element_libraries_project ON project_element_libraries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_elements_project ON project_elements(project_id);
CREATE INDEX IF NOT EXISTS idx_project_elements_library ON project_elements(library_id);
CREATE INDEX IF NOT EXISTS idx_project_data_indicator_elements_project ON project_data_indicator_elements(project_id);
CREATE INDEX IF NOT EXISTS idx_project_data_indicator_elements_data_indicator ON project_data_indicator_elements(data_indicator_id);
CREATE INDEX IF NOT EXISTS idx_project_data_indicator_elements_element ON project_data_indicator_elements(element_id);
CREATE INDEX IF NOT EXISTS idx_project_supporting_material_elements_project ON project_supporting_material_elements(project_id);
CREATE INDEX IF NOT EXISTS idx_project_data_tools_project ON project_data_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_field_mappings_project ON project_field_mappings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_field_mappings_tool ON project_field_mappings(tool_id);
