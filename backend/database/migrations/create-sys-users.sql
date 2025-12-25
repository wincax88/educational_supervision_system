-- 系统用户表迁移脚本
-- 将用户存储从 JSON 文件迁移到 PostgreSQL 数据库
-- 使用手机号作为主键和登录账号

-- ============================================================================
-- 1. 创建 sys_users 表
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys_users (
  phone TEXT PRIMARY KEY,                    -- 手机号作为主键和登录账号
  password TEXT NOT NULL,                    -- 密码（bcrypt 加密）
  name TEXT,                                 -- 用户姓名
  organization TEXT,                         -- 所属单位
  id_card TEXT,                              -- 身份证号
  roles TEXT[] NOT NULL DEFAULT '{}',        -- 角色数组：admin, project_admin, data_collector, project_expert, decision_maker
  status TEXT DEFAULT 'active',              -- 状态：active | inactive
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sys_users_status ON sys_users(status);
CREATE INDEX IF NOT EXISTS idx_sys_users_roles ON sys_users USING GIN(roles);
CREATE INDEX IF NOT EXISTS idx_sys_users_name ON sys_users(name);

-- 更新时间触发器函数
CREATE OR REPLACE FUNCTION update_sys_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sys_users_updated_at'
  ) THEN
    CREATE TRIGGER trigger_sys_users_updated_at
      BEFORE UPDATE ON sys_users
      FOR EACH ROW
      EXECUTE FUNCTION update_sys_users_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 2. 修改 project_personnel 表，添加 user_phone 关联字段
-- ============================================================================

ALTER TABLE project_personnel
  ADD COLUMN IF NOT EXISTS user_phone TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_personnel_user_phone ON project_personnel(user_phone);

-- ============================================================================
-- 3. 初始化 admin 账号
-- ============================================================================

-- 默认密码: 000000 (手机号后6位)
-- 注意：实际部署时应使用 bcrypt 加密密码
-- bcrypt hash of '000000' (使用 bcrypt.hash('000000', 10) 生成)
INSERT INTO sys_users (phone, password, name, roles, status, created_at, updated_at)
VALUES (
  '13800000000',
  '$2b$10$.kzFXMpvCLWXPY6lANBeiurTI9cbG/1TSmgF.1CmwLHKeHdAYUyT6',  -- bcrypt hash of '000000'
  '系统管理员',
  ARRAY['admin'],
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (phone) DO UPDATE SET
  password = EXCLUDED.password,
  updated_at = NOW();

-- ============================================================================
-- 4. 数据迁移：从 project_personnel 迁移有手机号的人员
-- ============================================================================

-- 角色映射规则：
-- project_admin -> project_admin
-- data_collector -> data_collector
-- project_expert -> project_expert
-- district_admin -> project_admin
-- district_reporter -> data_collector
-- school_reporter -> data_collector
-- city_admin -> project_admin

-- 迁移现有人员数据（使用 UPSERT，角色累加）
INSERT INTO sys_users (phone, password, name, organization, id_card, roles, status, created_at, updated_at)
SELECT DISTINCT ON (phone)
  phone,
  -- 默认密码为手机号后6位（这里存储明文，应用层会做 bcrypt 加密）
  RIGHT(phone, 6),
  name,
  organization,
  id_card,
  CASE role
    WHEN 'project_admin' THEN ARRAY['project_admin']
    WHEN 'data_collector' THEN ARRAY['data_collector']
    WHEN 'project_expert' THEN ARRAY['project_expert']
    WHEN 'district_admin' THEN ARRAY['project_admin']
    WHEN 'district_reporter' THEN ARRAY['data_collector']
    WHEN 'school_reporter' THEN ARRAY['data_collector']
    WHEN 'city_admin' THEN ARRAY['project_admin']
    ELSE ARRAY['data_collector']
  END,
  COALESCE(status, 'active'),
  COALESCE(created_at::timestamp, NOW()),
  NOW()
FROM project_personnel
WHERE phone IS NOT NULL
  AND phone != ''
  AND LENGTH(phone) >= 6
ON CONFLICT (phone) DO UPDATE SET
  -- 累加角色（去重）
  roles = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(sys_users.roles || EXCLUDED.roles)
    )
  ),
  -- 更新其他信息（如果原来为空）
  name = COALESCE(NULLIF(sys_users.name, ''), EXCLUDED.name),
  organization = COALESCE(NULLIF(sys_users.organization, ''), EXCLUDED.organization),
  updated_at = NOW();

-- ============================================================================
-- 5. 更新 project_personnel 的 user_phone 关联
-- ============================================================================

UPDATE project_personnel pp
SET user_phone = pp.phone
WHERE pp.phone IS NOT NULL
  AND pp.phone != ''
  AND pp.user_phone IS NULL
  AND EXISTS (SELECT 1 FROM sys_users su WHERE su.phone = pp.phone);

-- ============================================================================
-- 6. 输出迁移结果统计
-- ============================================================================

DO $$
DECLARE
  total_users INTEGER;
  total_linked INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM sys_users;
  SELECT COUNT(*) INTO total_linked FROM project_personnel WHERE user_phone IS NOT NULL;

  RAISE NOTICE '迁移完成：';
  RAISE NOTICE '  - 系统用户总数: %', total_users;
  RAISE NOTICE '  - 已关联项目人员数: %', total_linked;
END $$;
