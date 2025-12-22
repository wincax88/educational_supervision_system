-- 第三方问卷系统集成 - 数据库迁移脚本
-- 创建时间: 2025-12-22
-- 说明: 支持第三方问卷系统集成，包括问卷数据采集、统计和访问链接管理

-- 1. 扩展 data_tools 表 - 添加第三方问卷系统相关字段
ALTER TABLE data_tools
ADD COLUMN IF NOT EXISTS external_survey_id TEXT,           -- 第三方问卷系统的问卷ID
ADD COLUMN IF NOT EXISTS external_survey_url TEXT,          -- 第三方问卷系统的问卷链接
ADD COLUMN IF NOT EXISTS satisfaction_config JSONB;         -- 满意度判定配置

-- 添加注释说明
COMMENT ON COLUMN data_tools.external_survey_id IS '第三方系统返回的问卷ID，用于后续编辑、查看等操作';
COMMENT ON COLUMN data_tools.external_survey_url IS '第三方系统的问卷完整URL，用于直接访问';
COMMENT ON COLUMN data_tools.satisfaction_config IS '满意度判定配置（JSON格式），例如：{"scale": 5, "minScore": 4.0, "calculationMethod": "threshold"}';

-- 2. 创建问卷响应详细记录表（核心表）
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,                    -- 关联 data_tools.id
  project_id TEXT NOT NULL,                 -- 关联 projects.id
  school_id TEXT NOT NULL,                  -- 关联 schools.id
  district_id TEXT,                         -- 关联 districts.id（冗余，便于查询）

  external_response_id TEXT,                -- 第三方系统的响应ID
  external_survey_id TEXT,                  -- 第三方问卷实例ID
  respondent_type TEXT,                     -- 填报人身份：parent/teacher/student/principal/other
  total_score REAL,                         -- 总分数（如4.5、3.8等）
  is_valid BOOLEAN DEFAULT true,            -- 是否有效问卷

  submitted_at TEXT,                        -- 问卷提交时间
  created_at TEXT,
  updated_at TEXT,

  -- 可选：存储完整的问卷数据（JSON）
  raw_data JSONB
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_survey_responses_tool ON survey_responses(tool_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_project_school ON survey_responses(project_id, school_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_type ON survey_responses(respondent_type);
CREATE INDEX IF NOT EXISTS idx_survey_responses_external_survey ON survey_responses(external_survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_score ON survey_responses(total_score);

-- 唯一约束：防止重复导入同一份问卷
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_external_unique
ON survey_responses(external_response_id)
WHERE external_response_id IS NOT NULL;

-- 添加表注释
COMMENT ON TABLE survey_responses IS '问卷响应详细记录表：存储每份问卷的详细数据';
COMMENT ON COLUMN survey_responses.tool_id IS '关联 data_tools.id';
COMMENT ON COLUMN survey_responses.project_id IS '关联 projects.id';
COMMENT ON COLUMN survey_responses.school_id IS '关联 schools.id';
COMMENT ON COLUMN survey_responses.district_id IS '关联 districts.id（冗余，便于查询）';
COMMENT ON COLUMN survey_responses.external_response_id IS '第三方系统的响应ID，用于去重';
COMMENT ON COLUMN survey_responses.external_survey_id IS '第三方问卷实例ID';
COMMENT ON COLUMN survey_responses.respondent_type IS '填报人身份：parent/teacher/student/principal/other';
COMMENT ON COLUMN survey_responses.total_score IS '总分数（由第三方系统计算）';
COMMENT ON COLUMN survey_responses.is_valid IS '是否有效问卷（由第三方系统判定）';
COMMENT ON COLUMN survey_responses.raw_data IS '完整的问卷数据（JSON）';

-- 3. 创建问卷统计汇总表（视图/缓存表）
CREATE TABLE IF NOT EXISTS survey_statistics (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,                    -- 关联 data_tools.id
  project_id TEXT,                           -- 关联 projects.id
  school_id TEXT,                            -- 关联 schools.id
  district_id TEXT,                          -- 关联 districts.id

  -- 问卷统计数据（由本系统计算）
  total_sent INTEGER DEFAULT 0,             -- 问卷总数/发放总数
  total_sent_to_parents INTEGER DEFAULT 0, -- 发给家长的数量
  total_valid INTEGER DEFAULT 0,             -- 回收有效问卷数
  total_valid_from_parents INTEGER DEFAULT 0, -- 家长有效问卷数
  total_satisfied INTEGER DEFAULT 0,         -- 满意问卷数（根据阈值计算）
  total_satisfied_from_parents INTEGER DEFAULT 0, -- 家长满意问卷数

  -- 元数据
  source TEXT DEFAULT 'external',           -- 数据来源：external（第三方系统）| manual（手动录入）
  external_survey_id TEXT,                  -- 第三方问卷系统的问卷ID
  collected_at TEXT,                        -- 数据采集时间
  created_at TEXT,
  updated_at TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_survey_statistics_tool_id ON survey_statistics(tool_id);
CREATE INDEX IF NOT EXISTS idx_survey_statistics_project_id ON survey_statistics(project_id);
CREATE INDEX IF NOT EXISTS idx_survey_statistics_school_id ON survey_statistics(school_id);
CREATE INDEX IF NOT EXISTS idx_survey_statistics_external_survey_id ON survey_statistics(external_survey_id);

-- 创建唯一约束（确保一个项目+学校+工具只有一条统计记录）
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_statistics_unique
ON survey_statistics(tool_id, project_id, school_id)
WHERE project_id IS NOT NULL AND school_id IS NOT NULL;

-- 添加表注释
COMMENT ON TABLE survey_statistics IS '问卷统计汇总表：基于 survey_responses 计算的统计数据';
COMMENT ON COLUMN survey_statistics.total_sent IS '问卷总数/发放总数';
COMMENT ON COLUMN survey_statistics.total_sent_to_parents IS '发给家长的数量';
COMMENT ON COLUMN survey_statistics.total_valid IS '回收有效问卷数';
COMMENT ON COLUMN survey_statistics.total_valid_from_parents IS '家长有效问卷数';
COMMENT ON COLUMN survey_statistics.total_satisfied IS '满意问卷数（根据阈值计算）';
COMMENT ON COLUMN survey_statistics.total_satisfied_from_parents IS '家长满意问卷数';
COMMENT ON COLUMN survey_statistics.source IS '数据来源：external（第三方系统）| manual（手动录入）';

-- 4. 创建问卷访问链接记录表
CREATE TABLE IF NOT EXISTS survey_access_links (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,              -- 关联 data_tools.id
  project_id TEXT NOT NULL,           -- 关联 projects.id
  school_id TEXT NOT NULL,            -- 关联 schools.id
  district_id TEXT,                   -- 关联 districts.id（冗余，便于查询）

  access_url TEXT,                    -- 生成的带学校标识的访问链接
  access_token TEXT,                  -- 访问令牌（JWT）
  qr_code_url TEXT,                   -- 二维码URL（可选）

  target_audience TEXT,               -- 目标受众：parent/teacher/student/principal
  link_type TEXT DEFAULT 'url',       -- 链接类型：url/qrcode/shortlink

  is_active BOOLEAN DEFAULT true,     -- 链接是否有效
  expires_at TEXT,                    -- 链接过期时间（可选）

  created_at TEXT,
  updated_at TEXT,
  accessed_count INTEGER DEFAULT 0    -- 访问次数统计
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_survey_access_links_tool ON survey_access_links(tool_id);
CREATE INDEX IF NOT EXISTS idx_survey_access_links_project ON survey_access_links(project_id);
CREATE INDEX IF NOT EXISTS idx_survey_access_links_school ON survey_access_links(school_id);
CREATE INDEX IF NOT EXISTS idx_survey_access_links_token ON survey_access_links(access_token);

-- 唯一约束：同一工具、同一项目、同一学校、同一受众只有一条访问链接记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_access_links_unique
ON survey_access_links(tool_id, project_id, school_id, target_audience);

-- 添加表注释
COMMENT ON TABLE survey_access_links IS '问卷访问链接记录表：记录为每个学校生成的问卷访问链接';
COMMENT ON COLUMN survey_access_links.access_url IS '生成的带学校标识的访问链接';
COMMENT ON COLUMN survey_access_links.access_token IS '访问令牌（JWT）';
COMMENT ON COLUMN survey_access_links.target_audience IS '目标受众：parent/teacher/student/principal';
COMMENT ON COLUMN survey_access_links.link_type IS '链接类型：url/qrcode/shortlink';
COMMENT ON COLUMN survey_access_links.accessed_count IS '访问次数统计';
