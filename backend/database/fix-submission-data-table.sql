-- ============================================
-- 修复 submission_data 表缺失问题
-- 在 PostgreSQL 数据库中执行此脚本
-- ============================================

-- 1. 确保 submissions 表有 school_id 字段
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS school_id TEXT;

-- 2. 为 school_id 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_submissions_school_id ON submissions(school_id);

-- ============================================
-- 执行完成提示
-- ============================================
SELECT 'submissions 表修复完成！已添加 school_id 字段和索引。' as message;









