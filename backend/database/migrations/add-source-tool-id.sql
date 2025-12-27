-- 为 project_data_tools 表添加 source_tool_id 列
-- 用于追踪项目采集工具副本的来源模板ID，便于同步删除

ALTER TABLE project_data_tools
ADD COLUMN IF NOT EXISTS source_tool_id TEXT;

-- 创建索引以加速按来源工具ID查询
CREATE INDEX IF NOT EXISTS idx_project_data_tools_source_tool
ON project_data_tools(source_tool_id);

-- 通知 PostgREST 刷新 schema cache
NOTIFY pgrst, 'reload schema';
