-- 教育督导评估系统数据库Schema
-- SQLite数据库

-- 指标体系表
CREATE TABLE IF NOT EXISTS indicator_systems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('达标类', '评分类')),
  target TEXT NOT NULL,
  tags TEXT,
  description TEXT,
  indicator_count INTEGER DEFAULT 0,
  attachments TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'editing', 'published')),
  created_by TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- 指标表（扁平存储，通过parent_id维护树结构）
CREATE TABLE IF NOT EXISTS indicators (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL,
  parent_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  is_leaf INTEGER DEFAULT 0,
  weight REAL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (system_id) REFERENCES indicator_systems(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES indicators(id) ON DELETE CASCADE
);

-- 数据指标表（末级指标关联的数据指标）
CREATE TABLE IF NOT EXISTS data_indicators (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  threshold TEXT,
  description TEXT,
  data_source TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);

-- 佐证资料配置表
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
  updated_at TEXT,
  FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);

-- 采集工具表
CREATE TABLE IF NOT EXISTS data_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('表单', '问卷')),
  target TEXT,
  description TEXT,
  schema TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'editing', 'published')),
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
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
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
  element_type TEXT NOT NULL CHECK (element_type IN ('基础要素', '派生要素')),
  data_type TEXT NOT NULL,
  formula TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (library_id) REFERENCES element_libraries(id) ON DELETE CASCADE
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
  status TEXT DEFAULT '配置中' CHECK (status IN ('配置中', '填报中', '评审中', '已中止', '已完成')),
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (indicator_system_id) REFERENCES indicator_systems(id)
);

-- 填报记录表
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  submitter_id TEXT,
  submitter_name TEXT,
  submitter_org TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  data TEXT,
  reject_reason TEXT,
  created_at TEXT,
  updated_at TEXT,
  submitted_at TEXT,
  approved_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES data_tools(id)
);

-- 佐证资料上传记录表
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
  uploaded_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (material_config_id) REFERENCES supporting_materials(id),
  FOREIGN KEY (indicator_id) REFERENCES data_indicators(id)
);

-- 项目与采集工具关联表
CREATE TABLE IF NOT EXISTS project_tools (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 1,
  created_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES data_tools(id) ON DELETE CASCADE,
  UNIQUE(project_id, tool_id)
);

-- 表单字段映射表（字段与数据指标/要素的映射关系）
CREATE TABLE IF NOT EXISTS field_mappings (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('data_indicator', 'element')),
  target_id TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (tool_id) REFERENCES data_tools(id) ON DELETE CASCADE,
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
