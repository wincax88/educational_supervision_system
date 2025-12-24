-- 填报任务分配功能数据库迁移脚本
-- 创建时间: 2024-12-24
-- 功能: 支持数据采集员按区县分配填报范围，采集工具级别审核配置

-- ============================================================================
-- 1. 扩展 project_personnel 表
-- ============================================================================

-- 添加区县关联字段（用于数据采集员按区县限制填报范围）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_personnel' AND column_name = 'district_id'
  ) THEN
    ALTER TABLE project_personnel ADD COLUMN district_id TEXT;
    COMMENT ON COLUMN project_personnel.district_id IS '关联区县ID（来自project_samples，type=district），用于数据采集员限制填报范围';
  END IF;
END $$;

-- 创建区县关联索引
CREATE INDEX IF NOT EXISTS idx_project_personnel_district ON project_personnel(district_id);

-- ============================================================================
-- 2. 扩展 project_tools 表
-- ============================================================================

-- 添加审核配置字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_tools' AND column_name = 'require_review'
  ) THEN
    ALTER TABLE project_tools ADD COLUMN require_review BOOLEAN DEFAULT true;
    COMMENT ON COLUMN project_tools.require_review IS '是否需要审核，true=提交后需审核，false=提交后直接通过';
  END IF;
END $$;

-- ============================================================================
-- 3. 更新现有数据（可选）
-- ============================================================================

-- 将现有角色映射到新角色体系
-- 旧角色: system_admin, city_admin, district_admin, district_reporter, school_reporter
-- 新角色: project_admin, data_collector, project_expert

-- 注意: 以下 UPDATE 语句仅作为参考，实际执行时需要根据业务需求调整
-- UPDATE project_personnel SET role = 'project_admin' WHERE role IN ('system_admin', 'city_admin');
-- UPDATE project_personnel SET role = 'data_collector' WHERE role IN ('district_admin', 'district_reporter', 'school_reporter');

-- ============================================================================
-- 4. 验证迁移结果
-- ============================================================================

-- 查询验证
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'project_personnel' AND column_name = 'district_id';

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'project_tools' AND column_name = 'require_review';
