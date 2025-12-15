const express = require('express');
const router = express.Router();
const { projectRules, submissionRules, idParamRules } = require('../middleware/validate');
const { validateEnum } = require('../constants/enums');
const { deleteProject } = require('../services/cascadeService');

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 项目 CRUD ====================

// 获取项目列表
router.get('/projects', async (req, res) => {
  try {
    const { status, year } = req.query;
    let sql = `
      SELECT p.id, p.name, p.keywords, p.description, p.indicator_system_id as "indicatorSystemId",
             p.start_date as "startDate", p.end_date as "endDate", p.status,
             p.created_by as "createdBy", p.created_at as "createdAt", p.updated_at as "updatedAt",
             i.name as "indicatorSystemName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    if (year) {
      sql += ` AND EXTRACT(YEAR FROM p.start_date::date) = $${paramIndex++}`;
      params.push(year);
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await db.query(sql, params);
    const projects = result.rows.map(p => ({
      ...p,
      keywords: p.keywords ? JSON.parse(p.keywords) : []
    }));

    res.json({ code: 200, data: projects });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个项目
router.get('/projects/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.name, p.keywords, p.description, p.indicator_system_id as "indicatorSystemId",
             p.start_date as "startDate", p.end_date as "endDate", p.status,
             p.created_by as "createdBy", p.created_at as "createdAt", p.updated_at as "updatedAt",
             i.name as "indicatorSystemName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.id = $1
    `, [req.params.id]);

    const project = result.rows[0];

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    project.keywords = project.keywords ? JSON.parse(project.keywords) : [];
    res.json({ code: 200, data: project });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建项目
router.post('/projects', projectRules.create, async (req, res) => {
  try {
    const { name, keywords, description, indicatorSystemId, startDate, endDate } = req.body;

    // 验证指标体系是否存在（程序层面引用验证）
    if (indicatorSystemId) {
      const systemResult = await db.query('SELECT id FROM indicator_systems WHERE id = $1', [indicatorSystemId]);
      if (!systemResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '指标体系不存在' });
      }
    }

    const id = generateId();
    const timestamp = now().split('T')[0];

    await db.query(`
      INSERT INTO projects (id, name, keywords, description, indicator_system_id, start_date, end_date, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, '配置中', 'admin', $8, $9)
    `, [id, name, JSON.stringify(keywords || []), description, indicatorSystemId, startDate, endDate, timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新项目
router.put('/projects/:id', async (req, res) => {
  try {
    const { name, keywords, description, indicatorSystemId, startDate, endDate, status } = req.body;

    // 程序层面枚举验证
    if (status) {
      try {
        validateEnum('PROJECT_STATUS', status, 'status');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    // 验证指标体系是否存在（程序层面引用验证）
    if (indicatorSystemId) {
      const systemResult = await db.query('SELECT id FROM indicator_systems WHERE id = $1', [indicatorSystemId]);
      if (!systemResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '指标体系不存在' });
      }
    }

    const timestamp = now().split('T')[0];

    const result = await db.query(`
      UPDATE projects SET name = $1, keywords = $2, description = $3, indicator_system_id = $4,
             start_date = $5, end_date = $6, status = $7, updated_at = $8
      WHERE id = $9
    `, [name, JSON.stringify(keywords || []), description, indicatorSystemId, startDate, endDate, status, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 启动填报
router.post('/projects/:id/start', async (req, res) => {
  try {
    // 检查项目当前状态
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以启动填报' });
    }

    const timestamp = now().split('T')[0];
    await db.query(`
      UPDATE projects SET status = '填报中', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    res.json({ code: 200, message: '填报已启动' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 中止项目
router.post('/projects/:id/stop', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status === '已完成' || project.status === '已中止') {
      return res.status(400).json({ code: 400, message: '已完成或已中止的项目无法再次中止' });
    }

    const timestamp = now().split('T')[0];
    await db.query(`
      UPDATE projects SET status = '已中止', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    res.json({ code: 200, message: '项目已中止' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 进入评审
router.post('/projects/:id/review', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '填报中') {
      return res.status(400).json({ code: 400, message: '只有填报中的项目可以进入评审' });
    }

    const timestamp = now().split('T')[0];
    await db.query(`
      UPDATE projects SET status = '评审中', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    res.json({ code: 200, message: '项目已进入评审阶段' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 完成项目
router.post('/projects/:id/complete', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '评审中') {
      return res.status(400).json({ code: 400, message: '只有评审中的项目可以完成' });
    }

    const timestamp = now().split('T')[0];
    await db.query(`
      UPDATE projects SET status = '已完成', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    res.json({ code: 200, message: '项目已完成' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 重新启动项目（从已中止恢复到配置中）
router.post('/projects/:id/restart', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '已中止') {
      return res.status(400).json({ code: 400, message: '只有已中止的项目可以重新启动' });
    }

    const timestamp = now().split('T')[0];
    await db.query(`
      UPDATE projects SET status = '配置中', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    res.json({ code: 200, message: '项目已重新启动' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除项目（使用级联删除服务）
router.delete('/projects/:id', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以删除' });
    }

    const result = await deleteProject(req.params.id);

    res.json({ code: 200, message: '删除成功', data: result.deleted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 填报记录 CRUD ====================

// 获取填报记录列表
router.get('/submissions', async (req, res) => {
  try {
    const { projectId, formId, status, submitterOrg } = req.query;
    let sql = `
      SELECT s.id, s.project_id as "projectId", s.form_id as "formId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             p.name as "projectName", t.name as "formName"
      FROM submissions s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN data_tools t ON s.form_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex++}`;
      params.push(projectId);
    }
    if (formId) {
      sql += ` AND s.form_id = $${paramIndex++}`;
      params.push(formId);
    }
    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }
    if (submitterOrg) {
      sql += ` AND s.submitter_org LIKE $${paramIndex++}`;
      params.push(`%${submitterOrg}%`);
    }

    sql += ' ORDER BY s.updated_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目下的填报记录
router.get('/projects/:projectId/submissions', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.project_id as "projectId", s.form_id as "formId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             t.name as "formName"
      FROM submissions s
      LEFT JOIN data_tools t ON s.form_id = t.id
      WHERE s.project_id = $1
      ORDER BY s.updated_at DESC
    `, [req.params.projectId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个填报记录（含数据）
router.get('/submissions/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.project_id as "projectId", s.form_id as "formId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.data, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             p.name as "projectName", t.name as "formName", t.schema
      FROM submissions s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN data_tools t ON s.form_id = t.id
      WHERE s.id = $1
    `, [req.params.id]);

    const submission = result.rows[0];

    if (!submission) {
      return res.status(404).json({ code: 404, message: '填报记录不存在' });
    }

    submission.data = submission.data ? JSON.parse(submission.data) : {};
    submission.schema = submission.schema ? JSON.parse(submission.schema) : [];

    res.json({ code: 200, data: submission });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建填报记录（草稿）
router.post('/submissions', async (req, res) => {
  try {
    const { projectId, formId, submitterId, submitterName, submitterOrg, data } = req.body;

    // 验证项目是否存在（程序层面引用验证）
    const projectResult = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!projectResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '项目不存在' });
    }

    // 验证表单是否存在（程序层面引用验证）
    const formResult = await db.query('SELECT id FROM data_tools WHERE id = $1', [formId]);
    if (!formResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '表单不存在' });
    }

    const id = generateId();
    const timestamp = now();

    await db.query(`
      INSERT INTO submissions (id, project_id, form_id, submitter_id, submitter_name, submitter_org, status, data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9)
    `, [id, projectId, formId, submitterId, submitterName, submitterOrg, JSON.stringify(data || {}), timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新填报数据
router.put('/submissions/:id', async (req, res) => {
  try {
    const { data, submitterName, submitterOrg } = req.body;
    const timestamp = now();

    const result = await db.query(`
      UPDATE submissions SET data = $1, submitter_name = $2, submitter_org = $3, updated_at = $4 WHERE id = $5 AND status = 'draft'
    `, [JSON.stringify(data || {}), submitterName, submitterOrg, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '只能更新草稿状态的填报记录' });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 提交填报
router.post('/submissions/:id/submit', async (req, res) => {
  try {
    const timestamp = now();
    const result = await db.query(`
      UPDATE submissions SET status = 'submitted', submitted_at = $1, updated_at = $2 WHERE id = $3 AND status = 'draft'
    `, [timestamp, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '只能提交草稿状态的填报记录' });
    }

    res.json({ code: 200, message: '提交成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 审核通过
router.post('/submissions/:id/approve', async (req, res) => {
  try {
    const timestamp = now();
    const result = await db.query(`
      UPDATE submissions SET status = 'approved', approved_at = $1, updated_at = $2 WHERE id = $3 AND status = 'submitted'
    `, [timestamp, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '只能审核已提交状态的填报记录' });
    }

    res.json({ code: 200, message: '审核通过' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 审核驳回
router.post('/submissions/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const timestamp = now();
    const result = await db.query(`
      UPDATE submissions SET status = 'rejected', reject_reason = $1, updated_at = $2 WHERE id = $3 AND status = 'submitted'
    `, [reason || '', timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '只能驳回已提交状态的填报记录' });
    }

    res.json({ code: 200, message: '已驳回' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 退回修改（将驳回的记录改回草稿状态）
router.post('/submissions/:id/revise', async (req, res) => {
  try {
    const timestamp = now();
    const result = await db.query(`
      UPDATE submissions SET status = 'draft', reject_reason = NULL, updated_at = $1 WHERE id = $2 AND status = 'rejected'
    `, [timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '只能修改已驳回状态的填报记录' });
    }

    res.json({ code: 200, message: '已退回修改' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除填报记录
router.delete('/submissions/:id', async (req, res) => {
  try {
    const result = await db.query("DELETE FROM submissions WHERE id = $1 AND status = 'draft'", [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '只能删除草稿状态的填报记录' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 统计 ====================

// 获取填报统计
router.get('/projects/:projectId/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM submissions WHERE project_id = $1
    `, [req.params.projectId]);

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目的指标映射汇总
router.get('/projects/:projectId/indicator-mapping-summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. 获取项目信息和关联的指标体系
    const projectResult = await db.query(`
      SELECT p.id, p.name, p.indicator_system_id as "indicatorSystemId",
             i.name as "indicatorSystemName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.id = $1
    `, [projectId]);

    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    if (!project.indicatorSystemId) {
      return res.json({
        code: 200,
        data: {
          project,
          dataIndicators: [],
          stats: { total: 0, mapped: 0, unmapped: 0 },
        },
      });
    }

    // 2. 获取该指标体系下的所有数据指标
    const dataIndicatorsResult = await db.query(`
      SELECT di.id, di.code, di.name, di.threshold, di.description,
             ind.id as "indicatorId", ind.code as "indicatorCode", ind.name as "indicatorName"
      FROM data_indicators di
      JOIN indicators ind ON di.indicator_id = ind.id
      WHERE ind.system_id = $1
      ORDER BY di.code
    `, [project.indicatorSystemId]);

    const dataIndicators = dataIndicatorsResult.rows;

    // 3. 获取项目关联的所有工具及其字段映射
    const toolMappingsResult = await db.query(`
      SELECT fm.field_id as "fieldId", fm.mapping_type as "mappingType", fm.target_id as "targetId",
             dt.id as "toolId", dt.name as "toolName", dt.schema as "toolSchema"
      FROM project_tools pt
      JOIN data_tools dt ON pt.tool_id = dt.id
      LEFT JOIN field_mappings fm ON dt.id = fm.tool_id
      WHERE pt.project_id = $1 AND fm.mapping_type = 'data_indicator'
    `, [projectId]);

    const toolMappings = toolMappingsResult.rows;

    // 4. 构建映射查找表
    const mappingByTargetId = {};
    toolMappings.forEach(m => {
      if (m.targetId) {
        // 从 schema 中获取字段信息
        let fieldLabel = '';
        if (m.toolSchema) {
          try {
            const schema = JSON.parse(m.toolSchema);
            const findField = (fields, id) => {
              for (const f of fields) {
                if (f.id === m.fieldId) return f.label;
                if (f.children) {
                  const found = findField(f.children, id);
                  if (found) return found;
                }
              }
              return null;
            };
            fieldLabel = findField(schema, m.fieldId) || m.fieldId;
          } catch (e) {
            fieldLabel = m.fieldId;
          }
        }
        mappingByTargetId[m.targetId] = {
          toolId: m.toolId,
          toolName: m.toolName,
          fieldId: m.fieldId,
          fieldLabel: fieldLabel,
        };
      }
    });

    // 5. 合并数据指标和映射信息
    const result = dataIndicators.map(di => ({
      ...di,
      mapping: mappingByTargetId[di.id] || null,
      isMapped: !!mappingByTargetId[di.id],
    }));

    // 6. 统计
    const stats = {
      total: result.length,
      mapped: result.filter(r => r.isMapped).length,
      unmapped: result.filter(r => !r.isMapped).length,
    };

    res.json({
      code: 200,
      data: {
        project: {
          id: project.id,
          name: project.name,
          indicatorSystemId: project.indicatorSystemId,
          indicatorSystemName: project.indicatorSystemName,
        },
        dataIndicators: result,
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
