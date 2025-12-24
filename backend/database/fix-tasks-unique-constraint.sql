-- 修复：tasks 表唯一约束，支持为每个学校/区县创建单独的任务
-- 用途：当采集工具的采集对象为"学校"时，需要为每个学校分配独立任务
-- 说明：请在 Supabase SQL Editor 中执行本脚本

-- 1. 删除旧的唯一约束
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_unique_project_tool_assignee;

-- 2. 创建新的唯一约束，包含 target_type 和 target_id
-- 使用 COALESCE 处理 null 值，确保 (project_id, tool_id, assignee_id, target_type, target_id) 组合唯一
-- 当 target_type 或 target_id 为 null 时，使用空字符串代替
CREATE UNIQUE INDEX tasks_unique_project_tool_assignee_target
ON tasks (project_id, tool_id, assignee_id, COALESCE(target_type, ''), COALESCE(target_id, ''));

-- 3. 添加 target_id 索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_target ON tasks(target_type, target_id);
