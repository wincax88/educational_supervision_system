-- ============================================
-- 修复缺失字段的 SQL 脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ==================== indicator_systems ====================
ALTER TABLE indicator_systems ADD COLUMN IF NOT EXISTS attachments TEXT;
ALTER TABLE indicator_systems ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ==================== districts ====================
ALTER TABLE districts ADD COLUMN IF NOT EXISTS parent_code TEXT;

-- ==================== schools ====================
ALTER TABLE schools ADD COLUMN IF NOT EXISTS principal TEXT;
-- 如果已有 contact 列，可以改名；否则添加 contact_phone
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- ==================== data_tools ====================
ALTER TABLE data_tools ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ==================== element_libraries ====================
ALTER TABLE element_libraries ADD COLUMN IF NOT EXISTS element_count INTEGER DEFAULT 0;
ALTER TABLE element_libraries ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ==================== data_indicator_elements ====================
ALTER TABLE data_indicator_elements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE data_indicator_elements ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE data_indicator_elements ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- ==================== field_mappings ====================
-- 将 field_key 改名为 field_id（如果需要）
ALTER TABLE field_mappings RENAME COLUMN field_key TO field_id;
ALTER TABLE field_mappings ADD COLUMN IF NOT EXISTS field_label TEXT;
ALTER TABLE field_mappings ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- ==================== elements ====================
-- 基础要素可选：关联采集工具/表单控件（用于页面回显与筛选“未关联/已关联”）
ALTER TABLE elements ADD COLUMN IF NOT EXISTS tool_id TEXT;
ALTER TABLE elements ADD COLUMN IF NOT EXISTS field_id TEXT;
ALTER TABLE elements ADD COLUMN IF NOT EXISTS field_label TEXT;

-- ==================== submissions ====================
-- 添加 form_id 列（与 tool_id 分开，或作为别名）
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS form_id TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitter_id TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitter_name TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitter_org TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS approved_at TEXT;

-- 同步 form_id 和 tool_id 的数据（如果 tool_id 已有数据）
UPDATE submissions SET form_id = tool_id WHERE form_id IS NULL AND tool_id IS NOT NULL;

-- ==================== supporting_materials ====================
ALTER TABLE supporting_materials ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ==================== compliance_rules ====================
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS indicator_id TEXT;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS element_id TEXT;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS enabled INTEGER DEFAULT 1;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 添加 code 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_rules_code ON compliance_rules(code) WHERE code IS NOT NULL;

-- ==================== rule_conditions ====================
-- 将 logic_operator 改名为 logical_operator
ALTER TABLE rule_conditions RENAME COLUMN logic_operator TO logical_operator;

-- ==================== rule_actions ====================
ALTER TABLE rule_actions ADD COLUMN IF NOT EXISTS config TEXT;
ALTER TABLE rule_actions ADD COLUMN IF NOT EXISTS result_field TEXT;
ALTER TABLE rule_actions ADD COLUMN IF NOT EXISTS pass_message TEXT;
ALTER TABLE rule_actions ADD COLUMN IF NOT EXISTS fail_message TEXT;

-- ==================== compliance_results ====================
ALTER TABLE compliance_results ADD COLUMN IF NOT EXISTS indicator_id TEXT;
ALTER TABLE compliance_results ADD COLUMN IF NOT EXISTS actual_value TEXT;
ALTER TABLE compliance_results ADD COLUMN IF NOT EXISTS threshold_value TEXT;
ALTER TABLE compliance_results ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE compliance_results ADD COLUMN IF NOT EXISTS calculated_at TEXT;

-- ==================== threshold_standards ====================
-- 添加缺失的字段
ALTER TABLE threshold_standards ADD COLUMN IF NOT EXISTS institution_type TEXT;
ALTER TABLE threshold_standards ADD COLUMN IF NOT EXISTS threshold_operator TEXT;
ALTER TABLE threshold_standards ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE threshold_standards ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE threshold_standards ADD COLUMN IF NOT EXISTS effective_date TEXT;
ALTER TABLE threshold_standards ADD COLUMN IF NOT EXISTS expiry_date TEXT;

-- 如果需要同步 school_type 到 institution_type
UPDATE threshold_standards SET institution_type = school_type WHERE institution_type IS NULL AND school_type IS NOT NULL;

-- 添加唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_threshold_standards_indicator_institution
  ON threshold_standards(indicator_id, institution_type);

-- ==================== school_indicator_data ====================
-- 添加唯一约束（用于 UPSERT）
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_indicator_data_unique
  ON school_indicator_data(project_id, school_id, data_indicator_id);

-- ==================== district_statistics ====================
-- 添加唯一约束（用于 UPSERT）
CREATE UNIQUE INDEX IF NOT EXISTS idx_district_statistics_unique
  ON district_statistics(project_id, district_id, school_type);

-- ============================================
-- 执行完成提示
-- ============================================
SELECT '缺失字段修复脚本执行完成！' as message;
