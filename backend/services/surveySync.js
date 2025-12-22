/**
 * 问卷指标同步服务
 * 负责将问卷统计数据同步到指标系统
 */

const { nowISO } = require('../utils/helpers');

/**
 * 同步问卷统计数据到指标系统
 * @param {Object} client - 数据库客户端（事务中）
 * @param {string} projectId - 项目ID
 * @param {string} schoolId - 学校ID
 * @param {string} toolId - 工具ID
 * @param {Object} statistics - 统计数据
 * @param {string} collectedAt - 采集时间
 * @returns {Promise<Object>} 同步结果
 */
async function syncSurveyIndicators(client, projectId, schoolId, toolId, statistics, collectedAt) {
  try {
    // 1. 构建虚拟的 submission data（与表单数据格式一致）
    const virtualSubmissionData = {
      total_sent: statistics.total_sent || statistics.total_valid || 0,
      total_sent_to_parents: statistics.total_sent_to_parents || 0,
      total_valid: statistics.total_valid || 0,
      total_valid_from_parents: statistics.total_valid_from_parents || 0,
      total_satisfied: statistics.total_satisfied || 0,
      total_satisfied_from_parents: statistics.total_satisfied_from_parents || 0
    };

    // 2. 读取字段映射
    const mappingsResult = await client.query(`
      SELECT field_id, mapping_type, target_id
      FROM field_mappings
      WHERE tool_id = $1 AND mapping_type = 'element'
    `, [toolId]);

    const mappings = mappingsResult.rows;

    if (mappings.length === 0) {
      console.log(`工具 ${toolId} 没有配置字段映射，跳过指标同步`);
      return { indicatorsUpdated: 0, synced: false };
    }

    // 3. 提取基础要素值
    const elementValues = {};
    for (const mapping of mappings) {
      const value = getValueByPath(virtualSubmissionData, mapping.field_id);
      if (value !== undefined && value !== null) {
        elementValues[mapping.target_id] = value;
      }
    }

    // 4. 计算派生要素
    const derivedElementsResult = await client.query(`
      SELECT id, code, name, formula
      FROM elements
      WHERE element_type = '派生要素' AND formula IS NOT NULL
    `);

    const derivedElements = derivedElementsResult.rows;
    for (const element of derivedElements) {
      try {
        const value = evaluateFormula(element.formula, elementValues);
        if (value !== undefined && value !== null) {
          elementValues[element.id] = value;
        }
      } catch (error) {
        console.error(`计算派生要素 ${element.code} 失败:`, error.message);
      }
    }

    // 5. 查找要素关联的数据指标并写入
    let indicatorsUpdated = 0;

    for (const [elementId, value] of Object.entries(elementValues)) {
      // 查找关联的数据指标
      const indicatorsResult = await client.query(`
        SELECT DISTINCT di.id, di.name, di.threshold, di.threshold_type
        FROM data_indicators di
        INNER JOIN data_indicator_elements die ON di.id = die.indicator_id
        WHERE die.element_id = $1
      `, [elementId]);

      const indicators = indicatorsResult.rows;

      for (const indicator of indicators) {
        // 判定达标性
        const isCompliant = checkCompliance(value, indicator.threshold, indicator.threshold_type);

        // 写入/更新 school_indicator_data 表
        await client.query(`
          INSERT INTO school_indicator_data (
            project_id, school_id, data_indicator_id,
            value, text_value, is_compliant,
            submission_id, collected_at,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (project_id, school_id, data_indicator_id)
          DO UPDATE SET
            value = EXCLUDED.value,
            text_value = EXCLUDED.text_value,
            is_compliant = EXCLUDED.is_compliant,
            collected_at = EXCLUDED.collected_at,
            updated_at = EXCLUDED.updated_at
        `, [
          projectId,
          schoolId,
          indicator.id,
          value,
          formatValue(value),
          isCompliant,
          null, // 问卷无submission
          collectedAt || nowISO(),
          nowISO(),
          nowISO()
        ]);

        indicatorsUpdated++;
      }
    }

    return { indicatorsUpdated, synced: true };

  } catch (error) {
    console.error('同步问卷指标失败:', error);
    throw error;
  }
}

/**
 * 基于路径从对象中获取值
 * @param {Object} obj - 对象
 * @param {string} path - 路径（如 'total_sent'）
 * @returns {*} 值
 */
function getValueByPath(obj, path) {
  return obj[path];
}

/**
 * 评估公式
 * @param {string} formula - 公式（如 'S6_03 / S6_02 * 100'）
 * @param {Object} elementValues - 要素值字典
 * @returns {number} 计算结果
 */
function evaluateFormula(formula, elementValues) {
  // 简单的公式计算实现
  // 替换公式中的要素ID为实际值
  let expression = formula;

  // 按要素ID长度排序，避免短ID替换长ID时出错
  const elementIds = Object.keys(elementValues).sort((a, b) => b.length - a.length);

  for (const elementId of elementIds) {
    const value = elementValues[elementId];
    if (value !== undefined && value !== null) {
      // 使用正则表达式确保完整匹配要素ID
      const regex = new RegExp(`\\b${elementId}\\b`, 'g');
      expression = expression.replace(regex, value);
    }
  }

  // 使用 eval 计算表达式（注意：生产环境应使用更安全的表达式解析器）
  try {
    // eslint-disable-next-line no-eval
    const result = eval(expression);
    return typeof result === 'number' && !isNaN(result) ? result : null;
  } catch (error) {
    throw new Error(`公式计算失败: ${formula} -> ${expression}`);
  }
}

/**
 * 判定达标性
 * @param {number} value - 指标值
 * @param {number} threshold - 阈值
 * @param {string} thresholdType - 阈值类型
 * @returns {number} 1=达标，0=不达标
 */
function checkCompliance(value, threshold, thresholdType = '>=') {
  if (value === null || value === undefined) {
    return 0;
  }
  if (threshold === null || threshold === undefined) {
    return 1; // 无阈值时默认达标
  }

  switch (thresholdType) {
    case '>=':
      return value >= threshold ? 1 : 0;
    case '>':
      return value > threshold ? 1 : 0;
    case '<=':
      return value <= threshold ? 1 : 0;
    case '<':
      return value < threshold ? 1 : 0;
    case '==':
    case '=':
      return value === threshold ? 1 : 0;
    default:
      return value >= threshold ? 1 : 0;
  }
}

/**
 * 格式化值为文本
 * @param {*} value - 值
 * @returns {string} 文本值
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    // 保留2位小数
    return value.toFixed(2);
  }
  return String(value);
}

module.exports = {
  syncSurveyIndicators,
  getValueByPath,
  evaluateFormula,
  checkCompliance,
  formatValue
};
