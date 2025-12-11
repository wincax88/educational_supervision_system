const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 项目-采集工具关联 ====================

// 获取项目关联的采集工具列表
router.get('/projects/:projectId/tools', (req, res) => {
  try {
    const { projectId } = req.params;

    // 检查项目是否存在
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const tools = db.prepare(`
      SELECT
        pt.id,
        pt.project_id as projectId,
        pt.tool_id as toolId,
        pt.sort_order as sortOrder,
        pt.is_required as isRequired,
        pt.created_at as createdAt,
        dt.name as toolName,
        dt.type as toolType,
        dt.target as toolTarget,
        dt.description as toolDescription,
        dt.status as toolStatus
      FROM project_tools pt
      LEFT JOIN data_tools dt ON pt.tool_id = dt.id
      WHERE pt.project_id = ?
      ORDER BY pt.sort_order
    `).all(projectId);

    res.json({ code: 200, data: tools });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 关联采集工具到项目
router.post('/projects/:projectId/tools', (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, isRequired = 1 } = req.body;

    if (!toolId) {
      return res.status(400).json({ code: 400, message: '工具ID不能为空' });
    }

    // 检查项目是否存在
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查工具是否存在
    const tool = db.prepare('SELECT id FROM data_tools WHERE id = ?').get(toolId);
    if (!tool) {
      return res.status(404).json({ code: 404, message: '采集工具不存在' });
    }

    // 检查是否已关联
    const existing = db.prepare('SELECT id FROM project_tools WHERE project_id = ? AND tool_id = ?').get(projectId, toolId);
    if (existing) {
      return res.status(400).json({ code: 400, message: '该工具已关联到此项目' });
    }

    const id = generateId();
    const timestamp = now();

    // 获取最大排序号
    const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM project_tools WHERE project_id = ?').get(projectId);
    const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

    db.prepare(`
      INSERT INTO project_tools (id, project_id, tool_id, sort_order, is_required, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, toolId, sortOrder, isRequired ? 1 : 0, timestamp);

    res.json({ code: 200, data: { id }, message: '关联成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量关联采集工具到项目
router.post('/projects/:projectId/tools/batch', (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolIds } = req.body;

    if (!toolIds || !Array.isArray(toolIds) || toolIds.length === 0) {
      return res.status(400).json({ code: 400, message: '工具ID列表不能为空' });
    }

    // 检查项目是否存在
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const timestamp = now();
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO project_tools (id, project_id, tool_id, sort_order, is_required, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    const transaction = db.transaction(() => {
      // 获取当前最大排序号
      const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM project_tools WHERE project_id = ?').get(projectId);
      let sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

      toolIds.forEach(toolId => {
        const id = generateId();
        insertStmt.run(id, projectId, toolId, sortOrder++, timestamp);
      });
    });

    transaction();

    res.json({ code: 200, message: '批量关联成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 移除项目与工具的关联
router.delete('/projects/:projectId/tools/:toolId', (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const result = db.prepare('DELETE FROM project_tools WHERE project_id = ? AND tool_id = ?').run(projectId, toolId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '关联关系不存在' });
    }

    res.json({ code: 200, message: '移除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新关联属性（是否必填）
router.put('/projects/:projectId/tools/:toolId', (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    const { isRequired } = req.body;

    const result = db.prepare(`
      UPDATE project_tools SET is_required = ? WHERE project_id = ? AND tool_id = ?
    `).run(isRequired ? 1 : 0, projectId, toolId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '关联关系不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 调整工具排序
router.put('/projects/:projectId/tools/order', (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolIds } = req.body;

    if (!toolIds || !Array.isArray(toolIds)) {
      return res.status(400).json({ code: 400, message: '工具ID列表格式错误' });
    }

    const updateStmt = db.prepare(`
      UPDATE project_tools SET sort_order = ? WHERE project_id = ? AND tool_id = ?
    `);

    const transaction = db.transaction(() => {
      toolIds.forEach((toolId, index) => {
        updateStmt.run(index, projectId, toolId);
      });
    });

    transaction();

    res.json({ code: 200, message: '排序更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目可用的采集工具（未关联的已发布工具）
router.get('/projects/:projectId/available-tools', (req, res) => {
  try {
    const { projectId } = req.params;

    const tools = db.prepare(`
      SELECT id, name, type, target, description, status,
             created_by as createdBy, created_at as createdAt
      FROM data_tools
      WHERE status = 'published'
        AND id NOT IN (SELECT tool_id FROM project_tools WHERE project_id = ?)
      ORDER BY created_at DESC
    `).all(projectId);

    res.json({ code: 200, data: tools });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
