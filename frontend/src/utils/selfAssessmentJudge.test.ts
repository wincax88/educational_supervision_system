/**
 * 自评判定工具测试
 */

import {
  parseThresholdString,
  suggestConclusion,
  generateAssessmentDescription,
  calculateCompletionStats,
  determineGradingLevel,
  DEFAULT_GRADING_CRITERIA,
  type LeafIndicator,
  type DataIndicator,
} from './selfAssessmentJudge';

describe('parseThresholdString', () => {
  test('解析 >= 格式', () => {
    const result = parseThresholdString('>= 85%');
    expect(result).toEqual({
      operator: '>=',
      value: 85,
      isPercentage: true,
    });
  });

  test('解析 = 格式', () => {
    const result = parseThresholdString('= 100%');
    expect(result).toEqual({
      operator: '=',
      value: 100,
      isPercentage: true,
    });
  });

  test('解析无操作符的纯数字', () => {
    const result = parseThresholdString('50%');
    expect(result).toEqual({
      operator: '=',
      value: 50,
      isPercentage: true,
    });
  });

  test('解析非百分比格式', () => {
    const result = parseThresholdString('>= 500');
    expect(result).toEqual({
      operator: '>=',
      value: 500,
      isPercentage: false,
    });
  });

  test('无法解析逻辑类型阈值', () => {
    const result = parseThresholdString('合格');
    expect(result).toBeNull();
  });
});

describe('suggestConclusion', () => {
  test('数字类型达标应返回合格', () => {
    const indicator: LeafIndicator = {
      id: 'test-1',
      code: '1.1.1',
      name: '测试指标',
      description: '测试描述',
      level: 3,
      isLeaf: true,
      dataIndicators: [
        {
          id: 'test-1-d1',
          code: '1.1.1-D1',
          name: '入园率',
          dataType: '数字',
          unit: '%',
          threshold: '>= 85%',
          thresholdType: 'single',
          actualValue: 90,
        } as DataIndicator,
      ],
      selfAssessment: {
        description: '',
        conclusion: null,
      },
    };

    const result = suggestConclusion(indicator);
    expect(result).toBe('合格');
  });

  test('数字类型未达标应返回不合格', () => {
    const indicator: LeafIndicator = {
      id: 'test-2',
      code: '1.1.2',
      name: '测试指标',
      description: '测试描述',
      level: 3,
      isLeaf: true,
      dataIndicators: [
        {
          id: 'test-2-d1',
          code: '1.1.2-D1',
          name: '入园率',
          dataType: '数字',
          unit: '%',
          threshold: '>= 85%',
          thresholdType: 'single',
          actualValue: 70,
        } as DataIndicator,
      ],
      selfAssessment: {
        description: '',
        conclusion: null,
      },
    };

    const result = suggestConclusion(indicator);
    expect(result).toBe('不合格');
  });

  test('无实际值应返回null', () => {
    const indicator: LeafIndicator = {
      id: 'test-3',
      code: '1.1.3',
      name: '测试指标',
      description: '测试描述',
      level: 3,
      isLeaf: true,
      dataIndicators: [
        {
          id: 'test-3-d1',
          code: '1.1.3-D1',
          name: '入园率',
          dataType: '数字',
          unit: '%',
          threshold: '>= 85%',
          thresholdType: 'single',
          actualValue: null,
        } as DataIndicator,
      ],
      selfAssessment: {
        description: '',
        conclusion: null,
      },
    };

    const result = suggestConclusion(indicator);
    expect(result).toBeNull();
  });

  test('逻辑类型选择合格应返回合格', () => {
    const indicator: LeafIndicator = {
      id: 'test-4',
      code: '2.1.1',
      name: '党的领导',
      description: '测试描述',
      level: 3,
      isLeaf: true,
      dataIndicators: [
        {
          id: 'test-4-d1',
          code: '2.1.1-D1',
          name: '党组织覆盖情况',
          dataType: '逻辑',
          threshold: '合格',
          thresholdType: 'single',
          actualValue: '合格',
        } as DataIndicator,
      ],
      selfAssessment: {
        description: '',
        conclusion: null,
      },
    };

    const result = suggestConclusion(indicator);
    expect(result).toBe('合格');
  });
});

describe('generateAssessmentDescription', () => {
  test('生成数字类型说明', () => {
    const indicator: LeafIndicator = {
      id: 'test-1',
      code: '1.1.1',
      name: '测试指标',
      description: '',
      level: 3,
      isLeaf: true,
      dataIndicators: [
        {
          id: 'test-1-d1',
          code: '1.1.1-D1',
          name: '学前三年毛入园率',
          dataType: '数字',
          unit: '%',
          threshold: '>= 85%',
          thresholdType: 'single',
          actualValue: 92.5,
        } as DataIndicator,
      ],
      selfAssessment: {
        description: '',
        conclusion: null,
      },
    };

    const result = generateAssessmentDescription(indicator);
    expect(result).toContain('学前三年毛入园率为92.5%');
    expect(result).toContain('>= 85%');
  });
});

describe('calculateCompletionStats', () => {
  test('计算统计数据', () => {
    const indicators: LeafIndicator[] = [
      {
        id: '1', code: '1', name: '', description: '', level: 3, isLeaf: true, dataIndicators: [],
        selfAssessment: { description: '', conclusion: '合格' },
      },
      {
        id: '2', code: '2', name: '', description: '', level: 3, isLeaf: true, dataIndicators: [],
        selfAssessment: { description: '', conclusion: '合格' },
      },
      {
        id: '3', code: '3', name: '', description: '', level: 3, isLeaf: true, dataIndicators: [],
        selfAssessment: { description: '', conclusion: '基本合格' },
      },
      {
        id: '4', code: '4', name: '', description: '', level: 3, isLeaf: true, dataIndicators: [],
        selfAssessment: { description: '', conclusion: '不合格' },
      },
      {
        id: '5', code: '5', name: '', description: '', level: 3, isLeaf: true, dataIndicators: [],
        selfAssessment: { description: '', conclusion: null },
      },
    ];

    const stats = calculateCompletionStats(indicators);
    expect(stats.total).toBe(5);
    expect(stats.qualified).toBe(2);
    expect(stats.basicallyQualified).toBe(1);
    expect(stats.unqualified).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.qualifiedRate).toBe(60); // (2+1)/5 = 60%
  });
});

describe('determineGradingLevel', () => {
  test('创优等级 - 33项合格、3项基本合格', () => {
    const result = determineGradingLevel({
      qualified: 33,
      basicallyQualified: 3,
      unqualified: 0,
    });
    expect(result.level).toBe('创优');
    expect(result.meetsRequirement).toBe(true);
  });

  test('创优等级 - 超过33项合格', () => {
    const result = determineGradingLevel({
      qualified: 35,
      basicallyQualified: 1,
      unqualified: 0,
    });
    expect(result.level).toBe('创优');
    expect(result.meetsRequirement).toBe(true);
  });

  test('提高等级 - 31项合格、5项基本合格', () => {
    const result = determineGradingLevel({
      qualified: 31,
      basicallyQualified: 5,
      unqualified: 0,
    });
    expect(result.level).toBe('提高');
    expect(result.meetsRequirement).toBe(true);
  });

  test('提高等级 - 32项合格、4项基本合格', () => {
    const result = determineGradingLevel({
      qualified: 32,
      basicallyQualified: 4,
      unqualified: 0,
    });
    expect(result.level).toBe('提高');
    expect(result.meetsRequirement).toBe(true);
  });

  test('巩固等级 - 29项合格、7项基本合格', () => {
    const result = determineGradingLevel({
      qualified: 29,
      basicallyQualified: 7,
      unqualified: 0,
    });
    expect(result.level).toBe('巩固');
    expect(result.meetsRequirement).toBe(true);
  });

  test('巩固等级 - 30项合格、6项基本合格', () => {
    const result = determineGradingLevel({
      qualified: 30,
      basicallyQualified: 6,
      unqualified: 0,
    });
    expect(result.level).toBe('巩固');
    expect(result.meetsRequirement).toBe(true);
  });

  test('未通过 - 存在不合格项', () => {
    const result = determineGradingLevel({
      qualified: 33,
      basicallyQualified: 2,
      unqualified: 1,
    });
    expect(result.level).toBeNull();
    expect(result.meetsRequirement).toBe(false);
    expect(result.failureReason).toContain('不合格');
  });

  test('未通过 - 未达到巩固等级', () => {
    const result = determineGradingLevel({
      qualified: 28,
      basicallyQualified: 8,
      unqualified: 0,
    });
    expect(result.level).toBeNull();
    expect(result.meetsRequirement).toBe(false);
    expect(result.failureReason).toContain('未达到巩固等级');
  });

  test('默认使用学前双普标准', () => {
    expect(DEFAULT_GRADING_CRITERIA).toHaveLength(3);
    expect(DEFAULT_GRADING_CRITERIA.map(c => c.name)).toEqual(['创优', '提高', '巩固']);
  });
});
