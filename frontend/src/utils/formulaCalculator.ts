/**
 * 公式计算器
 * 用于计算派生要素的值
 */

// 支持的运算符
const OPERATORS = ['+', '-', '*', '/', '%', '(', ')'];

// 运算符优先级
const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
};

/**
 * 解析公式中的变量
 * 支持的变量格式：E001, E002, ${E001}, {fieldId}
 * @param formula 公式字符串
 * @returns 变量列表
 */
export function parseVariables(formula: string): string[] {
  if (!formula) return [];

  const variables: Set<string> = new Set();

  // 匹配 ${xxx} 格式
  const dollarBracePattern = /\$\{([^}]+)\}/g;
  let match;
  while ((match = dollarBracePattern.exec(formula)) !== null) {
    variables.add(match[1]);
  }

  // 匹配 {xxx} 格式
  const bracePattern = /\{([^}]+)\}/g;
  while ((match = bracePattern.exec(formula)) !== null) {
    variables.add(match[1]);
  }

  // 匹配字母开头的标识符（如 E001, E002）
  const identifierPattern = /\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  while ((match = identifierPattern.exec(formula)) !== null) {
    // 排除运算符和关键字
    const identifier = match[1];
    if (!['Math', 'PI', 'E'].includes(identifier)) {
      variables.add(identifier);
    }
  }

  return Array.from(variables);
}

/**
 * 替换公式中的变量为实际值
 * @param formula 公式字符串
 * @param values 变量值映射
 * @returns 替换后的公式
 */
function replaceVariables(formula: string, values: Record<string, number>): string {
  let result = formula;

  // 替换 ${xxx} 格式
  result = result.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const value = values[varName];
    return value !== undefined ? String(value) : '0';
  });

  // 替换 {xxx} 格式
  result = result.replace(/\{([^}]+)\}/g, (_, varName) => {
    const value = values[varName];
    return value !== undefined ? String(value) : '0';
  });

  // 替换标识符格式（从长到短排序，避免部分替换）
  const varNames = Object.keys(values).sort((a, b) => b.length - a.length);
  for (const varName of varNames) {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    result = result.replace(regex, String(values[varName]));
  }

  return result;
}

/**
 * 安全计算数学表达式
 * 只支持基本的数学运算，不使用 eval
 * @param expression 表达式字符串
 * @returns 计算结果
 */
function safeEvaluate(expression: string): number {
  // 移除空格
  expression = expression.replace(/\s+/g, '');

  // 验证表达式只包含数字、运算符和括号
  if (!/^[\d+\-*/%().]+$/.test(expression)) {
    throw new Error('表达式包含非法字符');
  }

  // 使用 Function 构造安全的计算环境（比 eval 更安全）
  try {
    // 创建一个只能执行数学运算的函数
    const fn = new Function(`return (${expression})`);
    const result = fn();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('计算结果无效');
    }

    return result;
  } catch (error) {
    throw new Error(`表达式计算错误: ${(error as Error).message}`);
  }
}

/**
 * 计算公式结果
 * @param formula 公式字符串
 * @param values 变量值映射
 * @returns 计算结果
 */
export function calculate(formula: string, values: Record<string, number>): number {
  if (!formula) {
    throw new Error('公式不能为空');
  }

  // 检查所需变量是否都有值
  const variables = parseVariables(formula);
  const missingVars = variables.filter(v => values[v] === undefined);
  if (missingVars.length > 0) {
    throw new Error(`缺少变量值: ${missingVars.join(', ')}`);
  }

  // 替换变量
  const expression = replaceVariables(formula, values);

  // 计算结果
  return safeEvaluate(expression);
}

/**
 * 验证公式语法
 * @param formula 公式字符串
 * @returns 验证结果
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: '公式不能为空' };
  }

  // 检查括号匹配
  let parenCount = 0;
  for (const char of formula) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: '括号不匹配' };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: '括号不匹配' };
  }

  // 尝试用测试值计算
  try {
    const variables = parseVariables(formula);
    const testValues: Record<string, number> = {};
    variables.forEach(v => {
      testValues[v] = 1; // 使用测试值
    });
    calculate(formula, testValues);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

/**
 * 阈值校验
 */
export interface ThresholdConfig {
  threshold: string;        // 原始阈值字符串，如 "≤0.50", "≥95%", "100%"
  operator?: string;        // 比较操作符
  value?: number;           // 阈值数值
  minValue?: number;        // 范围最小值
  maxValue?: number;        // 范围最大值
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  warning?: boolean;        // 是否为警告（非阻断）
}

/**
 * 解析阈值字符串
 * @param threshold 阈值字符串
 * @returns 解析后的配置
 */
export function parseThreshold(threshold: string): ThresholdConfig {
  const config: ThresholdConfig = { threshold };

  if (!threshold) return config;

  // 移除百分号并处理
  let normalizedThreshold = threshold.trim();
  let isPercentage = false;

  if (normalizedThreshold.endsWith('%')) {
    isPercentage = true;
    normalizedThreshold = normalizedThreshold.slice(0, -1);
  }

  // 解析操作符和数值
  const operators = ['≤', '≥', '<=', '>=', '<', '>', '=', '=='];

  for (const op of operators) {
    if (normalizedThreshold.startsWith(op)) {
      config.operator = op.replace('<=', '≤').replace('>=', '≥').replace('==', '=');
      const valueStr = normalizedThreshold.slice(op.length).trim();
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        config.value = isPercentage ? value : value;
      }
      return config;
    }
  }

  // 尝试解析为范围 (如 "0.3-0.5")
  if (normalizedThreshold.includes('-') && !normalizedThreshold.startsWith('-')) {
    const parts = normalizedThreshold.split('-');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        config.minValue = min;
        config.maxValue = max;
        config.operator = 'range';
        return config;
      }
    }
  }

  // 尝试解析为单个数值（等于）
  const value = parseFloat(normalizedThreshold);
  if (!isNaN(value)) {
    config.operator = '=';
    config.value = value;
  }

  return config;
}

/**
 * 校验值是否满足阈值要求
 * @param value 要校验的值
 * @param thresholdConfig 阈值配置
 * @returns 校验结果
 */
export function validateThreshold(
  value: number,
  thresholdConfig: ThresholdConfig
): ValidationResult {
  const { operator, value: threshold, minValue, maxValue, threshold: original } = thresholdConfig;

  if (!operator || (threshold === undefined && minValue === undefined)) {
    // 无法解析阈值，返回警告
    return { valid: true, warning: true, message: `无法解析阈值: ${original}` };
  }

  // 范围校验
  if (operator === 'range' && minValue !== undefined && maxValue !== undefined) {
    if (value >= minValue && value <= maxValue) {
      return { valid: true };
    }
    return {
      valid: false,
      message: `值 ${value} 不在阈值范围 ${minValue}-${maxValue} 内`,
    };
  }

  // 比较校验
  if (threshold !== undefined) {
    let isValid = false;
    switch (operator) {
      case '≤':
      case '<=':
        isValid = value <= threshold;
        break;
      case '≥':
      case '>=':
        isValid = value >= threshold;
        break;
      case '<':
        isValid = value < threshold;
        break;
      case '>':
        isValid = value > threshold;
        break;
      case '=':
      case '==':
        isValid = Math.abs(value - threshold) < 0.0001; // 浮点数比较
        break;
      default:
        return { valid: true, warning: true, message: `未知操作符: ${operator}` };
    }

    if (isValid) {
      return { valid: true };
    }
    return {
      valid: false,
      message: `值 ${value} 不满足阈值要求 ${original}`,
    };
  }

  return { valid: true };
}

/**
 * 公式计算器类
 */
export class FormulaCalculator {
  /**
   * 解析公式中的变量
   */
  parseVariables = parseVariables;

  /**
   * 计算公式结果
   */
  calculate = calculate;

  /**
   * 验证公式语法
   */
  validate = validateFormula;

  /**
   * 解析阈值
   */
  parseThreshold = parseThreshold;

  /**
   * 校验阈值
   */
  validateThreshold = validateThreshold;
}

export default FormulaCalculator;
