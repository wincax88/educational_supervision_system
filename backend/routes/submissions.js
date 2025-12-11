const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 项目 CRUD ====================

// 获取项目列表
router.get('/projects', (req, res) => {
  try {
    const { status, year } = req.query;
    let sql = `
      SELECT p.id, p.name, p.keywords, p.description, p.indicator_system_id as indicatorSystemId,
             p.start_date as startDate, p.end_date as endDate, p.status,
             p.created_by as createdBy, p.created_at as createdAt, p.updated_at as updatedAt,
             i.name as indicatorSystemName
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    if (year) {
      sql += ' AND strftime("%Y", p.start_date) = ?';
      params.push(year);
    }

    sql += ' ORDER BY p.created_at DESC';

    const projects = db.prepare(sql).all(...params);
    projects.forEach(p => {
      p.keywords = p.keywords ? JSON.parse(p.keywords) : [];
    });

    res.json({ code: 200, data: projects });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个项目
router.get('/projects/:id', (req, res) => {
  try {
    const project = db.prepare(`
      SELECT p.id, p.name, p.keywords, p.description, p.indicator_system_id as indicatorSystemId,
             p.start_date as startDate, p.end_date as endDate, p.status,
             p.created_by as createdBy, p.created_at as createdAt, p.updated_at as updatedAt,
             i.name as indicatorSystemName
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.id = ?
    `).get(req.params.id);

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
router.post('/projects', (req, res) => {
  try {
    const { name, keywords, description, indicatorSystemId, startDate, endDate } = req.body;
    const id = generateId();
    const timestamp = now().split('T')[0];

    db.prepare(`
      INSERT INTO projects (id, name, keywords, description, indicator_system_id, start_date, end_date, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, '配置中', 'admin', ?, ?)
    `).run(id, name, JSON.stringify(keywords || []), description, indicatorSystemId, startDate, endDate, timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新项目
router.put('/projects/:id', (req, res) => {
  try {
    const { name, keywords, description, indicatorSystemId, startDate, endDate, status } = req.body;
    const timestamp = now().split('T')[0];

    const result = db.prepare(`
      UPDATE projects SET name = ?, keywords = ?, description = ?, indicator_system_id = ?,
             start_date = ?, end_date = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(name, JSON.stringify(keywords || []), description, indicatorSystemId, startDate, endDate, status, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 启动填报
router.post('/projects/:id/start', (req, res) => {
  try {
    // 检查项目当前状态
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以启动填报' });
    }

    const timestamp = now().split('T')[0];
    db.prepare(`
      UPDATE projects SET status = '填报中', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    res.json({ code: 200, message: '填报已启动' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 中止项目
router.post('/projects/:id/stop', (req, res) => {
  try {
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status === '已完成' || project.status === '已中止') {
      return res.status(400).json({ code: 400, message: '已完成或已中止的项目无法再次中止' });
    }

    const timestamp = now().split('T')[0];
    db.prepare(`
      UPDATE projects SET status = '已中止', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    res.json({ code: 200, message: '项目已中止' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 进入评审
router.post('/projects/:id/review', (req, res) => {
  try {
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '填报中') {
      return res.status(400).json({ code: 400, message: '只有填报中的项目可以进入评审' });
    }

    const timestamp = now().split('T')[0];
    db.prepare(`
      UPDATE projects SET status = '评审中', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    res.json({ code: 200, message: '项目已进入评审阶段' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 完成项目
router.post('/projects/:id/complete', (req, res) => {
  try {
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '评审中') {
      return res.status(400).json({ code: 400, message: '只有评审中的项目可以完成' });
    }

    const timestamp = now().split('T')[0];
    db.prepare(`
      UPDATE projects SET status = '已完成', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    res.json({ code: 200, message: '项目已完成' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 重新启动项目（从已中止恢复到配置中）
router.post('/projects/:id/restart', (req, res) => {
  try {
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '已中止') {
      return res.status(400).json({ code: 400, message: '只有已中止的项目可以重新启动' });
    }

    const timestamp = now().split('T')[0];
    db.prepare(`
      UPDATE projects SET status = '配置中', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    res.json({ code: 200, message: '项目已重新启动' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除项目
router.delete('/projects/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以删除' });
    }

    // 删除关联的工具关系
    db.prepare('DELETE FROM project_tools WHERE project_id = ?').run(req.params.id);
    // 删除项目
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 填报记录 CRUD ====================

// 获取填报记录列表
router.get('/submissions', (req, res) => {
  try {
    const { projectId, formId, status, submitterOrg } = req.query;
    let sql = `
      SELECT s.id, s.project_id as projectId, s.form_id as formId,
             s.submitter_id as submitterId, s.submitter_name as submitterName,
             s.submitter_org as submitterOrg, s.status, s.reject_reason as rejectReason,
             s.created_at as createdAt, s.updated_at as updatedAt,
             s.submitted_at as submittedAt, s.approved_at as approvedAt,
             p.name as projectName, t.name as formName
      FROM submissions s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN data_tools t ON s.form_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND s.project_id = ?';
      params.push(projectId);
    }
    if (formId) {
      sql += ' AND s.form_id = ?';
      params.push(formId);
    }
    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    if (submitterOrg) {
      sql += ' AND s.submitter_org LIKE ?';
      params.push(`%${submitterOrg}%`);
    }

    sql += ' ORDER BY s.updated_at DESC';

    const submissions = db.prepare(sql).all(...params);
    res.json({ code: 200, data: submissions });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目下的填报记录
router.get('/projects/:projectId/submissions', (req, res) => {
  try {
    const submissions = db.prepare(`
      SELECT s.id, s.project_id as projectId, s.form_id as formId,
             s.submitter_id as submitterId, s.submitter_name as submitterName,
             s.submitter_org as submitterOrg, s.status, s.reject_reason as rejectReason,
             s.created_at as createdAt, s.updated_at as updatedAt,
             s.submitted_at as submittedAt, s.approved_at as approvedAt,
             t.name as formName
      FROM submissions s
      LEFT JOIN data_tools t ON s.form_id = t.id
      WHERE s.project_id = ?
      ORDER BY s.updated_at DESC
    `).all(req.params.projectId);

    res.json({ code: 200, data: submissions });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个填报记录（含数据）
router.get('/submissions/:id', (req, res) => {
  try {
    const submission = db.prepare(`
      SELECT s.id, s.project_id as projectId, s.form_id as formId,
             s.submitter_id as submitterId, s.submitter_name as submitterName,
             s.submitter_org as submitterOrg, s.status, s.data, s.reject_reason as rejectReason,
             s.created_at as createdAt, s.updated_at as updatedAt,
             s.submitted_at as submittedAt, s.approved_at as approvedAt,
             p.name as projectName, t.name as formName, t.schema
      FROM submissions s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN data_tools t ON s.form_id = t.id
      WHERE s.id = ?
    `).get(req.params.id);

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
router.post('/submissions', (req, res) => {
  try {
    const { projectId, formId, submitterId, submitterName, submitterOrg, data } = req.body;
    const id = generateId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO submissions (id, project_id, form_id, submitter_id, submitter_name, submitter_org, status, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
    `).run(id, projectId, formId, submitterId, submitterName, submitterOrg, JSON.stringify(data || {}), timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新填报数据
router.put('/submissions/:id', (req, res) => {
  try {
    const { data, submitterName, submitterOrg } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE submissions SET data = ?, submitter_name = ?, submitter_org = ?, updated_at = ? WHERE id = ? AND status = 'draft'
    `).run(JSON.stringify(data || {}), submitterName, submitterOrg, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(400).json({ code: 400, message: '只能更新草稿状态的填报记录' });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 提交填报
router.post('/submissions/:id/submit', (req, res) => {
  try {
    const timestamp = now();
    const result = db.prepare(`
      UPDATE submissions SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'
    `).run(timestamp, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(400).json({ code: 400, message: '只能提交草稿状态的填报记录' });
    }

    res.json({ code: 200, message: '提交成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 审核通过
router.post('/submissions/:id/approve', (req, res) => {
  try {
    const timestamp = now();
    const result = db.prepare(`
      UPDATE submissions SET status = 'approved', approved_at = ?, updated_at = ? WHERE id = ? AND status = 'submitted'
    `).run(timestamp, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(400).json({ code: 400, message: '只能审核已提交状态的填报记录' });
    }

    res.json({ code: 200, message: '审核通过' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 审核驳回
router.post('/submissions/:id/reject', (req, res) => {
  try {
    const { reason } = req.body;
    const timestamp = now();
    const result = db.prepare(`
      UPDATE submissions SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ? AND status = 'submitted'
    `).run(reason || '', timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(400).json({ code: 400, message: '只能驳回已提交状态的填报记录' });
    }

    res.json({ code: 200, message: '已驳回' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 退回修改（将驳回的记录改回草稿状态）
router.post('/submissions/:id/revise', (req, res) => {
  try {
    const timestamp = now();
    const result = db.prepare(`
      UPDATE submissions SET status = 'draft', reject_reason = NULL, updated_at = ? WHERE id = ? AND status = 'rejected'
    `).run(timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(400).json({ code: 400, message: '只能修改已驳回状态的填报记录' });
    }

    res.json({ code: 200, message: '已退回修改' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除填报记录
router.delete('/submissions/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM submissions WHERE id = ? AND status = "draft"').run(req.params.id);

    if (result.changes === 0) {
      return res.status(400).json({ code: 400, message: '只能删除草稿状态的填报记录' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 统计 ====================

// 获取填报统计
router.get('/projects/:projectId/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM submissions WHERE project_id = ?
    `).get(req.params.projectId);

    res.json({ code: 200, data: stats });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目的指标映射汇总
router.get('/projects/:projectId/indicator-mapping-summary', (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. 获取项目信息和关联的指标体系
    const project = db.prepare(`
      SELECT p.id, p.name, p.indicator_system_id as indicatorSystemId,
             i.name as indicatorSystemName
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.id = ?
    `).get(projectId);

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
    const dataIndicators = db.prepare(`
      SELECT di.id, di.code, di.name, di.threshold, di.description,
             ind.id as indicatorId, ind.code as indicatorCode, ind.name as indicatorName
      FROM data_indicators di
      JOIN indicators ind ON di.indicator_id = ind.id
      WHERE ind.system_id = ?
      ORDER BY di.code
    `).all(project.indicatorSystemId);

    // 3. 获取项目关联的所有工具及其字段映射
    const toolMappings = db.prepare(`
      SELECT fm.field_id as fieldId, fm.mapping_type as mappingType, fm.target_id as targetId,
             dt.id as toolId, dt.name as toolName, dt.schema as toolSchema
      FROM project_tools pt
      JOIN data_tools dt ON pt.tool_id = dt.id
      LEFT JOIN field_mappings fm ON dt.id = fm.tool_id
      WHERE pt.project_id = ? AND fm.mapping_type = 'data_indicator'
    `).all(projectId);

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
