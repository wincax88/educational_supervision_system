/**
 * 聚合计算服务
 * 提供SUM、AVG、COUNT等聚合函数及差异系数计算
 */

const { calculateCV } = require('./statisticsService');

/**
 * ==========================================
 * 扩展公式函数（用于派生要素计算）
 * ==========================================
 */

/**
 * 扩展函数关键字列表（用于公式解析时排除）
 */
const EXTENDED_FUNCTION_KEYWORDS = ['CEIL', 'FLOOR', 'LEN', 'YEAR', 'IF', 'COUNT_IF', 'SUM_ARRAY', 'OR', 'AND'];

/**
 * 向上取整
 * @param {number} value
 * @returns {number|null}
 */
function extCeil(value) {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Math.ceil(Number(value));
}

/**
 * 向下取整
 * @param {number} value
 * @returns {number|null}
 */
function extFloor(value) {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Math.floor(Number(value));
}

/**
 * 获取数组长度
 * @param {Array} arr
 * @returns {number}
 */
function extLen(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.length;
}

/**
 * 从日期字符串提取年份
 * @param {string} dateStr - 日期字符串，格式 YYYY-MM-DD 或 YYYY
 * @returns {number|null}
 */
function extYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 条件计数 - 统计数组中满足条件的元素个数
 * @param {Array} arr - 数组
 * @param {string} field - 要比较的字段名
 * @param {string} operator - 比较操作符 ('>=', '>', '<=', '<', '==', '!=')
 * @param {number} threshold - 阈值
 * @returns {number}
 */
function extCountIf(arr, field, operator, threshold) {
  if (!Array.isArray(arr)) return 0;
  if (threshold === null || threshold === undefined) return 0;

  const thresholdNum = Number(threshold);
  if (isNaN(thresholdNum)) return 0;

  const operators = {
    '>=': (a, b) => a >= b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '<': (a, b) => a < b,
    '==': (a, b) => a === b,
    '!=': (a, b) => a !== b
  };

  const compareFn = operators[operator];
  if (!compareFn) return 0;

  return arr.filter(item => {
    const value = item[field];
    if (value === null || value === undefined || isNaN(value)) return false;
    return compareFn(Number(value), thresholdNum);
  }).length;
}

/**
 * 数组字段求和
 * @param {Array} arr - 数组
 * @param {string} field - 要求和的字段名
 * @returns {number}
 */
function extSumArray(arr, field) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((sum, item) => {
    const value = field ? item[field] : item;
    const num = Number(value);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}

/**
 * 评估子表达式（支持变量替换和基本运算）
 * @param {string} expr - 表达式字符串
 * @param {Object} context - 上下文，包含变量值
 * @returns {*} 计算结果
 */
function evaluateSubExpression(expr, context) {
  if (expr === null || expr === undefined) return null;

  const trimmed = String(expr).trim();

  // 如果是带引号的字符串，去掉引号返回
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // 如果是纯数字，直接返回
  if (!isNaN(trimmed) && trimmed !== '') {
    return Number(trimmed);
  }

  // 如果是变量引用
  if (context[trimmed] !== undefined) {
    return context[trimmed];
  }

  // 尝试计算表达式
  let result = trimmed;
  const varNames = Object.keys(context).sort((a, b) => b.length - a.length);
  for (const varName of varNames) {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    const value = context[varName];
    if (typeof value === 'string') {
      result = result.replace(regex, `'${value}'`);
    } else if (value === null || value === undefined) {
      result = result.replace(regex, 'null');
    } else {
      result = result.replace(regex, String(value));
    }
  }

  try {
    // 只允许安全的表达式
    if (/^[\d\s+\-*/%().null]+$/.test(result)) {
      return new Function(`return (${result})`)();
    }
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * 评估布尔表达式
 * @param {string} expr - 布尔表达式
 * @param {Object} context - 上下文
 * @returns {boolean}
 */
function evaluateBooleanExpression(expr, context) {
  let result = String(expr).trim();

  // 替换变量（从长到短排序）
  const varNames = Object.keys(context).sort((a, b) => b.length - a.length);
  for (const varName of varNames) {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    const value = context[varName];
    if (typeof value === 'string') {
      result = result.replace(regex, `'${value}'`);
    } else if (value === null || value === undefined) {
      result = result.replace(regex, 'null');
    } else {
      result = result.replace(regex, String(value));
    }
  }

  // 处理比较操作符
  result = result.replace(/(?<![=!<>])={2}(?!=)/g, '===');
  result = result.replace(/!=(?!=)/g, '!==');

  try {
    return Boolean(new Function(`return (${result})`)());
  } catch (e) {
    console.warn('Boolean expression evaluation error:', expr, e.message);
    return false;
  }
}

/**
 * 解析嵌套的IF语句，正确处理平衡括号
 * @param {string} formula - 公式字符串
 * @param {number} startIndex - IF开始位置的索引
 * @returns {Object|null} { fullMatch, condition, trueExpr, falseExpr, endIndex } 或 null
 */
function parseNestedIf(formula, startIndex) {
  // 确保从IF(开始
  if (formula.substring(startIndex, startIndex + 3) !== 'IF(') {
    return null;
  }

  let depth = 0;
  let partStart = startIndex + 3; // IF( 之后
  let parts = [];
  let i = startIndex + 2; // 指向 '('

  for (; i < formula.length; i++) {
    const char = formula[i];

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        // 找到匹配的结束括号
        parts.push(formula.substring(partStart, i).trim());
        break;
      }
    } else if (char === ',' && depth === 1) {
      // 顶层逗号，分隔参数
      parts.push(formula.substring(partStart, i).trim());
      partStart = i + 1;
    }
  }

  if (parts.length !== 3) {
    return null;
  }

  return {
    fullMatch: formula.substring(startIndex, i + 1),
    condition: parts[0],
    trueExpr: parts[1],
    falseExpr: parts[2],
    endIndex: i
  };
}

/**
 * 解析并执行扩展函数
 * @param {string} formula - 公式字符串
 * @param {Object} context - 上下文（包含要素值和数组数据）
 * @returns {string|number|boolean} 处理后的表达式或最终结果
 */
function parseExtendedFunctions(formula, context) {
  let result = formula;
  let changed = true;
  let iterations = 0;
  const maxIterations = 20; // 防止无限循环

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 解析 CEIL(expr)
    const ceilMatch = result.match(/CEIL\(([^()]+)\)/);
    if (ceilMatch) {
      const value = evaluateSubExpression(ceilMatch[1], context);
      const ceilResult = extCeil(value);
      result = result.replace(ceilMatch[0], ceilResult === null ? 'null' : String(ceilResult));
      changed = true;
      continue;
    }

    // 解析 FLOOR(expr)
    const floorMatch = result.match(/FLOOR\(([^()]+)\)/);
    if (floorMatch) {
      const value = evaluateSubExpression(floorMatch[1], context);
      const floorResult = extFloor(value);
      result = result.replace(floorMatch[0], floorResult === null ? 'null' : String(floorResult));
      changed = true;
      continue;
    }

    // 解析 LEN(arrayCode)
    const lenMatch = result.match(/LEN\(([^()]+)\)/);
    if (lenMatch) {
      const arrayCode = lenMatch[1].trim();
      const arr = context[arrayCode];
      const lenResult = extLen(arr);
      result = result.replace(lenMatch[0], String(lenResult));
      changed = true;
      continue;
    }

    // 解析 YEAR(dateCode)
    const yearMatch = result.match(/YEAR\(([^()]+)\)/);
    if (yearMatch) {
      const dateCode = yearMatch[1].trim();
      const dateStr = context[dateCode];
      const yearResult = extYear(dateStr);
      result = result.replace(yearMatch[0], yearResult === null ? 'null' : String(yearResult));
      changed = true;
      continue;
    }

    // 解析 COUNT_IF(arrayCode, 'field', 'operator', threshold)
    const countIfMatch = result.match(/COUNT_IF\(\s*([^,]+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([^)]+)\s*\)/);
    if (countIfMatch) {
      const arrayCode = countIfMatch[1].trim();
      const field = countIfMatch[2];
      const operator = countIfMatch[3];
      const thresholdExpr = countIfMatch[4].trim();

      const arr = context[arrayCode];
      const threshold = evaluateSubExpression(thresholdExpr, context);
      const countResult = extCountIf(arr, field, operator, threshold);
      result = result.replace(countIfMatch[0], String(countResult));
      changed = true;
      continue;
    }

    // 解析 SUM_ARRAY(arrayCode, 'field')
    const sumArrayMatch = result.match(/SUM_ARRAY\(\s*([^,]+)\s*,\s*'([^']+)'\s*\)/);
    if (sumArrayMatch) {
      const arrayCode = sumArrayMatch[1].trim();
      const field = sumArrayMatch[2];
      const arr = context[arrayCode];
      const sumResult = extSumArray(arr, field);
      result = result.replace(sumArrayMatch[0], String(sumResult));
      changed = true;
      continue;
    }

    // 解析 IF(condition, trueValue, falseValue) - 使用平衡括号解析器处理嵌套
    const ifIndex = result.indexOf('IF(');
    if (ifIndex !== -1) {
      const ifParsed = parseNestedIf(result, ifIndex);
      if (ifParsed) {
        const { fullMatch, condition: condExpr, trueExpr, falseExpr } = ifParsed;

        // 先递归处理嵌套的IF（如果存在）
        let resolvedTrueExpr = trueExpr;
        let resolvedFalseExpr = falseExpr;

        if (trueExpr.includes('IF(')) {
          resolvedTrueExpr = parseExtendedFunctions(trueExpr, context);
        }
        if (falseExpr.includes('IF(')) {
          resolvedFalseExpr = parseExtendedFunctions(falseExpr, context);
        }

        const condition = evaluateBooleanExpression(condExpr, context);
        const resultValue = condition
          ? evaluateSubExpression(resolvedTrueExpr, context)
          : evaluateSubExpression(resolvedFalseExpr, context);

        result = result.replace(fullMatch, resultValue === null ? 'null' : String(resultValue));
        changed = true;
        continue;
      }
    }
  }

  return result;
}

/**
 * 计算扩展公式（支持扩展函数）
 * @param {string} formula - 公式字符串
 * @param {Object} context - 上下文（包含变量值和数组数据）
 * @returns {number|boolean|null} 计算结果
 */
function calculateExtendedFormula(formula, context) {
  // 先解析扩展函数
  let processedFormula = parseExtendedFunctions(formula, context);

  // 处理逻辑运算符
  processedFormula = processedFormula.replace(/\bOR\b/gi, '||').replace(/\bAND\b/gi, '&&');

  // 替换剩余变量
  const varNames = Object.keys(context).sort((a, b) => b.length - a.length);
  for (const varName of varNames) {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    const value = context[varName];
    if (typeof value === 'string') {
      processedFormula = processedFormula.replace(regex, `'${value}'`);
    } else if (value === null || value === undefined) {
      processedFormula = processedFormula.replace(regex, 'null');
    } else if (typeof value !== 'object') { // 排除数组等对象类型
      processedFormula = processedFormula.replace(regex, String(value));
    }
  }

  // 处理比较操作符
  processedFormula = processedFormula.replace(/(?<![=!<>])={2}(?!=)/g, '===');
  processedFormula = processedFormula.replace(/!=(?!=)/g, '!==');

  try {
    const fn = new Function(`return (${processedFormula})`);
    const result = fn();

    // 处理布尔结果
    if (typeof result === 'boolean') {
      return result;
    }

    // 处理数值结果
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }

    // 处理 null
    if (result === null) {
      return null;
    }

    return null;
  } catch (error) {
    console.warn(`[扩展公式计算] 计算失败: ${processedFormula}`, error.message);
    return null;
  }
}

/**
 * 聚合函数类型
 */
const AGGREGATE_FUNCTIONS = {
  SUM: 'SUM',
  AVG: 'AVG',
  COUNT: 'COUNT',
  MIN: 'MIN',
  MAX: 'MAX',
  STDDEV: 'STDDEV',
  CV: 'CV'         // 差异系数
};

/**
 * 计算SUM
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function sum(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => Number(a) + Number(b), 0);
}

/**
 * 计算AVG
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function avg(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  const total = valid.reduce((a, b) => Number(a) + Number(b), 0);
  return total / valid.length;
}

/**
 * 计算COUNT
 * @param {any[]} values - 值数组
 * @param {object} options - 选项 { countNull: false }
 * @returns {number}
 */
function count(values, options = {}) {
  if (options.countNull) {
    return values.length;
  }
  return values.filter(v => v !== null && v !== undefined).length;
}

/**
 * 计算MIN
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function min(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

/**
 * 计算MAX
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function max(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

/**
 * 计算标准差
 * @param {number[]} values - 数值数组
 * @param {boolean} population - 是否是总体标准差
 * @returns {number|null}
 */
function stddev(values, population = true) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (valid.length === 0) return null;

  const n = valid.length;
  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const squaredDiffs = valid.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / (population ? n : n - 1);

  return Math.sqrt(avgSquaredDiff);
}

/**
 * 计算差异系数 (Coefficient of Variation)
 * @param {number[]} values - 数值数组
 * @returns {object|null} { cv, mean, stdDev, count }
 */
function cv(values) {
  return calculateCV(values);
}

/**
 * 执行聚合函数
 * @param {string} func - 函数名
 * @param {number[]} values - 数值数组
 * @param {object} options - 选项
 * @returns {any} 计算结果
 */
function executeAggregateFunction(func, values, options = {}) {
  switch (func.toUpperCase()) {
    case AGGREGATE_FUNCTIONS.SUM:
      return sum(values);
    case AGGREGATE_FUNCTIONS.AVG:
      return avg(values);
    case AGGREGATE_FUNCTIONS.COUNT:
      return count(values, options);
    case AGGREGATE_FUNCTIONS.MIN:
      return min(values);
    case AGGREGATE_FUNCTIONS.MAX:
      return max(values);
    case AGGREGATE_FUNCTIONS.STDDEV:
      return stddev(values, options.population !== false);
    case AGGREGATE_FUNCTIONS.CV:
      return cv(values);
    default:
      console.warn(`Unknown aggregate function: ${func}`);
      return null;
  }
}

/**
 * 按分组计算聚合
 * @param {Array} data - 数据数组
 * @param {object} config - 配置 { valueField, groupBy, function, filter }
 * @returns {object} 分组结果
 */
function aggregateByGroup(data, config) {
  const { valueField, groupBy = [], aggregateFunction, filter } = config;

  // 应用过滤条件
  let filteredData = data;
  if (filter && typeof filter === 'function') {
    filteredData = data.filter(filter);
  }

  // 如果没有分组，直接计算整体
  if (!groupBy || groupBy.length === 0) {
    const values = filteredData.map(d => d[valueField]);
    return {
      _all: {
        value: executeAggregateFunction(aggregateFunction, values),
        count: filteredData.length
      }
    };
  }

  // 按分组键聚合
  const groups = {};

  for (const item of filteredData) {
    // 构建分组键
    const keyParts = groupBy.map(field => item[field] ?? 'null');
    const key = keyParts.join('|');

    if (!groups[key]) {
      groups[key] = {
        groupValues: {},
        values: []
      };
      groupBy.forEach((field, i) => {
        groups[key].groupValues[field] = keyParts[i];
      });
    }

    groups[key].values.push(item[valueField]);
  }

  // 计算每组的聚合值
  const result = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = {
      ...group.groupValues,
      value: executeAggregateFunction(aggregateFunction, group.values),
      count: group.values.length
    };
  }

  return result;
}

/**
 * 计算区县级指标达标率
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {object} options - 选项
 * @returns {object} 达标率统计
 */
function calculateDistrictComplianceRate(db, projectId, districtId, options = {}) {
  const { indicatorId, schoolType } = options;

  let query = `
    SELECT
      cr.indicator_id,
      di.code as indicatorCode,
      di.name as indicatorName,
      COUNT(*) as total,
      SUM(CASE WHEN cr.is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
      SUM(CASE WHEN cr.is_compliant = 0 THEN 1 ELSE 0 END) as nonCompliant
    FROM compliance_results cr
    JOIN schools s ON cr.entity_id = s.id AND cr.entity_type = 'school'
    LEFT JOIN data_indicators di ON cr.indicator_id = di.id
    WHERE cr.project_id = ? AND s.district_id = ?
  `;
  const params = [projectId, districtId];

  if (indicatorId) {
    query += ' AND cr.indicator_id = ?';
    params.push(indicatorId);
  }

  if (schoolType) {
    query += ' AND s.school_type = ?';
    params.push(schoolType);
  }

  query += ' GROUP BY cr.indicator_id';

  try {
    const results = db.prepare(query).all(...params);

    const indicators = results.map(r => ({
      indicatorId: r.indicator_id,
      indicatorCode: r.indicatorCode,
      indicatorName: r.indicatorName,
      total: r.total,
      compliant: r.compliant,
      nonCompliant: r.nonCompliant,
      complianceRate: r.total > 0
        ? Math.round((r.compliant / r.total) * 10000) / 100
        : null
    }));

    // 汇总
    const summary = {
      totalIndicators: indicators.length,
      totalEvaluations: indicators.reduce((sum, i) => sum + i.total, 0),
      totalCompliant: indicators.reduce((sum, i) => sum + i.compliant, 0),
      totalNonCompliant: indicators.reduce((sum, i) => sum + i.nonCompliant, 0)
    };
    summary.overallComplianceRate = summary.totalEvaluations > 0
      ? Math.round((summary.totalCompliant / summary.totalEvaluations) * 10000) / 100
      : null;

    return {
      districtId,
      summary,
      indicators
    };
  } catch (e) {
    console.error('Calculate district compliance rate error:', e);
    return null;
  }
}

/**
 * 计算区县级差异系数
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {string} indicatorId - 数据指标ID
 * @param {object} options - 选项
 * @returns {object} 差异系数结果
 */
function calculateDistrictCV(db, projectId, districtId, indicatorId, options = {}) {
  const { schoolType } = options;

  let query = `
    SELECT
      sid.value,
      s.id as schoolId,
      s.name as schoolName,
      s.school_type as schoolType
    FROM school_indicator_data sid
    JOIN schools s ON sid.school_id = s.id
    WHERE sid.project_id = ? AND s.district_id = ? AND sid.data_indicator_id = ?
    AND sid.value IS NOT NULL
  `;
  const params = [projectId, districtId, indicatorId];

  if (schoolType) {
    if (schoolType === '小学') {
      query += " AND (s.school_type = '小学' OR s.school_type = '九年一贯制')";
    } else if (schoolType === '初中') {
      query += " AND (s.school_type = '初中' OR s.school_type = '九年一贯制' OR s.school_type = '完全中学')";
    } else {
      query += ' AND s.school_type = ?';
      params.push(schoolType);
    }
  }

  try {
    const rows = db.prepare(query).all(...params);
    const values = rows.map(r => Number(r.value)).filter(v => !isNaN(v));

    if (values.length === 0) {
      return {
        districtId,
        indicatorId,
        schoolCount: 0,
        cv: null,
        mean: null,
        stdDev: null,
        isCompliant: null,
        threshold: options.cvThreshold || 0.65
      };
    }

    const cvResult = calculateCV(values);
    const threshold = options.cvThreshold || 0.65;

    return {
      districtId,
      indicatorId,
      schoolCount: values.length,
      cv: cvResult?.cv,
      mean: cvResult?.mean,
      stdDev: cvResult?.stdDev,
      isCompliant: cvResult?.cv !== null ? cvResult.cv <= threshold : null,
      threshold,
      schools: rows.map(r => ({
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        value: Number(r.value)
      }))
    };
  } catch (e) {
    console.error('Calculate district CV error:', e);
    return null;
  }
}

/**
 * 计算综合差异系数
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {string[]} indicatorIds - 数据指标ID数组
 * @param {object} options - 选项
 * @returns {object} 综合差异系数结果
 */
function calculateCompositeCV(db, projectId, districtId, indicatorIds, options = {}) {
  const { schoolType } = options;

  const indicatorResults = [];
  let validCvCount = 0;
  let cvSum = 0;

  for (const indicatorId of indicatorIds) {
    const result = calculateDistrictCV(db, projectId, districtId, indicatorId, {
      schoolType,
      cvThreshold: 0.65
    });

    if (result) {
      indicatorResults.push(result);
      if (result.cv !== null) {
        cvSum += result.cv;
        validCvCount++;
      }
    }
  }

  // 综合差异系数 = 各指标差异系数的平均值
  const compositeCV = validCvCount > 0 ? cvSum / validCvCount : null;

  // 综合差异系数阈值
  const threshold = schoolType === '小学' ? 0.50 : (schoolType === '初中' ? 0.45 : 0.50);

  return {
    districtId,
    schoolType,
    indicatorCount: indicatorIds.length,
    validIndicatorCount: validCvCount,
    compositeCV: compositeCV !== null ? Math.round(compositeCV * 10000) / 10000 : null,
    threshold,
    isCompliant: compositeCV !== null ? compositeCV <= threshold : null,
    indicators: indicatorResults
  };
}

/**
 * 执行聚合规则
 * @param {object} db - 数据库实例
 * @param {object} rule - 规则对象
 * @param {object} context - 上下文 { projectId, districtId, schoolType }
 * @returns {object} 聚合结果
 */
function executeAggregationRule(db, rule, context) {
  const { projectId, districtId, schoolType, entityType = 'school' } = context;

  // 解析规则配置
  const actions = rule.actions || [];
  const results = [];

  for (const action of actions) {
    if (action.actionType !== 'aggregate') continue;

    const config = typeof action.config === 'string'
      ? JSON.parse(action.config)
      : action.config;

    const aggConfig = config.aggregation;
    if (!aggConfig) continue;

    const { function: aggFunc, groupBy, valueField, filter: filterConfig } = aggConfig;

    // 构建数据查询
    let query = '';
    const params = [];

    if (entityType === 'school') {
      query = `
        SELECT
          sid.value,
          s.id as schoolId,
          s.name as schoolName,
          s.school_type as schoolType,
          s.district_id as districtId
        FROM school_indicator_data sid
        JOIN schools s ON sid.school_id = s.id
        WHERE sid.project_id = ?
      `;
      params.push(projectId);

      if (districtId) {
        query += ' AND s.district_id = ?';
        params.push(districtId);
      }

      if (rule.indicatorId) {
        query += ' AND sid.data_indicator_id = ?';
        params.push(rule.indicatorId);
      }

      if (schoolType) {
        query += ' AND s.school_type = ?';
        params.push(schoolType);
      }

      query += ' AND sid.value IS NOT NULL';
    }

    try {
      const rows = db.prepare(query).all(...params);

      // 执行聚合
      const aggregated = aggregateByGroup(rows, {
        valueField: 'value',
        groupBy: groupBy || [],
        aggregateFunction: aggFunc
      });

      results.push({
        ruleId: rule.id,
        actionId: action.id,
        function: aggFunc,
        groupBy,
        result: aggregated
      });
    } catch (e) {
      console.error('Execute aggregation rule error:', e);
      results.push({
        ruleId: rule.id,
        actionId: action.id,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * 生成区县统计报表数据
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @returns {object} 报表数据
 */
function generateDistrictReport(db, projectId, districtId) {
  // 获取区县信息
  const district = db.prepare('SELECT id, name, code FROM districts WHERE id = ?').get(districtId);
  if (!district) return null;

  // 获取学校统计
  const schoolStats = db.prepare(`
    SELECT
      school_type as schoolType,
      COUNT(*) as count,
      SUM(student_count) as studentCount,
      SUM(teacher_count) as teacherCount
    FROM schools
    WHERE district_id = ? AND status = 'active'
    GROUP BY school_type
  `).all(districtId);

  // 小学和初中的差异系数
  const primaryCV = calculateCompositeCV(db, projectId, districtId, [], { schoolType: '小学' });
  const middleCV = calculateCompositeCV(db, projectId, districtId, [], { schoolType: '初中' });

  // 达标率
  const complianceRate = calculateDistrictComplianceRate(db, projectId, districtId);

  return {
    district,
    generatedAt: new Date().toISOString(),
    projectId,
    schoolStats,
    primarySchool: {
      cv: primaryCV,
      cvThreshold: 0.50
    },
    middleSchool: {
      cv: middleCV,
      cvThreshold: 0.45
    },
    complianceRate
  };
}

/**
 * 解析公式中的变量（要素编码）
 * @param {string} formula - 公式字符串
 * @returns {string[]} 变量列表
 */
function parseFormulaVariables(formula) {
  if (!formula) return [];

  const variables = new Set();

  // 匹配字母开头的标识符（如 E001, E002, D001）
  const identifierPattern = /\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  let match;
  while ((match = identifierPattern.exec(formula)) !== null) {
    const identifier = match[1];
    // 排除数学关键字和扩展函数关键字
    if (!['Math', 'PI'].includes(identifier) &&
        !EXTENDED_FUNCTION_KEYWORDS.includes(identifier.toUpperCase())) {
      variables.add(identifier);
    }
  }

  return Array.from(variables);
}

/**
 * 安全计算数学表达式
 * @param {string} expression - 表达式字符串
 * @returns {number} 计算结果
 */
function safeEvaluate(expression) {
  // 移除空格
  expression = expression.replace(/\s+/g, '');

  // 验证表达式只包含数字、运算符和括号
  if (!/^[\d+\-*/%().]+$/.test(expression)) {
    throw new Error('表达式包含非法字符');
  }

  try {
    const fn = new Function(`return (${expression})`);
    const result = fn();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('计算结果无效');
    }

    return result;
  } catch (error) {
    throw new Error(`表达式计算错误: ${error.message}`);
  }
}

/**
 * 计算公式结果
 * @param {string} formula - 公式字符串
 * @param {Object} values - 变量值映射
 * @returns {number} 计算结果
 */
function calculateFormula(formula, values) {
  if (!formula) {
    throw new Error('公式不能为空');
  }

  // 替换变量（从长到短排序，避免部分替换）
  let expression = formula;
  const varNames = Object.keys(values).sort((a, b) => b.length - a.length);
  for (const varName of varNames) {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    expression = expression.replace(regex, String(values[varName]));
  }

  return safeEvaluate(expression);
}

/**
 * 计算单个样本的派生要素值（支持扩展公式）
 * @param {string} elementCode - 要素编码
 * @param {Array} elements - 所有要素定义
 * @param {Object} sampleData - 单个样本的填报数据
 * @param {Map} calculatedCache - 已计算的要素值缓存
 * @returns {number|boolean|null} 计算结果
 */
function calculateDerivedValueForSample(elementCode, elements, sampleData, calculatedCache = new Map()) {
  // 如果已经计算过，直接返回缓存
  if (calculatedCache.has(elementCode)) {
    return calculatedCache.get(elementCode);
  }

  const element = elements.find(e => e.code === elementCode);
  if (!element) {
    console.warn(`[派生计算] 未找到要素: ${elementCode}`);
    return null;
  }

  const elementType = element.element_type || element.elementType;
  const dataType = element.data_type || element.dataType;

  // 基础要素：直接从填报数据中获取
  if (elementType === '基础要素') {
    const fieldId = element.field_id || element.fieldId;
    if (!fieldId) {
      console.warn(`[派生计算] 基础要素 ${elementCode} 没有关联字段`);
      return null;
    }
    const value = sampleData[fieldId];

    // 数组类型：直接返回数组
    if (dataType === '数组') {
      calculatedCache.set(elementCode, value || []);
      return value || [];
    }

    // 日期类型：返回字符串
    if (dataType === '日期') {
      calculatedCache.set(elementCode, value || null);
      return value || null;
    }

    // 逻辑类型：返回字符串值（如 'yes'/'no'）
    if (dataType === '逻辑') {
      calculatedCache.set(elementCode, value || null);
      return value || null;
    }

    // 数字类型
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return null;
    }
    calculatedCache.set(elementCode, numValue);
    return numValue;
  }

  // 派生要素：通过公式计算
  if (elementType === '派生要素') {
    if (!element.formula) {
      console.warn(`[派生计算] 派生要素 ${elementCode} 没有公式`);
      return null;
    }

    // 解析公式中引用的要素
    const referencedCodes = parseFormulaVariables(element.formula);
    const context = {};

    // 递归计算每个引用的要素
    for (const refCode of referencedCodes) {
      const refValue = calculateDerivedValueForSample(refCode, elements, sampleData, calculatedCache);
      // 允许 null 值参与计算（由公式决定如何处理）
      context[refCode] = refValue;
    }

    // 检查公式是否包含扩展函数
    const hasExtendedFunction = EXTENDED_FUNCTION_KEYWORDS.some(keyword =>
      element.formula.toUpperCase().includes(keyword)
    );

    // 计算公式
    try {
      let result;
      if (hasExtendedFunction) {
        // 使用扩展公式计算
        result = calculateExtendedFormula(element.formula, context);
      } else {
        // 使用传统公式计算（要求所有值非空）
        const hasNullValue = Object.values(context).some(v => v === null || v === undefined);
        if (hasNullValue) {
          return null;
        }
        result = calculateFormula(element.formula, context);
      }
      calculatedCache.set(elementCode, result);
      return result;
    } catch (error) {
      console.warn(`[派生计算] 计算公式失败: ${element.formula}`, error.message);
      return null;
    }
  }

  return null;
}

/**
 * 计算派生要素的聚合值（多样本聚合）
 *
 * 计算流程：
 * 1. 对每个填报样本，计算派生公式得到该样本的派生值
 * 2. 收集所有样本的派生值
 * 3. 对派生值列表执行聚合计算（如差异系数 CV）
 *
 * @param {Object} db - 数据库实例
 * @param {Object} derivedElement - 派生要素定义
 * @param {Array} allElements - 所有要素定义
 * @param {Array} submissions - 所有填报数据
 * @param {Object} options - 选项
 * @returns {Object} 聚合计算结果
 */
function calculateDerivedElementAggregation(db, derivedElement, allElements, submissions, options = {}) {
  const { code, name, formula, aggregation } = derivedElement;
  const elementType = derivedElement.element_type || derivedElement.elementType;

  // 验证参数
  if (elementType !== '派生要素') {
    throw new Error(`要素 ${code} 不是派生要素`);
  }
  if (!formula) {
    throw new Error(`派生要素 ${code} 没有计算公式`);
  }

  const aggConfig = typeof aggregation === 'string' ? JSON.parse(aggregation) : aggregation;
  if (!aggConfig?.enabled) {
    throw new Error(`派生要素 ${code} 没有启用聚合`);
  }

  // 1. 应用聚合范围过滤
  let filteredSubmissions = submissions;
  if (aggConfig.scope && aggConfig.scope.level === 'custom' && aggConfig.scope.filter) {
    const { field, operator, value } = aggConfig.scope.filter;
    filteredSubmissions = submissions.filter(s => {
      const fieldValue = s.data?.[field] ?? s[field];
      if (fieldValue === undefined || fieldValue === null) return false;

      switch (operator) {
        case 'eq': return fieldValue === value;
        case 'ne': return fieldValue !== value;
        case 'gt': return Number(fieldValue) > Number(value);
        case 'lt': return Number(fieldValue) < Number(value);
        case 'gte': return Number(fieldValue) >= Number(value);
        case 'lte': return Number(fieldValue) <= Number(value);
        case 'in': return Array.isArray(value) && value.includes(fieldValue);
        default: return true;
      }
    });
  }

  // 2. 为每个样本计算派生值
  const derivedValues = [];
  const sampleDetails = [];

  for (const submission of filteredSubmissions) {
    const sampleData = submission.data || submission;
    const calculatedCache = new Map();
    const value = calculateDerivedValueForSample(code, allElements, sampleData, calculatedCache);

    if (value !== null && !isNaN(value) && isFinite(value)) {
      derivedValues.push(value);
      sampleDetails.push({
        sampleId: submission.school_id || submission.sampleId,
        sampleName: submission.school_name || submission.sampleName,
        value,
      });
    }
  }

  // 3. 执行聚合计算
  const aggregatedValue = executeAggregateFunction(aggConfig.method.toUpperCase(), derivedValues);

  // 4. 生成范围描述
  let scopeDesc = '全部样本';
  if (aggConfig.scope && aggConfig.scope.level !== 'all' && aggConfig.scope.filter) {
    scopeDesc = `${aggConfig.scope.filter.field} ${aggConfig.scope.filter.operator} ${aggConfig.scope.filter.value}`;
  }

  return {
    elementCode: code,
    elementName: name,
    value: aggConfig.method === 'cv' && aggregatedValue?.cv !== undefined ? aggregatedValue.cv : aggregatedValue,
    method: aggConfig.method,
    details: {
      sampleCount: derivedValues.length,
      rawValues: derivedValues,
      scope: scopeDesc,
      samples: sampleDetails,
    },
  };
}

/**
 * 批量计算要素聚合值（支持基础要素和派生要素）
 * @param {Object} db - 数据库实例
 * @param {Array} elements - 要素列表
 * @param {Array} submissions - 所有填报数据
 * @param {Object} options - 选项
 * @returns {Map} 要素编码到聚合结果的映射
 */
function calculateAllElementsAggregation(db, elements, submissions, options = {}) {
  const results = new Map();

  for (const element of elements) {
    const aggConfig = typeof element.aggregation === 'string'
      ? JSON.parse(element.aggregation)
      : element.aggregation;

    // 只处理启用了聚合的要素
    if (!aggConfig?.enabled) {
      continue;
    }

    const elementType = element.element_type || element.elementType;

    try {
      if (elementType === '基础要素') {
        // 基础要素聚合
        const fieldId = element.field_id || element.fieldId;
        const toolId = element.tool_id || element.toolId;
        if (!fieldId || !toolId) {
          continue;
        }

        // 筛选该工具的填报数据
        let relevantSubmissions = submissions.filter(s => s.tool_id === toolId || s.toolId === toolId);
        
        // 应用聚合范围过滤
        if (aggConfig.scope && aggConfig.scope.level === 'custom' && aggConfig.scope.filter) {
          const { field, operator, value } = aggConfig.scope.filter;
          relevantSubmissions = relevantSubmissions.filter(s => {
            const fieldValue = s.data?.[field] ?? s[field];
            if (fieldValue === undefined || fieldValue === null) return false;

            switch (operator) {
              case 'eq': return fieldValue === value;
              case 'ne': return fieldValue !== value;
              case 'gt': return Number(fieldValue) > Number(value);
              case 'lt': return Number(fieldValue) < Number(value);
              case 'gte': return Number(fieldValue) >= Number(value);
              case 'lte': return Number(fieldValue) <= Number(value);
              case 'in': return Array.isArray(value) && value.includes(fieldValue);
              default: return true;
            }
          });
        }
        
        const values = relevantSubmissions
          .map(s => {
            const data = s.data || s;
            const v = data[fieldId];
            return v !== undefined && v !== null && v !== '' ? Number(v) : NaN;
          })
          .filter(v => !isNaN(v));

        const aggregatedValue = executeAggregateFunction(aggConfig.method.toUpperCase(), values);

        results.set(element.code, {
          elementCode: element.code,
          elementName: element.name,
          value: aggConfig.method === 'cv' && aggregatedValue?.cv !== undefined ? aggregatedValue.cv : aggregatedValue,
          method: aggConfig.method,
          details: {
            sampleCount: values.length,
            rawValues: values,
          },
        });
      } else if (elementType === '派生要素') {
        // 派生要素聚合
        if (!element.formula) {
          continue;
        }
        const result = calculateDerivedElementAggregation(db, element, elements, submissions, options);
        results.set(element.code, result);
      }
    } catch (error) {
      console.error(`[聚合计算] 要素 ${element.code} 计算失败:`, error);
    }
  }

  return results;
}

module.exports = {
  AGGREGATE_FUNCTIONS,
  sum,
  avg,
  count,
  min,
  max,
  stddev,
  cv,
  executeAggregateFunction,
  aggregateByGroup,
  calculateDistrictComplianceRate,
  calculateDistrictCV,
  calculateCompositeCV,
  executeAggregationRule,
  generateDistrictReport,
  // 派生要素聚合支持
  parseFormulaVariables,
  calculateFormula,
  calculateDerivedValueForSample,
  calculateDerivedElementAggregation,
  calculateAllElementsAggregation,
  // 扩展公式函数
  EXTENDED_FUNCTION_KEYWORDS,
  calculateExtendedFormula,
  extCeil,
  extFloor,
  extLen,
  extYear,
  extCountIf,
  extSumArray,
};
