/**
 * 引用完整性验证服务
 * 替代数据库外键约束，在程序层面验证表关联
 */

const db = require('../database/db');

/**
 * 表关系映射
 * key: 表名
 * value: { 字段名: { table: 关联表, required: 是否必填 } }
 */
const RELATIONS = {
  indicators: {
    system_id: { table: 'indicator_systems', required: true },
    parent_id: { table: 'indicators', required: false }
  },
  data_indicators: {
    indicator_id: { table: 'indicators', required: true }
  },
  supporting_materials: {
    indicator_id: { table: 'indicators', required: true }
  },
  elements: {
    library_id: { table: 'element_libraries', required: true }
  },
  projects: {
    indicator_system_id: { table: 'indicator_systems', required: false }
  },
  submissions: {
    project_id: { table: 'projects', required: true },
    form_id: { table: 'data_tools', required: true }
  },
  submission_materials: {
    submission_id: { table: 'submissions', required: true },
    material_config_id: { table: 'supporting_materials', required: false },
    indicator_id: { table: 'data_indicators', required: false }
  },
  project_tools: {
    project_id: { table: 'projects', required: true },
    tool_id: { table: 'data_tools', required: true }
  },
  field_mappings: {
    tool_id: { table: 'data_tools', required: true }
  },
  schools: {
    district_id: { table: 'districts', required: true }
  },
  school_indicator_data: {
    project_id: { table: 'projects', required: true },
    school_id: { table: 'schools', required: true },
    data_indicator_id: { table: 'data_indicators', required: true }
  },
  district_statistics: {
    project_id: { table: 'projects', required: true },
    district_id: { table: 'districts', required: true }
  },
  data_indicator_elements: {
    data_indicator_id: { table: 'data_indicators', required: true },
    element_id: { table: 'elements', required: true }
  },
  compliance_rules: {
    indicator_id: { table: 'data_indicators', required: false },
    element_id: { table: 'elements', required: false }
  },
  rule_conditions: {
    rule_id: { table: 'compliance_rules', required: true }
  },
  rule_actions: {
    rule_id: { table: 'compliance_rules', required: true }
  },
  compliance_results: {
    project_id: { table: 'projects', required: true },
    rule_id: { table: 'compliance_rules', required: true }
  },
  threshold_standards: {
    indicator_id: { table: 'data_indicators', required: true }
  }
};

/**
 * 反向引用映射
 * key: 表名
 * value: [{ table: 引用此表的表名, field: 外键字段名 }]
 */
const REVERSE_RELATIONS = {
  indicator_systems: [
    { table: 'indicators', field: 'system_id' },
    { table: 'projects', field: 'indicator_system_id' }
  ],
  indicators: [
    { table: 'indicators', field: 'parent_id' },
    { table: 'data_indicators', field: 'indicator_id' },
    { table: 'supporting_materials', field: 'indicator_id' }
  ],
  data_indicators: [
    { table: 'data_indicator_elements', field: 'data_indicator_id' },
    { table: 'threshold_standards', field: 'indicator_id' },
    { table: 'school_indicator_data', field: 'data_indicator_id' },
    { table: 'submission_materials', field: 'indicator_id' },
    { table: 'compliance_rules', field: 'indicator_id' }
  ],
  supporting_materials: [
    { table: 'submission_materials', field: 'material_config_id' }
  ],
  element_libraries: [
    { table: 'elements', field: 'library_id' }
  ],
  elements: [
    { table: 'data_indicator_elements', field: 'element_id' },
    { table: 'compliance_rules', field: 'element_id' }
  ],
  data_tools: [
    { table: 'submissions', field: 'form_id' },
    { table: 'project_tools', field: 'tool_id' },
    { table: 'field_mappings', field: 'tool_id' }
  ],
  projects: [
    { table: 'submissions', field: 'project_id' },
    { table: 'project_tools', field: 'project_id' },
    { table: 'school_indicator_data', field: 'project_id' },
    { table: 'district_statistics', field: 'project_id' },
    { table: 'compliance_results', field: 'project_id' }
  ],
  submissions: [
    { table: 'submission_materials', field: 'submission_id' }
  ],
  districts: [
    { table: 'schools', field: 'district_id' },
    { table: 'district_statistics', field: 'district_id' }
  ],
  schools: [
    { table: 'school_indicator_data', field: 'school_id' }
  ],
  compliance_rules: [
    { table: 'rule_conditions', field: 'rule_id' },
    { table: 'rule_actions', field: 'rule_id' },
    { table: 'compliance_results', field: 'rule_id' }
  ]
};

/**
 * 验证单个外键引用是否存在
 * @param {string} table - 关联表名
 * @param {string} id - 记录 ID
 * @param {object} client - 数据库客户端（可选，用于事务）
 * @returns {Promise<boolean>}
 */
async function exists(table, id, client = null) {
  if (!id) return true; // 空值不验证（由 required 控制）

  const queryFn = client ? client.query.bind(client) : db.query;
  const result = await queryFn(
    `SELECT 1 FROM ${table} WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows.length > 0;
}

/**
 * 验证外键引用是否有效
 * @param {string} table - 当前表名
 * @param {string} field - 外键字段名
 * @param {any} value - 字段值
 * @param {object} client - 数据库客户端（可选，用于事务）
 * @returns {Promise<{valid: boolean, message?: string}>}
 */
async function validateReference(table, field, value, client = null) {
  const relations = RELATIONS[table];
  if (!relations || !relations[field]) {
    return { valid: true }; // 未定义的关系，跳过验证
  }

  const relation = relations[field];

  // 检查必填
  if (relation.required && !value) {
    return {
      valid: false,
      message: `${field} is required`
    };
  }

  // 空值且非必填，通过
  if (!value) {
    return { valid: true };
  }

  // 验证引用存在
  const refExists = await exists(relation.table, value, client);
  if (!refExists) {
    return {
      valid: false,
      message: `Referenced ${relation.table} with id '${value}' does not exist`
    };
  }

  return { valid: true };
}

/**
 * 批量验证多个外键引用
 * @param {string} table - 当前表名
 * @param {object} data - 包含外键字段的数据对象
 * @param {object} client - 数据库客户端（可选，用于事务）
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validateReferences(table, data, client = null) {
  const relations = RELATIONS[table];
  if (!relations) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  for (const [field, relation] of Object.entries(relations)) {
    if (field in data) {
      const result = await validateReference(table, field, data[field], client);
      if (!result.valid) {
        errors.push(result.message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查记录是否被其他表引用
 * @param {string} table - 表名
 * @param {string} id - 记录 ID
 * @param {object} client - 数据库客户端（可选，用于事务）
 * @returns {Promise<{referenced: boolean, references: Array}>}
 */
async function checkReferences(table, id, client = null) {
  const reverseRefs = REVERSE_RELATIONS[table];
  if (!reverseRefs || reverseRefs.length === 0) {
    return { referenced: false, references: [] };
  }

  const queryFn = client ? client.query.bind(client) : db.query;
  const references = [];

  for (const ref of reverseRefs) {
    const result = await queryFn(
      `SELECT COUNT(*) as count FROM ${ref.table} WHERE ${ref.field} = $1`,
      [id]
    );
    const count = parseInt(result.rows[0].count, 10);
    if (count > 0) {
      references.push({
        table: ref.table,
        field: ref.field,
        count
      });
    }
  }

  return {
    referenced: references.length > 0,
    references
  };
}

/**
 * 验证是否可以安全删除（无引用）
 * @param {string} table - 表名
 * @param {string} id - 记录 ID
 * @param {object} client - 数据库客户端（可选）
 * @returns {Promise<{canDelete: boolean, message?: string}>}
 */
async function canDelete(table, id, client = null) {
  const { referenced, references } = await checkReferences(table, id, client);

  if (!referenced) {
    return { canDelete: true };
  }

  const refList = references
    .map(r => `${r.table}(${r.count}条)`)
    .join(', ');

  return {
    canDelete: false,
    message: `Cannot delete: record is referenced by ${refList}`
  };
}

module.exports = {
  RELATIONS,
  REVERSE_RELATIONS,
  exists,
  validateReference,
  validateReferences,
  checkReferences,
  canDelete
};
