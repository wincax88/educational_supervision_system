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
    const timestamp = now().split('T')[0];
    const result = db.prepare(`
      UPDATE projects SET status = '填报中', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    res.json({ code: 200, message: '填报已启动' });
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

module.exports = { router, setDb };
