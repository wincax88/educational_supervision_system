/**
 * 音乐美术教室指标计算测试
 * 测试 D061-D073 派生要素的计算逻辑
 */

const {
  extCeil,
  extFloor,
  extLen,
  extYear,
  extCountIf,
  calculateExtendedFormula,
  calculateDerivedValueForSample,
  parseFormulaVariables,
} = require('../services/aggregationService');

describe('扩展函数测试', () => {
  describe('CEIL - 向上取整', () => {
    test('正常数值向上取整', () => {
      expect(extCeil(2.1)).toBe(3);
      expect(extCeil(2.9)).toBe(3);
      expect(extCeil(2.0)).toBe(2);
    });

    test('处理边界情况', () => {
      expect(extCeil(0)).toBe(0);
      expect(extCeil(-2.1)).toBe(-2);
      expect(extCeil(null)).toBe(null);
      expect(extCeil(undefined)).toBe(null);
    });
  });

  describe('LEN - 数组长度', () => {
    test('正常数组', () => {
      expect(extLen([1, 2, 3])).toBe(3);
      expect(extLen([])).toBe(0);
    });

    test('非数组返回0', () => {
      expect(extLen(null)).toBe(0);
      expect(extLen(undefined)).toBe(0);
      expect(extLen('string')).toBe(0);
    });
  });

  describe('YEAR - 年份提取', () => {
    test('正常日期字符串', () => {
      expect(extYear('2016-09-01')).toBe(2016);
      expect(extYear('1985-01-01')).toBe(1985);
      expect(extYear('2020')).toBe(2020);
    });

    test('无效日期', () => {
      expect(extYear(null)).toBe(null);
      expect(extYear('')).toBe(null);
      expect(extYear('invalid')).toBe(null);
    });
  });

  describe('COUNT_IF - 条件计数', () => {
    const musicRooms = [
      { music_room_index: 1, music_room_area: 100 },
      { music_room_index: 2, music_room_area: 80 },
      { music_room_index: 3, music_room_area: 96 },
    ];

    test('大于等于条件', () => {
      expect(extCountIf(musicRooms, 'music_room_area', '>=', 96)).toBe(2);
      expect(extCountIf(musicRooms, 'music_room_area', '>=', 100)).toBe(1);
    });

    test('大于条件', () => {
      expect(extCountIf(musicRooms, 'music_room_area', '>', 96)).toBe(1);
    });

    test('空数组或无效输入', () => {
      expect(extCountIf([], 'music_room_area', '>=', 96)).toBe(0);
      expect(extCountIf(null, 'music_room_area', '>=', 96)).toBe(0);
    });
  });
});

describe('公式变量解析测试', () => {
  test('解析简单变量', () => {
    const vars = parseFormulaVariables('E001 + E002');
    expect(vars).toContain('E001');
    expect(vars).toContain('E002');
  });

  test('排除扩展函数关键字', () => {
    const vars = parseFormulaVariables('CEIL(E047 / 12)');
    expect(vars).toContain('E047');
    expect(vars).not.toContain('CEIL');
  });

  test('排除逻辑运算符', () => {
    const vars = parseFormulaVariables('E047 == 0 OR D067 >= D061');
    expect(vars).toContain('E047');
    expect(vars).toContain('D067');
    expect(vars).toContain('D061');
    expect(vars).not.toContain('OR');
  });
});

describe('扩展公式计算测试', () => {
  test('CEIL公式', () => {
    const result = calculateExtendedFormula('CEIL(E047 / 12)', { E047: 25 });
    expect(result).toBe(3); // ceil(25/12) = ceil(2.08) = 3
  });

  test('IF公式 - 条件为真', () => {
    const result = calculateExtendedFormula(
      "IF(E104 == 'yes', 54, 96)",
      { E104: 'yes' }
    );
    expect(result).toBe(54);
  });

  test('IF公式 - 条件为假', () => {
    const result = calculateExtendedFormula(
      "IF(E104 == 'yes', 54, 96)",
      { E104: 'no' }
    );
    expect(result).toBe(96);
  });

  test('嵌套IF公式', () => {
    const result = calculateExtendedFormula(
      "IF(E104 == 'yes', IF(E047 > 0, 54, 61), 96)",
      { E104: 'yes', E047: 24 }
    );
    expect(result).toBe(54);
  });

  test('YEAR和IF组合', () => {
    const result = calculateExtendedFormula(
      'IF(YEAR(E091) <= 2016, 73, 96)',
      { E091: '2010-09-01' }
    );
    expect(result).toBe(73);
  });

  test('LEN公式', () => {
    const result = calculateExtendedFormula('LEN(E065)', {
      E065: [{ area: 100 }, { area: 80 }],
    });
    expect(result).toBe(2);
  });

  test('COUNT_IF公式', () => {
    const result = calculateExtendedFormula(
      "COUNT_IF(E065, 'music_room_area', '>=', 96)",
      {
        E065: [
          { music_room_area: 100 },
          { music_room_area: 80 },
          { music_room_area: 96 },
        ],
      }
    );
    expect(result).toBe(2);
  });

  test('逻辑运算 AND', () => {
    const result = calculateExtendedFormula('D069 AND D070', {
      D069: true,
      D070: true,
    });
    expect(result).toBe(true);
  });

  test('逻辑运算 OR', () => {
    const result = calculateExtendedFormula('E047 == 0 OR D067 >= D061', {
      E047: 0,
      D067: 1,
      D061: 2,
    });
    expect(result).toBe(true); // E047 == 0 为真
  });
});

describe('音乐美术教室指标计算测试', () => {
  // 要素定义
  const elements = [
    { code: 'E047', name: '小学班级数', elementType: '基础要素', dataType: '数字', fieldId: 'primary_class_count' },
    { code: 'E048', name: '初中班级数', elementType: '基础要素', dataType: '数字', fieldId: 'junior_class_count' },
    { code: 'E065', name: '音乐教室面积', elementType: '基础要素', dataType: '数组', fieldId: 'music_classroom_list' },
    { code: 'E066', name: '美术教室面积', elementType: '基础要素', dataType: '数组', fieldId: 'art_classroom_list' },
    { code: 'E091', name: '建校年份', elementType: '基础要素', dataType: '日期', fieldId: 'founding_year' },
    { code: 'E104', name: '是否农村小规模学校', elementType: '基础要素', dataType: '逻辑', fieldId: 'is_small_class_rural_school' },
    { code: 'D061', name: '小学所需音乐美术教室数', elementType: '派生要素', dataType: '数字', formula: 'CEIL(E047 / 12)' },
    { code: 'D062', name: '初中所需音乐美术教室数', elementType: '派生要素', dataType: '数字', formula: 'CEIL(E048 / 12)' },
    { code: 'D063', name: '音乐教室面积标准', elementType: '派生要素', dataType: '数字', formula: "IF(E104 == 'yes', IF(E047 > 0, 54, 61), IF(YEAR(E091) <= 2016, 73, 96))" },
    { code: 'D064', name: '美术教室面积标准', elementType: '派生要素', dataType: '数字', formula: "IF(E104 == 'yes', IF(E047 > 0, 54, 61), IF(YEAR(E091) <= 2016, 67, 90))" },
    { code: 'D065', name: '音乐教室总数', elementType: '派生要素', dataType: '数字', formula: 'LEN(E065)' },
    { code: 'D066', name: '美术教室总数', elementType: '派生要素', dataType: '数字', formula: 'LEN(E066)' },
    { code: 'D067', name: '面积达标音乐教室数', elementType: '派生要素', dataType: '数字', formula: "COUNT_IF(E065, 'music_room_area', '>=', D063)" },
    { code: 'D068', name: '面积达标美术教室数', elementType: '派生要素', dataType: '数字', formula: "COUNT_IF(E066, 'art_room_area', '>=', D064)" },
    { code: 'D069', name: '小学音乐教室达标', elementType: '派生要素', dataType: '逻辑', formula: 'E047 == 0 OR D067 >= D061' },
    { code: 'D070', name: '小学美术教室达标', elementType: '派生要素', dataType: '逻辑', formula: 'E047 == 0 OR D068 >= D061' },
    { code: 'D071', name: '初中音乐教室达标', elementType: '派生要素', dataType: '逻辑', formula: 'E048 == 0 OR D067 >= D062' },
    { code: 'D072', name: '初中美术教室达标', elementType: '派生要素', dataType: '逻辑', formula: 'E048 == 0 OR D068 >= D062' },
    { code: 'D073', name: '音乐美术教室综合达标', elementType: '派生要素', dataType: '逻辑', formula: 'D069 AND D070 AND D071 AND D072' },
  ];

  describe('常规小学（24班，2020年建校）', () => {
    const sampleData = {
      primary_class_count: 24,
      junior_class_count: 0,
      founding_year: '2020-09-01',
      is_small_class_rural_school: 'no',
      music_classroom_list: [
        { music_room_index: 1, music_room_name: '音乐教室1', music_room_area: 100 },
        { music_room_index: 2, music_room_name: '音乐教室2', music_room_area: 98 },
      ],
      art_classroom_list: [
        { art_room_index: 1, art_room_name: '美术教室1', art_room_area: 95 },
        { art_room_index: 2, art_room_name: '美术教室2', art_room_area: 92 },
      ],
    };

    test('D061 所需音乐美术教室数 = ceil(24/12) = 2', () => {
      const result = calculateDerivedValueForSample('D061', elements, sampleData);
      expect(result).toBe(2);
    });

    test('D063 音乐教室面积标准 = 96 (常规标准)', () => {
      const result = calculateDerivedValueForSample('D063', elements, sampleData);
      expect(result).toBe(96);
    });

    test('D064 美术教室面积标准 = 90 (常规标准)', () => {
      const result = calculateDerivedValueForSample('D064', elements, sampleData);
      expect(result).toBe(90);
    });

    test('D065 音乐教室总数 = 2', () => {
      const result = calculateDerivedValueForSample('D065', elements, sampleData);
      expect(result).toBe(2);
    });

    test('D067 面积达标音乐教室数 = 2 (100>=96, 98>=96)', () => {
      const result = calculateDerivedValueForSample('D067', elements, sampleData);
      expect(result).toBe(2);
    });

    test('D068 面积达标美术教室数 = 2 (95>=90, 92>=90)', () => {
      const result = calculateDerivedValueForSample('D068', elements, sampleData);
      expect(result).toBe(2);
    });

    test('D069 小学音乐教室达标 = true', () => {
      const result = calculateDerivedValueForSample('D069', elements, sampleData);
      expect(result).toBe(true);
    });

    test('D073 综合达标 = true', () => {
      const result = calculateDerivedValueForSample('D073', elements, sampleData);
      expect(result).toBe(true);
    });
  });

  describe('2016年前建校小学', () => {
    const sampleData = {
      primary_class_count: 12,
      junior_class_count: 0,
      founding_year: '2010-09-01',
      is_small_class_rural_school: 'no',
      music_classroom_list: [
        { music_room_index: 1, music_room_name: '音乐教室1', music_room_area: 75 },
      ],
      art_classroom_list: [
        { art_room_index: 1, art_room_name: '美术教室1', art_room_area: 70 },
      ],
    };

    test('D061 所需教室数 = ceil(12/12) = 1', () => {
      const result = calculateDerivedValueForSample('D061', elements, sampleData);
      expect(result).toBe(1);
    });

    test('D063 音乐教室面积标准 = 73 (2016年前建校)', () => {
      const result = calculateDerivedValueForSample('D063', elements, sampleData);
      expect(result).toBe(73);
    });

    test('D064 美术教室面积标准 = 67 (2016年前建校)', () => {
      const result = calculateDerivedValueForSample('D064', elements, sampleData);
      expect(result).toBe(67);
    });

    test('D067 面积达标音乐教室数 = 1 (75>=73)', () => {
      const result = calculateDerivedValueForSample('D067', elements, sampleData);
      expect(result).toBe(1);
    });

    test('D073 综合达标 = true', () => {
      const result = calculateDerivedValueForSample('D073', elements, sampleData);
      expect(result).toBe(true);
    });
  });

  describe('农村小规模小学', () => {
    const sampleData = {
      primary_class_count: 6,
      junior_class_count: 0,
      founding_year: '2020-09-01',
      is_small_class_rural_school: 'yes',
      music_classroom_list: [
        { music_room_index: 1, music_room_name: '音乐教室1', music_room_area: 55 },
      ],
      art_classroom_list: [
        { art_room_index: 1, art_room_name: '美术教室1', art_room_area: 55 },
      ],
    };

    test('D061 所需教室数 = ceil(6/12) = 1', () => {
      const result = calculateDerivedValueForSample('D061', elements, sampleData);
      expect(result).toBe(1);
    });

    test('D063 音乐教室面积标准 = 54 (农村小规模小学)', () => {
      const result = calculateDerivedValueForSample('D063', elements, sampleData);
      expect(result).toBe(54);
    });

    test('D073 综合达标 = true', () => {
      const result = calculateDerivedValueForSample('D073', elements, sampleData);
      expect(result).toBe(true);
    });
  });

  describe('九年一贯制学校', () => {
    const sampleData = {
      primary_class_count: 24,
      junior_class_count: 18,
      founding_year: '2020-09-01',
      is_small_class_rural_school: 'no',
      music_classroom_list: [
        { music_room_index: 1, music_room_name: '音乐教室1', music_room_area: 100 },
        { music_room_index: 2, music_room_name: '音乐教室2', music_room_area: 98 },
        { music_room_index: 3, music_room_name: '音乐教室3', music_room_area: 96 },
        { music_room_index: 4, music_room_name: '音乐教室4', music_room_area: 97 },
      ],
      art_classroom_list: [
        { art_room_index: 1, art_room_name: '美术教室1', art_room_area: 95 },
        { art_room_index: 2, art_room_name: '美术教室2', art_room_area: 92 },
        { art_room_index: 3, art_room_name: '美术教室3', art_room_area: 90 },
        { art_room_index: 4, art_room_name: '美术教室4', art_room_area: 91 },
      ],
    };

    test('D061 小学所需 = ceil(24/12) = 2', () => {
      const result = calculateDerivedValueForSample('D061', elements, sampleData);
      expect(result).toBe(2);
    });

    test('D062 初中所需 = ceil(18/12) = 2', () => {
      const result = calculateDerivedValueForSample('D062', elements, sampleData);
      expect(result).toBe(2);
    });

    test('D065 音乐教室总数 = 4', () => {
      const result = calculateDerivedValueForSample('D065', elements, sampleData);
      expect(result).toBe(4);
    });

    test('D067 面积达标音乐教室数 = 4', () => {
      const result = calculateDerivedValueForSample('D067', elements, sampleData);
      expect(result).toBe(4);
    });

    test('D069 小学音乐教室达标 = true (4 >= 2)', () => {
      const result = calculateDerivedValueForSample('D069', elements, sampleData);
      expect(result).toBe(true);
    });

    test('D071 初中音乐教室达标 = true (4 >= 2)', () => {
      const result = calculateDerivedValueForSample('D071', elements, sampleData);
      expect(result).toBe(true);
    });

    test('D073 综合达标 = true', () => {
      const result = calculateDerivedValueForSample('D073', elements, sampleData);
      expect(result).toBe(true);
    });
  });

  describe('不达标情况', () => {
    const sampleData = {
      primary_class_count: 24,
      junior_class_count: 0,
      founding_year: '2020-09-01',
      is_small_class_rural_school: 'no',
      music_classroom_list: [
        { music_room_index: 1, music_room_name: '音乐教室1', music_room_area: 80 }, // 面积不达标
      ],
      art_classroom_list: [
        { art_room_index: 1, art_room_name: '美术教室1', art_room_area: 85 }, // 面积不达标
      ],
    };

    test('D067 面积达标音乐教室数 = 0 (80<96)', () => {
      const result = calculateDerivedValueForSample('D067', elements, sampleData);
      expect(result).toBe(0);
    });

    test('D069 小学音乐教室达标 = false (0 < 2)', () => {
      const result = calculateDerivedValueForSample('D069', elements, sampleData);
      expect(result).toBe(false);
    });

    test('D073 综合达标 = false', () => {
      const result = calculateDerivedValueForSample('D073', elements, sampleData);
      expect(result).toBe(false);
    });
  });

  describe('边界条件', () => {
    test('班级数为0时默认达标', () => {
      const sampleData = {
        primary_class_count: 0,
        junior_class_count: 0,
        founding_year: '2020-09-01',
        is_small_class_rural_school: 'no',
        music_classroom_list: [],
        art_classroom_list: [],
      };

      const result = calculateDerivedValueForSample('D069', elements, sampleData);
      expect(result).toBe(true); // E047 == 0 为真
    });

    test('班级数为12时所需教室数为1', () => {
      const result = calculateDerivedValueForSample('D061', elements, {
        primary_class_count: 12,
        junior_class_count: 0,
        founding_year: '2020-09-01',
        is_small_class_rural_school: 'no',
        music_classroom_list: [],
        art_classroom_list: [],
      });
      expect(result).toBe(1);
    });

    test('班级数为13时所需教室数为2', () => {
      const result = calculateDerivedValueForSample('D061', elements, {
        primary_class_count: 13,
        junior_class_count: 0,
        founding_year: '2020-09-01',
        is_small_class_rural_school: 'no',
        music_classroom_list: [],
        art_classroom_list: [],
      });
      expect(result).toBe(2);
    });
  });
});
