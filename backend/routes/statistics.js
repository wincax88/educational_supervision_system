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

        // 获取该部门的指标数据统计（排除需要实时计算的指标）
        const statsResult = await db.query(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
            SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
            SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
          FROM school_indicator_data sid
          JOIN data_indicators di ON sid.data_indicator_id = di.id
          WHERE sid.project_id = $1 AND sid.school_id = $2
            AND di.code NOT IN ($3, $4, $5, $6, $7, $8, $9)${indicatorFilter}
        `, [projectId, school.id, ...sectionCalculatedIndicatorCodes]);

        const stats = statsResult.rows[0];
        let total = parseInt(stats.total) || 0;
        let compliant = parseInt(stats.compliant) || 0;
        let nonCompliant = parseInt(stats.nonCompliant) || 0;

        // 获取需要实时计算的指标的阈值和达标状态（根据部门类型）
        const calculatedIndicatorsResult = await db.query(`
          SELECT id, code, name, threshold
          FROM data_indicators
          WHERE (code LIKE '%1.1${indicatorCodeSuffix}%' OR code LIKE '%1.2${indicatorCodeSuffix}%' 
                 OR code LIKE '%1.3${indicatorCodeSuffix}%' OR code LIKE '%1.4${indicatorCodeSuffix}%'
                 OR code LIKE '%1.5${indicatorCodeSuffix}%' OR code LIKE '%1.6${indicatorCodeSuffix}%'
                 OR code LIKE '%1.7${indicatorCodeSuffix}%')
        `);

        const calculatedIndicators = calculatedIndicatorsResult.rows;
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
          WHERE sid.project_id = $1 AND sid.school_id = $2 AND sid.is_compliant = 0
            AND di.code NOT IN ($3, $4, $5, $6, $7, $8, $9)${indicatorFilter}
          ORDER BY di.code
        `, [projectId, school.id, ...sectionCalculatedIndicatorCodes]);

        // 合并未达标指标列表
        const allNonCompliantIndicators = [...nonCompliantResult.rows, ...nonCompliantCalculated];

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
          nonCompliantIndicators: allNonCompliantIndicators
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
    const allCvCompliant = totalCvCount > 0 && compliantCvCount === totalCvCount;

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
          allCompliant: allCvCompliant,  // 向后兼容别名
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

module.exports = { router, setDb };
