const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 采集工具 CRUD ====================

// 获取采集工具列表
router.get('/tools', (req, res) => {
  try {
    const { status, type } = req.query;
    let sql = `
      SELECT id, name, type, target, description, status,
             created_by as createdBy, created_at as createdAt,
             updated_by as updatedBy, updated_at as updatedAt
      FROM data_tools WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';

    const tools = db.prepare(sql).all(...params);
    res.json({ code: 200, data: tools });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个工具（含schema）
router.get('/tools/:id', (req, res) => {
  try {
    const tool = db.prepare(`
      SELECT id, name, type, target, description, schema, status,
             created_by as createdBy, created_at as createdAt,
             updated_by as updatedBy, updated_at as updatedAt
      FROM data_tools WHERE id = ?
    `).get(req.params.id);

    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    tool.schema = tool.schema ? JSON.parse(tool.schema) : [];
    res.json({ code: 200, data: tool });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建采集工具
router.post('/tools', (req, res) => {
  try {
    const { name, type, target, description } = req.body;
    const id = generateId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO data_tools (id, name, type, target, description, status, created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, 'draft', 'admin', ?, 'admin', ?)
    `).run(id, name, type, target, description, timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新采集工具基础信息
router.put('/tools/:id', (req, res) => {
  try {
    const { name, type, target, description, status } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE data_tools SET name = ?, type = ?, target = ?, description = ?, status = ?, updated_by = 'admin', updated_at = ?
      WHERE id = ?
    `).run(name, type, target, description, status || 'editing', timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存表单schema
router.put('/tools/:id/schema', (req, res) => {
  try {
    const { schema } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE data_tools SET schema = ?, status = 'editing', updated_by = 'admin', updated_at = ? WHERE id = ?
    `).run(JSON.stringify(schema), timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 发布工具
router.post('/tools/:id/publish', (req, res) => {
  try {
    const timestamp = now();
    const result = db.prepare(`
      UPDATE data_tools SET status = 'published', updated_by = 'admin', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '发布成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 取消发布
router.post('/tools/:id/unpublish', (req, res) => {
  try {
    const timestamp = now();
    const result = db.prepare(`
      UPDATE data_tools SET status = 'editing', updated_by = 'admin', updated_at = ? WHERE id = ?
    `).run(timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '取消发布成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除工具
router.delete('/tools/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM data_tools WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 要素库 CRUD ====================

// 获取要素库列表
router.get('/element-libraries', (req, res) => {
  try {
    const libraries = db.prepare(`
      SELECT id, name, description, element_count as elementCount, status,
             created_by as createdBy, created_at as createdAt,
             updated_by as updatedBy, updated_at as updatedAt
      FROM element_libraries ORDER BY created_at DESC
    `).all();

    res.json({ code: 200, data: libraries });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个要素库及其要素
router.get('/element-libraries/:id', (req, res) => {
  try {
    const library = db.prepare(`
      SELECT id, name, description, element_count as elementCount, status,
             created_by as createdBy, created_at as createdAt,
             updated_by as updatedBy, updated_at as updatedAt
      FROM element_libraries WHERE id = ?
    `).get(req.params.id);

    if (!library) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    const elements = db.prepare(`
      SELECT id, code, name, element_type as elementType, data_type as dataType, formula
      FROM elements WHERE library_id = ? ORDER BY sort_order
    `).all(req.params.id);

    library.elements = elements;
    res.json({ code: 200, data: library });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建要素库
router.post('/element-libraries', (req, res) => {
  try {
    const { name, description } = req.body;
    const id = generateId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO element_libraries (id, name, description, element_count, status, created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, 0, 'draft', 'admin', ?, 'admin', ?)
    `).run(id, name, description, timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新要素库
router.put('/element-libraries/:id', (req, res) => {
  try {
    const { name, description, status } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE element_libraries SET name = ?, description = ?, status = ?, updated_by = 'admin', updated_at = ? WHERE id = ?
    `).run(name, description, status, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除要素库
router.delete('/element-libraries/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM element_libraries WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加要素
router.post('/element-libraries/:id/elements', (req, res) => {
  try {
    const { code, name, elementType, dataType, formula } = req.body;
    const id = generateId();
    const libraryId = req.params.id;
    const timestamp = now();

    const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM elements WHERE library_id = ?').get(libraryId);
    const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

    db.prepare(`
      INSERT INTO elements (id, library_id, code, name, element_type, data_type, formula, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, libraryId, code, name, elementType, dataType, formula || null, sortOrder, timestamp, timestamp);

    db.prepare('UPDATE element_libraries SET element_count = element_count + 1, updated_at = ? WHERE id = ?')
      .run(timestamp, libraryId);

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新要素
router.put('/elements/:id', (req, res) => {
  try {
    const { code, name, elementType, dataType, formula } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE elements SET code = ?, name = ?, element_type = ?, data_type = ?, formula = ?, updated_at = ? WHERE id = ?
    `).run(code, name, elementType, dataType, formula || null, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除要素
router.delete('/elements/:id', (req, res) => {
  try {
    const element = db.prepare('SELECT library_id FROM elements WHERE id = ?').get(req.params.id);
    if (!element) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    const timestamp = now();
    db.prepare('DELETE FROM elements WHERE id = ?').run(req.params.id);
    db.prepare('UPDATE element_libraries SET element_count = element_count - 1, updated_at = ? WHERE id = ?')
      .run(timestamp, element.library_id);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
