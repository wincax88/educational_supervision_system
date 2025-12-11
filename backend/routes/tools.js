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

// ==================== 字段映射 CRUD ====================

// 获取工具的字段映射
router.get('/tools/:id/field-mappings', (req, res) => {
  try {
    const toolId = req.params.id;

    // 检查工具是否存在
    const tool = db.prepare('SELECT id FROM data_tools WHERE id = ?').get(toolId);
    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const mappings = db.prepare(`
      SELECT
        fm.id,
        fm.tool_id as toolId,
        fm.field_id as fieldId,
        fm.mapping_type as mappingType,
        fm.target_id as targetId,
        fm.created_at as createdAt,
        fm.updated_at as updatedAt
      FROM field_mappings fm
      WHERE fm.tool_id = ?
    `).all(toolId);

    // 为每个映射获取目标信息
    mappings.forEach(mapping => {
      if (mapping.mappingType === 'data_indicator') {
        const indicator = db.prepare(`
          SELECT di.code, di.name, di.threshold, di.description,
                 i.name as indicatorName, i.code as indicatorCode
          FROM data_indicators di
          LEFT JOIN indicators i ON di.indicator_id = i.id
          WHERE di.id = ?
        `).get(mapping.targetId);
        mapping.targetInfo = indicator || null;
      } else if (mapping.mappingType === 'element') {
        const element = db.prepare(`
          SELECT code, name, element_type as elementType, data_type as dataType, formula
          FROM elements WHERE id = ?
        `).get(mapping.targetId);
        mapping.targetInfo = element || null;
      }
    });

    res.json({ code: 200, data: mappings });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存工具的字段映射（全量更新）
router.put('/tools/:id/field-mappings', (req, res) => {
  try {
    const toolId = req.params.id;
    const { mappings } = req.body;

    // 检查工具是否存在
    const tool = db.prepare('SELECT id FROM data_tools WHERE id = ?').get(toolId);
    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const timestamp = now();

    const transaction = db.transaction(() => {
      // 删除旧的映射
      db.prepare('DELETE FROM field_mappings WHERE tool_id = ?').run(toolId);

      // 插入新的映射
      if (mappings && Array.isArray(mappings) && mappings.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO field_mappings (id, tool_id, field_id, mapping_type, target_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        mappings.forEach(mapping => {
          const id = generateId();
          insertStmt.run(id, toolId, mapping.fieldId, mapping.mappingType, mapping.targetId, timestamp, timestamp);
        });
      }
    });

    transaction();

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加单个字段映射
router.post('/tools/:id/field-mappings', (req, res) => {
  try {
    const toolId = req.params.id;
    const { fieldId, mappingType, targetId } = req.body;

    if (!fieldId || !mappingType || !targetId) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }

    // 检查是否已存在映射
    const existing = db.prepare('SELECT id FROM field_mappings WHERE tool_id = ? AND field_id = ?').get(toolId, fieldId);

    const id = generateId();
    const timestamp = now();

    if (existing) {
      // 更新现有映射
      db.prepare(`
        UPDATE field_mappings SET mapping_type = ?, target_id = ?, updated_at = ? WHERE tool_id = ? AND field_id = ?
      `).run(mappingType, targetId, timestamp, toolId, fieldId);
    } else {
      // 创建新映射
      db.prepare(`
        INSERT INTO field_mappings (id, tool_id, field_id, mapping_type, target_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, toolId, fieldId, mappingType, targetId, timestamp, timestamp);
    }

    res.json({ code: 200, data: { id: existing?.id || id }, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除单个字段映射
router.delete('/tools/:toolId/field-mappings/:fieldId', (req, res) => {
  try {
    const { toolId, fieldId } = req.params;

    const result = db.prepare('DELETE FROM field_mappings WHERE tool_id = ? AND field_id = ?').run(toolId, fieldId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '映射不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取完整的表单schema（含字段映射信息）
router.get('/tools/:id/full-schema', (req, res) => {
  try {
    const toolId = req.params.id;

    const tool = db.prepare(`
      SELECT id, name, type, target, description, schema, status
      FROM data_tools WHERE id = ?
    `).get(toolId);

    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const schema = tool.schema ? JSON.parse(tool.schema) : [];

    // 获取字段映射
    const mappings = db.prepare(`
      SELECT field_id as fieldId, mapping_type as mappingType, target_id as targetId
      FROM field_mappings WHERE tool_id = ?
    `).all(toolId);

    // 为每个映射获取目标详情
    const mappingMap = {};
    mappings.forEach(mapping => {
      if (mapping.mappingType === 'data_indicator') {
        const indicator = db.prepare(`
          SELECT di.id, di.code, di.name, di.threshold, di.description,
                 i.name as indicatorName, i.code as indicatorCode
          FROM data_indicators di
          LEFT JOIN indicators i ON di.indicator_id = i.id
          WHERE di.id = ?
        `).get(mapping.targetId);
        mappingMap[mapping.fieldId] = {
          mappingType: mapping.mappingType,
          targetId: mapping.targetId,
          targetInfo: indicator
        };
      } else if (mapping.mappingType === 'element') {
        const element = db.prepare(`
          SELECT id, code, name, element_type as elementType, data_type as dataType, formula
          FROM elements WHERE id = ?
        `).get(mapping.targetId);
        mappingMap[mapping.fieldId] = {
          mappingType: mapping.mappingType,
          targetId: mapping.targetId,
          targetInfo: element
        };
      }
    });

    // 将映射信息合并到schema中
    const enrichedSchema = schema.map(field => ({
      ...field,
      mapping: mappingMap[field.id] || null
    }));

    res.json({
      code: 200,
      data: {
        ...tool,
        schema: enrichedSchema,
        mappings: mappings
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 数据指标查询 ====================

// 获取所有数据指标列表
router.get('/data-indicators', (req, res) => {
  try {
    const { systemId, indicatorId, keyword } = req.query;

    let sql = `
      SELECT
        di.id,
        di.indicator_id as indicatorId,
        di.code,
        di.name,
        di.threshold,
        di.description,
        di.data_source as dataSource,
        i.name as indicatorName,
        i.code as indicatorCode,
        i.level as indicatorLevel,
        i.system_id as systemId,
        s.name as systemName
      FROM data_indicators di
      LEFT JOIN indicators i ON di.indicator_id = i.id
      LEFT JOIN indicator_systems s ON i.system_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (systemId) {
      sql += ' AND i.system_id = ?';
      params.push(systemId);
    }
    if (indicatorId) {
      sql += ' AND di.indicator_id = ?';
      params.push(indicatorId);
    }
    if (keyword) {
      sql += ' AND (di.name LIKE ? OR di.code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY di.code';

    const indicators = db.prepare(sql).all(...params);
    res.json({ code: 200, data: indicators });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个数据指标详情
router.get('/data-indicators/:id', (req, res) => {
  try {
    const indicator = db.prepare(`
      SELECT
        di.id,
        di.indicator_id as indicatorId,
        di.code,
        di.name,
        di.threshold,
        di.description,
        di.data_source as dataSource,
        i.name as indicatorName,
        i.code as indicatorCode,
        i.level as indicatorLevel,
        i.system_id as systemId,
        s.name as systemName
      FROM data_indicators di
      LEFT JOIN indicators i ON di.indicator_id = i.id
      LEFT JOIN indicator_systems s ON i.system_id = s.id
      WHERE di.id = ?
    `).get(req.params.id);

    if (!indicator) {
      return res.status(404).json({ code: 404, message: '数据指标不存在' });
    }

    // 获取关联的佐证资料配置
    const materials = db.prepare(`
      SELECT id, code, name, file_types as fileTypes, max_size as maxSize, description, required
      FROM supporting_materials WHERE indicator_id = ?
    `).all(indicator.indicatorId);

    indicator.supportingMaterials = materials;

    res.json({ code: 200, data: indicator });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 要素查询 ====================

// 获取所有要素列表
router.get('/elements', (req, res) => {
  try {
    const { libraryId, elementType, keyword } = req.query;

    let sql = `
      SELECT
        e.id,
        e.library_id as libraryId,
        e.code,
        e.name,
        e.element_type as elementType,
        e.data_type as dataType,
        e.formula,
        el.name as libraryName
      FROM elements e
      LEFT JOIN element_libraries el ON e.library_id = el.id
      WHERE 1=1
    `;
    const params = [];

    if (libraryId) {
      sql += ' AND e.library_id = ?';
      params.push(libraryId);
    }
    if (elementType) {
      sql += ' AND e.element_type = ?';
      params.push(elementType);
    }
    if (keyword) {
      sql += ' AND (e.name LIKE ? OR e.code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY e.library_id, e.sort_order';

    const elements = db.prepare(sql).all(...params);
    res.json({ code: 200, data: elements });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
