-- ============================================
-- 为 tasks 表添加任务配置字段
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 添加是否需要审核字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE;

-- 添加问卷访问地址字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS access_url TEXT;

-- 添加访问模式字段（anonymous: 匿名访问, login: 需要登录）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS access_mode TEXT;

-- 添加注释说明
COMMENT ON COLUMN tasks.requires_review IS '是否需要审核：true-提交后需管理员审核，false-提交后直接完成';
COMMENT ON COLUMN tasks.access_url IS '问卷访问地址（仅问卷类型工具使用）';
COMMENT ON COLUMN tasks.access_mode IS '访问模式：anonymous-匿名访问，login-需要登录（仅问卷类型工具使用）';

-- ============================================
-- 执行完成提示
-- ============================================
SELECT '任务配置字段添加完成！' as message;
