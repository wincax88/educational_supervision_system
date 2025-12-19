-- ============================================
-- 为 projects 表添加 element_library_id 字段
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 添加 element_library_id 列
ALTER TABLE projects ADD COLUMN IF NOT EXISTS element_library_id TEXT;

-- 刷新 schema cache（PostgREST 需要）
NOTIFY pgrst, 'reload schema';

SELECT '已添加 element_library_id 字段到 projects 表' as message;
