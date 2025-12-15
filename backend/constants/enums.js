/**
 * 系统枚举值定义
 * 替代数据库 CHECK 约束，在程序层面进行验证
 */

module.exports = {
  // ==================== 指标体系相关 ====================

  // 指标体系类型
  INDICATOR_SYSTEM_TYPE: ['达标类', '评分类'],

  // 指标体系状态
  INDICATOR_SYSTEM_STATUS: ['draft', 'editing', 'published'],

  // 指标层级 (1-3级)
  INDICATOR_LEVEL: [1, 2, 3],

  // ==================== 采集工具相关 ====================

  // 采集工具类型
  DATA_TOOL_TYPE: ['表单', '问卷'],

  // 采集工具状态
  DATA_TOOL_STATUS: ['draft', 'editing', 'published'],

  // ==================== 要素库相关 ====================

  // 要素库状态
  ELEMENT_LIBRARY_STATUS: ['draft', 'published'],

  // 要素类型
  ELEMENT_TYPE: ['基础要素', '派生要素'],

  // 要素数据类型
  ELEMENT_DATA_TYPE: ['文本', '数字', '日期', '时间', '逻辑', '数组', '文件'],

  // ==================== 项目相关 ====================

  // 项目状态
  PROJECT_STATUS: ['配置中', '填报中', '评审中', '已中止', '已完成'],

  // 填报状态
  SUBMISSION_STATUS: ['draft', 'submitted', 'approved', 'rejected'],

  // ==================== 映射和规则相关 ====================

  // 字段映射类型
  FIELD_MAPPING_TYPE: ['data_indicator', 'element'],

  // 数据指标-要素关联类型
  DATA_INDICATOR_ELEMENT_MAPPING_TYPE: ['primary', 'reference'],

  // 规则类型
  COMPLIANCE_RULE_TYPE: ['threshold', 'conditional', 'validation', 'aggregation'],

  // 规则动作类型
  RULE_ACTION_TYPE: ['compare', 'validate', 'calculate', 'aggregate'],

  // ==================== 学校相关 ====================

  // 学校类型
  SCHOOL_TYPE: ['小学', '初中', '九年一贯制', '完全中学'],

  // 城乡类型
  URBAN_RURAL_TYPE: ['城区', '镇区', '乡村'],

  // 办学性质
  SCHOOL_CATEGORY: ['公办', '民办'],

  // 学校状态
  SCHOOL_STATUS: ['active', 'inactive'],

  // ==================== 区县相关 ====================

  // 区县类型
  DISTRICT_TYPE: ['市辖区', '县', '县级市'],

  // ==================== 其他 ====================

  // 评估年度状态
  EVALUATION_YEAR_STATUS: ['active', 'archived'],

  // 实体类型（用于达标结果）
  ENTITY_TYPE: ['school', 'district', 'county'],

  // 目标类型（用于校验配置）
  VALIDATION_TARGET_TYPE: ['field', 'element', 'indicator'],
};

/**
 * 验证枚举值是否有效
 * @param {string} enumName - 枚举名称
 * @param {any} value - 待验证的值
 * @returns {boolean}
 */
function isValidEnum(enumName, value) {
  const enumValues = module.exports[enumName];
  if (!enumValues) {
    console.warn(`Unknown enum: ${enumName}`);
    return false;
  }
  return enumValues.includes(value);
}

/**
 * 获取枚举值列表
 * @param {string} enumName - 枚举名称
 * @returns {Array|null}
 */
function getEnumValues(enumName) {
  return module.exports[enumName] || null;
}

/**
 * 验证枚举值，无效时抛出错误
 * @param {string} enumName - 枚举名称
 * @param {any} value - 待验证的值
 * @param {string} fieldName - 字段名（用于错误消息）
 * @throws {Error}
 */
function validateEnum(enumName, value, fieldName) {
  if (!isValidEnum(enumName, value)) {
    const enumValues = module.exports[enumName];
    throw new Error(
      `Invalid ${fieldName}: '${value}'. Must be one of: [${enumValues ? enumValues.join(', ') : 'unknown enum'}]`
    );
  }
}

module.exports.isValidEnum = isValidEnum;
module.exports.getEnumValues = getEnumValues;
module.exports.validateEnum = validateEnum;
