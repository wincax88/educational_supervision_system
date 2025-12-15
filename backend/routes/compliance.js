const express = require('express');
const router = express.Router();
const { validateEnum } = require('../constants/enums');
const { deleteComplianceRule } = require('../services/cascadeService');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成UUID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 规则 CRUD ====================

// 获取规则列表
router.get('/compliance-rules', async (req, res) => {
  try {
    const { ruleType, indicatorId, enabled } = req.query;

    let query = `
      SELECT
        cr.id, cr.code, cr.name, cr.rule_type as "ruleType",
        cr.indicator_id as "indicatorId", cr.element_id as "elementId",
        cr.enabled, cr.priority, cr.description,
        cr.created_by as "createdBy", cr.created_at as "createdAt",
        cr.updated_by as "updatedBy", cr.updated_at as "updatedAt",
        di.code as "indicatorCode", di.name as "indicatorName",
        e.code as "elementCode", e.name as "elementName"
      FROM compliance_rules cr
      LEFT JOIN data_indicators di ON cr.indicator_id = di.id
      LEFT JOIN elements e ON cr.element_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (ruleType) {
      query += ` AND cr.rule_type = $${paramIndex++}`;
      params.push(ruleType);
    }

    if (indicatorId) {
      query += ` AND cr.indicator_id = $${paramIndex++}`;
      params.push(indicatorId);
    }

    if (enabled !== undefined) {
      query += ` AND cr.enabled = $${paramIndex++}`;
      params.push(enabled === 'true' || enabled === '1' ? 1 : 0);
    }

    query += ' ORDER BY cr.priority DESC, cr.created_at DESC';

    const result = await db.query(query, params);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个规则详情
router.get('/compliance-rules/:id', async (req, res) => {
  try {
    const ruleResult = await db.query(`
      SELECT
        cr.id, cr.code, cr.name, cr.rule_type as "ruleType",
        cr.indicator_id as "indicatorId", cr.element_id as "elementId",
        cr.enabled, cr.priority, cr.description,
        cr.created_by as "createdBy", cr.created_at as "createdAt",
        cr.updated_by as "updatedBy", cr.updated_at as "updatedAt"
      FROM compliance_rules cr WHERE cr.id = $1
    `, [req.params.id]);

    const rule = ruleResult.rows[0];

    if (!rule) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    // 获取条件
    const conditionsResult = await db.query(`
      SELECT id, field, operator, value, logical_operator as "logicalOperator", sort_order as "sortOrder"
      FROM rule_conditions WHERE rule_id = $1 ORDER BY sort_order
    `, [req.params.id]);

    rule.conditions = conditionsResult.rows;

    // 解析条件值
    rule.conditions.forEach(c => {
      try {
        c.value = JSON.parse(c.value);
      } catch {
        // 保持原值
      }
    });

    // 获取动作
    const actionsResult = await db.query(`
      SELECT id, action_type as "actionType", config, result_field as "resultField",
             pass_message as "passMessage", fail_message as "failMessage", sort_order as "sortOrder"
      FROM rule_actions WHERE rule_id = $1 ORDER BY sort_order
    `, [req.params.id]);

    rule.actions = actionsResult.rows;

    // 解析配置
    rule.actions.forEach(a => {
      try {
        a.config = JSON.parse(a.config);
      } catch {
        // 保持原值
      }
    });

    res.json({ code: 200, data: rule });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建规则
router.post('/compliance-rules', async (req, res) => {
  try {
    const { code, name, ruleType, indicatorId, elementId, enabled, priority, description, conditions, actions } = req.body;

    if (!code || !name || !ruleType) {
      return res.status(400).json({ code: 400, message: '缺少必填字段' });
    }

    // 程序层面枚举验证
    try {
      validateEnum('COMPLIANCE_RULE_TYPE', ruleType, 'ruleType');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    const id = generateId();
    const timestamp = now();

    // 检查code唯一性
    const existingResult = await db.query('SELECT id FROM compliance_rules WHERE code = $1', [code]);
    if (existingResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '规则代码已存在' });
    }

    await db.transaction(async (client) => {
      // 插入规则
      await client.query(`
        INSERT INTO compliance_rules
        (id, code, name, rule_type, indicator_id, element_id, enabled, priority, description, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin', $10, $11)
      `, [id, code, name, ruleType, indicatorId || null, elementId || null,
        enabled !== false ? 1 : 0, priority || 0, description || '', timestamp, timestamp]);

      // 插入条件
      if (conditions && conditions.length > 0) {
        for (let idx = 0; idx < conditions.length; idx++) {
          const c = conditions[idx];
          await client.query(`
            INSERT INTO rule_conditions (id, rule_id, field, operator, value, logical_operator, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            generateId(), id, c.field, c.operator,
            typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
            c.logicalOperator || 'AND', idx
          ]);
        }
      }

      // 插入动作
      if (actions && actions.length > 0) {
        for (let idx = 0; idx < actions.length; idx++) {
          const a = actions[idx];
          await client.query(`
            INSERT INTO rule_actions (id, rule_id, action_type, config, result_field, pass_message, fail_message, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            generateId(), id, a.actionType,
            typeof a.config === 'object' ? JSON.stringify(a.config) : a.config,
            a.resultField || null, a.passMessage || null, a.failMessage || null, idx
          ]);
        }
      }
    });

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新规则
router.put('/compliance-rules/:id', async (req, res) => {
  try {
    const { code, name, ruleType, indicatorId, elementId, enabled, priority, description, conditions, actions } = req.body;
    const ruleId = req.params.id;
    const timestamp = now();

    // 程序层面枚举验证
    if (ruleType) {
      try {
        validateEnum('COMPLIANCE_RULE_TYPE', ruleType, 'ruleType');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    // 检查规则是否存在
    const existingResult = await db.query('SELECT id FROM compliance_rules WHERE id = $1', [ruleId]);
    if (!existingResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    // 检查code唯一性
    if (code) {
      const codeExistsResult = await db.query('SELECT id FROM compliance_rules WHERE code = $1 AND id != $2', [code, ruleId]);
      if (codeExistsResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '规则代码已存在' });
      }
    }

    await db.transaction(async (client) => {
      // 更新规则
      await client.query(`
        UPDATE compliance_rules
        SET code = $1, name = $2, rule_type = $3, indicator_id = $4, element_id = $5,
            enabled = $6, priority = $7, description = $8, updated_by = 'admin', updated_at = $9
        WHERE id = $10
      `, [code, name, ruleType, indicatorId || null, elementId || null,
        enabled !== false ? 1 : 0, priority || 0, description || '', timestamp, ruleId]);

      // 更新条件：删除旧的，插入新的
      await client.query('DELETE FROM rule_conditions WHERE rule_id = $1', [ruleId]);

      if (conditions && conditions.length > 0) {
        for (let idx = 0; idx < conditions.length; idx++) {
          const c = conditions[idx];
          await client.query(`
            INSERT INTO rule_conditions (id, rule_id, field, operator, value, logical_operator, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            c.id || generateId(), ruleId, c.field, c.operator,
            typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
            c.logicalOperator || 'AND', idx
          ]);
        }
      }

      // 更新动作
      await client.query('DELETE FROM rule_actions WHERE rule_id = $1', [ruleId]);

      if (actions && actions.length > 0) {
        for (let idx = 0; idx < actions.length; idx++) {
          const a = actions[idx];
          await client.query(`
            INSERT INTO rule_actions (id, rule_id, action_type, config, result_field, pass_message, fail_message, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            a.id || generateId(), ruleId, a.actionType,
            typeof a.config === 'object' ? JSON.stringify(a.config) : a.config,
            a.resultField || null, a.passMessage || null, a.failMessage || null, idx
          ]);
        }
      }
    });

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除规则（使用级联删除服务）
router.delete('/compliance-rules/:id', async (req, res) => {
  try {
    const result = await deleteComplianceRule(req.params.id);

    if (!result.deleted.compliance_rules) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 切换规则启用状态
router.post('/compliance-rules/:id/toggle', async (req, res) => {
  try {
    const ruleResult = await db.query('SELECT id, enabled FROM compliance_rules WHERE id = $1', [req.params.id]);
    const rule = ruleResult.rows[0];

    if (!rule) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    const newEnabled = rule.enabled ? 0 : 1;
    await db.query('UPDATE compliance_rules SET enabled = $1, updated_at = $2 WHERE id = $3',
      [newEnabled, now(), req.params.id]);

    res.json({ code: 200, data: { enabled: !!newEnabled }, message: newEnabled ? '已启用' : '已禁用' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目评估结果
router.get('/projects/:projectId/compliance-results', async (req, res) => {
  try {
    const { schoolId, indicatorId, isCompliant } = req.query;
    const projectId = req.params.projectId;

    let query = `
      SELECT
        cr.id, cr.rule_id as "ruleId", cr.entity_type as "entityType", cr.entity_id as "entityId",
        cr.indicator_id as "indicatorId", cr.actual_value as "actualValue",
        cr.threshold_value as "thresholdValue", cr.is_compliant as "isCompliant",
        cr.message, cr.details, cr.calculated_at as "calculatedAt",
        rule.code as "ruleCode", rule.name as "ruleName",
        s.name as "schoolName", s.code as "schoolCode",
        di.code as "indicatorCode", di.name as "indicatorName"
      FROM compliance_results cr
      LEFT JOIN compliance_rules rule ON cr.rule_id = rule.id
      LEFT JOIN schools s ON cr.entity_id = s.id AND cr.entity_type = 'school'
      LEFT JOIN data_indicators di ON cr.indicator_id = di.id
      WHERE cr.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (schoolId) {
      query += ` AND cr.entity_id = $${paramIndex++}`;
      params.push(schoolId);
    }

    if (indicatorId) {
      query += ` AND cr.indicator_id = $${paramIndex++}`;
      params.push(indicatorId);
    }

    if (isCompliant !== undefined) {
      query += ` AND cr.is_compliant = $${paramIndex++}`;
      params.push(isCompliant === 'true' || isCompliant === '1' ? 1 : 0);
    }

    query += ' ORDER BY cr.calculated_at DESC';

    const result = await db.query(query, params);

    // 解析details
    const results = result.rows.map(r => {
      try {
        r.details = JSON.parse(r.details);
      } catch {
        r.details = {};
      }
      r.isCompliant = r.isCompliant === 1 ? true : (r.isCompliant === 0 ? false : null);
      return r;
    });

    res.json({ code: 200, data: results });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校达标汇总
router.get('/schools/:schoolId/compliance-summary', async (req, res) => {
  try {
    const { projectId } = req.query;
    const schoolId = req.params.schoolId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    // 获取学校信息
    const schoolResult = await db.query(`
      SELECT id, name, code, school_type as "schoolType", district_id as "districtId"
      FROM schools WHERE id = $1
    `, [schoolId]);

    const school = schoolResult.rows[0];

    if (!school) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 获取达标统计
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
        SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
      FROM compliance_results
      WHERE project_id = $1 AND entity_id = $2 AND entity_type = 'school'
    `, [projectId, schoolId]);

    const stats = statsResult.rows[0];

    // 获取未达标项目明细
    const nonCompliantResult = await db.query(`
      SELECT
        cr.id, cr.indicator_id as "indicatorId", cr.actual_value as "actualValue",
        cr.threshold_value as "thresholdValue", cr.message,
        di.code as "indicatorCode", di.name as "indicatorName"
      FROM compliance_results cr
      LEFT JOIN data_indicators di ON cr.indicator_id = di.id
      WHERE cr.project_id = $1 AND cr.entity_id = $2 AND cr.entity_type = 'school' AND cr.is_compliant = 0
    `, [projectId, schoolId]);

    res.json({
      code: 200,
      data: {
        school,
        summary: {
          total: parseInt(stats.total) || 0,
          compliant: parseInt(stats.compliant) || 0,
          nonCompliant: parseInt(stats.nonCompliant) || 0,
          pending: parseInt(stats.pending) || 0,
          complianceRate: parseInt(stats.total) > 0
            ? Math.round((parseInt(stats.compliant) / (parseInt(stats.compliant) + parseInt(stats.nonCompliant))) * 10000) / 100
            : null
        },
        nonCompliantItems: nonCompliantResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 阈值标准管理 ====================

// 获取阈值标准列表
router.get('/threshold-standards', async (req, res) => {
  try {
    const { indicatorId, institutionType } = req.query;

    let query = `
      SELECT
        ts.id, ts.indicator_id as "indicatorId", ts.institution_type as "institutionType",
        ts.threshold_operator as "thresholdOperator", ts.threshold_value as "thresholdValue",
        ts.unit, ts.source, ts.effective_date as "effectiveDate", ts.expiry_date as "expiryDate",
        ts.created_at as "createdAt", ts.updated_at as "updatedAt",
        di.code as "indicatorCode", di.name as "indicatorName"
      FROM threshold_standards ts
      LEFT JOIN data_indicators di ON ts.indicator_id = di.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (indicatorId) {
      query += ` AND ts.indicator_id = $${paramIndex++}`;
      params.push(indicatorId);
    }

    if (institutionType) {
      query += ` AND ts.institution_type = $${paramIndex++}`;
      params.push(institutionType);
    }

    query += ' ORDER BY di.code, ts.institution_type';

    const result = await db.query(query, params);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存阈值标准
router.post('/threshold-standards', async (req, res) => {
  try {
    const { indicatorId, institutionType, thresholdOperator, thresholdValue, unit, source, effectiveDate, expiryDate } = req.body;

    if (!indicatorId || !institutionType || !thresholdOperator || thresholdValue === undefined) {
      return res.status(400).json({ code: 400, message: '缺少必填字段' });
    }

    // 验证数据指标是否存在（程序层面引用验证）
    const indicatorResult = await db.query('SELECT id FROM data_indicators WHERE id = $1', [indicatorId]);
    if (!indicatorResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '数据指标不存在' });
    }

    const id = generateId();
    const timestamp = now();

    // 使用UPSERT
    await db.query(`
      INSERT INTO threshold_standards
      (id, indicator_id, institution_type, threshold_operator, threshold_value, unit, source, effective_date, expiry_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(indicator_id, institution_type) DO UPDATE SET
        threshold_operator = EXCLUDED.threshold_operator,
        threshold_value = EXCLUDED.threshold_value,
        unit = EXCLUDED.unit,
        source = EXCLUDED.source,
        effective_date = EXCLUDED.effective_date,
        expiry_date = EXCLUDED.expiry_date,
        updated_at = EXCLUDED.updated_at
    `, [id, indicatorId, institutionType, thresholdOperator, String(thresholdValue),
      unit || null, source || null, effectiveDate || null, expiryDate || null, timestamp, timestamp]);

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 差异系数计算 ====================

// 计算区县差异系数
router.get('/districts/:districtId/cv', async (req, res) => {
  try {
    const { projectId, indicatorId, schoolType } = req.query;
    const districtId = req.params.districtId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    // 获取区县信息
    const districtResult = await db.query('SELECT id, name FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取该区县该类型的学校列表
    let schoolQuery = `
      SELECT s.id, s.name, s.student_count as "studentCount", s.teacher_count as "teacherCount"
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
      return res.json({
        code: 200,
        data: {
          district,
          schoolType,
          schoolCount: 0,
          cvIndicators: {},
          cvComposite: null,
          threshold: schoolType === '小学' ? 0.50 : 0.45,
          isCompliant: null
        }
      });
    }

    // 计算生师比的差异系数
    const studentTeacherRatios = schools
      .filter(s => s.teacherCount > 0)
      .map(s => s.studentCount / s.teacherCount);

    const calculateCV = (values) => {
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
    };

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

    res.json({
      code: 200,
      data: {
        district,
        schoolType,
        schoolCount: schools.length,
        cvIndicators,
        cvComposite,
        threshold,
        isCompliant
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县达标率统计
router.get('/districts/:districtId/compliance-rate', async (req, res) => {
  try {
    const { projectId, indicatorId, schoolType } = req.query;
    const districtId = req.params.districtId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    let query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant"
      FROM school_indicator_data sid
      WHERE sid.project_id = $1
        AND sid.school_id IN (SELECT id FROM schools WHERE district_id = $2)
    `;
    const params = [projectId, districtId];

    const result = await db.query(query, params);
    const stats = result.rows[0];

    res.json({
      code: 200,
      data: {
        total: parseInt(stats.total) || 0,
        compliant: parseInt(stats.compliant) || 0,
        nonCompliant: parseInt(stats.nonCompliant) || 0,
        complianceRate: parseInt(stats.total) > 0
          ? Math.round((parseInt(stats.compliant) / parseInt(stats.total)) * 10000) / 100
          : null
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
