/**
 * 级联删除服务
 * 替代数据库 ON DELETE CASCADE，在程序层面实现级联删除
 */

const db = require('../database/db');

/**
 * 级联删除关系图
 * key: 表名
 * value: [{ table: 子表名, field: 外键字段, cascade: 是否级联删除子表的子表 }]
 */
const CASCADE_MAP = {
  indicator_systems: [
    { table: 'indicators', field: 'system_id', cascade: true }
  ],
  indicators: [
    { table: 'indicators', field: 'parent_id', cascade: true }, // 自引用，递归删除子指标
    { table: 'data_indicators', field: 'indicator_id', cascade: true },
    { table: 'supporting_materials', field: 'indicator_id', cascade: false }
  ],
  data_indicators: [
    { table: 'data_indicator_elements', field: 'data_indicator_id', cascade: false },
    { table: 'threshold_standards', field: 'indicator_id', cascade: false },
    { table: 'school_indicator_data', field: 'data_indicator_id', cascade: false }
  ],
  element_libraries: [
    { table: 'elements', field: 'library_id', cascade: true }
  ],
  elements: [
    { table: 'data_indicator_elements', field: 'element_id', cascade: false }
  ],
  data_tools: [
    { table: 'field_mappings', field: 'tool_id', cascade: false },
    { table: 'project_tools', field: 'tool_id', cascade: false }
  ],
  projects: [
    { table: 'submissions', field: 'project_id', cascade: true },
    { table: 'project_tools', field: 'project_id', cascade: false },
    { table: 'school_indicator_data', field: 'project_id', cascade: false },
    { table: 'district_statistics', field: 'project_id', cascade: false },
    { table: 'compliance_results', field: 'project_id', cascade: false }
  ],
  submissions: [
    { table: 'submission_materials', field: 'submission_id', cascade: false }
  ],
  districts: [
    { table: 'schools', field: 'district_id', cascade: true },
    { table: 'district_statistics', field: 'district_id', cascade: false }
  ],
  schools: [
    { table: 'school_indicator_data', field: 'school_id', cascade: false }
  ],
  compliance_rules: [
    { table: 'rule_conditions', field: 'rule_id', cascade: false },
    { table: 'rule_actions', field: 'rule_id', cascade: false },
    { table: 'compliance_results', field: 'rule_id', cascade: false }
  ]
};

/**
 * SET NULL 关系映射
 * 这些关系在删除时将外键字段设置为 NULL 而不是级联删除
 */
const SET_NULL_MAP = {
  data_indicators: [
    { table: 'compliance_rules', field: 'indicator_id' },
    { table: 'submission_materials', field: 'indicator_id' }
  ],
  elements: [
    { table: 'compliance_rules', field: 'element_id' }
  ],
  supporting_materials: [
    { table: 'submission_materials', field: 'material_config_id' }
  ]
};

/**
 * 递归获取所有待删除的记录 ID
 * @param {object} client - 数据库客户端
 * @param {string} table - 表名
 * @param {string} id - 记录 ID
 * @param {Map} visited - 已访问的记录（防止循环）
 * @returns {Promise<Map<string, Set<string>>>} 表名 -> ID 集合的映射
 */
async function collectCascadeIds(client, table, id, visited = new Map()) {
  const key = `${table}:${id}`;
  if (visited.has(key)) {
    return new Map();
  }
  visited.set(key, true);

  const result = new Map();

  // 添加当前记录
  if (!result.has(table)) {
    result.set(table, new Set());
  }
  result.get(table).add(id);

  // 获取级联关系
  const cascades = CASCADE_MAP[table];
  if (!cascades) {
    return result;
  }

  // 处理每个级联关系
  for (const cascade of cascades) {
    // 查询所有需要级联删除的子记录
    const childResult = await client.query(
      `SELECT id FROM ${cascade.table} WHERE ${cascade.field} = $1`,
      [id]
    );

    for (const row of childResult.rows) {
      // 如果需要递归级联，则收集子记录的级联
      if (cascade.cascade) {
        const childCascades = await collectCascadeIds(client, cascade.table, row.id, visited);
        // 合并结果
        for (const [t, ids] of childCascades) {
          if (!result.has(t)) {
            result.set(t, new Set());
          }
          for (const childId of ids) {
            result.get(t).add(childId);
          }
        }
      } else {
        // 直接添加子记录
        if (!result.has(cascade.table)) {
          result.set(cascade.table, new Set());
        }
        result.get(cascade.table).add(row.id);
      }
    }
  }

  return result;
}

/**
 * 执行级联删除
 * @param {string} table - 表名
 * @param {string} id - 记录 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function cascadeDelete(table, id) {
  return db.transaction(async (client) => {
    // 1. 收集所有需要删除的记录
    const toDelete = await collectCascadeIds(client, table, id);

    // 2. 处理 SET NULL 关系
    const setNulls = SET_NULL_MAP[table];
    if (setNulls) {
      for (const setNull of setNulls) {
        await client.query(
          `UPDATE ${setNull.table} SET ${setNull.field} = NULL WHERE ${setNull.field} = $1`,
          [id]
        );
      }
    }

    // 3. 按照依赖顺序删除（先删子表，后删父表）
    // 定义删除顺序（子表在前，父表在后）
    const deleteOrder = [
      'compliance_results',
      'rule_actions',
      'rule_conditions',
      'compliance_rules',
      'submission_materials',
      'submissions',
      'district_statistics',
      'school_indicator_data',
      'project_tools',
      'field_mappings',
      'data_indicator_elements',
      'threshold_standards',
      'data_indicators',
      'supporting_materials',
      'indicators',
      'elements',
      'element_libraries',
      'schools',
      'districts',
      'data_tools',
      'projects',
      'indicator_systems'
    ];

    const deleted = {};

    for (const t of deleteOrder) {
      const ids = toDelete.get(t);
      if (ids && ids.size > 0) {
        const idArray = Array.from(ids);
        const placeholders = idArray.map((_, i) => `$${i + 1}`).join(', ');
        const result = await client.query(
          `DELETE FROM ${t} WHERE id IN (${placeholders})`,
          idArray
        );
        deleted[t] = result.rowCount;
      }
    }

    return { success: true, deleted };
  });
}

/**
 * 删除指标体系及其所有关联数据
 * @param {string} systemId - 指标体系 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteIndicatorSystem(systemId) {
  return cascadeDelete('indicator_systems', systemId);
}

/**
 * 删除指标及其所有关联数据
 * @param {string} indicatorId - 指标 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteIndicator(indicatorId) {
  return cascadeDelete('indicators', indicatorId);
}

/**
 * 删除要素库及其所有要素
 * @param {string} libraryId - 要素库 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteElementLibrary(libraryId) {
  return cascadeDelete('element_libraries', libraryId);
}

/**
 * 删除采集工具及其关联数据
 * @param {string} toolId - 工具 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteDataTool(toolId) {
  return cascadeDelete('data_tools', toolId);
}

/**
 * 删除项目及其所有关联数据
 * @param {string} projectId - 项目 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteProject(projectId) {
  return cascadeDelete('projects', projectId);
}

/**
 * 删除区县及其所有学校
 * @param {string} districtId - 区县 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteDistrict(districtId) {
  return cascadeDelete('districts', districtId);
}

/**
 * 删除达标规则及其条件和动作
 * @param {string} ruleId - 规则 ID
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function deleteComplianceRule(ruleId) {
  return cascadeDelete('compliance_rules', ruleId);
}

/**
 * 批量删除记录
 * @param {string} table - 表名
 * @param {string[]} ids - 记录 ID 数组
 * @returns {Promise<{success: boolean, deleted: object}>}
 */
async function batchCascadeDelete(table, ids) {
  const results = { success: true, deleted: {} };

  for (const id of ids) {
    const result = await cascadeDelete(table, id);
    // 合并删除结果
    for (const [t, count] of Object.entries(result.deleted)) {
      results.deleted[t] = (results.deleted[t] || 0) + count;
    }
  }

  return results;
}

module.exports = {
  CASCADE_MAP,
  SET_NULL_MAP,
  cascadeDelete,
  deleteIndicatorSystem,
  deleteIndicator,
  deleteElementLibrary,
  deleteDataTool,
  deleteProject,
  deleteDistrict,
  deleteComplianceRule,
  batchCascadeDelete
};
