const express = require('express');
const router = express.Router();
const {
  getDistrictCVAnalysis,
  getComplianceStatistics,
  getDistrictComparison,
  saveSchoolIndicatorData,
  updateDistrictStatistics,
  calculateCV
} = require('../services/statisticsService');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// ==================== 差异系数分析 ====================

// 获取项目的差异系数分析
router.get('/projects/:projectId/cv-analysis', (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolType } = req.query;

    if (!districtId) {
      return res.status(400).json({ code: 400, message: '请指定区县' });
    }

    const result = getDistrictCVAnalysis(db, projectId, districtId, schoolType || '小学');

    if (!result) {
      return res.status(404).json({ code: 404, message: '未找到数据' });
    }

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有区县的差异系数汇总
router.get('/projects/:projectId/cv-summary', (req, res) => {
  try {
    const { projectId } = req.params;
    const { schoolType } = req.query;

    const districts = db.prepare('SELECT id, name, code FROM districts ORDER BY sort_order').all();

    const summary = districts.map(district => {
      const analysis = getDistrictCVAnalysis(db, projectId, district.id, schoolType || '小学');
      return {
        districtId: district.id,
        districtName: district.name,
        districtCode: district.code,
        schoolCount: analysis?.schoolCount || 0,
        cvComposite: analysis?.cvComposite,
        threshold: analysis?.threshold,
        isCompliant: analysis?.isCompliant
      };
    }).filter(d => d.schoolCount > 0);

    // 计算全市汇总
    const cityTotal = {
      districtCount: summary.length,
      compliantCount: summary.filter(d => d.isCompliant).length,
      avgCV: summary.length > 0
        ? Math.round((summary.reduce((sum, d) => sum + (d.cvComposite || 0), 0) / summary.length) * 10000) / 10000
        : null
    };

    res.json({
      code: 200,
      data: {
        cityTotal,
        districts: summary
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 达标率统计 ====================

// 获取项目的达标率统计
router.get('/projects/:projectId/compliance-summary', (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolId } = req.query;

    const stats = getComplianceStatistics(db, projectId, { districtId, schoolId });

    res.json({ code: 200, data: stats });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取各维度达标率（资源配置、政府保障、教育质量、社会认可度）
router.get('/projects/:projectId/compliance-by-category', (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId } = req.query;

    // 获取项目关联的指标体系
    const project = db.prepare(`
      SELECT indicator_system_id FROM projects WHERE id = ?
    `).get(projectId);

    if (!project?.indicator_system_id) {
      return res.json({ code: 200, data: [] });
    }

    // 获取一级指标（类别）
    const categories = db.prepare(`
      SELECT id, code, name FROM indicators
      WHERE system_id = ? AND level = 1
      ORDER BY sort_order
    `).all(project.indicator_system_id);

    const result = categories.map(category => {
      // 获取该类别下所有末级指标的数据指标
      const dataIndicatorIds = db.prepare(`
        SELECT di.id
        FROM data_indicators di
        JOIN indicators ind ON di.indicator_id = ind.id
        WHERE ind.system_id = ?
        AND (ind.parent_id = ? OR ind.id IN (
          SELECT id FROM indicators WHERE parent_id IN (
            SELECT id FROM indicators WHERE parent_id = ?
          )
        ))
      `).all(project.indicator_system_id, category.id, category.id).map(r => r.id);

      if (dataIndicatorIds.length === 0) {
        return {
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          total: 0,
          compliant: 0,
          complianceRate: null
        };
      }

      // 统计该类别的达标情况
      let query = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant
        FROM school_indicator_data
        WHERE project_id = ?
        AND data_indicator_id IN (${dataIndicatorIds.map(() => '?').join(',')})
      `;
      const params = [projectId, ...dataIndicatorIds];

      if (districtId) {
        query += ' AND school_id IN (SELECT id FROM schools WHERE district_id = ?)';
        params.push(districtId);
      }

      const stats = db.prepare(query).get(...params);

      return {
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        total: stats.total || 0,
        compliant: stats.compliant || 0,
        complianceRate: stats.total > 0
          ? Math.round((stats.compliant / stats.total) * 10000) / 100
          : null
      };
    });

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 区县对比 ====================

// 获取区县对比数据
router.get('/projects/:projectId/district-comparison', (req, res) => {
  try {
    const { projectId } = req.params;
    const { schoolType } = req.query;

    const comparison = getDistrictComparison(db, projectId, schoolType || '小学');

    // 排序：按综合差异系数升序
    comparison.sort((a, b) => {
      if (a.cvComposite === null) return 1;
      if (b.cvComposite === null) return -1;
      return a.cvComposite - b.cvComposite;
    });

    res.json({ code: 200, data: comparison });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 学校指标数据 ====================

// 保存学校指标数据
router.post('/school-indicator-data', (req, res) => {
  try {
    const { projectId, schoolId, dataIndicatorId, value, textValue, submissionId } = req.body;

    if (!projectId || !schoolId || !dataIndicatorId) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }

    saveSchoolIndicatorData(db, {
      projectId, schoolId, dataIndicatorId, value, textValue, submissionId
    });

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量保存学校指标数据
router.post('/school-indicator-data/batch', (req, res) => {
  try {
    const { projectId, schoolId, data, submissionId } = req.body;

    if (!projectId || !schoolId || !data || !Array.isArray(data)) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }

    const saveMany = db.transaction((items) => {
      items.forEach(item => {
        saveSchoolIndicatorData(db, {
          projectId,
          schoolId,
          dataIndicatorId: item.dataIndicatorId,
          value: item.value,
          textValue: item.textValue,
          submissionId
        });
      });
    });

    saveMany(data);

    res.json({ code: 200, message: `成功保存 ${data.length} 条数据` });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 统计快照 ====================

// 刷新区县统计快照
router.post('/projects/:projectId/refresh-statistics', (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolType } = req.body;

    if (districtId) {
      // 刷新单个区县
      updateDistrictStatistics(db, projectId, districtId, schoolType || '小学');
      if (schoolType !== '初中') {
        updateDistrictStatistics(db, projectId, districtId, '初中');
      }
    } else {
      // 刷新所有区县
      const districts = db.prepare('SELECT id FROM districts').all();
      districts.forEach(d => {
        updateDistrictStatistics(db, projectId, d.id, '小学');
        updateDistrictStatistics(db, projectId, d.id, '初中');
      });
    }

    res.json({ code: 200, message: '统计刷新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县统计快照
router.get('/projects/:projectId/district-statistics', (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, schoolType } = req.query;

    let query = `
      SELECT ds.*, d.name as district_name, d.code as district_code
      FROM district_statistics ds
      JOIN districts d ON ds.district_id = d.id
      WHERE ds.project_id = ?
    `;
    const params = [projectId];

    if (districtId) {
      query += ' AND ds.district_id = ?';
      params.push(districtId);
    }

    if (schoolType) {
      query += ' AND ds.school_type = ?';
      params.push(schoolType);
    }

    query += ' ORDER BY d.sort_order, ds.school_type';

    const statistics = db.prepare(query).all(...params);

    res.json({ code: 200, data: statistics });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 城乡对比 ====================

// 获取城乡对比数据
router.get('/projects/:projectId/urban-rural-comparison', (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId } = req.query;

    const urbanRuralTypes = ['城区', '镇区', '乡村'];

    const comparison = urbanRuralTypes.map(type => {
      // 获取该城乡类型的学校
      let schoolQuery = `
        SELECT s.id, s.student_count, s.teacher_count
        FROM schools s
        WHERE s.urban_rural = ? AND s.status = 'active'
      `;
      const params = [type];

      if (districtId) {
        schoolQuery += ' AND s.district_id = ?';
        params.push(districtId);
      }

      const schools = db.prepare(schoolQuery).all(...params);

      if (schools.length === 0) {
        return {
          urbanRuralType: type,
          schoolCount: 0,
          avgStudentTeacherRatio: null,
          cvStudentTeacherRatio: null
        };
      }

      // 计算生师比
      const ratios = schools
        .filter(s => s.teacher_count > 0)
        .map(s => s.student_count / s.teacher_count);

      const cvResult = calculateCV(ratios);

      return {
        urbanRuralType: type,
        schoolCount: schools.length,
        avgStudentTeacherRatio: cvResult?.mean || null,
        cvStudentTeacherRatio: cvResult?.cv || null
      };
    });

    res.json({ code: 200, data: comparison.filter(c => c.schoolCount > 0) });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
