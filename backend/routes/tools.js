const express = require('express');
const router = express.Router();
const { toolRules, elementLibraryRules, elementRules, idParamRules } = require('../middleware/validate');
const { validateEnum } = require('../constants/enums');
const { deleteDataTool, deleteElementLibrary } = require('../services/cascadeService');

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 采集工具 CRUD ====================

// 获取采集工具列表
router.get('/tools', async (req, res) => {
  try {
    const { status, type } = req.query;
    let sql = `
      SELECT id, name, type, target, description, status,
             created_by as "createdBy", created_at as "createdAt",
             updated_by as "updatedBy", updated_at as "updatedAt"
      FROM data_tools WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个工具（含schema）
router.get('/tools/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, type, target, description, schema, status,
             created_by as "createdBy", created_at as "createdAt",
             updated_by as "updatedBy", updated_at as "updatedAt"
      FROM data_tools WHERE id = $1
    `, [req.params.id]);

    const tool = result.rows[0];

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
router.post('/tools', async (req, res) => {
  try {
    const { name, type, target, description } = req.body;

    // 程序层面枚举验证
    try {
      validateEnum('DATA_TOOL_TYPE', type, 'type');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    const id = generateId();
    const timestamp = now();

    await db.query(`
      INSERT INTO data_tools (id, name, type, target, description, status, created_by, created_at, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'draft', 'admin', $6, 'admin', $7)
    `, [id, name, type, target, description, timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新采集工具基础信息
router.put('/tools/:id', async (req, res) => {
  try {
    const { name, type, target, description, status } = req.body;

    // 程序层面枚举验证
    try {
      if (type) validateEnum('DATA_TOOL_TYPE', type, 'type');
      if (status) validateEnum('DATA_TOOL_STATUS', status, 'status');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    const timestamp = now();

    const result = await db.query(`
      UPDATE data_tools SET name = $1, type = $2, target = $3, description = $4, status = $5, updated_by = 'admin', updated_at = $6
      WHERE id = $7
    `, [name, type, target, description, status || 'editing', timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存表单schema
router.put('/tools/:id/schema', async (req, res) => {
  try {
    const { schema } = req.body;
    const timestamp = now();

    const result = await db.query(`
      UPDATE data_tools SET schema = $1, status = 'editing', updated_by = 'admin', updated_at = $2 WHERE id = $3
    `, [JSON.stringify(schema), timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 发布工具
router.post('/tools/:id/publish', async (req, res) => {
  try {
    const timestamp = now();
    const result = await db.query(`
      UPDATE data_tools SET status = 'published', updated_by = 'admin', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '发布成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 取消发布
router.post('/tools/:id/unpublish', async (req, res) => {
  try {
    const timestamp = now();
    const result = await db.query(`
      UPDATE data_tools SET status = 'editing', updated_by = 'admin', updated_at = $1 WHERE id = $2
    `, [timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '取消发布成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除工具（使用级联删除服务）
router.delete('/tools/:id', async (req, res) => {
  try {
    const result = await deleteDataTool(req.params.id);

    if (!result.deleted.data_tools) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '删除成功', data: result.deleted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 要素库 CRUD ====================

// 获取要素库列表
router.get('/element-libraries', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, element_count as "elementCount", status,
             created_by as "createdBy", created_at as "createdAt",
             updated_by as "updatedBy", updated_at as "updatedAt"
      FROM element_libraries ORDER BY created_at DESC
    `);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个要素库及其要素
router.get('/element-libraries/:id', async (req, res) => {
  try {
    const libraryResult = await db.query(`
      SELECT id, name, description, element_count as "elementCount", status,
             created_by as "createdBy", created_at as "createdAt",
             updated_by as "updatedBy", updated_at as "updatedAt"
      FROM element_libraries WHERE id = $1
    `, [req.params.id]);

    const library = libraryResult.rows[0];

    if (!library) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    const elementsResult = await db.query(`
      SELECT id, code, name, element_type as "elementType", data_type as "dataType", formula
      FROM elements WHERE library_id = $1 ORDER BY sort_order
    `, [req.params.id]);

    library.elements = elementsResult.rows;
    res.json({ code: 200, data: library });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建要素库
router.post('/element-libraries', async (req, res) => {
  try {
    const { name, description } = req.body;
    const id = generateId();
    const timestamp = now();

    await db.query(`
      INSERT INTO element_libraries (id, name, description, element_count, status, created_by, created_at, updated_by, updated_at)
      VALUES ($1, $2, $3, 0, 'draft', 'admin', $4, 'admin', $5)
    `, [id, name, description, timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新要素库
router.put('/element-libraries/:id', async (req, res) => {
  try {
    const { name, description, status } = req.body;

    // 程序层面枚举验证
    if (status) {
      try {
        validateEnum('ELEMENT_LIBRARY_STATUS', status, 'status');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    const timestamp = now();

    const result = await db.query(`
      UPDATE element_libraries SET name = $1, description = $2, status = $3, updated_by = 'admin', updated_at = $4 WHERE id = $5
    `, [name, description, status, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除要素库（使用级联删除服务）
router.delete('/element-libraries/:id', async (req, res) => {
  try {
    const result = await deleteElementLibrary(req.params.id);

    if (!result.deleted.element_libraries) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    res.json({ code: 200, message: '删除成功', data: result.deleted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加要素
router.post('/element-libraries/:id/elements', async (req, res) => {
  try {
    const { code, name, elementType, dataType, formula } = req.body;
    const id = generateId();
    const libraryId = req.params.id;
    const timestamp = now();

    // 程序层面枚举验证
    try {
      validateEnum('ELEMENT_TYPE', elementType, 'elementType');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    // 验证要素库是否存在（程序层面引用验证）
    const libraryResult = await db.query('SELECT id FROM element_libraries WHERE id = $1', [libraryId]);
    if (!libraryResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    const maxOrderResult = await db.query('SELECT MAX(sort_order) as "maxOrder" FROM elements WHERE library_id = $1', [libraryId]);
    const sortOrder = (maxOrderResult.rows[0]?.maxOrder ?? -1) + 1;

    await db.query(`
      INSERT INTO elements (id, library_id, code, name, element_type, data_type, formula, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, libraryId, code, name, elementType, dataType, formula || null, sortOrder, timestamp, timestamp]);

    await db.query('UPDATE element_libraries SET element_count = element_count + 1, updated_at = $1 WHERE id = $2',
      [timestamp, libraryId]);

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新要素
router.put('/elements/:id', async (req, res) => {
  try {
    const { code, name, elementType, dataType, formula } = req.body;
    const timestamp = now();

    // 程序层面枚举验证
    try {
      validateEnum('ELEMENT_TYPE', elementType, 'elementType');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    const result = await db.query(`
      UPDATE elements SET code = $1, name = $2, element_type = $3, data_type = $4, formula = $5, updated_at = $6 WHERE id = $7
    `, [code, name, elementType, dataType, formula || null, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除要素
router.delete('/elements/:id', async (req, res) => {
  try {
    const elementResult = await db.query('SELECT library_id FROM elements WHERE id = $1', [req.params.id]);
    if (!elementResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    const timestamp = now();

    // 检查要素是否被引用（程序层面引用检查）
    const refResult = await db.query('SELECT COUNT(*) as count FROM data_indicator_elements WHERE element_id = $1', [req.params.id]);
    if (parseInt(refResult.rows[0].count) > 0) {
      return res.status(400).json({ code: 400, message: '该要素已被数据指标引用，无法删除' });
    }

    await db.query('DELETE FROM elements WHERE id = $1', [req.params.id]);
    await db.query('UPDATE element_libraries SET element_count = element_count - 1, updated_at = $1 WHERE id = $2',
      [timestamp, elementResult.rows[0].library_id]);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 字段映射 CRUD ====================

// 获取工具的字段映射
router.get('/tools/:id/field-mappings', async (req, res) => {
  try {
    const toolId = req.params.id;

    // 检查工具是否存在（程序层面引用验证）
    const toolResult = await db.query('SELECT id FROM data_tools WHERE id = $1', [toolId]);
    if (!toolResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const mappingsResult = await db.query(`
      SELECT
        fm.id,
        fm.tool_id as "toolId",
        fm.field_id as "fieldId",
        fm.mapping_type as "mappingType",
        fm.target_id as "targetId",
        fm.created_at as "createdAt",
        fm.updated_at as "updatedAt"
      FROM field_mappings fm
      WHERE fm.tool_id = $1
    `, [toolId]);

    const mappings = mappingsResult.rows;

    // 为每个映射获取目标信息
    for (const mapping of mappings) {
      if (mapping.mappingType === 'data_indicator') {
        const indicatorResult = await db.query(`
          SELECT di.code, di.name, di.threshold, di.description,
                 i.name as "indicatorName", i.code as "indicatorCode"
          FROM data_indicators di
          LEFT JOIN indicators i ON di.indicator_id = i.id
          WHERE di.id = $1
        `, [mapping.targetId]);
        mapping.targetInfo = indicatorResult.rows[0] || null;
      } else if (mapping.mappingType === 'element') {
        const elementResult = await db.query(`
          SELECT code, name, element_type as "elementType", data_type as "dataType", formula
          FROM elements WHERE id = $1
        `, [mapping.targetId]);
        mapping.targetInfo = elementResult.rows[0] || null;
      }
    }

    res.json({ code: 200, data: mappings });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存工具的字段映射（全量更新）
router.put('/tools/:id/field-mappings', async (req, res) => {
  try {
    const toolId = req.params.id;
    const { mappings } = req.body;

    // 检查工具是否存在（程序层面引用验证）
    const toolResult = await db.query('SELECT id FROM data_tools WHERE id = $1', [toolId]);
    if (!toolResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const timestamp = now();

    await db.transaction(async (client) => {
      // 删除旧的映射
      await client.query('DELETE FROM field_mappings WHERE tool_id = $1', [toolId]);

      // 插入新的映射
      if (mappings && Array.isArray(mappings) && mappings.length > 0) {
        for (const mapping of mappings) {
          const id = generateId();
          await client.query(`
            INSERT INTO field_mappings (id, tool_id, field_id, mapping_type, target_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [id, toolId, mapping.fieldId, mapping.mappingType, mapping.targetId, timestamp, timestamp]);
        }
      }
    });

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加单个字段映射
router.post('/tools/:id/field-mappings', async (req, res) => {
  try {
    const toolId = req.params.id;
    const { fieldId, mappingType, targetId } = req.body;

    if (!fieldId || !mappingType || !targetId) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }

    // 程序层面枚举验证
    try {
      validateEnum('FIELD_MAPPING_TYPE', mappingType, 'mappingType');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    // 检查是否已存在映射
    const existingResult = await db.query('SELECT id FROM field_mappings WHERE tool_id = $1 AND field_id = $2', [toolId, fieldId]);
    const existing = existingResult.rows[0];

    const id = generateId();
    const timestamp = now();

    if (existing) {
      // 更新现有映射
      await db.query(`
        UPDATE field_mappings SET mapping_type = $1, target_id = $2, updated_at = $3 WHERE tool_id = $4 AND field_id = $5
      `, [mappingType, targetId, timestamp, toolId, fieldId]);
    } else {
      // 创建新映射
      await db.query(`
        INSERT INTO field_mappings (id, tool_id, field_id, mapping_type, target_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, toolId, fieldId, mappingType, targetId, timestamp, timestamp]);
    }

    res.json({ code: 200, data: { id: existing?.id || id }, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除单个字段映射
router.delete('/tools/:toolId/field-mappings/:fieldId', async (req, res) => {
  try {
    const { toolId, fieldId } = req.params;

    const result = await db.query('DELETE FROM field_mappings WHERE tool_id = $1 AND field_id = $2', [toolId, fieldId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '映射不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取完整的表单schema（含字段映射信息）
router.get('/tools/:id/full-schema', async (req, res) => {
  try {
    const toolId = req.params.id;

    const toolResult = await db.query(`
      SELECT id, name, type, target, description, schema, status
      FROM data_tools WHERE id = $1
    `, [toolId]);

    const tool = toolResult.rows[0];

    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const schema = tool.schema ? JSON.parse(tool.schema) : [];

    // 获取字段映射
    const mappingsResult = await db.query(`
      SELECT field_id as "fieldId", mapping_type as "mappingType", target_id as "targetId"
      FROM field_mappings WHERE tool_id = $1
    `, [toolId]);

    const mappings = mappingsResult.rows;

    // 为每个映射获取目标详情
    const mappingMap = {};
    for (const mapping of mappings) {
      if (mapping.mappingType === 'data_indicator') {
        const indicatorResult = await db.query(`
          SELECT di.id, di.code, di.name, di.threshold, di.description,
                 i.name as "indicatorName", i.code as "indicatorCode"
          FROM data_indicators di
          LEFT JOIN indicators i ON di.indicator_id = i.id
          WHERE di.id = $1
        `, [mapping.targetId]);
        mappingMap[mapping.fieldId] = {
          mappingType: mapping.mappingType,
          targetId: mapping.targetId,
          targetInfo: indicatorResult.rows[0]
        };
      } else if (mapping.mappingType === 'element') {
        const elementResult = await db.query(`
          SELECT id, code, name, element_type as "elementType", data_type as "dataType", formula
          FROM elements WHERE id = $1
        `, [mapping.targetId]);
        mappingMap[mapping.fieldId] = {
          mappingType: mapping.mappingType,
          targetId: mapping.targetId,
          targetInfo: elementResult.rows[0]
        };
      }
    }

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
router.get('/data-indicators', async (req, res) => {
  try {
    const { systemId, indicatorId, keyword } = req.query;

    let sql = `
      SELECT
        di.id,
        di.indicator_id as "indicatorId",
        di.code,
        di.name,
        di.threshold,
        di.description,
        di.data_source as "dataSource",
        i.name as "indicatorName",
        i.code as "indicatorCode",
        i.level as "indicatorLevel",
        i.system_id as "systemId",
        s.name as "systemName"
      FROM data_indicators di
      LEFT JOIN indicators i ON di.indicator_id = i.id
      LEFT JOIN indicator_systems s ON i.system_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (systemId) {
      sql += ` AND i.system_id = $${paramIndex++}`;
      params.push(systemId);
    }
    if (indicatorId) {
      sql += ` AND di.indicator_id = $${paramIndex++}`;
      params.push(indicatorId);
    }
    if (keyword) {
      sql += ` AND (di.name LIKE $${paramIndex++} OR di.code LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY di.code';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个数据指标详情
router.get('/data-indicators/:id', async (req, res) => {
  try {
    const indicatorResult = await db.query(`
      SELECT
        di.id,
        di.indicator_id as "indicatorId",
        di.code,
        di.name,
        di.threshold,
        di.description,
        di.data_source as "dataSource",
        i.name as "indicatorName",
        i.code as "indicatorCode",
        i.level as "indicatorLevel",
        i.system_id as "systemId",
        s.name as "systemName"
      FROM data_indicators di
      LEFT JOIN indicators i ON di.indicator_id = i.id
      LEFT JOIN indicator_systems s ON i.system_id = s.id
      WHERE di.id = $1
    `, [req.params.id]);

    const indicator = indicatorResult.rows[0];

    if (!indicator) {
      return res.status(404).json({ code: 404, message: '数据指标不存在' });
    }

    // 获取关联的佐证资料配置
    const materialsResult = await db.query(`
      SELECT id, code, name, file_types as "fileTypes", max_size as "maxSize", description, required
      FROM supporting_materials WHERE indicator_id = $1
    `, [indicator.indicatorId]);

    indicator.supportingMaterials = materialsResult.rows;

    res.json({ code: 200, data: indicator });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 要素查询 ====================

// 获取所有要素列表
router.get('/elements', async (req, res) => {
  try {
    const { libraryId, elementType, keyword } = req.query;

    let sql = `
      SELECT
        e.id,
        e.library_id as "libraryId",
        e.code,
        e.name,
        e.element_type as "elementType",
        e.data_type as "dataType",
        e.formula,
        el.name as "libraryName"
      FROM elements e
      LEFT JOIN element_libraries el ON e.library_id = el.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (libraryId) {
      sql += ` AND e.library_id = $${paramIndex++}`;
      params.push(libraryId);
    }
    if (elementType) {
      sql += ` AND e.element_type = $${paramIndex++}`;
      params.push(elementType);
    }
    if (keyword) {
      sql += ` AND (e.name LIKE $${paramIndex++} OR e.code LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY e.library_id, e.sort_order';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
