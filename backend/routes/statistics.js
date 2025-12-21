const express = require('express');
const router = express.Router();
const {
  parseFormulaVariables,
  calculateDerivedValueForSample,
} = require('../services/aggregationService');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

/**
 * 根据数据指标或要素编码计算指标值
 * @param {string} code - 数据指标编码（如 D015）或要素编码（如 D015、E063）
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {Object} districtFormData - 区县填报表单数据
 * @returns {Promise<{value: number|null, displayValue: string, details: Array}>}
 */
async function calculateIndicatorValueFromElements(code, projectId, districtId, districtFormData) {
  try {
    const safeEvalFormula = (formula, valuesByCode) => {
      if (!formula) return null;
      let expr = String(formula);
      for (const [k, v] of Object.entries(valuesByCode || {})) {
        if (v === null || v === undefined || Number.isNaN(v)) return null;
        // 用单词边界替换变量，避免 E00 覆盖 E001
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v));
      }
      // 仅允许数字、空白、运算符与括号
      // 注意：字符集中的 '-' 容易触发“区间”解析问题，放到末尾最稳妥；'/' 也显式转义
      if (!/^[\d\s+*()\/.\-]+$/.test(expr)) return null;
      try {
        // eslint-disable-next-line no-new-func
        const out = new Function(`return (${expr})`)();
        return (typeof out === 'number' && Number.isFinite(out)) ? out : null;
      } catch {
        return null;
      }
    };

    // 1. 首先尝试按数据指标编码查找
    const dataIndicatorResult = await db.query(`
      SELECT di.id, di.code, di.name, di.threshold
      FROM data_indicators di
      WHERE di.code = $1
      LIMIT 1
    `, [code]);

    let primaryElement = null;
    let linkedElements = [];

    if (dataIndicatorResult.rows.length > 0) {
      // 找到了数据指标，获取其关联的要素
      const dataIndicator = dataIndicatorResult.rows[0];
      console.log(`[要素计算] 找到数据指标: ${code}`);

      const elementsResult = await db.query(`
        SELECT
          die.id as association_id,
          die.mapping_type,
          e.id as element_id,
          e.code as element_code,
          e.name as element_name,
          e.element_type,
          e.data_type,
          e.tool_id,
          e.field_id,
          e.formula,
          e.aggregation
        FROM data_indicator_elements die
        JOIN elements e ON die.element_id = e.id
        WHERE die.data_indicator_id = $1
        ORDER BY die.mapping_type ASC
      `, [dataIndicator.id]);

      if (elementsResult.rows.length > 0) {
        linkedElements = elementsResult.rows;
        primaryElement = linkedElements.find(e => e.mapping_type === 'primary') || linkedElements[0];
        console.log(`[要素计算] 数据指标关联要素: ${primaryElement.element_code} (${primaryElement.element_name})`);
      }
    }

    // 2. 如果没有通过数据指标找到要素，尝试直接按要素编码查找
    if (!primaryElement) {
      console.log(`[要素计算] 未通过数据指标找到，尝试直接查找要素: ${code}`);
      const elementResult = await db.query(`
        SELECT
          e.id as element_id,
          e.code as element_code,
          e.name as element_name,
          e.element_type,
          e.data_type,
          e.tool_id,
          e.field_id,
          e.formula,
          e.aggregation
        FROM elements e
        WHERE e.code = $1
        LIMIT 1
      `, [code]);

      if (elementResult.rows.length > 0) {
        primaryElement = elementResult.rows[0];
        linkedElements = [primaryElement];
        console.log(`[要素计算] 找到要素: ${code} (${primaryElement.element_name}), 类型: ${primaryElement.element_type}, 公式: ${primaryElement.formula || '无'}`);
      }
    }

    if (!primaryElement) {
      console.log(`[要素计算] 未找到数据指标或要素: ${code}`);
      return { value: null, displayValue: '未配置', details: [] };
    }

    // 3. 获取要素库中所有要素（用于派生要素的公式计算）
    const allElementsResult = await db.query(`
      SELECT
        e.id, e.code, e.name, e.element_type, e.data_type,
        e.tool_id, e.field_id, e.formula, e.aggregation
      FROM elements e
    `);
    const allElements = allElementsResult.rows;

    // 4. 收集填报数据
    // 对于区县级数据，从区县填报表单获取
    // 对于学校汇总数据，需要从学校填报数据汇总

    // 判断主要素的数据来源
    const primaryElementType = primaryElement.element_type;

    let calculatedValue = null;
    const details = [];

    if (primaryElementType === '派生要素') {
      // 派生要素：通过公式计算
      const formula = primaryElement.formula;
      if (!formula) {
        return { value: null, displayValue: '公式未配置', details: [] };
      }

      // 解析公式中的变量
      const referencedCodes = parseFormulaVariables(formula);

      // 收集公式所需的基础数据
      const context = {};

      for (const refCode of referencedCodes) {
        const refElement = allElements.find(e => e.code === refCode);
        if (!refElement) {
          console.log(`[要素计算] 公式引用的要素不存在: ${refCode}`);
          continue;
        }

        let refValue = null;

        if (refElement.element_type === '基础要素') {
          // 基础要素：从填报数据获取
          const fieldId = refElement.field_id;
          if (fieldId && districtFormData[fieldId] !== undefined) {
            refValue = parseFloat(districtFormData[fieldId]);
          }

          // 如果区县表单没有，尝试从学校汇总获取
          if (refValue === null || isNaN(refValue)) {
            // 查询学校填报数据汇总
            // 注意: s.data 是 text 类型，需要先转换为 jsonb
            const schoolSumResult = await db.query(`
              SELECT SUM(
                CASE
                  WHEN s.data IS NOT NULL AND s.data != ''
                  THEN CAST((s.data::jsonb)->>$1 AS NUMERIC)
                  ELSE NULL
                END
              ) as total
              FROM submissions s
              JOIN schools sc ON s.school_id = sc.id
              JOIN data_tools dt ON COALESCE(s.form_id, s.tool_id) = dt.id
              WHERE s.project_id = $2
                AND sc.district_id = $3
                AND sc.status = 'active'
                AND dt.target = '学校'
                AND s.status IN ('approved', 'submitted')
            `, [fieldId, projectId, districtId]);

            if (schoolSumResult.rows[0]?.total !== null) {
              refValue = parseFloat(schoolSumResult.rows[0].total);
            }
          }
        } else if (refElement.element_type === '派生要素') {
          // 递归计算派生要素
          const nestedResult = await calculateIndicatorValueFromElements(
            refElement.code, projectId, districtId, districtFormData
          );
          refValue = nestedResult.value;
        }

        context[refCode] = refValue;
        details.push({
          code: refCode,
          name: refElement.name,
          value: refValue,
          displayValue: refValue !== null ? String(refValue) : '待填报'
        });
      }

      // ====== 业务特判：G9(D015) 的分母应为“县域专任教师总人数” ======
      // 当前库里 E004 往往指向学校表单字段（如 primary_full_time_teacher_count），会导致区县计算分母偏小。
      // 若区县表单已填 primary_teacher_count/junior_teacher_count，则优先用其合计覆盖 E004。
      if (primaryElement.element_code === 'D015' && referencedCodes.includes('E004')) {
        const primaryTeachers = parseFloat(districtFormData.primary_teacher_count);
        const juniorTeachers = parseFloat(districtFormData.junior_teacher_count);
        const denom =
          (Number.isFinite(primaryTeachers) ? primaryTeachers : 0) +
          (Number.isFinite(juniorTeachers) ? juniorTeachers : 0);
        if (denom > 0) {
          context.E004 = denom;
          const idx = details.findIndex(d => d.code === 'E004');
          if (idx >= 0) {
            details[idx] = {
              ...details[idx],
              value: denom,
              displayValue: String(denom),
              note: '分母使用区县填报：小学专任教师数+初中专任教师数',
            };
          } else {
            details.push({
              code: 'E004',
              name: '专任教师总人数',
              value: denom,
              displayValue: String(denom),
              note: '分母使用区县填报：小学专任教师数+初中专任教师数',
            });
          }
        }
      }

      // 检查是否所有引用的值都存在
      const hasAllValues = referencedCodes.every(code => {
        const v = context[code];
        return v !== null && v !== undefined && !isNaN(v);
      });

      if (hasAllValues) {
        // 计算公式（使用 code->value 上下文直接求值）
        calculatedValue = safeEvalFormula(formula, context);
      }
    } else if (primaryElementType === '基础要素') {
      // 基础要素：直接从填报数据获取
      const fieldId = primaryElement.field_id;
      if (fieldId && districtFormData[fieldId] !== undefined) {
        calculatedValue = parseFloat(districtFormData[fieldId]);
      }
    }

    // 格式化结果
    const displayValue = calculatedValue !== null && !isNaN(calculatedValue)
      ? `${Math.round(calculatedValue * 100) / 100}`
      : '待填报';

    return {
      value: calculatedValue !== null && !isNaN(calculatedValue) ? calculatedValue : null,
      displayValue,
      details,
      formula: primaryElement.formula,
      elementCode: primaryElement.code,
      elementName: primaryElement.name
    };
  } catch (error) {
    console.error('[要素计算] 计算失败:', error);
    return { value: null, displayValue: '计算错误', details: [] };
  }
}

// 计算差异系数
function calculateCV(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return null;
  const n = validValues.length;
  const mean = validValues.reduce((sum, v) => sum + v, 0) / n;

  // 只有 1 个样本时，标准差/CV 没有统计意义：返回 cv=null（保留 mean/count 便于前端展示）
  if (n < 2) {
    return {
      cv: null,
      mean: Math.round(mean * 100) / 100,
      stdDev: null,
      count: n
    };
  }

  if (mean === 0) return { cv: 0, mean: 0, stdDev: 0, count: n };
  const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  return {
    cv: Math.round(cv * 10000) / 10000,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    count: n
  };
}

// 获取区县差异系数分析
async function getDistrictCVAnalysis(projectId, districtId, schoolType) {
  // 获取区县信息
  const districtResult = await db.query('SELECT id, name FROM districts WHERE id = $1', [districtId]);
  const district = districtResult.rows[0];
  if (!district) return null;

  // 获取该区县该类型的学校列表
  let schoolQuery = `
    SELECT s.id, s.name, s.student_count as "studentCount", s.teacher_count as "teacherCount"
    FROM schools s
    WHERE s.district_id = $1 AND s.status = 'active'
  `;
  const params = [districtId];

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

  // 计算生师比
  const studentTeacherRatios = schools
    .filter(s => s.teacherCount > 0)
    .map(s => s.studentCount / s.teacherCount);

  const cvIndicators = {
    studentTeacherRatio: calculateCV(studentTeacherRatios)
  };

  // 综合差异系数
  const cvValues = Object.values(cvIndicators)
    .filter(v => v && v.cv !== null && v.cv !== undefined)
    .map(v => v.cv);

  const cvComposite = cvValues.length > 0
    ? Math.round((cvValues.reduce((sum, v) => sum + v, 0) / cvValues.length) * 10000) / 10000
    : null;

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

// ==================== 差异系数分析 ====================

// 获取项目的差异系数分析
router.get('/projects/:projectId/cv-analysis', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolType } = req.query;

    if (!districtId) {
      return res.status(400).json({ code: 400, message: '请指定区县' });
    }

    const result = await getDistrictCVAnalysis(projectId, districtId, schoolType || '小学');

    if (!result) {
      return res.status(404).json({ code: 404, message: '未找到数据' });
    }

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有区县的差异系数汇总
router.get('/projects/:projectId/cv-summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { schoolType } = req.query;

    const districtsResult = await db.query('SELECT id, name, code FROM districts ORDER BY sort_order');
    const districts = districtsResult.rows;

    const summary = [];
    for (const district of districts) {
      const analysis = await getDistrictCVAnalysis(projectId, district.id, schoolType || '小学');
      summary.push({
        districtId: district.id,
        districtName: district.name,
        districtCode: district.code,
        schoolCount: analysis?.schoolCount || 0,
        cvComposite: analysis?.cvComposite,
        threshold: analysis?.threshold,
        isCompliant: analysis?.isCompliant
      });
    }

    const filteredSummary = summary.filter(d => d.schoolCount > 0);

    // 计算全市汇总
    const cityTotal = {
      districtCount: filteredSummary.length,
      compliantCount: filteredSummary.filter(d => d.isCompliant).length,
      avgCV: filteredSummary.length > 0
        ? Math.round((filteredSummary.reduce((sum, d) => sum + (d.cvComposite || 0), 0) / filteredSummary.length) * 10000) / 10000
        : null
    };

    res.json({
      code: 200,
      data: {
        cityTotal,
        districts: filteredSummary
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 达标率统计 ====================

// 获取项目的达标率统计
router.get('/projects/:projectId/compliance-summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolId } = req.query;

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

    res.json({
      code: 200,
      data: {
        total: parseInt(stats.total) || 0,
        compliant: parseInt(stats.compliant) || 0,
        nonCompliant: parseInt(stats.nonCompliant) || 0,
        pending: parseInt(stats.pending) || 0,
        complianceRate: parseInt(stats.total) > 0
          ? Math.round((parseInt(stats.compliant) / parseInt(stats.total)) * 10000) / 100
          : null
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取各维度达标率
router.get('/projects/:projectId/compliance-by-category', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId } = req.query;

    // 获取项目关联的指标体系
    const projectResult = await db.query(`
      SELECT indicator_system_id FROM projects WHERE id = $1
    `, [projectId]);

    const project = projectResult.rows[0];

    if (!project?.indicator_system_id) {
      return res.json({ code: 200, data: [] });
    }

    // 获取一级指标
    const categoriesResult = await db.query(`
      SELECT id, code, name FROM indicators
      WHERE system_id = $1 AND level = 1
      ORDER BY sort_order
    `, [project.indicator_system_id]);

    const categories = categoriesResult.rows;

    const result = [];
    for (const category of categories) {
      // 获取该类别下所有数据指标
      const dataIndicatorIdsResult = await db.query(`
        SELECT di.id
        FROM data_indicators di
        JOIN indicators ind ON di.indicator_id = ind.id
        WHERE ind.system_id = $1
        AND (ind.parent_id = $2 OR ind.id IN (
          SELECT id FROM indicators WHERE parent_id IN (
            SELECT id FROM indicators WHERE parent_id = $2
          )
        ))
      `, [project.indicator_system_id, category.id]);

      const dataIndicatorIds = dataIndicatorIdsResult.rows.map(r => r.id);

      if (dataIndicatorIds.length === 0) {
        result.push({
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          total: 0,
          compliant: 0,
          complianceRate: null
        });
        continue;
      }

      // 统计达标情况
      let statsQuery = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant
        FROM school_indicator_data
        WHERE project_id = $1
        AND data_indicator_id = ANY($2)
      `;
      const statsParams = [projectId, dataIndicatorIds];

      if (districtId) {
        statsQuery += ' AND school_id IN (SELECT id FROM schools WHERE district_id = $3)';
        statsParams.push(districtId);
      }

      const statsResult = await db.query(statsQuery, statsParams);
      const stats = statsResult.rows[0];

      result.push({
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        total: parseInt(stats.total) || 0,
        compliant: parseInt(stats.compliant) || 0,
        complianceRate: parseInt(stats.total) > 0
          ? Math.round((parseInt(stats.compliant) / parseInt(stats.total)) * 10000) / 100
          : null
      });
    }

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 区县对比 ====================

// 获取区县对比数据
router.get('/projects/:projectId/district-comparison', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { schoolType } = req.query;

    const districtsResult = await db.query('SELECT id, name, code FROM districts ORDER BY sort_order');
    const districts = districtsResult.rows;

    const comparison = [];
    for (const district of districts) {
      const cvAnalysis = await getDistrictCVAnalysis(projectId, district.id, schoolType || '小学');

      // 获取达标统计
      const complianceResult = await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant
        FROM school_indicator_data
        WHERE project_id = $1
          AND school_id IN (SELECT id FROM schools WHERE district_id = $2)
      `, [projectId, district.id]);

      const complianceStats = complianceResult.rows[0];

      comparison.push({
        districtId: district.id,
        districtName: district.name,
        districtCode: district.code,
        schoolCount: cvAnalysis?.schoolCount || 0,
        cvComposite: cvAnalysis?.cvComposite,
        isCvCompliant: cvAnalysis?.isCompliant,
        complianceRate: parseInt(complianceStats.total) > 0
          ? Math.round((parseInt(complianceStats.compliant) / parseInt(complianceStats.total)) * 10000) / 100
          : null,
        compliantCount: parseInt(complianceStats.compliant) || 0,
        totalIndicators: parseInt(complianceStats.total) || 0
      });
    }

    // 过滤并排序
    const filteredComparison = comparison.filter(d => d.schoolCount > 0);
    filteredComparison.sort((a, b) => {
      if (a.cvComposite === null) return 1;
      if (b.cvComposite === null) return -1;
      return a.cvComposite - b.cvComposite;
    });

    res.json({ code: 200, data: filteredComparison });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 学校指标数据 ====================

// 保存学校指标数据
router.post('/school-indicator-data', async (req, res) => {
  try {
    const { projectId, schoolId, dataIndicatorId, value, textValue, submissionId } = req.body;

    if (!projectId || !schoolId || !dataIndicatorId) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }

    // 获取阈值
    const indicatorResult = await db.query('SELECT threshold FROM data_indicators WHERE id = $1', [dataIndicatorId]);
    const indicator = indicatorResult.rows[0];

    // 判断是否达标
    let isCompliant = null;
    if (indicator?.threshold && value !== null && value !== undefined) {
      const threshold = indicator.threshold;
      const match = threshold.match(/^([≥≤><]=?|>=|<=|>|<|=)?\s*([\d.]+)/);
      if (match) {
        const op = (match[1] || '≥').replace('>=', '≥').replace('<=', '≤');
        const thresholdValue = parseFloat(match[2]);
        switch (op) {
          case '≥': isCompliant = value >= thresholdValue; break;
          case '≤': isCompliant = value <= thresholdValue; break;
          case '>': isCompliant = value > thresholdValue; break;
          case '<': isCompliant = value < thresholdValue; break;
          case '=': isCompliant = value === thresholdValue; break;
        }
      }
    }

    const id = 'sid-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString().split('T')[0];

    // 避免 upsert 覆盖主键 id：先查是否存在，再 update/insert
    const { data: existing, error: existErr } = await db
      .from('school_indicator_data')
      .select('id')
      .eq('project_id', projectId)
      .eq('school_id', schoolId)
      .eq('data_indicator_id', dataIndicatorId)
      .maybeSingle();
    if (existErr) throw existErr;

    const payload = {
      project_id: projectId,
      school_id: schoolId,
      data_indicator_id: dataIndicatorId,
      value,
      text_value: textValue,
      is_compliant: isCompliant === null ? null : (isCompliant ? 1 : 0),
      submission_id: submissionId,
      collected_at: now,
      updated_at: now,
    };

    if (existing?.id) {
      const { error } = await db
        .from('school_indicator_data')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from('school_indicator_data')
        .insert({
          id,
          ...payload,
          created_at: now,
        });
      if (error) throw error;
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量保存学校指标数据
router.post('/school-indicator-data/batch', async (req, res) => {
  try {
    const { projectId, schoolId, data, submissionId } = req.body;

    if (!projectId || !schoolId || !data || !Array.isArray(data)) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }

    const now = new Date().toISOString().split('T')[0];

    for (const item of data) {
      // 获取阈值
      const indicatorResult = await db.query('SELECT threshold FROM data_indicators WHERE id = $1', [item.dataIndicatorId]);
      const indicator = indicatorResult.rows[0];

      // 判断是否达标
      let isCompliant = null;
      if (indicator?.threshold && item.value !== null && item.value !== undefined) {
        const threshold = indicator.threshold;
        const match = threshold.match(/^([≥≤><]=?|>=|<=|>|<|=)?\s*([\d.]+)/);
        if (match) {
          const op = (match[1] || '≥').replace('>=', '≥').replace('<=', '≤');
          const thresholdValue = parseFloat(match[2]);
          switch (op) {
            case '≥': isCompliant = item.value >= thresholdValue; break;
            case '≤': isCompliant = item.value <= thresholdValue; break;
            case '>': isCompliant = item.value > thresholdValue; break;
            case '<': isCompliant = item.value < thresholdValue; break;
            case '=': isCompliant = item.value === thresholdValue; break;
          }
        }
      }

      const payload = {
        project_id: projectId,
        school_id: schoolId,
        data_indicator_id: item.dataIndicatorId,
        value: item.value,
        text_value: item.textValue,
        is_compliant: isCompliant === null ? null : (isCompliant ? 1 : 0),
        submission_id: submissionId,
        collected_at: now,
        updated_at: now,
      };

      const { data: existing, error: existErr } = await db
        .from('school_indicator_data')
        .select('id')
        .eq('project_id', projectId)
        .eq('school_id', schoolId)
        .eq('data_indicator_id', item.dataIndicatorId)
        .maybeSingle();
      if (existErr) throw existErr;

      if (existing?.id) {
        const { error } = await db
          .from('school_indicator_data')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const id = 'sid-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        const { error } = await db
          .from('school_indicator_data')
          .insert({ id, ...payload, created_at: now });
        if (error) throw error;
      }
    }

    res.json({ code: 200, message: `成功保存 ${data.length} 条数据` });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 统计快照 ====================

// 刷新区县统计快照
router.post('/projects/:projectId/refresh-statistics', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolType } = req.body;

    const now = new Date().toISOString();

    if (districtId) {
      // 刷新单个区县
      for (const type of [schoolType || '小学', '初中']) {
        const cvAnalysis = await getDistrictCVAnalysis(projectId, districtId, type);
        if (cvAnalysis) {
          const { data: existing, error: existErr } = await db
            .from('district_statistics')
            .select('id')
            .eq('project_id', projectId)
            .eq('district_id', districtId)
            .eq('school_type', type)
            .maybeSingle();
          if (existErr) throw existErr;

          const payload = {
            project_id: projectId,
            district_id: districtId,
            school_type: type,
            school_count: cvAnalysis.schoolCount,
            cv_composite: cvAnalysis.cvComposite,
            is_cv_compliant: cvAnalysis.isCompliant ? 1 : 0,
            calculated_at: now,
          };

          if (existing?.id) {
            const { error } = await db
              .from('district_statistics')
              .update(payload)
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const id = 'ds-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            const { error } = await db
              .from('district_statistics')
              .insert({ id, ...payload, created_at: now });
            if (error) throw error;
          }
        }
      }
    } else {
      // 刷新所有区县
      const districtsResult = await db.query('SELECT id FROM districts');
      const districts = districtsResult.rows;

      for (const d of districts) {
        for (const type of ['小学', '初中']) {
          const cvAnalysis = await getDistrictCVAnalysis(projectId, d.id, type);
          if (cvAnalysis && cvAnalysis.schoolCount > 0) {
            const { data: existing, error: existErr } = await db
              .from('district_statistics')
              .select('id')
              .eq('project_id', projectId)
              .eq('district_id', d.id)
              .eq('school_type', type)
              .maybeSingle();
            if (existErr) throw existErr;

            const payload = {
              project_id: projectId,
              district_id: d.id,
              school_type: type,
              school_count: cvAnalysis.schoolCount,
              cv_composite: cvAnalysis.cvComposite,
              is_cv_compliant: cvAnalysis.isCompliant ? 1 : 0,
              calculated_at: now,
            };

            if (existing?.id) {
              const { error } = await db
                .from('district_statistics')
                .update(payload)
                .eq('id', existing.id);
              if (error) throw error;
            } else {
              const id = 'ds-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
              const { error } = await db
                .from('district_statistics')
                .insert({ id, ...payload, created_at: now });
              if (error) throw error;
            }
          }
        }
      }
    }

    res.json({ code: 200, message: '统计刷新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县统计快照
router.get('/projects/:projectId/district-statistics', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolType } = req.query;

    let query = `
      SELECT ds.*, d.name as district_name, d.code as district_code
      FROM district_statistics ds
      JOIN districts d ON ds.district_id = d.id
      WHERE ds.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (districtId) {
      query += ` AND ds.district_id = $${paramIndex++}`;
      params.push(districtId);
    }

    if (schoolType) {
      query += ` AND ds.school_type = $${paramIndex++}`;
      params.push(schoolType);
    }

    query += ' ORDER BY d.sort_order, ds.school_type';

    const result = await db.query(query, params);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 区县学校指标汇总（区县管理员专用） ====================

// 获取区县下所有学校的指标汇总
router.get('/districts/:districtId/schools-indicator-summary', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId, schoolType } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请指定项目ID' });
    }

    // 获取项目关联的指标体系（用于限定 data_indicators 范围，避免同 code 不同 id 的重复指标导致统计翻倍）
    const projectResult = await db.query(
      `SELECT indicator_system_id as "indicatorSystemId" FROM projects WHERE id = $1`,
      [projectId]
    );
    const indicatorSystemId = projectResult.rows?.[0]?.indicatorSystemId || null;

    // 获取区县信息
    const districtResult = await db.query('SELECT id, name, code FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取该区县的学校列表
    let schoolQuery = `
      SELECT s.id, s.code, s.name, s.school_type as "schoolType",
             s.school_category as "schoolCategory", s.urban_rural as "urbanRural",
             s.student_count as "studentCount", s.teacher_count as "teacherCount"
      FROM schools s
      WHERE s.district_id = $1 AND s.status = 'active'
    `;
    const params = [districtId];

    if (schoolType) {
      if (schoolType === '小学') {
        schoolQuery += " AND (s.school_type = '小学' OR s.school_type = '九年一贯制')";
      } else if (schoolType === '初中') {
        schoolQuery += " AND (s.school_type = '初中' OR s.school_type = '九年一贯制' OR s.school_type = '完全中学')";
      } else {
        schoolQuery += " AND s.school_type = $2";
        params.push(schoolType);
      }
    }

    schoolQuery += ' ORDER BY s.name';

    const schoolsResult = await db.query(schoolQuery, params);
    const schools = schoolsResult.rows;

    // 需要从 submissions 实时计算的指标代码（资源配置7项指标）
    // 这些指标需要根据学校类型使用对应的学生数进行计算，确保数据一致性
    const calculatedIndicatorCodes = [
      '1.1-D1', // 每百名学生拥有高学历教师数（通过公式计算得出）
      '1.2-D1', // 每百名学生拥有骨干教师数（通过公式计算得出）
      '1.3-D1', // 每百名学生拥有体艺教师数
      '1.4-D1', // 生均教学及辅助用房面积（通过公式计算得出）
      '1.5-D1', // 生均体育运动场馆面积（通过公式计算得出）
      '1.6-D1', // 生均教学仪器设备值（通过公式计算得出）
      '1.7-D1'  // 每百名学生拥有多媒体教室数
    ];

    // 获取每个学校的指标数据和达标统计
    const schoolSummaries = [];
    for (const school of schools) {
      // 获取该学校的 submissions 数据（用于计算资源配置指标）
      const submissionResult = await db.query(`
        SELECT s.data as form_data
        FROM submissions s
        WHERE s.school_id = $1 AND s.project_id = $2 AND s.status = 'approved'
        ORDER BY s.submitted_at DESC
        LIMIT 1
      `, [school.id, projectId]);

      let formData = {};
      if (submissionResult.rows.length > 0 && submissionResult.rows[0].form_data) {
        const rawData = submissionResult.rows[0].form_data;
        if (typeof rawData === 'string') {
          try {
            formData = JSON.parse(rawData);
          } catch (e) {
            console.error('解析formData失败:', e);
            formData = {};
          }
        } else {
          formData = rawData || {};
        }
      }

      // 判断是否为一贯制学校或完全中学，需要拆分成小学部和初中部
      const isIntegratedSchool = school.schoolType === '九年一贯制' || school.schoolType === '完全中学';
      
      // 调试日志：检查formData中的学生数字段
      if (isIntegratedSchool && Object.keys(formData).length > 0) {
        console.log(`学校 ${school.name} (${school.id}) formData学生数:`, {
          primary_student_count: formData.primary_student_count,
          junior_student_count: formData.junior_student_count,
          student_count: formData.student_count,
          school_studentCount: school.studentCount
        });
      }
      
      // 确定需要处理的部门列表
      const sections = [];
      if (isIntegratedSchool) {
        // 一贯制学校和完全中学：根据筛选条件决定生成哪些部门
        // 如果没有筛选条件，生成两个部门；如果有筛选条件，只生成对应的部门
        if (!schoolType) {
          // 没有筛选条件：生成两个部门
          sections.push({ sectionType: 'primary', sectionName: '小学部', displayName: `${school.name}（小学部）` });
          sections.push({ sectionType: 'junior', sectionName: '初中部', displayName: `${school.name}（初中部）` });
        } else if (schoolType === '小学') {
          // 筛选小学：只生成小学部
          sections.push({ sectionType: 'primary', sectionName: '小学部', displayName: `${school.name}（小学部）` });
        } else if (schoolType === '初中') {
          // 筛选初中：只生成初中部
          sections.push({ sectionType: 'junior', sectionName: '初中部', displayName: `${school.name}（初中部）` });
        } else {
          // 筛选其他类型（如"九年一贯制"）：生成两个部门
          sections.push({ sectionType: 'primary', sectionName: '小学部', displayName: `${school.name}（小学部）` });
          sections.push({ sectionType: 'junior', sectionName: '初中部', displayName: `${school.name}（初中部）` });
        }
      } else {
        // 普通学校：只处理一个部门
        const actualSchoolType = school.schoolType;
        const sectionType = actualSchoolType === '小学' ? 'primary' : 'junior';
        const sectionName = actualSchoolType === '小学' ? '小学部' : '初中部';
        sections.push({ sectionType, sectionName, displayName: school.name });
      }

      // 为每个部门生成一条记录
      for (const section of sections) {
        const actualSchoolType = section.sectionType === 'primary' ? '小学' : '初中';
        
        // 根据部门类型确定学生数
        // 使用 ?? 运算符，确保0值不会被当作falsy
        let studentCount = 0;
        if (section.sectionType === 'primary') {
          // 小学部：优先使用 primary_student_count
          // 如果formData中没有primary_student_count，使用student_count，最后使用school.studentCount作为后备
          studentCount = formData.primary_student_count ?? formData.student_count ?? school.studentCount ?? 0;
        } else {
          // 初中部：优先使用 junior_student_count
          // 如果formData中没有junior_student_count，使用student_count，最后使用school.studentCount作为后备
          studentCount = formData.junior_student_count ?? formData.student_count ?? school.studentCount ?? 0;
        }

        // 计算需要实时计算的指标值（7项资源配置指标）
        // 根据部门类型确定指标代码后缀（小学部用-D1，初中部用-D2）
        const indicatorCodeSuffix = section.sectionType === 'primary' ? '-D1' : '-D2';
        const calculatedValues = {};
        if (studentCount > 0) {
          // 1.1: 每百名学生拥有高学历教师数
          let highEduTeachers = 0;
          if (section.sectionType === 'primary') {
            highEduTeachers = (
              (formData.primary_college_degree_teacher_count || 0) +
              (formData.primary_bachelor_degree_teacher_count || 0) +
              (formData.primary_master_degree_teacher_count || 0) +
              (formData.primary_doctor_degree_teacher_count || 0)
            );
          } else {
            highEduTeachers = (
              (formData.junior_bachelor_degree_teacher_count || 0) +
              (formData.junior_master_degree_teacher_count || 0) +
              (formData.junior_doctor_degree_teacher_count || 0)
            );
          }
          const L1Value = (highEduTeachers / studentCount) * 100;
          calculatedValues[`1.1${indicatorCodeSuffix}`] = Math.round(L1Value * 100) / 100;

          // 1.2: 每百名学生拥有骨干教师数
          const backboneTeachers = section.sectionType === 'primary'
            ? (formData.primary_county_backbone_teacher_count || 0)
            : (formData.junior_county_backbone_teacher_count || 0);
          const L2Value = (backboneTeachers / studentCount) * 100;
          calculatedValues[`1.2${indicatorCodeSuffix}`] = Math.round(L2Value * 100) / 100;

          // 1.3: 每百名学生拥有体艺教师数
          let peArtTeachers = 0;
          if (section.sectionType === 'primary') {
            peArtTeachers = (
              (formData.primary_pe_teacher_count || 0) +
              (formData.primary_music_teacher_count || 0) +
              (formData.primary_art_teacher_count || 0)
            );
          } else {
            peArtTeachers = (
              (formData.junior_pe_teacher_count || 0) +
              (formData.junior_music_teacher_count || 0) +
              (formData.junior_art_teacher_count || 0)
            );
          }
          const L3Value = (peArtTeachers / studentCount) * 100;
          calculatedValues[`1.3${indicatorCodeSuffix}`] = Math.round(L3Value * 100) / 100;

          // 1.4: 生均教学及辅助用房面积
          const teachingArea = section.sectionType === 'primary'
            ? (formData.primary_teaching_auxiliary_area || 0)
            : (formData.junior_teaching_auxiliary_area || 0);
          const L4Value = teachingArea / studentCount;
          calculatedValues[`1.4${indicatorCodeSuffix}`] = Math.round(L4Value * 100) / 100;

          // 1.5: 生均体育运动场馆面积
          const sportsArea = section.sectionType === 'primary'
            ? (formData.primary_sports_venue_area || 0)
            : (formData.junior_sports_venue_area || 0);
          const L5Value = sportsArea / studentCount;
          calculatedValues[`1.5${indicatorCodeSuffix}`] = Math.round(L5Value * 100) / 100;

          // 1.6: 生均教学仪器设备值（万元转元）
          const equipmentValue = section.sectionType === 'primary'
            ? (formData.primary_teaching_equipment_value || 0)
            : (formData.junior_teaching_equipment_value || 0);
          const L6Value = (equipmentValue * 10000) / studentCount;
          calculatedValues[`1.6${indicatorCodeSuffix}`] = Math.round(L6Value * 100) / 100;

          // 1.7: 每百名学生拥有多媒体教室数
          const multimediaRooms = section.sectionType === 'primary'
            ? (formData.primary_multimedia_classroom_count || 0)
            : (formData.junior_multimedia_classroom_count || 0);
          const L7Value = (multimediaRooms / studentCount) * 100;
          calculatedValues[`1.7${indicatorCodeSuffix}`] = Math.round(L7Value * 100) / 100;
        }

        // 构建指标代码过滤条件（根据部门类型过滤）
        // 小学部：只显示 -D1 后缀或名称包含（小学）的指标，排除 -D2 和（初中）
        // 初中部：只显示 -D2 后缀或名称包含（初中）的指标，排除 -D1 和（小学）
        // 对于一贯制学校和完全中学，需要严格排除另一个部门的指标
        let indicatorFilter = '';
        if (isIntegratedSchool) {
          if (section.sectionType === 'primary') {
            // 小学部：只包含 -D1 或（小学），排除 -D2 和（初中）
            indicatorFilter = " AND ((di.code LIKE '%-D1' OR di.name LIKE '%（小学）%') AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（初中）%')";
          } else {
            // 初中部：只包含 -D2 或（初中），排除 -D1 和（小学）
            indicatorFilter = " AND ((di.code LIKE '%-D2' OR di.name LIKE '%（初中）%') AND di.code NOT LIKE '%-D1' AND di.name NOT LIKE '%（小学）%')";
          }
        } else {
          // 普通学校：根据学校类型过滤
          if (school.schoolType === '小学') {
            indicatorFilter = " AND (di.code LIKE '%-D1' OR di.name LIKE '%（小学）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
          } else if (school.schoolType === '初中') {
            indicatorFilter = " AND (di.code LIKE '%-D2' OR di.name LIKE '%（初中）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
          }
        }

        // 构建需要排除的实时计算指标代码列表（根据部门类型）
        const sectionCalculatedIndicatorCodes = calculatedIndicatorCodes.map(code => {
          // 将代码中的 -D1 或 -D2 替换为当前部门的代码后缀
          if (code.includes('-D1')) {
            return code.replace('-D1', indicatorCodeSuffix);
          } else if (code.includes('-D2')) {
            return code.replace('-D2', indicatorCodeSuffix);
          }
          return code;
        });

        // 关键：避免“落库数据 + 实时计算”双计导致 7 项变 14 项
        // - 普通学校：如果已经有落库指标数据，直接以落库为准，不再实时计算 7 项资源指标
        // - 一贯制/完全中学：即使有落库数据，也需要按部门拆分实时计算（否则无法得到小学部/初中部口径）
        const storedStatsResult = await db.query(
          `
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN sid.is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
              SUM(CASE WHEN sid.is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
              SUM(CASE WHEN sid.is_compliant IS NULL THEN 1 ELSE 0 END) as pending
            FROM school_indicator_data sid
            JOIN data_indicators di ON sid.data_indicator_id = di.id
            JOIN indicators ind ON di.indicator_id = ind.id
            WHERE sid.project_id = $1 AND sid.school_id = $2
              ${indicatorSystemId ? 'AND ind.system_id = $3' : ''}
              ${indicatorFilter}
          `,
          indicatorSystemId ? [projectId, school.id, indicatorSystemId] : [projectId, school.id]
        );
        const storedStats = storedStatsResult.rows?.[0] || { total: 0, compliant: 0, nonCompliant: 0, pending: 0 };
        const storedTotal = parseInt(storedStats.total) || 0;
        const shouldCalculateRealtime = isIntegratedSchool || storedTotal === 0;

        if (!shouldCalculateRealtime) {
          // 普通学校且已有落库数据：直接返回落库统计与未达标列表
          const nonCompliantStoredResult = await db.query(
            `
              SELECT sid.data_indicator_id, sid.value, sid.text_value,
                     di.code as "indicatorCode", di.name as "indicatorName", di.threshold
              FROM school_indicator_data sid
              JOIN data_indicators di ON sid.data_indicator_id = di.id
              JOIN indicators ind ON di.indicator_id = ind.id
              WHERE sid.project_id = $1 AND sid.school_id = $2 AND sid.is_compliant = 0
                ${indicatorSystemId ? 'AND ind.system_id = $3' : ''}
                ${indicatorFilter}
              ORDER BY di.code
            `,
            indicatorSystemId ? [projectId, school.id, indicatorSystemId] : [projectId, school.id]
          );

          schoolSummaries.push({
            school: {
              id: school.id,
              code: school.code,
              name: section.displayName,
              schoolType: school.schoolType,
              schoolCategory: school.schoolCategory,
              urbanRural: school.urbanRural,
              studentCount,
              teacherCount: school.teacherCount,
              studentTeacherRatio: school.teacherCount > 0
                ? Math.round((studentCount / school.teacherCount) * 100) / 100
                : null,
              sectionType: section.sectionType,
              sectionName: section.sectionName
            },
            statistics: {
              total: storedTotal,
              compliant: parseInt(storedStats.compliant) || 0,
              nonCompliant: parseInt(storedStats.nonCompliant) || 0,
              pending: parseInt(storedStats.pending) || 0
            },
            complianceRate: storedTotal > 0
              ? Math.round(((parseInt(storedStats.compliant) || 0) / storedTotal) * 10000) / 100
              : null,
            nonCompliantIndicators: nonCompliantStoredResult.rows || []
          });

          // 已使用落库数据处理完本 section
          continue;
        }

        // 获取该部门的指标数据统计（排除需要实时计算的指标）
        const statsResult = await db.query(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
            SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
            SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
          FROM school_indicator_data sid
          JOIN data_indicators di ON sid.data_indicator_id = di.id
          JOIN indicators ind ON di.indicator_id = ind.id
          WHERE sid.project_id = $1 AND sid.school_id = $2
            AND di.code NOT IN ($3, $4, $5, $6, $7, $8, $9)${indicatorSystemId ? ' AND ind.system_id = $10' : ''}${indicatorFilter}
        `, indicatorSystemId
          ? [projectId, school.id, ...sectionCalculatedIndicatorCodes, indicatorSystemId]
          : [projectId, school.id, ...sectionCalculatedIndicatorCodes]
        );

        const stats = statsResult.rows[0];
        let total = parseInt(stats.total) || 0;
        let compliant = parseInt(stats.compliant) || 0;
        let nonCompliant = parseInt(stats.nonCompliant) || 0;

        // 获取需要实时计算的指标的阈值和达标状态（根据部门类型）
        const calculatedIndicatorsResult = await db.query(
          `
            SELECT di.id, di.code, di.name, di.threshold
            FROM data_indicators di
            JOIN indicators ind ON di.indicator_id = ind.id
            WHERE (di.code LIKE '%1.1${indicatorCodeSuffix}%' OR di.code LIKE '%1.2${indicatorCodeSuffix}%'
                   OR di.code LIKE '%1.3${indicatorCodeSuffix}%' OR di.code LIKE '%1.4${indicatorCodeSuffix}%'
                   OR di.code LIKE '%1.5${indicatorCodeSuffix}%' OR di.code LIKE '%1.6${indicatorCodeSuffix}%'
                   OR di.code LIKE '%1.7${indicatorCodeSuffix}%')
              ${indicatorSystemId ? 'AND ind.system_id = $1' : ''}
          `,
          indicatorSystemId ? [indicatorSystemId] : []
        );

        // 去重：避免同 code 不同 id 的 data_indicators 被重复计入（导致 7 项变 14 项）
        const calculatedIndicators = [];
        const seenCalcCode = new Set();
        for (const row of (calculatedIndicatorsResult.rows || [])) {
          const m = row.code?.match(/(\d+\.\d+-\w+)/);
          const normalized = (m && m[1]) ? m[1] : row.code;
          if (!normalized) continue;
          if (seenCalcCode.has(normalized)) continue;
          seenCalcCode.add(normalized);
          calculatedIndicators.push(row);
        }
        const nonCompliantCalculated = [];

        // 创建代码映射：将数据库中的实际代码映射到我们计算的指标代码
        const codeMapping = {
          [`1.1${indicatorCodeSuffix}`]: [`1.1${indicatorCodeSuffix}`],
          [`1.2${indicatorCodeSuffix}`]: [`1.2${indicatorCodeSuffix}`],
          [`1.3${indicatorCodeSuffix}`]: [`1.3${indicatorCodeSuffix}`],
          [`1.4${indicatorCodeSuffix}`]: [`1.4${indicatorCodeSuffix}`],
          [`1.5${indicatorCodeSuffix}`]: [`1.5${indicatorCodeSuffix}`],
          [`1.6${indicatorCodeSuffix}`]: [`1.6${indicatorCodeSuffix}`],
          [`1.7${indicatorCodeSuffix}`]: [`1.7${indicatorCodeSuffix}`]
        };

        for (const indicator of calculatedIndicators) {
          // 尝试匹配指标代码（支持不同的代码格式）
          let matchedCode = null;
          for (const [calcCode, patterns] of Object.entries(codeMapping)) {
            if (indicator.code === calcCode || indicator.code.includes(calcCode) || 
                patterns.some(p => indicator.code.includes(p))) {
              matchedCode = calcCode;
              break;
            }
          }
          
          // 如果无法匹配，尝试从代码中提取模式（如从 SY-YZJH-1-3-D1 提取 1.3-D1）
          if (!matchedCode) {
            const codeMatch = indicator.code.match(/(\d+\.\d+-\w+)/);
            if (codeMatch && codeMatch[1].endsWith(indicatorCodeSuffix)) {
              matchedCode = codeMatch[1];
            }
          }

          const calculatedValue = matchedCode ? calculatedValues[matchedCode] : null;
          if (calculatedValue !== undefined && calculatedValue !== null) {
            total++;
            // 判断是否达标
            let isCompliant = null;
            if (indicator.threshold) {
              const threshold = indicator.threshold;
              const match = threshold.match(/^([≥≤><]=?|>=|<=|>|<|=)?\s*([\d.]+)/);
              if (match) {
                const op = (match[1] || '≥').replace('>=', '≥').replace('<=', '≤');
                const thresholdValue = parseFloat(match[2]);
                switch (op) {
                  case '≥': isCompliant = calculatedValue >= thresholdValue; break;
                  case '≤': isCompliant = calculatedValue <= thresholdValue; break;
                  case '>': isCompliant = calculatedValue > thresholdValue; break;
                  case '<': isCompliant = calculatedValue < thresholdValue; break;
                  case '=': isCompliant = calculatedValue === thresholdValue; break;
                }
              }
            }
            if (isCompliant === true) {
              compliant++;
            } else if (isCompliant === false) {
              nonCompliant++;
              nonCompliantCalculated.push({
                data_indicator_id: indicator.id,
                value: calculatedValue,
                threshold: indicator.threshold,
                text_value: null,
                indicatorCode: indicator.code,
                indicatorName: indicator.name
              });
            }
          }
        }

        // 获取未达标指标列表（排除需要实时计算的指标，并根据部门类型过滤）
        const nonCompliantResult = await db.query(`
          SELECT sid.data_indicator_id, sid.value, sid.text_value,
                 di.code as "indicatorCode", di.name as "indicatorName", di.threshold
          FROM school_indicator_data sid
          JOIN data_indicators di ON sid.data_indicator_id = di.id
          JOIN indicators ind ON di.indicator_id = ind.id
          WHERE sid.project_id = $1 AND sid.school_id = $2 AND sid.is_compliant = 0
            AND di.code NOT IN ($3, $4, $5, $6, $7, $8, $9)${indicatorSystemId ? ' AND ind.system_id = $10' : ''}${indicatorFilter}
          ORDER BY di.code
        `, indicatorSystemId
          ? [projectId, school.id, ...sectionCalculatedIndicatorCodes, indicatorSystemId]
          : [projectId, school.id, ...sectionCalculatedIndicatorCodes]
        );

        // 合并未达标指标列表
        const allNonCompliantIndicators = [...nonCompliantResult.rows, ...nonCompliantCalculated];

        // 最终按规范码（如 1.3-D1）去重，避免历史脏数据导致展示重复
        const dedupedNonCompliantIndicators = [];
        const seenNonCompliantCode = new Set();
        for (const item of allNonCompliantIndicators) {
          const rawCode = item.indicatorCode || item.code || '';
          const m = rawCode.match(/(\d+\.\d+-\w+)/);
          const normalized = (m && m[1]) ? m[1] : rawCode;
          if (!normalized) continue;
          if (seenNonCompliantCode.has(normalized)) continue;
          seenNonCompliantCode.add(normalized);
          dedupedNonCompliantIndicators.push(item);
        }

        // 根据部门类型确定学生数和教师数
        // studentCount 已经在上面根据部门类型正确设置了（会fallback到school.studentCount）
        let finalStudentCount = studentCount;
        let finalTeacherCount = school.teacherCount;
        
        if (isIntegratedSchool) {
          // 对于一贯制学校，优先使用各部门的专任教师数
          // 使用 ?? 运算符，确保0值不会被当作falsy
          // 如果没有部门教师数，使用school.teacherCount作为后备
          const sectionTeacherCount = section.sectionType === 'primary'
            ? (formData.primary_full_time_teacher_count ?? formData.full_time_teacher_count ?? school.teacherCount ?? 0)
            : (formData.junior_full_time_teacher_count ?? formData.full_time_teacher_count ?? school.teacherCount ?? 0);
          
          // studentCount 已经在上面根据部门类型正确设置了
          // 对于一贯制学校，优先使用各部门的学生数
          // 如果没有部门学生数，studentCount会fallback到formData.student_count或school.studentCount
          // 所以直接使用studentCount即可
          finalStudentCount = studentCount;
          
          // 使用部门教师数（如果存在），否则使用school.teacherCount
          finalTeacherCount = sectionTeacherCount;
        }

        schoolSummaries.push({
          school: {
            id: school.id,
            code: school.code,
            name: section.displayName,
            schoolType: isIntegratedSchool ? `${school.schoolType} - ${section.sectionName}` : school.schoolType,
            schoolCategory: school.schoolCategory,
            urbanRural: school.urbanRural,
            studentCount: finalStudentCount,
            teacherCount: finalTeacherCount,
            studentTeacherRatio: finalTeacherCount > 0
              ? Math.round((finalStudentCount / finalTeacherCount) * 100) / 100
              : null,
            sectionType: section.sectionType,
            sectionName: section.sectionName
          },
          statistics: {
            total,
            compliant,
            nonCompliant,
            pending: parseInt(stats.pending) || 0
          },
          complianceRate: total > 0 ? Math.round((compliant / total) * 10000) / 100 : null,
          nonCompliantIndicators: dedupedNonCompliantIndicators
        });
      }
    }

    // 汇总统计
    const summary = {
      schoolCount: schools.length,
      totalIndicators: schoolSummaries.reduce((sum, s) => sum + s.statistics.total, 0),
      totalCompliant: schoolSummaries.reduce((sum, s) => sum + s.statistics.compliant, 0),
      totalNonCompliant: schoolSummaries.reduce((sum, s) => sum + s.statistics.nonCompliant, 0),
      avgComplianceRate: schoolSummaries.length > 0
        ? Math.round((schoolSummaries.reduce((sum, s) => sum + (s.complianceRate || 0), 0) / schoolSummaries.length) * 100) / 100
        : null
    };

    res.json({
      code: 200,
      data: {
        district,
        summary,
        schools: schoolSummaries
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个学校的详细指标数据
router.get('/schools/:schoolId/indicator-data', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { projectId, sectionType } = req.query; // sectionType: 'primary' | 'junior'

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请指定项目ID' });
    }

    // 获取学校信息
    const schoolResult = await db.query(`
      SELECT s.id, s.code, s.name, s.school_type as "schoolType",
             s.student_count as "studentCount", s.teacher_count as "teacherCount",
             d.id as "districtId", d.name as "districtName"
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.id = $1
    `, [schoolId]);

    const school = schoolResult.rows[0];
    if (!school) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 判断是否为一贯制学校或完全中学
    const isIntegratedSchool = school.schoolType === '九年一贯制' || school.schoolType === '完全中学';
    
    // 根据学校类型和部门类型构建指标过滤条件
    let indicatorFilter = '';
    if (isIntegratedSchool && sectionType) {
      // 一贯制学校或完全中学，根据部门类型过滤
      if (sectionType === 'primary') {
        // 小学部：只显示 -D1 后缀或名称包含（小学）的指标
        indicatorFilter = " AND (di.code LIKE '%-D1' OR di.name LIKE '%（小学）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
      } else if (sectionType === 'junior') {
        // 初中部：只显示 -D2 后缀或名称包含（初中）的指标
        indicatorFilter = " AND (di.code LIKE '%-D2' OR di.name LIKE '%（初中）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
      }
    } else if (school.schoolType === '小学') {
      indicatorFilter = " AND (di.code LIKE '%-D1' OR di.name LIKE '%（小学）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
    } else if (school.schoolType === '初中') {
      indicatorFilter = " AND (di.code LIKE '%-D2' OR di.name LIKE '%（初中）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
    }
    // 如果是一贯制学校或完全中学但没有指定部门类型，显示所有指标（保持向后兼容）

    // 获取该学校的指标数据（根据学校类型和部门类型过滤）
    const indicatorDataResult = await db.query(`
      SELECT sid.id, sid.data_indicator_id as "dataIndicatorId",
             sid.value, sid.text_value as "textValue",
             sid.is_compliant as "isCompliant",
             sid.collected_at as "collectedAt",
             sid.submission_id as "submissionId",
             di.code as "indicatorCode", di.name as "indicatorName",
             di.threshold, di.description as "indicatorDescription"
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.project_id = $1 AND sid.school_id = $2${indicatorFilter}
      ORDER BY di.code
    `, [projectId, schoolId]);

    // 统计
    const data = indicatorDataResult.rows;
    const stats = {
      total: data.length,
      compliant: data.filter(d => d.isCompliant === 1).length,
      nonCompliant: data.filter(d => d.isCompliant === 0).length,
      pending: data.filter(d => d.isCompliant === null).length
    };

    // 初始化学生数和教师数（默认使用学校的基础数据）
    let finalStudentCount = school.studentCount;
    let finalTeacherCount = school.teacherCount;
    
    // 如果是一贯制学校或完全中学，需要计算实时指标
    let calculatedIndicators = [];
    if (isIntegratedSchool && sectionType) {
      // 获取该学校的 submissions 数据（用于计算资源配置指标）
      const submissionResult = await db.query(`
        SELECT s.data as form_data
        FROM submissions s
        WHERE s.school_id = $1 AND s.project_id = $2 AND s.status = 'approved'
        ORDER BY s.submitted_at DESC
        LIMIT 1
      `, [schoolId, projectId]);

      let formData = {};
      if (submissionResult.rows.length > 0 && submissionResult.rows[0].form_data) {
        const rawData = submissionResult.rows[0].form_data;
        if (typeof rawData === 'string') {
          try {
            formData = JSON.parse(rawData);
          } catch (e) {
            formData = {};
          }
        } else {
          formData = rawData || {};
        }
      }

      // 根据部门类型确定学生数
      // 使用 ?? 运算符，确保0值不会被当作falsy
      const studentCount = sectionType === 'primary'
        ? (formData.primary_student_count ?? formData.student_count ?? school.studentCount ?? 0)
        : (formData.junior_student_count ?? formData.student_count ?? school.studentCount ?? 0);
      
      // 根据部门类型确定教师数
      const teacherCount = sectionType === 'primary'
        ? (formData.primary_full_time_teacher_count ?? formData.full_time_teacher_count ?? school.teacherCount ?? 0)
        : (formData.junior_full_time_teacher_count ?? formData.full_time_teacher_count ?? school.teacherCount ?? 0);
      
      // 更新最终的学生数和教师数
      finalStudentCount = studentCount;
      finalTeacherCount = teacherCount;

      // 计算需要实时计算的指标值（7项资源配置指标）
      const indicatorCodeSuffix = sectionType === 'primary' ? '-D1' : '-D2';
      const calculatedValues = {};
      
      if (studentCount > 0) {
        // 1.1: 每百名学生拥有高学历教师数
        let highEduTeachers = 0;
        if (sectionType === 'primary') {
          highEduTeachers = (
            (formData.primary_college_degree_teacher_count || 0) +
            (formData.primary_bachelor_degree_teacher_count || 0) +
            (formData.primary_master_degree_teacher_count || 0) +
            (formData.primary_doctor_degree_teacher_count || 0)
          );
        } else {
          highEduTeachers = (
            (formData.junior_bachelor_degree_teacher_count || 0) +
            (formData.junior_master_degree_teacher_count || 0) +
            (formData.junior_doctor_degree_teacher_count || 0)
          );
        }
        calculatedValues[`1.1${indicatorCodeSuffix}`] = Math.round((highEduTeachers / studentCount) * 100 * 100) / 100;

        // 1.2: 每百名学生拥有骨干教师数
        const backboneTeachers = sectionType === 'primary'
          ? (formData.primary_county_backbone_teacher_count || 0)
          : (formData.junior_county_backbone_teacher_count || 0);
        calculatedValues[`1.2${indicatorCodeSuffix}`] = Math.round((backboneTeachers / studentCount) * 100 * 100) / 100;

        // 1.3: 每百名学生拥有体艺教师数
        let peArtTeachers = 0;
        if (sectionType === 'primary') {
          peArtTeachers = (
            (formData.primary_pe_teacher_count || 0) +
            (formData.primary_music_teacher_count || 0) +
            (formData.primary_art_teacher_count || 0)
          );
        } else {
          peArtTeachers = (
            (formData.junior_pe_teacher_count || 0) +
            (formData.junior_music_teacher_count || 0) +
            (formData.junior_art_teacher_count || 0)
          );
        }
        calculatedValues[`1.3${indicatorCodeSuffix}`] = Math.round((peArtTeachers / studentCount) * 100 * 100) / 100;

        // 1.4: 生均教学及辅助用房面积
        const teachingArea = sectionType === 'primary'
          ? (formData.primary_teaching_auxiliary_area || 0)
          : (formData.junior_teaching_auxiliary_area || 0);
        calculatedValues[`1.4${indicatorCodeSuffix}`] = Math.round((teachingArea / studentCount) * 100) / 100;

        // 1.5: 生均体育运动场馆面积
        const sportsArea = sectionType === 'primary'
          ? (formData.primary_sports_venue_area || 0)
          : (formData.junior_sports_venue_area || 0);
        calculatedValues[`1.5${indicatorCodeSuffix}`] = Math.round((sportsArea / studentCount) * 100) / 100;

        // 1.6: 生均教学仪器设备值（万元转元）
        const equipmentValue = sectionType === 'primary'
          ? (formData.primary_teaching_equipment_value || 0)
          : (formData.junior_teaching_equipment_value || 0);
        calculatedValues[`1.6${indicatorCodeSuffix}`] = Math.round((equipmentValue * 10000 / studentCount) * 100) / 100;

        // 1.7: 每百名学生拥有多媒体教室数
        const multimediaRooms = sectionType === 'primary'
          ? (formData.primary_multimedia_classroom_count || 0)
          : (formData.junior_multimedia_classroom_count || 0);
        calculatedValues[`1.7${indicatorCodeSuffix}`] = Math.round((multimediaRooms / studentCount) * 100 * 100) / 100;
      }

      // 获取需要实时计算的指标的阈值和达标状态
      const calculatedIndicatorsResult = await db.query(`
        SELECT id, code, name, threshold
        FROM data_indicators
        WHERE (code LIKE '%1.1${indicatorCodeSuffix}%' OR code LIKE '%1.2${indicatorCodeSuffix}%' 
               OR code LIKE '%1.3${indicatorCodeSuffix}%' OR code LIKE '%1.4${indicatorCodeSuffix}%'
               OR code LIKE '%1.5${indicatorCodeSuffix}%' OR code LIKE '%1.6${indicatorCodeSuffix}%'
               OR code LIKE '%1.7${indicatorCodeSuffix}%')
      `);

      for (const indicator of calculatedIndicatorsResult.rows) {
        // 匹配指标代码
        let matchedCode = null;
        const codeMatch = indicator.code.match(/(\d+\.\d+-\w+)/);
        if (codeMatch && codeMatch[1].endsWith(indicatorCodeSuffix)) {
          matchedCode = codeMatch[1];
        }

        const calculatedValue = matchedCode ? calculatedValues[matchedCode] : null;
        if (calculatedValue !== undefined && calculatedValue !== null) {
          // 判断是否达标
          let isCompliant = null;
          if (indicator.threshold) {
            const threshold = indicator.threshold;
            const match = threshold.match(/^([≥≤><]=?|>=|<=|>|<|=)?\s*([\d.]+)/);
            if (match) {
              const op = (match[1] || '≥').replace('>=', '≥').replace('<=', '≤');
              const thresholdValue = parseFloat(match[2]);
              switch (op) {
                case '≥': isCompliant = calculatedValue >= thresholdValue; break;
                case '≤': isCompliant = calculatedValue <= thresholdValue; break;
                case '>': isCompliant = calculatedValue > thresholdValue; break;
                case '<': isCompliant = calculatedValue < thresholdValue; break;
                case '=': isCompliant = calculatedValue === thresholdValue; break;
              }
            }
          }

          calculatedIndicators.push({
            id: `calc-${indicator.id}`,
            dataIndicatorId: indicator.id,
            value: calculatedValue,
            textValue: null,
            isCompliant: isCompliant === true ? 1 : isCompliant === false ? 0 : null,
            collectedAt: new Date().toISOString(),
            submissionId: null,
            indicatorCode: indicator.code,
            indicatorName: indicator.name,
            threshold: indicator.threshold,
            indicatorDescription: null
          });
        }
      }
    }

    // 合并数据库指标和计算的指标
    const allIndicators = [...data, ...calculatedIndicators];
    
    // 重新统计（包含计算的指标）
    const finalStats = {
      total: allIndicators.length,
      compliant: allIndicators.filter(d => d.isCompliant === 1).length,
      nonCompliant: allIndicators.filter(d => d.isCompliant === 0).length,
      pending: allIndicators.filter(d => d.isCompliant === null).length
    };

    res.json({
      code: 200,
      data: {
        school: {
          ...school,
          // 对于一贯制学校和完全中学，使用各部门的学生数和教师数
          studentCount: finalStudentCount,
          teacherCount: finalTeacherCount,
          sectionType: sectionType || null,
          sectionName: sectionType === 'primary' ? '小学部' : sectionType === 'junior' ? '初中部' : null
        },
        statistics: finalStats,
        complianceRate: finalStats.total > 0 ? Math.round((finalStats.compliant / finalStats.total) * 10000) / 100 : null,
        indicators: allIndicators
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 城乡对比 ====================

// 获取城乡对比数据
router.get('/projects/:projectId/urban-rural-comparison', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId } = req.query;

    const urbanRuralTypes = ['城区', '镇区', '乡村'];

    const comparison = [];
    for (const type of urbanRuralTypes) {
      let schoolQuery = `
        SELECT s.id, s.student_count as "studentCount", s.teacher_count as "teacherCount"
        FROM schools s
        WHERE s.urban_rural = $1 AND s.status = 'active'
      `;
      const params = [type];

      if (districtId) {
        schoolQuery += ' AND s.district_id = $2';
        params.push(districtId);
      }

      const schoolsResult = await db.query(schoolQuery, params);
      const schools = schoolsResult.rows;

      if (schools.length === 0) {
        continue;
      }

      // 计算生师比
      const ratios = schools
        .filter(s => s.teacherCount > 0)
        .map(s => s.studentCount / s.teacherCount);

      const cvResult = calculateCV(ratios);

      comparison.push({
        urbanRuralType: type,
        schoolCount: schools.length,
        avgStudentTeacherRatio: cvResult?.mean || null,
        cvStudentTeacherRatio: cvResult?.cv || null
      });
    }

    res.json({ code: 200, data: comparison });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 资源配置7项指标汇总（区县管理员专用） ====================

// 综合达标规则配置：每所学校至少6项达标，余项不低于85%
const OVERALL_COMPLIANCE_CONFIG = {
  minCompliantCount: 6,
  minThresholdPercent: 0.85,
  description: '每所学校至少6项指标达标，余项不低于标准的85%'
};

// 7项资源配置指标定义（含85%最低阈值 thresholdMin）
const RESOURCE_INDICATORS = {
  primary: { // 小学
    L1: { name: '每百名学生拥有高学历教师数', threshold: 4.2, thresholdMin: 3.57, unit: '人', cvThreshold: 0.50 },
    L2: { name: '每百名学生拥有骨干教师数', threshold: 1.0, thresholdMin: 0.85, unit: '人', cvThreshold: 0.50 },
    L3: { name: '每百名学生拥有体艺教师数', threshold: 0.9, thresholdMin: 0.765, unit: '人', cvThreshold: 0.50 },
    L4: { name: '生均教学及辅助用房面积', threshold: 4.5, thresholdMin: 3.825, unit: '㎡', cvThreshold: 0.50 },
    L5: { name: '生均体育运动场馆面积', threshold: 7.5, thresholdMin: 6.375, unit: '㎡', cvThreshold: 0.50 },
    L6: { name: '生均教学仪器设备值', threshold: 2000, thresholdMin: 1700, unit: '元', cvThreshold: 0.50 },
    L7: { name: '每百名学生拥有多媒体教室数', threshold: 2.3, thresholdMin: 1.955, unit: '间', cvThreshold: 0.50 },
  },
  junior: { // 初中
    L1: { name: '每百名学生拥有高学历教师数', threshold: 5.3, thresholdMin: 4.505, unit: '人', cvThreshold: 0.45 },
    L2: { name: '每百名学生拥有骨干教师数', threshold: 1.0, thresholdMin: 0.85, unit: '人', cvThreshold: 0.45 },
    L3: { name: '每百名学生拥有体艺教师数', threshold: 0.9, thresholdMin: 0.765, unit: '人', cvThreshold: 0.45 },
    L4: { name: '生均教学及辅助用房面积', threshold: 5.8, thresholdMin: 4.93, unit: '㎡', cvThreshold: 0.45 },
    L5: { name: '生均体育运动场馆面积', threshold: 10.2, thresholdMin: 8.67, unit: '㎡', cvThreshold: 0.45 },
    L6: { name: '生均教学仪器设备值', threshold: 2500, thresholdMin: 2125, unit: '元', cvThreshold: 0.45 },
    L7: { name: '每百名学生拥有多媒体教室数', threshold: 2.4, thresholdMin: 2.04, unit: '间', cvThreshold: 0.45 },
  }
};

// 获取区县资源配置7项指标汇总
router.get('/districts/:districtId/resource-indicators-summary', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId, schoolType = '小学' } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请指定项目ID' });
    }

    // 获取区县信息
    const districtResult = await db.query('SELECT id, name, code FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 根据学校类型确定指标配置
    const indicatorConfig = schoolType === '初中' ? RESOURCE_INDICATORS.junior : RESOURCE_INDICATORS.primary;

    // 获取该区县的学校列表
    let schoolQuery = `
      SELECT s.id, s.code, s.name, s.school_type as "schoolType",
             s.student_count as "studentCount", s.teacher_count as "teacherCount"
      FROM schools s
      WHERE s.district_id = $1 AND s.status = 'active'
    `;
    const params = [districtId];

    if (schoolType === '小学') {
      schoolQuery += " AND (s.school_type = '小学' OR s.school_type = '九年一贯制')";
    } else if (schoolType === '初中') {
      schoolQuery += " AND (s.school_type = '初中' OR s.school_type = '九年一贯制' OR s.school_type = '完全中学')";
    }

    schoolQuery += ' ORDER BY s.name';

    const schoolsResult = await db.query(schoolQuery, params);
    const schools = schoolsResult.rows;

    if (schools.length === 0) {
      return res.json({
        code: 200,
        data: {
          district,
          schoolType,
          summary: {
            schoolCount: 0,
            cvIndicators: [],
            allCompliant: null
          },
          schools: []
        }
      });
    }

    // 获取每个学校的指标数据
    const schoolIndicators = [];
    const indicatorValuesMap = { L1: [], L2: [], L3: [], L4: [], L5: [], L6: [], L7: [] };

    for (const school of schools) {
      // 从 submissions 数据中获取学校的基础数据
      // 规则：优先使用 approved；若没有 approved，则回退到最新的 submitted/rejected（避免“没有 approved 就全是 0”的误导）
      // 注意：draft 通常是未完成数据，不纳入统计
      const submissionResult = await db.query(`
        SELECT s.data as form_data,
               s.status as submission_status,
               s.submitted_at as submitted_at
        FROM submissions s
        WHERE s.school_id = $1 AND s.project_id = $2
          AND s.status IN ('approved', 'submitted', 'rejected')
        ORDER BY
          CASE WHEN s.status = 'approved' THEN 0 ELSE 1 END,
          s.submitted_at DESC
        LIMIT 1
      `, [school.id, projectId]);

      let formData = {};
      const submissionStatus = submissionResult.rows?.[0]?.submission_status || null;
      const submittedAt = submissionResult.rows?.[0]?.submitted_at || null;
      const hasSubmission = submissionResult.rows.length > 0;

      if (submissionResult.rows.length > 0 && submissionResult.rows[0].form_data) {
        // 如果 data 是 JSON 字符串，需要解析
        const rawData = submissionResult.rows[0].form_data;
        if (typeof rawData === 'string') {
          try {
            formData = JSON.parse(rawData);
          } catch (e) {
            formData = {};
          }
        } else {
          formData = rawData || {};
        }
      }

      // 计算7项指标
      // 根据学校类型确定学生数（小学用小学部学生数，初中用初中部学生数）
      // 重要：如果没有任何有效 submission（approved/submitted/rejected），则不应将缺失字段当作 0 参与计算；
      // 否则会出现“全 0 且未达标”的假象。这里保持 studentCount 用于展示，但指标值返回 null。
      let studentCount = 0;
      if (hasSubmission) {
        if (schoolType === '小学') {
          studentCount = formData.primary_student_count || formData.student_count || school.studentCount || 0;
        } else {
          studentCount = formData.junior_student_count || formData.student_count || school.studentCount || 0;
        }
      } else {
        studentCount = school.studentCount || 0;
      }
      const indicators = {};

      if (hasSubmission && studentCount > 0) {
        // L1: 每百名学生拥有高学历教师数
        // 小学: (专科+本科+硕士+博士) / 学生数 * 100
        // 初中: (本科+硕士+博士) / 学生数 * 100
        let highEduTeachers = 0;
        if (schoolType === '小学') {
          highEduTeachers = (
            (formData.primary_college_degree_teacher_count || 0) +
            (formData.primary_bachelor_degree_teacher_count || 0) +
            (formData.primary_master_degree_teacher_count || 0) +
            (formData.primary_doctor_degree_teacher_count || 0)
          );
        } else {
          highEduTeachers = (
            (formData.junior_bachelor_degree_teacher_count || 0) +
            (formData.junior_master_degree_teacher_count || 0) +
            (formData.junior_doctor_degree_teacher_count || 0)
          );
        }
        const L1Value = (highEduTeachers / studentCount) * 100;
        indicators.L1 = {
          value: Math.round(L1Value * 100) / 100,
          threshold: indicatorConfig.L1.threshold,
          isCompliant: L1Value >= indicatorConfig.L1.threshold
        };
        indicatorValuesMap.L1.push(L1Value);

        // L2: 每百名学生拥有骨干教师数
        const backboneTeachers = schoolType === '小学'
          ? (formData.primary_county_backbone_teacher_count || 0)
          : (formData.junior_county_backbone_teacher_count || 0);
        const L2Value = (backboneTeachers / studentCount) * 100;
        indicators.L2 = {
          value: Math.round(L2Value * 100) / 100,
          threshold: indicatorConfig.L2.threshold,
          isCompliant: L2Value >= indicatorConfig.L2.threshold
        };
        indicatorValuesMap.L2.push(L2Value);

        // L3: 每百名学生拥有体艺教师数
        let peArtTeachers = 0;
        if (schoolType === '小学') {
          peArtTeachers = (
            (formData.primary_pe_teacher_count || 0) +
            (formData.primary_music_teacher_count || 0) +
            (formData.primary_art_teacher_count || 0)
          );
        } else {
          peArtTeachers = (
            (formData.junior_pe_teacher_count || 0) +
            (formData.junior_music_teacher_count || 0) +
            (formData.junior_art_teacher_count || 0)
          );
        }
        const L3Value = (peArtTeachers / studentCount) * 100;
        indicators.L3 = {
          value: Math.round(L3Value * 100) / 100,
          threshold: indicatorConfig.L3.threshold,
          isCompliant: L3Value >= indicatorConfig.L3.threshold
        };
        indicatorValuesMap.L3.push(L3Value);

        // L4: 生均教学及辅助用房面积
        const teachingArea = schoolType === '小学'
          ? (formData.primary_teaching_auxiliary_area || 0)
          : (formData.junior_teaching_auxiliary_area || 0);
        const L4Value = teachingArea / studentCount;
        indicators.L4 = {
          value: Math.round(L4Value * 100) / 100,
          threshold: indicatorConfig.L4.threshold,
          isCompliant: L4Value >= indicatorConfig.L4.threshold
        };
        indicatorValuesMap.L4.push(L4Value);

        // L5: 生均体育运动场馆面积
        const sportsArea = schoolType === '小学'
          ? (formData.primary_sports_venue_area || 0)
          : (formData.junior_sports_venue_area || 0);
        const L5Value = sportsArea / studentCount;
        indicators.L5 = {
          value: Math.round(L5Value * 100) / 100,
          threshold: indicatorConfig.L5.threshold,
          isCompliant: L5Value >= indicatorConfig.L5.threshold
        };
        indicatorValuesMap.L5.push(L5Value);

        // L6: 生均教学仪器设备值（万元转元）
        const equipmentValue = schoolType === '小学'
          ? (formData.primary_teaching_equipment_value || 0)
          : (formData.junior_teaching_equipment_value || 0);
        const L6Value = (equipmentValue * 10000) / studentCount;
        indicators.L6 = {
          value: Math.round(L6Value * 100) / 100,
          threshold: indicatorConfig.L6.threshold,
          isCompliant: L6Value >= indicatorConfig.L6.threshold
        };
        indicatorValuesMap.L6.push(L6Value);

        // L7: 每百名学生拥有多媒体教室数
        const multimediaRooms = schoolType === '小学'
          ? (formData.primary_multimedia_classroom_count || 0)
          : (formData.junior_multimedia_classroom_count || 0);
        const L7Value = (multimediaRooms / studentCount) * 100;
        indicators.L7 = {
          value: Math.round(L7Value * 100) / 100,
          threshold: indicatorConfig.L7.threshold,
          isCompliant: L7Value >= indicatorConfig.L7.threshold
        };
        indicatorValuesMap.L7.push(L7Value);
      } else {
        // 没有有效 submission 或学生数为0：所有指标设为 null（避免误把缺失数据当作 0）
        ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].forEach(key => {
          indicators[key] = { value: null, threshold: indicatorConfig[key].threshold, isCompliant: null };
        });
      }

      // 计算达标数
      const compliantCount = Object.values(indicators).filter(ind => ind.isCompliant === true).length;
      const totalCount = Object.values(indicators).filter(ind => ind.value !== null).length;

      // 综合达标判定：至少6项达标，余项不低于85%（使用配置的 thresholdMin）
      let isOverallCompliant = null;
      let belowMinThresholdCount = 0;
      const overallComplianceDetails = [];

      if (totalCount > 0) {
        // 检查未达标项是否高于 thresholdMin
        for (const [key, ind] of Object.entries(indicators)) {
          if (ind.isCompliant === false && ind.value !== null) {
            const minThreshold = indicatorConfig[key].thresholdMin;
            if (ind.value < minThreshold) {
              belowMinThresholdCount++;
              overallComplianceDetails.push(
                `${indicatorConfig[key].name}: ${ind.value}${indicatorConfig[key].unit} 低于最低要求 ${minThreshold}${indicatorConfig[key].unit}（标准的85%）`
              );
            } else {
              overallComplianceDetails.push(
                `${indicatorConfig[key].name}: ${ind.value}${indicatorConfig[key].unit} 未达标准 ${ind.threshold}${indicatorConfig[key].unit}，但高于最低要求 ${minThreshold}${indicatorConfig[key].unit}`
              );
            }
          }
        }

        // 综合判定：至少6项达标 AND 未达标项都不低于85%
        const meetsMinCompliant = compliantCount >= OVERALL_COMPLIANCE_CONFIG.minCompliantCount;
        const allAboveMinThreshold = belowMinThresholdCount === 0;
        isOverallCompliant = meetsMinCompliant && allAboveMinThreshold;
      }

      // 生成综合达标消息
      let overallComplianceMessage = '';
      if (isOverallCompliant === true) {
        overallComplianceMessage = `综合达标：${compliantCount}/${totalCount}项达标`;
        if (compliantCount < totalCount) {
          overallComplianceMessage += `，${totalCount - compliantCount}项未达标但高于85%标准`;
        }
      } else if (isOverallCompliant === false) {
        const reasons = [];
        if (compliantCount < OVERALL_COMPLIANCE_CONFIG.minCompliantCount) {
          reasons.push(`达标项仅${compliantCount}项（需至少${OVERALL_COMPLIANCE_CONFIG.minCompliantCount}项）`);
        }
        if (belowMinThresholdCount > 0) {
          reasons.push(`${belowMinThresholdCount}项低于标准的85%`);
        }
        overallComplianceMessage = `综合未达标：${reasons.join('；')}`;
      }

      // 名称展示：九年一贯制/完全中学在不同学段下加后缀（用于区县管理员工作台展示）
      let displayName = school.name;
      const needSuffix = school.schoolType === '九年一贯制' || school.schoolType === '完全中学';
      if (needSuffix && (schoolType === '小学' || schoolType === '初中')) {
        const suffix = schoolType === '小学' ? '（小学部）' : '（初中部）';
        if (!displayName.endsWith(suffix)) {
          displayName = `${displayName}${suffix}`;
        }
      }

      schoolIndicators.push({
        id: school.id,
        code: school.code,
        name: displayName,
        schoolType: school.schoolType,
        studentCount: studentCount,
        submissionStatus,
        submittedAt,
        indicators,
        compliantCount,
        totalCount,
        // 综合达标判定结果
        isOverallCompliant,
        overallComplianceMessage,
        belowMinThresholdCount,
        overallComplianceDetails
      });
    }

    // 计算7个差异系数
    const cvIndicators = [];
    for (const [key, config] of Object.entries(indicatorConfig)) {
      const values = indicatorValuesMap[key];
      const cvResult = calculateCV(values);
      cvIndicators.push({
        code: key,
        name: config.name,
        unit: config.unit,
        cv: cvResult?.cv ?? null,
        mean: cvResult?.mean ?? null,
        stdDev: cvResult?.stdDev ?? null,
        count: cvResult?.count ?? 0,
        threshold: config.cvThreshold,
        isCompliant: cvResult && cvResult.cv !== null ? cvResult.cv <= config.cvThreshold : null
      });
    }

    // 判断差异系数是否全部达标
    const compliantCvCount = cvIndicators.filter(cv => cv.isCompliant === true).length;
    const totalCvCount = cvIndicators.filter(cv => cv.cv !== null).length;
    const allCvCompliant = totalCvCount > 0 ? (compliantCvCount === totalCvCount) : null;

    // 统计学校综合达标情况（至少6项达标，余项≥85%）
    const overallCompliantSchools = schoolIndicators.filter(s => s.isOverallCompliant === true).length;
    const overallNonCompliantSchools = schoolIndicators.filter(s => s.isOverallCompliant === false).length;
    const overallPendingSchools = schoolIndicators.filter(s => s.isOverallCompliant === null).length;

    res.json({
      code: 200,
      data: {
        district,
        schoolType,
        summary: {
          schoolCount: schools.length,
          cvIndicators,
          compliantCvCount,
          totalCvCount,
          allCvCompliant,  // 差异系数是否全部达标
          allCompliant: allCvCompliant,  // 向后兼容别名（无可计算CV时为 null）
          // 学校综合达标统计（至少6项达标，余项≥85%）
          overallCompliance: {
            rule: OVERALL_COMPLIANCE_CONFIG.description || '每所学校至少6项指标达标，余项不低于标准的85%',
            minCompliantCount: OVERALL_COMPLIANCE_CONFIG.minCompliantCount,
            minThresholdPercent: OVERALL_COMPLIANCE_CONFIG.minThresholdPercent,
            compliantSchools: overallCompliantSchools,
            nonCompliantSchools: overallNonCompliantSchools,
            pendingSchools: overallPendingSchools,
            complianceRate: schools.length > 0
              ? Math.round((overallCompliantSchools / schools.length) * 10000) / 100
              : null,
            allSchoolsCompliant: overallCompliantSchools === schools.length && schools.length > 0
          }
        },
        schools: schoolIndicators
      }
    });
  } catch (error) {
    console.error('获取资源配置指标汇总失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 政府保障程度15项指标汇总（区县管理员专用） ====================

// 政府保障程度15项指标定义
// dataSource: 'district' - 从区县填报表单获取, 'school_aggregate' - 从学校填报汇总计算
const GOVERNMENT_GUARANTEE_INDICATORS = [
  {
    code: 'G1',
    name: '县域内义务教育学校规划布局合理，符合国家规定要求',
    shortName: '规划布局',
    type: 'material',
    dataSource: 'district',
    materialField: 'school_layout_material',
    threshold: '需提供佐证材料',
    description: '需提供规划布局、批复与实施等佐证资料'
  },
  {
    code: 'G2',
    name: '城乡义务教育学校建设标准统一',
    shortName: '统一标准',
    type: 'material',
    dataSource: 'district',
    materialField: 'unified_standard_material',
    threshold: '需提供佐证材料',
    description: '需提供佐证材料证明城乡学校建设标准统一'
  },
  {
    code: 'G3',
    name: '每12个班级配备音乐、美术专用教室1间以上且面积达标',
    shortName: '音美教室',
    type: 'school_aggregate',
    dataSource: 'school_aggregate',
    threshold: '所有学校达标',
    description: '基于学校填报的音乐/美术教室数据汇总判定'
  },
  {
    code: 'G4',
    name: '学校规模控制达标',
    shortName: '规模控制',
    type: 'school_aggregate',
    dataSource: 'school_aggregate',
    threshold: '超规模学校数=0',
    description: '小学/初中≤2000人，九年一贯制≤2500人'
  },
  {
    code: 'G5',
    name: '班级学生数控制达标',
    shortName: '班额控制',
    type: 'school_aggregate',
    dataSource: 'school_aggregate',
    threshold: '超标班级数=0',
    description: '小学≤45人/班，初中≤50人/班'
  },
  {
    code: 'G6',
    name: '不足100人的规模较小学校按不低于100人核定公用经费',
    shortName: '小规模学校经费',
    type: 'school_aggregate',
    dataSource: 'school_aggregate',
    threshold: '达标',
    description: '小规模学校按不低于100人核定公用经费'
  },
  {
    code: 'G7',
    name: '特殊教育学校生均公用经费不低于8000元',
    shortName: '特教经费',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'special_education_funding', name: '特教经费拨付总额' },
      { id: 'district_special_education_student_count', name: '特教学生人数' }
    ],
    threshold: 8000,
    operator: '>=',
    unit: '元',
    description: '特殊教育学校生均公用经费不低于8000元'
  },
  {
    code: 'G8',
    name: '义务教育学校教师平均工资不低于当地公务员平均工资',
    shortName: '教师工资',
    type: 'comparison',
    dataSource: 'district',
    dataFields: [
      { id: 'teacher_avg_salary', name: '教师年平均工资' },
      { id: 'civil_servant_avg_salary', name: '公务员年平均工资' }
    ],
    threshold: '教师工资≥公务员工资',
    description: '教师年平均工资收入水平不低于当地公务员'
  },
  {
    code: 'G9',
    name: '教师5年360学时培训完成率达到100%',
    shortName: '培训完成率',
    type: 'element_linked',
    dataSource: 'district',
    dataIndicatorCode: 'D015',  // 关联的数据指标编码
    fallbackField: 'teacher_training_completion_rate',  // 备用：直接从表单获取
    threshold: 100,
    operator: '>=',
    unit: '%',
    description: '教师5年360学时培训完成率（通过要素 E063/E004*100 计算）'
  },
  {
    code: 'G10',
    name: '县级教育行政部门统筹分配各校教职工编制和岗位数量',
    shortName: '编制统筹',
    type: 'material',
    dataSource: 'district',
    materialField: 'staff_quota_allocation_material',
    threshold: '需提供佐证材料',
    description: '需提供编制核定、岗位设置与分配文件'
  },
  {
    code: 'G11',
    name: '教师交流轮岗比例达标',
    shortName: '交流轮岗',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'exchange_eligible_teacher_count', name: '符合条件教师数' },
      { id: 'actual_exchange_teacher_count', name: '实际交流教师数' },
      { id: 'actual_exchange_backbone_count', name: '实际交流骨干教师数' }
    ],
    threshold: '交流≥10%，骨干≥20%',
    description: '交流轮岗教师比例不低于10%，其中骨干教师不低于20%'
  },
  {
    code: 'G12',
    name: '专任教师持证上岗率达到100%',
    shortName: '持证上岗',
    type: 'number',
    dataSource: 'district',
    dataField: 'teacher_certification_rate',
    threshold: 100,
    operator: '>=',
    unit: '%',
    description: '专任教师持有教师资格证上岗率'
  },
  {
    code: 'G13',
    name: '就近划片入学比例达标',
    shortName: '就近入学',
    type: 'composite',
    dataSource: 'district',
    dataFields: [
      { id: 'primary_nearby_enrollment_rate', name: '小学就近划片入学比例', threshold: 100, operator: '>=', unit: '%' },
      { id: 'junior_nearby_enrollment_rate', name: '初中就近划片入学比例', threshold: 95, operator: '>=', unit: '%' }
    ],
    threshold: '小学100%，初中≥95%',
    description: '城区和镇区公办小学、初中就近划片入学比例'
  },
  {
    code: 'G14',
    name: '优质高中招生名额分配比例不低于50%并向农村初中倾斜',
    shortName: '高中名额分配',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'quality_high_school_quota_allocation', name: '分配指标数' },
      { id: 'quality_high_school_enrollment_plan', name: '招生计划总数' }
    ],
    threshold: 50,
    operator: '>=',
    unit: '%',
    description: '优质高中招生名额分配比例'
  },
  {
    code: 'G15',
    name: '留守儿童关爱体系健全，随迁子女就读比例不低于85%',
    shortName: '随迁子女',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'migrant_in_public_school_count', name: '公办学校随迁子女数' },
      { id: 'migrant_in_private_school_count', name: '购买服务民办学校随迁子女数' },
      { id: 'eligible_migrant_children_count', name: '符合条件随迁子女总数' }
    ],
    threshold: 85,
    operator: '>=',
    unit: '%',
    description: '随迁子女在公办学校和政府购买服务的民办学校就读比例'
  }
];

// 获取区县政府保障程度15项指标汇总
router.get('/districts/:districtId/government-guarantee-summary', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请指定项目ID' });
    }

    // 获取区县信息
    const districtResult = await db.query('SELECT id, name, code FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取区县填报的数据（从submissions表中获取区县级别的填报）
    const submissionResult = await db.query(`
      SELECT s.id, s.data as form_data, s.status, s.submitted_at, s.approved_at,
             dt.name as form_name, dt.target as form_target
      FROM submissions s
      JOIN data_tools dt ON COALESCE(s.form_id, s.tool_id) = dt.id
      WHERE s.project_id = $1
        AND (dt.target = '区县' OR s.submitter_org = $2)
        AND s.status IN ('approved', 'submitted', 'rejected')
      ORDER BY
        CASE WHEN s.status = 'approved' THEN 0 ELSE 1 END,
        s.submitted_at DESC
      LIMIT 1
    `, [projectId, district.name]);

    let districtFormData = {};
    let submissionStatus = null;
    let submittedAt = null;
    const hasDistrictSubmission = submissionResult.rows.length > 0;

    if (hasDistrictSubmission && submissionResult.rows[0].form_data) {
      submissionStatus = submissionResult.rows[0].status;
      submittedAt = submissionResult.rows[0].submitted_at;
      const rawData = submissionResult.rows[0].form_data;
      districtFormData = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
    }

    // 获取区县下所有学校的填报数据（用于计算G3、G4、G5等汇总指标）
    const schoolSubmissionsResult = await db.query(`
      SELECT s.id, s.school_id, s.data as form_data, s.status,
             sc.name as school_name, sc.school_type
      FROM submissions s
      JOIN schools sc ON s.school_id = sc.id
      JOIN data_tools dt ON COALESCE(s.form_id, s.tool_id) = dt.id
      WHERE s.project_id = $1
        AND sc.district_id = $2
        AND sc.status = 'active'
        AND dt.target = '学校'
        AND s.status IN ('approved', 'submitted', 'rejected')
      ORDER BY sc.id,
        CASE WHEN s.status = 'approved' THEN 0 ELSE 1 END,
        s.submitted_at DESC
    `, [projectId, districtId]);

    // 按学校去重，只保留每个学校最新的一条有效提交
    const schoolDataMap = new Map();
    for (const row of schoolSubmissionsResult.rows) {
      if (!schoolDataMap.has(row.school_id)) {
        let formData = {};
        if (row.form_data) {
          formData = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : (row.form_data || {});
        }
        schoolDataMap.set(row.school_id, {
          schoolId: row.school_id,
          schoolName: row.school_name,
          schoolType: row.school_type,
          formData
        });
      }
    }
    const schoolDataList = Array.from(schoolDataMap.values());
    const hasSchoolSubmissions = schoolDataList.length > 0;

    // 计算学校汇总数据（用于G3、G4、G5、G6）
    let schoolAggregateData = {
      // G3: 音美教室
      musicArtCompliant: null,
      schoolsChecked: 0,
      schoolsWithMusicArtData: 0,
      schoolsCompliantMusicArt: 0,
      // G4: 规模控制
      overScalePrimaryCount: 0,
      overScaleJuniorCount: 0,
      overScaleNineYearCount: 0,
      // G5: 班额控制
      over45PrimaryClassCount: 0,
      over50JuniorClassCount: 0,
      // G6: 小规模学校经费
      smallSchoolsTotal: 0,
      smallSchoolsCompliant: 0
    };

    if (hasSchoolSubmissions) {
      for (const school of schoolDataList) {
        const data = school.formData;
        const schoolType = school.schoolType;
        schoolAggregateData.schoolsChecked++;

        // G3: 音美教室检查
        const musicList = data.music_classroom_list || [];
        const artList = data.art_classroom_list || [];
        const primaryClassCount = parseFloat(data.primary_class_count) || 0;
        const juniorClassCount = parseFloat(data.junior_class_count) || 0;
        const totalClassCount = primaryClassCount + juniorClassCount;

        if (musicList.length > 0 || artList.length > 0) {
          schoolAggregateData.schoolsWithMusicArtData++;
          // 简化判定：有音乐和美术教室数据即视为达标（实际应根据面积标准判定）
          const requiredCount = Math.ceil(totalClassCount / 12);
          if (musicList.length >= requiredCount && artList.length >= requiredCount) {
            schoolAggregateData.schoolsCompliantMusicArt++;
          }
        }

        // G4: 规模控制检查
        const studentCount = parseFloat(data.student_count) ||
                            parseFloat(data.primary_student_count || 0) + parseFloat(data.junior_student_count || 0);

        if (schoolType === '小学' || schoolType === '初中') {
          if (studentCount > 2000) {
            if (schoolType === '小学') schoolAggregateData.overScalePrimaryCount++;
            else schoolAggregateData.overScaleJuniorCount++;
          }
        } else if (schoolType === '九年一贯制') {
          if (studentCount > 2500) {
            schoolAggregateData.overScaleNineYearCount++;
          }
        }

        // G5: 班额控制检查
        // 检查超标班级数（需要从详细班级数据中统计，这里简化处理）
        const avgPrimaryClassSize = primaryClassCount > 0 ?
          (parseFloat(data.primary_student_count) || 0) / primaryClassCount : 0;
        const avgJuniorClassSize = juniorClassCount > 0 ?
          (parseFloat(data.junior_student_count) || 0) / juniorClassCount : 0;

        // 如果平均班额超标，估算超标班级数
        if (avgPrimaryClassSize > 45 && primaryClassCount > 0) {
          schoolAggregateData.over45PrimaryClassCount += Math.ceil(primaryClassCount * 0.2); // 估算20%超标
        }
        if (avgJuniorClassSize > 50 && juniorClassCount > 0) {
          schoolAggregateData.over50JuniorClassCount += Math.ceil(juniorClassCount * 0.2);
        }

        // G6: 小规模学校检查
        if (studentCount > 0 && studentCount < 100) {
          schoolAggregateData.smallSchoolsTotal++;
          // 检查是否按100人核定公用经费（需要经费数据支持）
          // 这里简化处理，假设有经费数据时达标
          if (data.public_funding_budget) {
            schoolAggregateData.smallSchoolsCompliant++;
          }
        }
      }
    }

    // 计算每个指标的达标情况
    const indicators = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    let pendingCount = 0;

    for (const config of GOVERNMENT_GUARANTEE_INDICATORS) {
      const indicator = {
        code: config.code,
        name: config.name,
        shortName: config.shortName,
        type: config.type,
        threshold: config.threshold,
        description: config.description,
        value: null,
        displayValue: null,
        isCompliant: null,
        details: []
      };

      // 根据数据来源类型处理
      if (config.dataSource === 'school_aggregate') {
        // 从学校填报数据汇总计算
        if (!hasSchoolSubmissions) {
          indicator.isCompliant = null;
          indicator.displayValue = '暂无学校数据';
          pendingCount++;
        } else {
          switch (config.code) {
            case 'G3': // 音美教室
              if (schoolAggregateData.schoolsWithMusicArtData === 0) {
                indicator.isCompliant = null;
                indicator.displayValue = '学校未填报';
                indicator.details = [
                  { name: '已检查学校数', value: schoolAggregateData.schoolsChecked, displayValue: `${schoolAggregateData.schoolsChecked}所` },
                  { name: '有音美教室数据学校', value: 0, displayValue: '0所' }
                ];
                pendingCount++;
              } else {
                const allCompliant = schoolAggregateData.schoolsCompliantMusicArt === schoolAggregateData.schoolsWithMusicArtData;
                indicator.isCompliant = allCompliant;
                indicator.displayValue = allCompliant ? '全部达标' : `${schoolAggregateData.schoolsCompliantMusicArt}/${schoolAggregateData.schoolsWithMusicArtData}所达标`;
                indicator.details = [
                  { name: '有数据学校', value: schoolAggregateData.schoolsWithMusicArtData, displayValue: `${schoolAggregateData.schoolsWithMusicArtData}所`, isCompliant: null },
                  { name: '达标学校', value: schoolAggregateData.schoolsCompliantMusicArt, displayValue: `${schoolAggregateData.schoolsCompliantMusicArt}所`, isCompliant: allCompliant }
                ];
                if (allCompliant) compliantCount++;
                else nonCompliantCount++;
              }
              break;

            case 'G4': // 规模控制
              const totalOverScale = schoolAggregateData.overScalePrimaryCount +
                                    schoolAggregateData.overScaleJuniorCount +
                                    schoolAggregateData.overScaleNineYearCount;
              indicator.isCompliant = totalOverScale === 0;
              indicator.value = totalOverScale;
              indicator.displayValue = totalOverScale === 0 ? '全部达标' : `${totalOverScale}所超规模`;
              indicator.details = [
                { name: '超规模小学', value: schoolAggregateData.overScalePrimaryCount, displayValue: `${schoolAggregateData.overScalePrimaryCount}所`, isCompliant: schoolAggregateData.overScalePrimaryCount === 0 },
                { name: '超规模初中', value: schoolAggregateData.overScaleJuniorCount, displayValue: `${schoolAggregateData.overScaleJuniorCount}所`, isCompliant: schoolAggregateData.overScaleJuniorCount === 0 },
                { name: '超规模九年一贯制', value: schoolAggregateData.overScaleNineYearCount, displayValue: `${schoolAggregateData.overScaleNineYearCount}所`, isCompliant: schoolAggregateData.overScaleNineYearCount === 0 }
              ];
              if (indicator.isCompliant) compliantCount++;
              else nonCompliantCount++;
              break;

            case 'G5': // 班额控制
              const totalOverClass = schoolAggregateData.over45PrimaryClassCount + schoolAggregateData.over50JuniorClassCount;
              indicator.isCompliant = totalOverClass === 0;
              indicator.value = totalOverClass;
              indicator.displayValue = totalOverClass === 0 ? '全部达标' : `${totalOverClass}个班超标`;
              indicator.details = [
                { name: '超45人小学班级', value: schoolAggregateData.over45PrimaryClassCount, displayValue: `${schoolAggregateData.over45PrimaryClassCount}个`, isCompliant: schoolAggregateData.over45PrimaryClassCount === 0 },
                { name: '超50人初中班级', value: schoolAggregateData.over50JuniorClassCount, displayValue: `${schoolAggregateData.over50JuniorClassCount}个`, isCompliant: schoolAggregateData.over50JuniorClassCount === 0 }
              ];
              if (indicator.isCompliant) compliantCount++;
              else nonCompliantCount++;
              break;

            case 'G6': // 小规模学校经费
              if (schoolAggregateData.smallSchoolsTotal === 0) {
                indicator.isCompliant = true; // 无小规模学校，视为达标
                indicator.displayValue = '无小规模学校';
                compliantCount++;
              } else {
                const allSmallCompliant = schoolAggregateData.smallSchoolsCompliant === schoolAggregateData.smallSchoolsTotal;
                indicator.isCompliant = allSmallCompliant;
                indicator.displayValue = allSmallCompliant ? '全部达标' : `${schoolAggregateData.smallSchoolsCompliant}/${schoolAggregateData.smallSchoolsTotal}所达标`;
                indicator.details = [
                  { name: '小规模学校总数', value: schoolAggregateData.smallSchoolsTotal, displayValue: `${schoolAggregateData.smallSchoolsTotal}所` },
                  { name: '达标学校数', value: schoolAggregateData.smallSchoolsCompliant, displayValue: `${schoolAggregateData.smallSchoolsCompliant}所` }
                ];
                if (allSmallCompliant) compliantCount++;
                else nonCompliantCount++;
              }
              break;

            default:
              indicator.isCompliant = null;
              indicator.displayValue = '暂无数据';
              pendingCount++;
          }
        }
      } else {
        // 从区县填报数据获取
        if (!hasDistrictSubmission) {
          indicator.isCompliant = null;
          indicator.displayValue = '区县未填报';
          pendingCount++;
        } else {
          switch (config.type) {
            case 'material':
              const materialValue = districtFormData[config.materialField];
              const hasMaterial = materialValue && (
                (Array.isArray(materialValue) && materialValue.length > 0) ||
                (typeof materialValue === 'string' && materialValue.trim() !== '')
              );
              indicator.isCompliant = hasMaterial ? true : null;
              indicator.displayValue = hasMaterial ? '已上传' : '待上传';
              if (hasMaterial) compliantCount++;
              else pendingCount++;
              break;

            case 'number':
              // 默认：直接从区县填报字段取数值
              let numValue = parseFloat(districtFormData[config.dataField]);

              // G12 特殊处理：若未直接填报 teacher_certification_rate，则尝试用“持证人数/专任教师数”计算比例
              // 约定：
              // - certified_full_time_teacher_count：持有教师资格证的专任教师人数（新增字段）
              // - primary_teacher_count + junior_teacher_count：区县内小学/初中专任教师数（用于合计分母）
              if ((isNaN(numValue) || numValue === null) && config.code === 'G12') {
                const certified = parseFloat(districtFormData.certified_full_time_teacher_count);
                const primaryTeachers = parseFloat(districtFormData.primary_teacher_count);
                const juniorTeachers = parseFloat(districtFormData.junior_teacher_count);

                const denom =
                  (isNaN(primaryTeachers) ? 0 : primaryTeachers) +
                  (isNaN(juniorTeachers) ? 0 : juniorTeachers);

                if (!isNaN(certified) && denom > 0) {
                  numValue = (certified / denom) * 100;
                  indicator.details = [
                    { name: '持证专任教师数', value: certified, displayValue: `${certified}人` },
                    { name: '小学专任教师数', value: isNaN(primaryTeachers) ? null : primaryTeachers, displayValue: isNaN(primaryTeachers) ? '待填报' : `${primaryTeachers}人` },
                    { name: '初中专任教师数', value: isNaN(juniorTeachers) ? null : juniorTeachers, displayValue: isNaN(juniorTeachers) ? '待填报' : `${juniorTeachers}人` },
                    { name: '计算公式', value: null, displayValue: '持证专任教师数 ÷（小学专任教师数+初中专任教师数）×100' },
                  ];
                }
              }

              if (isNaN(numValue)) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                pendingCount++;
              } else {
                // 统一显示：保留 2 位小数（百分比/金额等）
                const rounded = Math.round(numValue * 100) / 100;
                indicator.value = rounded;
                indicator.displayValue = `${rounded}${config.unit || ''}`;
                let isNumCompliant = false;
                if (config.operator === '>=') isNumCompliant = numValue >= config.threshold;
                else if (config.operator === '>') isNumCompliant = numValue > config.threshold;
                else if (config.operator === '<=') isNumCompliant = numValue <= config.threshold;
                else if (config.operator === '<') isNumCompliant = numValue < config.threshold;
                else if (config.operator === '=') isNumCompliant = numValue === config.threshold;
                indicator.isCompliant = isNumCompliant;
                if (isNumCompliant) compliantCount++;
                else nonCompliantCount++;
              }
              break;

            case 'element_linked':
              // 通过关联的数据指标和要素计算
              let elementValue = null;
              let elementDetails = [];

              if (config.dataIndicatorCode) {
                // 使用要素关联计算
                const elementResult = await calculateIndicatorValueFromElements(
                  config.dataIndicatorCode,
                  projectId,
                  districtId,
                  districtFormData
                );
                elementValue = elementResult.value;
                elementDetails = elementResult.details || [];

                // 如果有公式信息，添加到详情
                if (elementResult.formula) {
                  indicator.formula = elementResult.formula;
                }
                if (elementResult.elementCode) {
                  indicator.elementCode = elementResult.elementCode;
                }
              }

              // 如果要素计算没有结果，尝试备用字段
              if (elementValue === null && config.fallbackField) {
                elementValue = parseFloat(districtFormData[config.fallbackField]);
              }

              if (elementValue === null || isNaN(elementValue)) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                indicator.details = elementDetails.length > 0 ? elementDetails : [
                  { name: '说明', displayValue: '请确保已关联要素并填报相关数据' }
                ];
                pendingCount++;
              } else {
                indicator.value = Math.round(elementValue * 100) / 100;
                indicator.displayValue = `${indicator.value}${config.unit || ''}`;

                let isElementCompliant = false;
                if (config.operator === '>=') isElementCompliant = elementValue >= config.threshold;
                else if (config.operator === '>') isElementCompliant = elementValue > config.threshold;
                else if (config.operator === '<=') isElementCompliant = elementValue <= config.threshold;
                else if (config.operator === '<') isElementCompliant = elementValue < config.threshold;
                else if (config.operator === '=') isElementCompliant = elementValue === config.threshold;

                indicator.isCompliant = isElementCompliant;
                indicator.details = elementDetails.map(d => ({
                  ...d,
                  isCompliant: d.value !== null
                }));

                if (isElementCompliant) compliantCount++;
                else nonCompliantCount++;
              }
              break;

            case 'comparison':
              const field1 = parseFloat(districtFormData[config.dataFields[0].id]);
              const field2 = parseFloat(districtFormData[config.dataFields[1].id]);
              if (isNaN(field1) || isNaN(field2)) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                indicator.details = config.dataFields.map(f => ({
                  name: f.name,
                  value: districtFormData[f.id] || null,
                  displayValue: isNaN(parseFloat(districtFormData[f.id])) ? '待填报' : `${districtFormData[f.id]}万元`
                }));
                pendingCount++;
              } else {
                const isCompCompliant = field1 >= field2;
                indicator.isCompliant = isCompCompliant;
                indicator.displayValue = isCompCompliant ? '达标' : '不达标';
                indicator.details = [
                  { name: config.dataFields[0].name, value: field1, displayValue: `${field1}万元`, isCompliant: null },
                  { name: config.dataFields[1].name, value: field2, displayValue: `${field2}万元`, isCompliant: null }
                ];
                if (isCompCompliant) compliantCount++;
                else nonCompliantCount++;
              }
              break;

            case 'composite':
              let allSubCompliant = true;
              let hasAnyData = false;
              let allDataPresent = true;
              const subDetails = [];

              for (const subField of config.dataFields) {
                const subValue = parseFloat(districtFormData[subField.id]);
                const subDetail = {
                  id: subField.id,
                  name: subField.name,
                  value: null,
                  displayValue: '待填报',
                  threshold: subField.threshold,
                  unit: subField.unit,
                  isCompliant: null
                };

                if (!isNaN(subValue)) {
                  hasAnyData = true;
                  subDetail.value = subValue;
                  subDetail.displayValue = `${subValue}${subField.unit || ''}`;

                  let subCompliant = false;
                  const op = subField.operator || '>=';
                  if (op === '>=') subCompliant = subValue >= subField.threshold;
                  else if (op === '>') subCompliant = subValue > subField.threshold;
                  else if (op === '<=') subCompliant = subValue <= subField.threshold;
                  else if (op === '<') subCompliant = subValue < subField.threshold;
                  else if (op === '=') subCompliant = subValue === subField.threshold;

                  subDetail.isCompliant = subCompliant;
                  if (!subCompliant) allSubCompliant = false;
                } else {
                  allDataPresent = false;
                }
                subDetails.push(subDetail);
              }

              indicator.details = subDetails;

              if (!hasAnyData) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                pendingCount++;
              } else if (!allDataPresent) {
                indicator.isCompliant = null;
                indicator.displayValue = '部分填报';
                pendingCount++;
              } else {
                indicator.isCompliant = allSubCompliant;
                indicator.displayValue = allSubCompliant ? '全部达标' : '部分未达标';
                if (allSubCompliant) compliantCount++;
                else nonCompliantCount++;
              }
              break;

            case 'calculated_district':
              // 区县填报数据的计算类型
              if (config.code === 'G7') {
                // 特殊教育学校生均公用经费
                const funding = parseFloat(districtFormData['special_education_funding']);
                const studentCount = parseFloat(districtFormData['district_special_education_student_count']);
                if (isNaN(funding) || isNaN(studentCount) || studentCount === 0) {
                  indicator.isCompliant = null;
                  indicator.displayValue = '待填报';
                  pendingCount++;
                } else {
                  const perStudentFunding = funding / studentCount;
                  indicator.value = Math.round(perStudentFunding * 100) / 100;
                  indicator.displayValue = `${indicator.value}元`;
                  indicator.isCompliant = perStudentFunding >= 8000;
                  indicator.details = [
                    { name: '特教经费拨付总额', value: funding, displayValue: `${funding}元` },
                    { name: '特教学生人数', value: studentCount, displayValue: `${studentCount}人` },
                    { name: '生均公用经费', value: indicator.value, displayValue: `${indicator.value}元`, threshold: 8000, unit: '元', isCompliant: indicator.isCompliant }
                  ];
                  if (indicator.isCompliant) compliantCount++;
                  else nonCompliantCount++;
                }
              } else if (config.code === 'G11') {
                // 交流轮岗
                const eligibleCount = parseFloat(districtFormData['exchange_eligible_teacher_count']);
                const actualCount = parseFloat(districtFormData['actual_exchange_teacher_count']);
                const backboneCount = parseFloat(districtFormData['actual_exchange_backbone_count']);

                if (isNaN(eligibleCount) || eligibleCount === 0 || isNaN(actualCount)) {
                  indicator.isCompliant = null;
                  indicator.displayValue = '待填报';
                  pendingCount++;
                } else {
                  const exchangeRate = (actualCount / eligibleCount) * 100;
                  const backboneRate = actualCount > 0 && !isNaN(backboneCount) ? (backboneCount / actualCount) * 100 : 0;
                  const isG11Compliant = exchangeRate >= 10 && backboneRate >= 20;

                  indicator.isCompliant = isG11Compliant;
                  indicator.displayValue = isG11Compliant ? '全部达标' : '部分未达标';
                  indicator.details = [
                    { name: '交流轮岗教师比例', value: Math.round(exchangeRate * 100) / 100, displayValue: `${Math.round(exchangeRate * 100) / 100}%`, threshold: 10, unit: '%', isCompliant: exchangeRate >= 10 },
                    { name: '交流轮岗骨干教师比例', value: Math.round(backboneRate * 100) / 100, displayValue: `${Math.round(backboneRate * 100) / 100}%`, threshold: 20, unit: '%', isCompliant: backboneRate >= 20 }
                  ];
                  if (isG11Compliant) compliantCount++;
                  else nonCompliantCount++;
                }
              } else if (config.code === 'G14') {
                // 高中名额分配
                const quota = parseFloat(districtFormData['quality_high_school_quota_allocation']);
                const plan = parseFloat(districtFormData['quality_high_school_enrollment_plan']);
                if (isNaN(quota) || isNaN(plan) || plan === 0) {
                  indicator.isCompliant = null;
                  indicator.displayValue = '待填报';
                  pendingCount++;
                } else {
                  const rate = (quota / plan) * 100;
                  indicator.value = Math.round(rate * 100) / 100;
                  indicator.displayValue = `${indicator.value}%`;
                  indicator.isCompliant = rate >= 50;
                  indicator.details = [
                    { name: '分配指标数', value: quota, displayValue: `${quota}人` },
                    { name: '招生计划总数', value: plan, displayValue: `${plan}人` }
                  ];
                  if (indicator.isCompliant) compliantCount++;
                  else nonCompliantCount++;
                }
              } else if (config.code === 'G15') {
                // 随迁子女
                const publicCount = parseFloat(districtFormData['migrant_in_public_school_count']) || 0;
                const privateCount = parseFloat(districtFormData['migrant_in_private_school_count']) || 0;
                const totalEligible = parseFloat(districtFormData['eligible_migrant_children_count']);
                if (isNaN(totalEligible) || totalEligible === 0) {
                  indicator.isCompliant = null;
                  indicator.displayValue = '待填报';
                  pendingCount++;
                } else {
                  const rate = ((publicCount + privateCount) / totalEligible) * 100;
                  indicator.value = Math.round(rate * 100) / 100;
                  indicator.displayValue = `${indicator.value}%`;
                  indicator.isCompliant = rate >= 85;
                  indicator.details = [
                    { name: '公办学校随迁子女数', value: publicCount, displayValue: `${publicCount}人` },
                    { name: '购买服务民办学校随迁子女数', value: privateCount, displayValue: `${privateCount}人` },
                    { name: '符合条件随迁子女总数', value: totalEligible, displayValue: `${totalEligible}人` }
                  ];
                  if (indicator.isCompliant) compliantCount++;
                  else nonCompliantCount++;
                }
              } else {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                pendingCount++;
              }
              break;

            default:
              indicator.isCompliant = null;
              indicator.displayValue = '待填报';
              pendingCount++;
          }
        }
      }

      indicators.push(indicator);
    }

    // 整体达标判定：15项全部达标
    const totalCount = indicators.length;
    const allCompliant = compliantCount === totalCount;

    res.json({
      code: 200,
      data: {
        district,
        submission: {
          status: submissionStatus,
          submittedAt
        },
        summary: {
          totalCount,
          compliantCount,
          nonCompliantCount,
          pendingCount,
          allCompliant: pendingCount === 0 ? allCompliant : null,
          complianceRate: totalCount > 0 && pendingCount === 0
            ? Math.round((compliantCount / totalCount) * 10000) / 100
            : null
        },
        indicators
      }
    });
  } catch (error) {
    console.error('获取政府保障程度指标汇总失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 教育质量指标定义（9项二级指标，依据义务教育优质均衡督导评估指标体系）
const EDUCATION_QUALITY_INDICATORS = [
  {
    code: 'Q1',
    name: '初中三年巩固率达到95%以上',
    shortName: '初中巩固率',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'junior_graduation_count', name: '初中毕业生人数' },
      { id: 'junior_grade1_count_3years_ago', name: '三年前初一在校生数' },
      { id: 'junior_transfer_in_3years', name: '三年内转入人数' },
      { id: 'junior_transfer_out_3years', name: '三年内转出人数' },
      { id: 'junior_death_3years', name: '三年内死亡人数' }
    ],
    threshold: 95,
    operator: '>=',
    unit: '%',
    description: '初中三年巩固率 = (毕业数 - 转入 + 转出) / (三年前初一数 - 死亡) × 100'
  },
  {
    code: 'Q2',
    name: '残疾儿童少年入学率达到95%以上',
    shortName: '残疾儿童入学率',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'disabled_children_enrollment', name: '适龄残疾儿童少年入学总人数' },
      { id: 'disabled_children_population', name: '适龄残疾儿童少年人口总数' }
    ],
    threshold: 95,
    operator: '>=',
    unit: '%',
    description: '适龄残疾儿童少年入学率不低于95%'
  },
  {
    code: 'Q3',
    name: '所有学校制定章程，实现学校管理与教学信息化',
    shortName: '章程与信息化',
    type: 'material',
    dataSource: 'district',
    materialField: 'school_charter_informatization_material',
    threshold: '佐证材料',
    description: '学校制度建设与信息化应用，需提供佐证材料'
  },
  {
    code: 'Q4',
    name: '教师培训经费占公用经费预算不低于5%',
    shortName: '培训经费占比',
    type: 'calculated_district',
    dataSource: 'district',
    dataFields: [
      { id: 'teacher_training_budget', name: '教师培训经费预算总额' },
      { id: 'public_funding_budget', name: '公用经费预算总额' }
    ],
    threshold: 5,
    operator: '>=',
    unit: '%',
    description: '教师培训经费预算 / 公用经费预算 × 100 ≥ 5%'
  },
  {
    code: 'Q5',
    name: '教师能熟练运用信息化手段组织教学',
    shortName: '信息化教学',
    type: 'material',
    dataSource: 'district',
    materialField: 'teacher_informatization_teaching_material',
    threshold: '佐证材料',
    description: '设施设备利用率达到较高水平，需提供佐证材料'
  },
  {
    code: 'Q6',
    name: '德育工作与校园文化建设达到良好以上',
    shortName: '德育与文化',
    type: 'material',
    dataSource: 'district',
    materialField: 'moral_education_culture_material',
    threshold: '佐证材料',
    description: '德育工作与校园文化建设水平，需提供佐证材料'
  },
  {
    code: 'Q7',
    name: '课程开齐开足，教学秩序规范',
    shortName: '课程与秩序',
    type: 'material',
    dataSource: 'district',
    materialField: 'curriculum_teaching_order_material',
    threshold: '佐证材料',
    description: '综合实践活动有效开展，需提供佐证材料'
  },
  {
    code: 'Q8',
    name: '无过重课业负担',
    shortName: '课业负担',
    type: 'material',
    dataSource: 'district',
    materialField: 'homework_burden_material',
    threshold: '佐证材料',
    description: '学生课业负担合理，需提供佐证材料'
  },
  {
    code: 'Q9',
    name: '国家义务教育质量监测达标',
    shortName: '质量监测',
    type: 'quality_monitoring',
    dataSource: 'district',
    subjects: [
      { id: 'chinese', name: '语文', levelField: 'chinese_achievement_level', diffRateField: 'chinese_difference_rate' },
      { id: 'math', name: '数学', levelField: 'math_achievement_level', diffRateField: 'math_difference_rate' },
      { id: 'science', name: '科学', levelField: 'science_achievement_level', diffRateField: 'science_difference_rate' },
      { id: 'pe', name: '体育', levelField: 'pe_achievement_level', diffRateField: 'pe_difference_rate' },
      { id: 'art', name: '艺术', levelField: 'art_achievement_level', diffRateField: 'art_difference_rate' },
      { id: 'moral', name: '德育', levelField: 'moral_achievement_level', diffRateField: 'moral_difference_rate' }
    ],
    levelThreshold: 'III',
    diffRateThreshold: 0.15,
    threshold: '学业水平≥Ⅲ级，差异率<0.15',
    description: '各相关科目学业水平达到Ⅲ级以上，且校际差异率低于0.15'
  }
];

// 获取区县教育质量指标汇总
router.get('/districts/:districtId/education-quality-summary', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请指定项目ID' });
    }

    // 获取区县信息
    const districtResult = await db.query('SELECT id, name, code FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取区县填报的数据
    const submissionResult = await db.query(`
      SELECT s.id, s.data as form_data, s.status, s.submitted_at,
             dt.name as form_name, dt.target as form_target
      FROM submissions s
      JOIN data_tools dt ON COALESCE(s.form_id, s.tool_id) = dt.id
      WHERE s.project_id = $1
        AND (dt.target = '区县' OR s.submitter_org = $2)
        AND s.status IN ('approved', 'submitted', 'rejected')
      ORDER BY
        CASE WHEN s.status = 'approved' THEN 0 ELSE 1 END,
        s.submitted_at DESC
      LIMIT 1
    `, [projectId, district.name]);

    let districtFormData = {};
    let submissionStatus = null;
    let submittedAt = null;
    const hasDistrictSubmission = submissionResult.rows.length > 0;

    if (hasDistrictSubmission && submissionResult.rows[0].form_data) {
      submissionStatus = submissionResult.rows[0].status;
      submittedAt = submissionResult.rows[0].submitted_at;
      const rawData = submissionResult.rows[0].form_data;
      districtFormData = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
    }

    // 学业水平级别映射（罗马数字到数字）
    const levelMapping = {
      'I': 1, 'Ⅰ': 1, '1': 1, '一': 1, '一级': 1,
      'II': 2, 'Ⅱ': 2, '2': 2, '二': 2, '二级': 2,
      'III': 3, 'Ⅲ': 3, '3': 3, '三': 3, '三级': 3,
      'IV': 4, 'Ⅳ': 4, '4': 4, '四': 4, '四级': 4,
      'V': 5, 'Ⅴ': 5, '5': 5, '五': 5, '五级': 5
    };

    // 计算每个指标的达标情况
    const indicators = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    let pendingCount = 0;

    for (const config of EDUCATION_QUALITY_INDICATORS) {
      const indicator = {
        code: config.code,
        name: config.name,
        shortName: config.shortName,
        type: config.type,
        threshold: config.threshold,
        description: config.description,
        value: null,
        displayValue: null,
        isCompliant: null,
        details: []
      };

      if (!hasDistrictSubmission) {
        indicator.isCompliant = null;
        indicator.displayValue = '区县未填报';
        pendingCount++;
      } else {
        switch (config.type) {
          case 'calculated_district':
            if (config.code === 'Q1') {
              // 初中三年巩固率
              const graduation = parseFloat(districtFormData['junior_graduation_count']);
              const grade1_3years = parseFloat(districtFormData['junior_grade1_count_3years_ago']);
              const transferIn = parseFloat(districtFormData['junior_transfer_in_3years']) || 0;
              const transferOut = parseFloat(districtFormData['junior_transfer_out_3years']) || 0;
              const death = parseFloat(districtFormData['junior_death_3years']) || 0;

              if (isNaN(graduation) || isNaN(grade1_3years) || grade1_3years === 0) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                pendingCount++;
              } else {
                const denominator = grade1_3years - death;
                if (denominator <= 0) {
                  indicator.isCompliant = null;
                  indicator.displayValue = '数据异常';
                  pendingCount++;
                } else {
                  const rate = ((graduation - transferIn + transferOut) / denominator) * 100;
                  indicator.value = Math.round(rate * 100) / 100;
                  indicator.displayValue = `${indicator.value}%`;
                  indicator.isCompliant = rate >= config.threshold;
                  indicator.details = [
                    { name: '初中毕业生人数', value: graduation, displayValue: `${graduation}人`, isCompliant: null },
                    { name: '三年前初一在校生数', value: grade1_3years, displayValue: `${grade1_3years}人`, isCompliant: null },
                    { name: '三年内转入人数', value: transferIn, displayValue: `${transferIn}人`, isCompliant: null },
                    { name: '三年内转出人数', value: transferOut, displayValue: `${transferOut}人`, isCompliant: null },
                    { name: '三年内死亡人数', value: death, displayValue: `${death}人`, isCompliant: null },
                    { name: '巩固率', value: indicator.value, displayValue: `${indicator.value}%`, threshold: config.threshold, unit: '%', isCompliant: indicator.isCompliant }
                  ];
                  if (indicator.isCompliant) compliantCount++;
                  else nonCompliantCount++;
                }
              }
            } else if (config.code === 'Q2') {
              // 残疾儿童入学率
              const enrollment = parseFloat(districtFormData['disabled_children_enrollment']);
              const population = parseFloat(districtFormData['disabled_children_population']);

              if (isNaN(enrollment) || isNaN(population) || population === 0) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                pendingCount++;
              } else {
                const rate = (enrollment / population) * 100;
                indicator.value = Math.round(rate * 100) / 100;
                indicator.displayValue = `${indicator.value}%`;
                indicator.isCompliant = rate >= config.threshold;
                indicator.details = [
                  { name: '适龄残疾儿童少年入学总人数', value: enrollment, displayValue: `${enrollment}人`, isCompliant: null },
                  { name: '适龄残疾儿童少年人口总数', value: population, displayValue: `${population}人`, isCompliant: null },
                  { name: '入学率', value: indicator.value, displayValue: `${indicator.value}%`, threshold: config.threshold, unit: '%', isCompliant: indicator.isCompliant }
                ];
                if (indicator.isCompliant) compliantCount++;
                else nonCompliantCount++;
              }
            } else if (config.code === 'Q4') {
              // 教师培训经费占比
              const trainingBudget = parseFloat(districtFormData['teacher_training_budget']);
              const publicBudget = parseFloat(districtFormData['public_funding_budget']);

              if (isNaN(trainingBudget) || isNaN(publicBudget) || publicBudget === 0) {
                indicator.isCompliant = null;
                indicator.displayValue = '待填报';
                pendingCount++;
              } else {
                const rate = (trainingBudget / publicBudget) * 100;
                indicator.value = Math.round(rate * 100) / 100;
                indicator.displayValue = `${indicator.value}%`;
                indicator.isCompliant = rate >= config.threshold;
                indicator.details = [
                  { name: '教师培训经费预算总额', value: trainingBudget, displayValue: `${trainingBudget}元`, isCompliant: null },
                  { name: '公用经费预算总额', value: publicBudget, displayValue: `${publicBudget}元`, isCompliant: null },
                  { name: '培训经费占比', value: indicator.value, displayValue: `${indicator.value}%`, threshold: config.threshold, unit: '%', isCompliant: indicator.isCompliant }
                ];
                if (indicator.isCompliant) compliantCount++;
                else nonCompliantCount++;
              }
            }
            break;

          case 'material':
            // 佐证材料类指标
            const materialValue = districtFormData[config.materialField];
            const hasMaterial = materialValue && (
              (Array.isArray(materialValue) && materialValue.length > 0) ||
              (typeof materialValue === 'string' && materialValue.trim() !== '')
            );

            if (hasMaterial) {
              indicator.isCompliant = true;
              indicator.displayValue = '已上传';
              indicator.value = Array.isArray(materialValue) ? materialValue.length : 1;
              indicator.details = [
                { name: '佐证材料', value: indicator.value, displayValue: `${indicator.value}份`, isCompliant: true }
              ];
              compliantCount++;
            } else {
              indicator.isCompliant = null;
              indicator.displayValue = '待上传';
              pendingCount++;
            }
            break;

          case 'quality_monitoring':
            // 国家义务教育质量监测（综合判定所有学科）
            const subjectResults = [];
            let allSubjectsCompliant = true;
            let anySubjectFilled = false;
            let allSubjectsFilled = true;

            for (const subject of config.subjects) {
              const levelVal = districtFormData[subject.levelField];
              const diffRateVal = parseFloat(districtFormData[subject.diffRateField]);

              const hasLevelVal = levelVal !== undefined && levelVal !== null && levelVal !== '';
              const hasDiffRateVal = !isNaN(diffRateVal);

              if (hasLevelVal || hasDiffRateVal) {
                anySubjectFilled = true;
              }
              if (!hasLevelVal || !hasDiffRateVal) {
                allSubjectsFilled = false;
              }

              let subjectCompliant = null;
              let levelCompliant = null;
              let diffRateCompliant = null;

              if (hasLevelVal && hasDiffRateVal) {
                const numLevel = levelMapping[levelVal] || levelMapping[String(levelVal).toUpperCase()];
                const threshLevel = levelMapping[config.levelThreshold] || 3;
                levelCompliant = numLevel !== undefined && numLevel >= threshLevel;
                diffRateCompliant = diffRateVal < config.diffRateThreshold;
                subjectCompliant = levelCompliant && diffRateCompliant;

                if (!subjectCompliant) {
                  allSubjectsCompliant = false;
                }
              }

              subjectResults.push({
                name: subject.name,
                level: {
                  value: levelVal || null,
                  displayValue: hasLevelVal ? `${levelVal}级` : '待填报',
                  isCompliant: levelCompliant
                },
                diffRate: {
                  value: hasDiffRateVal ? diffRateVal : null,
                  displayValue: hasDiffRateVal ? `${diffRateVal}` : '待填报',
                  isCompliant: diffRateCompliant
                },
                isCompliant: subjectCompliant
              });
            }

            if (!anySubjectFilled) {
              indicator.isCompliant = null;
              indicator.displayValue = '待填报';
              pendingCount++;
            } else if (!allSubjectsFilled) {
              indicator.isCompliant = null;
              indicator.displayValue = '部分填报';
              indicator.details = subjectResults.map(s => ({
                name: s.name,
                value: `${s.level.displayValue}/${s.diffRate.displayValue}`,
                displayValue: `学业水平: ${s.level.displayValue}, 差异率: ${s.diffRate.displayValue}`,
                isCompliant: s.isCompliant
              }));
              pendingCount++;
            } else {
              indicator.isCompliant = allSubjectsCompliant;
              indicator.displayValue = allSubjectsCompliant ? '达标' : '未达标';
              indicator.details = subjectResults.map(s => ({
                name: s.name,
                value: `${s.level.displayValue}/${s.diffRate.displayValue}`,
                displayValue: `学业水平: ${s.level.displayValue}, 差异率: ${s.diffRate.displayValue}`,
                isCompliant: s.isCompliant
              }));
              if (indicator.isCompliant) compliantCount++;
              else nonCompliantCount++;
            }
            break;

          default:
            indicator.isCompliant = null;
            indicator.displayValue = '待填报';
            pendingCount++;
        }
      }

      indicators.push(indicator);
    }

    // 整体达标判定
    const totalCount = indicators.length;
    const allCompliant = compliantCount === totalCount;

    res.json({
      code: 200,
      data: {
        district,
        submission: {
          status: submissionStatus,
          submittedAt
        },
        summary: {
          totalCount,
          compliantCount,
          nonCompliantCount,
          pendingCount,
          allCompliant: pendingCount === 0 ? allCompliant : null,
          complianceRate: totalCount > 0 && pendingCount === 0
            ? Math.round((compliantCount / totalCount) * 10000) / 100
            : null
        },
        indicators
      }
    });
  } catch (error) {
    console.error('获取教育质量指标汇总失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 社会认可度指标定义（1项指标）
const SOCIAL_RECOGNITION_INDICATORS = [
  {
    code: 'S1',
    name: '社会认可度达到85％以上',
    shortName: '社会认可度',
    type: 'boolean',
    dataSource: 'district',
    dataField: 'social_recognition_over_85',
    expectedValue: 'yes',
    threshold: '≥85%',
    description: '社会认可度调查结果达到85％以上'
  }
];

// 获取区县社会认可度指标汇总
router.get('/districts/:districtId/social-recognition-summary', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请指定项目ID' });
    }

    // 获取区县信息
    const districtResult = await db.query('SELECT id, name, code FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取区县填报的数据
    const submissionResult = await db.query(`
      SELECT s.id, s.data as form_data, s.status, s.submitted_at,
             dt.name as form_name, dt.target as form_target
      FROM submissions s
      JOIN data_tools dt ON COALESCE(s.form_id, s.tool_id) = dt.id
      WHERE s.project_id = $1
        AND (dt.target = '区县' OR s.submitter_org = $2)
        AND s.status IN ('approved', 'submitted', 'rejected')
      ORDER BY
        CASE WHEN s.status = 'approved' THEN 0 ELSE 1 END,
        s.submitted_at DESC
      LIMIT 1
    `, [projectId, district.name]);

    let districtFormData = {};
    let submissionStatus = null;
    let submittedAt = null;
    const hasDistrictSubmission = submissionResult.rows.length > 0;

    if (hasDistrictSubmission && submissionResult.rows[0].form_data) {
      submissionStatus = submissionResult.rows[0].status;
      submittedAt = submissionResult.rows[0].submitted_at;
      const rawData = submissionResult.rows[0].form_data;
      districtFormData = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
    }

    // 计算每个指标的达标情况
    const indicators = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    let pendingCount = 0;

    for (const config of SOCIAL_RECOGNITION_INDICATORS) {
      const indicator = {
        code: config.code,
        name: config.name,
        shortName: config.shortName,
        type: config.type,
        threshold: config.threshold,
        description: config.description,
        value: null,
        displayValue: null,
        isCompliant: null,
        details: []
      };

      if (!hasDistrictSubmission) {
        indicator.isCompliant = null;
        indicator.displayValue = '区县未填报';
        pendingCount++;
      } else {
        const fieldValue = districtFormData[config.dataField];

        if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
          indicator.isCompliant = null;
          indicator.displayValue = '待填报';
          pendingCount++;
        } else {
          indicator.value = fieldValue;

          if (config.type === 'boolean') {
            // 正向指标：需要选"是"才达标
            indicator.isCompliant = fieldValue === config.expectedValue;
            indicator.displayValue = fieldValue === 'yes' ? '是' : '否';
          } else if (config.type === 'boolean_negative') {
            // 否定指标：需要选"否"才达标（即不存在问题）
            indicator.isCompliant = fieldValue === config.expectedValue;
            indicator.displayValue = fieldValue === 'yes' ? '存在' : '不存在';
          }

          if (indicator.isCompliant) compliantCount++;
          else nonCompliantCount++;
        }
      }

      indicators.push(indicator);
    }

    // 整体达标判定：所有指标都达标
    const totalCount = indicators.length;
    const allCompliant = compliantCount === totalCount;

    res.json({
      code: 200,
      data: {
        district,
        submission: {
          status: submissionStatus,
          submittedAt
        },
        summary: {
          totalCount,
          compliantCount,
          nonCompliantCount,
          pendingCount,
          allCompliant: pendingCount === 0 ? allCompliant : null,
          complianceRate: totalCount > 0 && pendingCount === 0
            ? Math.round((compliantCount / totalCount) * 10000) / 100
            : null
        },
        indicators
      }
    });
  } catch (error) {
    console.error('获取社会认可度指标汇总失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
