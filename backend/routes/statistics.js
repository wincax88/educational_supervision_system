const express = require('express');
const router = express.Router();

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// 计算差异系数
function calculateCV(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return null;
  const n = validValues.length;
  const mean = validValues.reduce((sum, v) => sum + v, 0) / n;
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

    await db.query(`
      INSERT INTO school_indicator_data
      (id, project_id, school_id, data_indicator_id, value, text_value, is_compliant, submission_id, collected_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (project_id, school_id, data_indicator_id) DO UPDATE SET
        value = EXCLUDED.value,
        text_value = EXCLUDED.text_value,
        is_compliant = EXCLUDED.is_compliant,
        submission_id = EXCLUDED.submission_id,
        collected_at = EXCLUDED.collected_at,
        updated_at = EXCLUDED.updated_at
    `, [
      id, projectId, schoolId, dataIndicatorId, value, textValue,
      isCompliant === null ? null : (isCompliant ? 1 : 0),
      submissionId, now, now, now
    ]);

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

    await db.transaction(async (client) => {
      const now = new Date().toISOString().split('T')[0];

      for (const item of data) {
        // 获取阈值
        const indicatorResult = await client.query('SELECT threshold FROM data_indicators WHERE id = $1', [item.dataIndicatorId]);
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

        const id = 'sid-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

        await client.query(`
          INSERT INTO school_indicator_data
          (id, project_id, school_id, data_indicator_id, value, text_value, is_compliant, submission_id, collected_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (project_id, school_id, data_indicator_id) DO UPDATE SET
            value = EXCLUDED.value,
            text_value = EXCLUDED.text_value,
            is_compliant = EXCLUDED.is_compliant,
            submission_id = EXCLUDED.submission_id,
            collected_at = EXCLUDED.collected_at,
            updated_at = EXCLUDED.updated_at
        `, [
          id, projectId, schoolId, item.dataIndicatorId, item.value, item.textValue,
          isCompliant === null ? null : (isCompliant ? 1 : 0),
          submissionId, now, now, now
        ]);
      }
    });

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
          const id = 'ds-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
          await db.query(`
            INSERT INTO district_statistics
            (id, project_id, district_id, school_type, school_count, cv_composite, is_cv_compliant, calculated_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (project_id, district_id, school_type) DO UPDATE SET
              school_count = EXCLUDED.school_count,
              cv_composite = EXCLUDED.cv_composite,
              is_cv_compliant = EXCLUDED.is_cv_compliant,
              calculated_at = EXCLUDED.calculated_at
          `, [id, projectId, districtId, type, cvAnalysis.schoolCount, cvAnalysis.cvComposite,
            cvAnalysis.isCompliant ? 1 : 0, now, now]);
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
            const id = 'ds-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            await db.query(`
              INSERT INTO district_statistics
              (id, project_id, district_id, school_type, school_count, cv_composite, is_cv_compliant, calculated_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (project_id, district_id, school_type) DO UPDATE SET
                school_count = EXCLUDED.school_count,
                cv_composite = EXCLUDED.cv_composite,
                is_cv_compliant = EXCLUDED.is_cv_compliant,
                calculated_at = EXCLUDED.calculated_at
            `, [id, projectId, d.id, type, cvAnalysis.schoolCount, cvAnalysis.cvComposite,
              cvAnalysis.isCompliant ? 1 : 0, now, now]);
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

module.exports = { router, setDb };
