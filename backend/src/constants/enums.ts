/**
 * 系统枚举值定义
 * 替代数据库 CHECK 约束，在程序层面进行验证
 */

// ==================== 指标体系相关 ====================

// 指标体系类型
export const INDICATOR_SYSTEM_TYPE = ['达标类', '评分类'] as const;
export type IndicatorSystemType = typeof INDICATOR_SYSTEM_TYPE[number];

// 指标体系状态
export const INDICATOR_SYSTEM_STATUS = ['draft', 'editing', 'published'] as const;
export type IndicatorSystemStatus = typeof INDICATOR_SYSTEM_STATUS[number];

// 指标层级 (1-3级)
export const INDICATOR_LEVEL = [1, 2, 3] as const;
export type IndicatorLevel = typeof INDICATOR_LEVEL[number];

// ==================== 采集工具相关 ====================

// 采集工具类型
export const DATA_TOOL_TYPE = ['表单', '问卷'] as const;
export type DataToolType = typeof DATA_TOOL_TYPE[number];

// 采集工具状态
export const DATA_TOOL_STATUS = ['draft', 'editing', 'published'] as const;
export type DataToolStatus = typeof DATA_TOOL_STATUS[number];

// ==================== 要素库相关 ====================

// 要素库状态
export const ELEMENT_LIBRARY_STATUS = ['draft', 'published'] as const;
export type ElementLibraryStatus = typeof ELEMENT_LIBRARY_STATUS[number];

// 要素类型
export const ELEMENT_TYPE = ['基础要素', '派生要素'] as const;
export type ElementType = typeof ELEMENT_TYPE[number];

// 要素数据类型
export const ELEMENT_DATA_TYPE = ['文本', '数字', '日期', '时间', '逻辑', '数组', '文件'] as const;
export type ElementDataType = typeof ELEMENT_DATA_TYPE[number];

// ==================== 项目相关 ====================

// 项目状态
export const PROJECT_STATUS = ['配置中', '填报中', '评审中', '已中止', '已完成'] as const;
export type ProjectStatus = typeof PROJECT_STATUS[number];

// 填报状态
export const SUBMISSION_STATUS = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type SubmissionStatus = typeof SUBMISSION_STATUS[number];

// ==================== 映射和规则相关 ====================

// 字段映射类型
export const FIELD_MAPPING_TYPE = ['data_indicator', 'element'] as const;
export type FieldMappingType = typeof FIELD_MAPPING_TYPE[number];

// 数据指标-要素关联类型
export const DATA_INDICATOR_ELEMENT_MAPPING_TYPE = ['primary', 'reference'] as const;
export type DataIndicatorElementMappingType = typeof DATA_INDICATOR_ELEMENT_MAPPING_TYPE[number];

// 规则类型
export const COMPLIANCE_RULE_TYPE = ['threshold', 'conditional', 'validation', 'aggregation'] as const;
export type ComplianceRuleType = typeof COMPLIANCE_RULE_TYPE[number];

// 规则动作类型
export const RULE_ACTION_TYPE = ['compare', 'validate', 'calculate', 'aggregate'] as const;
export type RuleActionType = typeof RULE_ACTION_TYPE[number];

// ==================== 学校相关 ====================

// 学校类型
export const SCHOOL_TYPE = ['小学', '初中', '九年一贯制', '完全中学'] as const;
export type SchoolType = typeof SCHOOL_TYPE[number];

// 城乡类型
export const URBAN_RURAL_TYPE = ['城区', '镇区', '乡村'] as const;
export type UrbanRuralType = typeof URBAN_RURAL_TYPE[number];

// 办学性质
export const SCHOOL_CATEGORY = ['公办', '民办'] as const;
export type SchoolCategory = typeof SCHOOL_CATEGORY[number];

// 学校状态
export const SCHOOL_STATUS = ['active', 'inactive'] as const;
export type SchoolStatus = typeof SCHOOL_STATUS[number];

// ==================== 区县相关 ====================

// 区县类型
export const DISTRICT_TYPE = ['市辖区', '县', '县级市'] as const;
export type DistrictType = typeof DISTRICT_TYPE[number];

// ==================== 其他 ====================

// 评估年度状态
export const EVALUATION_YEAR_STATUS = ['active', 'archived'] as const;
export type EvaluationYearStatus = typeof EVALUATION_YEAR_STATUS[number];

// 实体类型（用于达标结果）
export const ENTITY_TYPE = ['school', 'district', 'county'] as const;
export type EntityType = typeof ENTITY_TYPE[number];

// 目标类型（用于校验配置）
export const VALIDATION_TARGET_TYPE = ['field', 'element', 'indicator'] as const;
export type ValidationTargetType = typeof VALIDATION_TARGET_TYPE[number];

// ==================== 枚举值映射表 ====================

const enumMap: Record<string, readonly unknown[]> = {
  INDICATOR_SYSTEM_TYPE,
  INDICATOR_SYSTEM_STATUS,
  INDICATOR_LEVEL,
  DATA_TOOL_TYPE,
  DATA_TOOL_STATUS,
  ELEMENT_LIBRARY_STATUS,
  ELEMENT_TYPE,
  ELEMENT_DATA_TYPE,
  PROJECT_STATUS,
  SUBMISSION_STATUS,
  FIELD_MAPPING_TYPE,
  DATA_INDICATOR_ELEMENT_MAPPING_TYPE,
  COMPLIANCE_RULE_TYPE,
  RULE_ACTION_TYPE,
  SCHOOL_TYPE,
  URBAN_RURAL_TYPE,
  SCHOOL_CATEGORY,
  SCHOOL_STATUS,
  DISTRICT_TYPE,
  EVALUATION_YEAR_STATUS,
  ENTITY_TYPE,
  VALIDATION_TARGET_TYPE,
};

/**
 * 验证枚举值是否有效
 * @param enumName - 枚举名称
 * @param value - 待验证的值
 * @returns boolean
 */
export function isValidEnum(enumName: string, value: unknown): boolean {
  const enumValues = enumMap[enumName];
  if (!enumValues) {
    console.warn(`Unknown enum: ${enumName}`);
    return false;
  }
  return enumValues.includes(value);
}

/**
 * 获取枚举值列表
 * @param enumName - 枚举名称
 * @returns 枚举值数组或 null
 */
export function getEnumValues(enumName: string): readonly unknown[] | null {
  return enumMap[enumName] || null;
}

/**
 * 验证枚举值，无效时抛出错误
 * @param enumName - 枚举名称
 * @param value - 待验证的值
 * @param fieldName - 字段名（用于错误消息）
 * @throws Error
 */
export function validateEnum(enumName: string, value: unknown, fieldName: string): void {
  if (!isValidEnum(enumName, value)) {
    const enumValues = enumMap[enumName];
    throw new Error(
      `Invalid ${fieldName}: '${value}'. Must be one of: [${enumValues ? enumValues.join(', ') : 'unknown enum'}]`
    );
  }
}
