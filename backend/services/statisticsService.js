/**
 * 统计分析服务
 * 提供差异系数计算、达标率统计等核心功能
 * 已适配 PostgreSQL 异步操作
 */

/**
 * 计算差异系数 (Coefficient of Variation)
 * CV = 标准差 / 平均值
 * @param {number[]} values - 数值数组
 * @returns {{ cv: number, mean: number, stdDev: number, count: number } | null}
 */
function calculateCV(values) {
  // 过滤有效值
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));

  if (validValues.length === 0) return null;

  const n = validValues.length;
  const mean = validValues.reduce((sum, v) => sum + v, 0) / n;

  if (mean === 0) return { cv: 0, mean: 0, stdDev: 0, count: n };

  const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  return {
    cv: Math.round(cv * 10000) / 10000,  // 保留4位小数
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    count: n
  };
}

/**
 * 解析阈值字符串，提取比较操作符和数值
 * 支持格式：≥4.2, ≤17:1, >=95%, <0.50 等
 * @param {string} threshold - 阈值字符串
 * @returns {{ operator: string, value: number, isRatio: boolean } | null}
 */
function parseThreshold(threshold) {
  if (!threshold) return null;

  // 移除空格
  const str = threshold.trim();

  // 匹配操作符和数值
  const match = str.match(/^([≥≤><]=?|>=|<=|>|<|=)?\s*([\d.]+)(?::(\d+))?/);
  if (!match) return null;

  let operator = match[1] || '≥';
  let value = parseFloat(match[2]);
  const isRatio = !!match[3];  // 是否是比例格式如 17:1

  // 标准化操作符
  operator = operator.replace('>=', '≥').replace('<=', '≤');

  // 处理百分比
  if (str.includes('%')) {
    value = value;  // 已经是百分比形式
  }

  return { operator, value, isRatio };
}

/**
 * 判断值是否达标
 * @param {number} value - 实际值
 * @param {string} threshold - 阈值字符串
 * @returns {boolean | null} - 达标/未达标/无法判断
 */
function checkCompliance(value, threshold) {
  if (value === null || value === undefined) return null;

  const parsed = parseThreshold(threshold);
  if (!parsed) return null;

  const { operator, value: thresholdValue } = parsed;

  switch (operator) {
    case '≥':
    case '>=':
      return value >= thresholdValue;
    case '≤':
    case '<=':
      return value <= thresholdValue;
    case '>':
      return value > thresholdValue;
    case '<':
      return value < thresholdValue;
    case '=':
      return value === thresholdValue;
    default:
      return null;
  }
}

/**
 * 获取区县的差异系数分析
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {string} schoolType - 学校类型 (小学/初中)
 * @returns {Promise<object>} 差异系数分析结果
 */
async function getDistrictCVAnalysis(db, projectId, districtId, schoolType) {
  // 获取区县信息
  const districtResult = await db.query('SELECT id, name FROM districts WHERE id = $1', [districtId]);
  const district = districtResult.rows[0];
  if (!district) return null;

  // 获取该区县该类型的学校列表
  let schoolQuery = `
    SELECT s.id, s.name, s.student_count, s.teacher_count
    FROM schools s
    WHERE s.district_id = $1 AND s.status = 'active'
  `;
  const params = [districtId];
  let paramIndex = 2;

  if (schoolType) {
    if (schoolType === '小学') {
      schoolQuery += " AND (s.school_type = '小学' OR s.school_type = '九年一贯制')";
    } else if (schoolType === '初中') {
      schoolQuery += " AND (s.school_type = '初中' OR s.school_type = '九年一贯制' OR s.school_type = '完全中学')";
    }
  }

  const schoolsResult = await db.query(schoolQuery, params);
  const schools = schoolsResult.rows;

  if (schools.length === 0) {
    return {
      district,
      schoolType,
      schoolCount: 0,
      cvIndicators: {},
      cvComposite: null,
      threshold: schoolType === '小学' ? 0.50 : 0.45,
      isCompliant: null
    };
  }

  // 8项核心指标的差异系数计算
  // 这里先使用学校基本数据计算生师比
  const studentTeacherRatios = schools
    .filter(s => s.teacher_count > 0)
    .map(s => s.student_count / s.teacher_count);

  const cvIndicators = {
    studentTeacherRatio: calculateCV(studentTeacherRatios)
  };

  // 如果有项目指标数据，从 school_indicator_data 表获取更多指标
  const indicatorDataResult = await db.query(`
    SELECT sid.school_id, sid.data_indicator_id, sid.value, di.code, di.name
    FROM school_indicator_data sid
    JOIN data_indicators di ON sid.data_indicator_id = di.id
    WHERE sid.project_id = $1
    AND sid.school_id IN (SELECT id FROM schools WHERE district_id = $2)
    AND sid.value IS NOT NULL
  `, [projectId, districtId]);

  const indicatorData = indicatorDataResult.rows;

  // 按指标分组计算差异系数
  const indicatorGroups = {};
  indicatorData.forEach(row => {
    if (!indicatorGroups[row.code]) {
      indicatorGroups[row.code] = {
        name: row.name,
        values: []
      };
    }
    indicatorGroups[row.code].values.push(row.value);
  });

  Object.entries(indicatorGroups).forEach(([code, group]) => {
    cvIndicators[code] = {
      ...calculateCV(group.values),
      name: group.name
    };
  });

  // 计算综合差异系数（所有有效指标的平均值）
  const cvValues = Object.values(cvIndicators)
    .filter(v => v && v.cv !== null && v.cv !== undefined)
    .map(v => v.cv);

  const cvComposite = cvValues.length > 0
    ? Math.round((cvValues.reduce((sum, v) => sum + v, 0) / cvValues.length) * 10000) / 10000
    : null;

  // 差异系数阈值
  const threshold = schoolType === '小学' ? 0.50 : 0.45;
  const isCompliant = cvComposite !== null && cvComposite <= threshold;

  return {
    district,
    schoolType,
    schoolCount: schools.length,
    cvIndicators,
    cvComposite,
    threshold,
    isCompliant
  };
}

/**
 * 获取达标率统计
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {object} options - 筛选选项
 * @returns {Promise<object>} 达标率统计结果
 */
async function getComplianceStatistics(db, projectId, options = {}) {
  const { districtId, schoolId, indicatorCategory } = options;

  let query = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
      SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
      SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
    FROM school_indicator_data sid
    WHERE sid.project_id = $1
  `;
  const params = [projectId];
  let paramIndex = 2;

  if (schoolId) {
    query += ` AND sid.school_id = $${paramIndex++}`;
    params.push(schoolId);
  }

  if (districtId) {
    query += ` AND sid.school_id IN (SELECT id FROM schools WHERE district_id = $${paramIndex++})`;
    params.push(districtId);
  }

  const result = await db.query(query, params);
  const stats = result.rows[0];

  return {
    total: parseInt(stats.total) || 0,
    compliant: parseInt(stats.compliant) || 0,
    nonCompliant: parseInt(stats.nonCompliant) || 0,
    pending: parseInt(stats.pending) || 0,
    complianceRate: stats.total > 0
      ? Math.round((stats.compliant / stats.total) * 10000) / 100
      : null
  };
}

/**
 * 获取区县对比数据
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} schoolType - 学校类型
 * @returns {Promise<Array>} 区县对比数据
 */
async function getDistrictComparison(db, projectId, schoolType) {
  const districtsResult = await db.query('SELECT id, name, code FROM districts ORDER BY sort_order');
  const districts = districtsResult.rows;

  const comparison = await Promise.all(districts.map(async (district) => {
    const cvAnalysis = await getDistrictCVAnalysis(db, projectId, district.id, schoolType);
    const complianceStats = await getComplianceStatistics(db, projectId, { districtId: district.id });

    return {
      districtId: district.id,
      districtName: district.name,
      districtCode: district.code,
      schoolCount: cvAnalysis?.schoolCount || 0,
      cvComposite: cvAnalysis?.cvComposite,
      isCvCompliant: cvAnalysis?.isCompliant,
      complianceRate: complianceStats.complianceRate,
      compliantCount: complianceStats.compliant,
      totalIndicators: complianceStats.total
    };
  }));

  return comparison.filter(d => d.schoolCount > 0);
}

/**
 * 保存或更新学校指标数据
 * @param {object} db - 数据库实例
 * @param {object} data - 指标数据
 */
async function saveSchoolIndicatorData(db, data) {
  const { projectId, schoolId, dataIndicatorId, value, textValue, submissionId } = data;

  // 获取阈值
  const indicatorResult = await db.query('SELECT threshold FROM data_indicators WHERE id = $1', [dataIndicatorId]);
  const indicator = indicatorResult.rows[0];
  const isCompliant = indicator?.threshold ? checkCompliance(value, indicator.threshold) : null;

  const now = new Date().toISOString().split('T')[0];

  // 检查是否已存在
  const existingResult = await db.query(
    'SELECT id FROM school_indicator_data WHERE project_id = $1 AND school_id = $2 AND data_indicator_id = $3',
    [projectId, schoolId, dataIndicatorId]
  );

  if (existingResult.rows[0]) {
    // 更新
    await db.query(`
      UPDATE school_indicator_data
      SET value = $1, text_value = $2, is_compliant = $3, submission_id = $4, collected_at = $5, updated_at = $6
      WHERE id = $7
    `, [
      value,
      textValue,
      isCompliant === null ? null : (isCompliant ? 1 : 0),
      submissionId,
      now,
      now,
      existingResult.rows[0].id
    ]);
  } else {
    // 插入
    const id = 'sid-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    await db.query(`
      INSERT INTO school_indicator_data
      (id, project_id, school_id, data_indicator_id, value, text_value, is_compliant, submission_id, collected_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      id,
      projectId,
      schoolId,
      dataIndicatorId,
      value,
      textValue,
      isCompliant === null ? null : (isCompliant ? 1 : 0),
      submissionId,
      now,
      now,
      now
    ]);
  }
}

/**
 * 更新区县统计快照
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {string} schoolType - 学校类型
 */
async function updateDistrictStatistics(db, projectId, districtId, schoolType) {
  const cvAnalysis = await getDistrictCVAnalysis(db, projectId, districtId, schoolType);
  const complianceStats = await getComplianceStatistics(db, projectId, { districtId });

  if (!cvAnalysis) return;

  const now = new Date().toISOString();

  // 检查是否已存在
  const existingResult = await db.query(
    'SELECT id FROM district_statistics WHERE project_id = $1 AND district_id = $2 AND school_type = $3',
    [projectId, districtId, schoolType]
  );

  if (existingResult.rows[0]) {
    // 更新
    await db.query(`
      UPDATE district_statistics
      SET school_count = $1, compliant_school_count = $2,
          cv_teacher_ratio = $3, cv_composite = $4, is_cv_compliant = $5,
          resource_compliance_rate = $6, overall_score = $7, calculated_at = $8
      WHERE id = $9
    `, [
      cvAnalysis.schoolCount,
      0,
      cvAnalysis.cvIndicators.studentTeacherRatio?.cv || null,
      cvAnalysis.cvComposite,
      cvAnalysis.isCompliant ? 1 : 0,
      complianceStats.complianceRate,
      null,  // overall_score
      now,
      existingResult.rows[0].id
    ]);
  } else {
    // 插入
    const id = 'ds-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    await db.query(`
      INSERT INTO district_statistics
      (id, project_id, district_id, school_type, school_count, compliant_school_count,
       cv_teacher_ratio, cv_composite, is_cv_compliant,
       resource_compliance_rate, overall_score, calculated_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      id,
      projectId,
      districtId,
      schoolType,
      cvAnalysis.schoolCount,
      0,
      cvAnalysis.cvIndicators.studentTeacherRatio?.cv || null,
      cvAnalysis.cvComposite,
      cvAnalysis.isCompliant ? 1 : 0,
      complianceStats.complianceRate,
      null,  // overall_score
      now,
      now
    ]);
  }
}

module.exports = {
  calculateCV,
  parseThreshold,
  checkCompliance,
  getDistrictCVAnalysis,
  getComplianceStatistics,
  getDistrictComparison,
  saveSchoolIndicatorData,
  updateDistrictStatistics
};
