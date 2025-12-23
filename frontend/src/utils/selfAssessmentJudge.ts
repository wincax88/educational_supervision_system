/**
 * 自评结论自动判定工具
 * 用于学前教育普及普惠督导评估自评表的自动判定
 */

// 自评结论类型
export type ConclusionType = '合格' | '基本合格' | '不合格' | null;

// 数据指标接口
export interface DataIndicator {
  id: string;
  code: string;
  name: string;
  dataType: '数字' | '逻辑' | '文本';
  unit?: string;
  threshold: string;
  thresholdType: 'single' | 'tiered';
  precision?: number;
  actualValue: number | string | boolean | null;
  description?: string;
}

// 叶子节点（二级指标）接口
export interface LeafIndicator {
  id: string;
  code: string;
  name: string;
  description: string;
  level: number;
  isLeaf: boolean;
  dataIndicators: DataIndicator[];
  selfAssessment: {
    description: string;
    conclusion: ConclusionType;
  };
}

// 阈值解析结果
interface ParsedThreshold {
  operator: '>=' | '>' | '<=' | '<' | '=' | 'range';
  value?: number;
  minValue?: number;
  maxValue?: number;
  isPercentage: boolean;
}

/**
 * 解析阈值字符串
 * 支持格式: ">= 85%", "= 100%", "> 0", "= 0", "80-100%"
 * @param threshold 阈值字符串
 * @returns 解析后的阈值配置
 */
export function parseThresholdString(threshold: string): ParsedThreshold | null {
  if (!threshold || typeof threshold !== 'string') {
    return null;
  }

  const normalizedThreshold = threshold.trim();
  const isPercentage = normalizedThreshold.includes('%');

  // 移除百分号用于数值解析
  const cleanThreshold = normalizedThreshold.replace(/%/g, '').trim();

  // 支持的操作符（从长到短排序以正确匹配）
  const operators = ['>=', '<=', '>', '<', '='];

  for (const op of operators) {
    if (cleanThreshold.startsWith(op)) {
      const valueStr = cleanThreshold.slice(op.length).trim();
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        return {
          operator: op as ParsedThreshold['operator'],
          value,
          isPercentage,
        };
      }
    }
  }

  // 尝试解析范围格式 (如 "80-100")
  if (cleanThreshold.includes('-') && !cleanThreshold.startsWith('-')) {
    const parts = cleanThreshold.split('-');
    if (parts.length === 2) {
      const min = parseFloat(parts[0].trim());
      const max = parseFloat(parts[1].trim());
      if (!isNaN(min) && !isNaN(max)) {
        return {
          operator: 'range',
          minValue: min,
          maxValue: max,
          isPercentage,
        };
      }
    }
  }

  // 尝试解析为纯数值（等于）
  const value = parseFloat(cleanThreshold);
  if (!isNaN(value)) {
    return {
      operator: '=',
      value,
      isPercentage,
    };
  }

  return null;
}

/**
 * 比较实际值与阈值
 * @param actualValue 实际值
 * @param parsedThreshold 解析后的阈值
 * @returns 是否满足阈值
 */
function compareWithThreshold(actualValue: number, parsedThreshold: ParsedThreshold): boolean {
  const { operator, value, minValue, maxValue } = parsedThreshold;

  switch (operator) {
    case '>=':
      return value !== undefined && actualValue >= value;
    case '>':
      return value !== undefined && actualValue > value;
    case '<=':
      return value !== undefined && actualValue <= value;
    case '<':
      return value !== undefined && actualValue < value;
    case '=':
      // 浮点数比较，允许小误差
      return value !== undefined && Math.abs(actualValue - value) < 0.0001;
    case 'range':
      return minValue !== undefined && maxValue !== undefined &&
             actualValue >= minValue && actualValue <= maxValue;
    default:
      return false;
  }
}

/**
 * 判定数字类型指标的结论
 * @param indicator 数据指标
 * @returns 判定结论
 */
function judgeNumericIndicator(indicator: DataIndicator): ConclusionType {
  const { actualValue, threshold, thresholdType } = indicator;

  // 检查实际值是否有效
  if (actualValue === null || actualValue === undefined || actualValue === '') {
    return null; // 无法判定
  }

  const numericValue = Number(actualValue);
  if (isNaN(numericValue)) {
    return null;
  }

  // 解析阈值
  const parsedThreshold = parseThresholdString(threshold);
  if (!parsedThreshold) {
    // 无法解析阈值，返回null
    console.warn(`[自评判定] 无法解析阈值: ${threshold}`);
    return null;
  }

  // 单一标准: 达标即合格，否则不合格
  if (thresholdType === 'single') {
    return compareWithThreshold(numericValue, parsedThreshold) ? '合格' : '不合格';
  }

  // 分级标准: 需要更复杂的逻辑
  // 目前简化处理：完全达标为合格，否则需要根据具体情况判断
  if (thresholdType === 'tiered') {
    // 对于分级标准，这里只能做基础判定
    // 完全达标 → 合格
    // 否则 → 需要人工判断是基本合格还是不合格
    return compareWithThreshold(numericValue, parsedThreshold) ? '合格' : null;
  }

  return null;
}

/**
 * 判定逻辑类型指标的结论
 * 逻辑类型通常需要人工判断，但可以根据选择值给出建议
 * @param indicator 数据指标
 * @returns 判定结论
 */
function judgeLogicIndicator(indicator: DataIndicator): ConclusionType {
  const { actualValue, thresholdType } = indicator;

  // 检查实际值
  if (actualValue === null || actualValue === undefined || actualValue === '') {
    return null;
  }

  // 逻辑类型的 actualValue 通常是 '合格', '基本合格', '不合格' 之一
  // 或者是 true/false, 'yes'/'no' 等
  const strValue = String(actualValue).trim();

  // 直接匹配结论值
  if (strValue === '合格' || strValue === 'qualified' || strValue === 'true' || strValue === 'yes') {
    return '合格';
  }
  if (strValue === '基本合格' || strValue === 'basically_qualified') {
    return '基本合格';
  }
  if (strValue === '不合格' || strValue === 'unqualified' || strValue === 'false' || strValue === 'no') {
    return '不合格';
  }

  // 对于分级标准，如果无法直接匹配，返回 null 让用户自行选择
  if (thresholdType === 'tiered') {
    return null;
  }

  return null;
}

/**
 * 根据数据指标自动判定自评结论
 * @param indicator 叶子节点指标
 * @returns 建议的自评结论
 */
export function suggestConclusion(indicator: LeafIndicator): ConclusionType {
  const { dataIndicators } = indicator;

  if (!dataIndicators || dataIndicators.length === 0) {
    return null;
  }

  // 收集所有数据指标的判定结果
  const conclusions: ConclusionType[] = [];

  for (const dataIndicator of dataIndicators) {
    let conclusion: ConclusionType = null;

    switch (dataIndicator.dataType) {
      case '数字':
        conclusion = judgeNumericIndicator(dataIndicator);
        break;
      case '逻辑':
        conclusion = judgeLogicIndicator(dataIndicator);
        break;
      case '文本':
        // 文本类型通常不能自动判定
        conclusion = null;
        break;
      default:
        conclusion = null;
    }

    conclusions.push(conclusion);
  }

  // 综合判定：
  // - 如果有任何一个指标是"不合格"，则整体"不合格"
  // - 如果所有指标都是"合格"，则整体"合格"
  // - 如果有"基本合格"，则整体"基本合格"
  // - 如果有无法判定的，返回 null

  const hasUnqualified = conclusions.includes('不合格');
  const hasBasicallyQualified = conclusions.includes('基本合格');
  const hasNull = conclusions.includes(null);
  const allQualified = conclusions.every(c => c === '合格');

  if (hasUnqualified) {
    return '不合格';
  }
  if (allQualified && !hasNull) {
    return '合格';
  }
  if (hasBasicallyQualified) {
    return '基本合格';
  }

  return null;
}

/**
 * 批量判定多个指标的结论
 * @param indicators 叶子节点指标列表
 * @returns 指标ID到结论的映射
 */
export function batchSuggestConclusions(indicators: LeafIndicator[]): Map<string, ConclusionType> {
  const results = new Map<string, ConclusionType>();

  for (const indicator of indicators) {
    const conclusion = suggestConclusion(indicator);
    results.set(indicator.id, conclusion);
  }

  return results;
}

/**
 * 生成自评说明文本建议
 * 根据指标的实际值和阈值生成说明文本
 * @param indicator 叶子节点指标
 * @returns 建议的自评说明文本
 */
export function generateAssessmentDescription(indicator: LeafIndicator): string {
  const { name, dataIndicators } = indicator;
  const parts: string[] = [];

  for (const dataIndicator of dataIndicators) {
    const { name: indicatorName, actualValue, threshold, unit, dataType } = dataIndicator;

    if (actualValue === null || actualValue === undefined || actualValue === '') {
      parts.push(`${indicatorName}: 暂无数据`);
      continue;
    }

    if (dataType === '数字') {
      const unitStr = unit || '';
      parts.push(`${indicatorName}为${actualValue}${unitStr}，标准要求${threshold}`);
    } else if (dataType === '逻辑') {
      const statusStr = actualValue === '合格' || actualValue === true || actualValue === 'yes'
        ? '已达标'
        : actualValue === '基本合格'
          ? '基本达标'
          : '未达标';
      parts.push(`${indicatorName}${statusStr}`);
    } else {
      parts.push(`${indicatorName}: ${actualValue}`);
    }
  }

  return parts.join('；') + '。';
}

/**
 * 更新指标的实际值并重新判定
 * @param indicator 叶子节点指标
 * @param dataIndicatorId 数据指标ID
 * @param newValue 新的实际值
 * @returns 更新后的指标（包含新的判定结果）
 */
export function updateIndicatorValue(
  indicator: LeafIndicator,
  dataIndicatorId: string,
  newValue: number | string | boolean | null
): LeafIndicator {
  // 深拷贝指标
  const updatedIndicator: LeafIndicator = JSON.parse(JSON.stringify(indicator));

  // 更新数据指标的实际值
  const targetDataIndicator = updatedIndicator.dataIndicators.find(d => d.id === dataIndicatorId);
  if (targetDataIndicator) {
    targetDataIndicator.actualValue = newValue;
  }

  // 重新判定结论
  const suggestedConclusion = suggestConclusion(updatedIndicator);

  // 更新自评说明和结论
  updatedIndicator.selfAssessment = {
    description: generateAssessmentDescription(updatedIndicator),
    conclusion: suggestedConclusion,
  };

  return updatedIndicator;
}

/**
 * 计算指标完成情况统计
 * @param indicators 叶子节点指标列表
 * @returns 统计结果
 */
export function calculateCompletionStats(indicators: LeafIndicator[]): {
  total: number;
  qualified: number;
  basicallyQualified: number;
  unqualified: number;
  pending: number;
  qualifiedRate: number;
} {
  const stats = {
    total: indicators.length,
    qualified: 0,
    basicallyQualified: 0,
    unqualified: 0,
    pending: 0,
    qualifiedRate: 0,
  };

  for (const indicator of indicators) {
    const conclusion = indicator.selfAssessment?.conclusion;
    switch (conclusion) {
      case '合格':
        stats.qualified++;
        break;
      case '基本合格':
        stats.basicallyQualified++;
        break;
      case '不合格':
        stats.unqualified++;
        break;
      default:
        stats.pending++;
    }
  }

  // 计算合格率（合格 + 基本合格）
  const passedCount = stats.qualified + stats.basicallyQualified;
  stats.qualifiedRate = stats.total > 0
    ? Math.round((passedCount / stats.total) * 10000) / 100  // 保留两位小数
    : 0;

  return stats;
}

/**
 * 自评判定工具类
 */
export class SelfAssessmentJudge {
  /**
   * 解析阈值字符串
   */
  parseThreshold = parseThresholdString;

  /**
   * 建议结论
   */
  suggestConclusion = suggestConclusion;

  /**
   * 批量建议结论
   */
  batchSuggestConclusions = batchSuggestConclusions;

  /**
   * 生成自评说明
   */
  generateDescription = generateAssessmentDescription;

  /**
   * 更新指标值
   */
  updateValue = updateIndicatorValue;

  /**
   * 计算完成统计
   */
  calculateStats = calculateCompletionStats;
}

export default SelfAssessmentJudge;
