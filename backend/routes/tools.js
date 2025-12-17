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

// 将导入/前端传入的哨兵字符串("null"/"undefined"/空串)规范为真正的 NULL，避免前端误判为已关联
const normalizeNullableText = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return v;
};

const normalizeNullableOrUndefined = (value) => {
  if (value === undefined) return undefined;
  return normalizeNullableText(value);
};

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

    // 使用 Supabase Data API，避免 exec_sql 仅支持 SELECT 的限制
    const { data, error } = await db
      .from('data_tools')
      .insert({
        id,
        name,
        type,
        target,
        description,
        status: 'draft',
        created_by: 'admin',
        created_at: timestamp,
        updated_by: 'admin',
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;

    // data 为空一般不会发生，但保持稳健
    const createdId = data?.[0]?.id || id;
    return res.json({ code: 200, data: { id: createdId }, message: '创建成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
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

    // 使用 Supabase Data API，避免 exec_sql 仅支持 SELECT 的限制
    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(target !== undefined ? { target } : {}),
      ...(description !== undefined ? { description } : {}),
      status: status || 'editing',
      updated_by: 'admin',
      updated_at: timestamp,
    };

    const { data, error } = await db
      .from('data_tools')
      .update(updates)
      .eq('id', req.params.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存表单schema
router.put('/tools/:id/schema', async (req, res) => {
  try {
    const { schema } = req.body;
    const timestamp = now();

    // 使用 Supabase 原生 API 避免 SQL 参数替换问题
    const { data, error } = await db.from('data_tools')
      .update({
        schema: JSON.stringify(schema),
        status: 'editing',
        updated_by: 'admin',
        updated_at: timestamp
      })
      .eq('id', req.params.id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取工具的schema（兼容前端调用：GET /tools/:id/schema）
router.get('/tools/:id/schema', async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT schema
      FROM data_tools
      WHERE id = $1
    `,
      [req.params.id]
    );

    const tool = result.rows[0];
    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const schema = tool.schema ? JSON.parse(tool.schema) : [];
    return res.json({ code: 200, data: { schema } });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 发布工具
router.post('/tools/:id/publish', async (req, res) => {
  try {
    const timestamp = now();
    const { data, error } = await db
      .from('data_tools')
      .update({
        status: 'published',
        updated_by: 'admin',
        updated_at: timestamp,
      })
      .eq('id', req.params.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    return res.json({ code: 200, message: '发布成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 取消发布
router.post('/tools/:id/unpublish', async (req, res) => {
  try {
    const timestamp = now();
    const { data, error } = await db
      .from('data_tools')
      .update({
        status: 'editing',
        updated_by: 'admin',
        updated_at: timestamp,
      })
      .eq('id', req.params.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    return res.json({ code: 200, message: '取消发布成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除工具（使用级联删除服务）
router.delete('/tools/:id', async (req, res) => {
  try {
    const toolId = req.params.id;

    // 先确认工具是否存在，避免无意义的级联删除
    const { data: tool, error: toolErr } = await db
      .from('data_tools')
      .select('id')
      .eq('id', toolId)
      .maybeSingle();

    if (toolErr) throw toolErr;
    if (!tool) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    // 使用 Supabase Data API 执行删除，绕开 exec_sql 仅支持 SELECT 的限制
    const deleted = {};

    const { data: fieldMappings, error: fmErr } = await db
      .from('field_mappings')
      .delete()
      .eq('tool_id', toolId)
      .select('id');
    if (fmErr) throw fmErr;
    deleted.field_mappings = fieldMappings?.length || 0;

    const { data: projectTools, error: ptErr } = await db
      .from('project_tools')
      .delete()
      .eq('tool_id', toolId)
      .select('id');
    if (ptErr) throw ptErr;
    deleted.project_tools = projectTools?.length || 0;

    const { data: tools, error: toolDelErr } = await db
      .from('data_tools')
      .delete()
      .eq('id', toolId)
      .select('id');
    if (toolDelErr) throw toolDelErr;
    deleted.data_tools = tools?.length || 0;

    return res.json({ code: 200, message: '删除成功', data: deleted });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
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

    let elementsResult;
    try {
      // 新版本：elements 表含 tool_id/field_id/field_label，直接回显
      elementsResult = await db.query(
        `
        SELECT
          id, code, name,
          element_type as "elementType",
          data_type as "dataType",
          tool_id as "toolId",
          field_id as "fieldId",
          field_label as "fieldLabel",
          formula
        FROM elements WHERE library_id = $1 ORDER BY sort_order
      `,
        [req.params.id]
      );
      library.elements = elementsResult.rows || [];
    } catch (e) {
      // 兼容旧库：elements 表还没有上述列时，回退到旧查询 + field_mappings 补充
      const baseElementsResult = await db.query(
        `
        SELECT id, code, name, element_type as "elementType", data_type as "dataType", formula
        FROM elements WHERE library_id = $1 ORDER BY sort_order
      `,
        [req.params.id]
      );

      const elements = baseElementsResult.rows || [];
      const elementIds = elements.map(el => el.id);
      let mappingRows = [];
      if (elementIds.length > 0) {
        try {
          const mappingsResult = await db.query(
            `
            SELECT tool_id as "toolId", field_id as "fieldId", field_label as "fieldLabel", target_id as "targetId"
            FROM field_mappings
            WHERE mapping_type = 'element'
              AND target_id = ANY($1)
            `,
            [elementIds]
          );
          mappingRows = mappingsResult.rows || [];
        } catch (e) {
          const mappingsResult = await db.query(
            `
            SELECT tool_id as "toolId", field_id as "fieldId", target_id as "targetId"
            FROM field_mappings
            WHERE mapping_type = 'element'
              AND target_id = ANY($1)
            `,
            [elementIds]
          );
          mappingRows = mappingsResult.rows || [];
        }
      }

      const mappingByTarget = {};
      for (const m of mappingRows) {
        if (!mappingByTarget[m.targetId]) {
          mappingByTarget[m.targetId] = { toolId: m.toolId, fieldId: m.fieldId, fieldLabel: m.fieldLabel };
        }
      }

      library.elements = elements.map(el => ({
        ...el,
        ...(mappingByTarget[el.id] || {}),
      }));
    }
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

    const { data, error } = await db
      .from('element_libraries')
      .insert({
        id,
        name,
        description,
        element_count: 0,
        status: 'draft',
        created_by: 'admin',
        created_at: timestamp,
        updated_by: 'admin',
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;
    return res.json({ code: 200, data: { id: data?.[0]?.id || id }, message: '创建成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新要素库
router.put('/element-libraries/:id', async (req, res) => {
  try {
    const { name, description, status, elements } = req.body;

    // 程序层面枚举验证
    if (status) {
      try {
        validateEnum('ELEMENT_LIBRARY_STATUS', status, 'status');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    const timestamp = now();

    // elements 全量覆盖（可选）：先做参数校验与删除可行性检查，避免中途更新导致状态不一致
    if (elements !== undefined) {
      if (!Array.isArray(elements)) {
        return res.status(400).json({ code: 400, message: 'elements 必须为数组' });
      }

      // 确认要素库存在
      const { data: lib, error: libErr } = await db
        .from('element_libraries')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (libErr) throw libErr;
      if (!lib) {
        return res.status(404).json({ code: 404, message: '要素库不存在' });
      }

      // 查出当前库下要素ID
      const { data: existingElements, error: exErr } = await db
        .from('elements')
        .select('id')
        .eq('library_id', req.params.id);
      if (exErr) throw exErr;
      const existingIds = new Set((existingElements || []).map(e => e.id));

      // 计算需要删除的要素（差集）
      const incomingIds = new Set(
        (elements || []).map(e => e && typeof e === 'object' ? e.id : undefined).filter(Boolean)
      );
      const toDeleteIds = Array.from(existingIds).filter(id => !incomingIds.has(id));

      // 若要删除的要素被数据指标引用，则拒绝覆盖删除（避免破坏引用关系）
      if (toDeleteIds.length > 0) {
        const { count: refCount, error: refErr } = await db
          .from('data_indicator_elements')
          .select('id', { count: 'exact', head: true })
          .in('element_id', toDeleteIds);
        if (refErr) throw refErr;
        if ((refCount || 0) > 0) {
          return res.status(400).json({
            code: 400,
            message: `全量覆盖失败：有 ${refCount} 个要素已被数据指标引用，无法删除`
          });
        }
      }

      // 先更新要素库基础信息（若传入）
      const libUpdates = {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        updated_by: 'admin',
        updated_at: timestamp,
      };

      const { data: libUpd, error: libUpdErr } = await db
        .from('element_libraries')
        .update(libUpdates)
        .eq('id', req.params.id)
        .select('id');
      if (libUpdErr) throw libUpdErr;
      if (!libUpd || libUpd.length === 0) {
        return res.status(404).json({ code: 404, message: '要素库不存在' });
      }

      // 删除差集要素 + 清理 field_mappings/compliance_rules
      if (toDeleteIds.length > 0) {
        // SET NULL：compliance_rules.element_id
        const { error: setNullErr } = await db
          .from('compliance_rules')
          .update({ element_id: null, updated_at: timestamp })
          .in('element_id', toDeleteIds);
        if (setNullErr) throw setNullErr;

        // 清理 field_mappings
        const { error: fmErr } = await db
          .from('field_mappings')
          .delete()
          .eq('mapping_type', 'element')
          .in('target_id', toDeleteIds);
        if (fmErr) throw fmErr;

        // 删除 elements
        const { error: delErr } = await db
          .from('elements')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      // 全量写入（按顺序设置 sort_order）
      const processedElements = [];
      for (let index = 0; index < elements.length; index++) {
        const el = elements[index] || {};
        const elId = el.id || generateId();

        // 基本字段校验
        if (!el.code || !el.name || !el.elementType || !el.dataType) {
          return res.status(400).json({ code: 400, message: `elements[${index}] 参数不完整` });
        }
        try {
          validateEnum('ELEMENT_TYPE', el.elementType, `elements[${index}].elementType`);
        } catch (e) {
          return res.status(400).json({ code: 400, message: e.message });
        }

        const baseRecord = {
          code: el.code,
          name: el.name,
          element_type: el.elementType,
          data_type: el.dataType,
          formula: el.elementType === '派生要素' ? (el.formula || null) : null,
          sort_order: index,
          updated_at: timestamp,
        };

        // 新库字段：tool/field/label（旧库无列时回退）
        const extendedRecord = {
          ...baseRecord,
          tool_id: el.elementType === '基础要素' ? normalizeNullableText(el.toolId) : null,
          field_id: el.elementType === '基础要素' ? normalizeNullableText(el.fieldId) : null,
          field_label: el.elementType === '基础要素' ? normalizeNullableText(el.fieldLabel) : null,
        };

        processedElements.push({
          id: elId,
          elementType: el.elementType,
          toolId: el.toolId,
          fieldId: el.fieldId,
          fieldLabel: el.fieldLabel,
        });

        if (existingIds.has(elId)) {
          // update
          try {
            const { error } = await db
              .from('elements')
              .update(extendedRecord)
              .eq('id', elId);
            if (error) throw error;
          } catch (e) {
            const { error } = await db
              .from('elements')
              .update(baseRecord)
              .eq('id', elId);
            if (error) throw error;
          }
        } else {
          // insert
          try {
            const { error } = await db
              .from('elements')
              .insert({
                id: elId,
                library_id: req.params.id,
                created_at: timestamp,
                ...extendedRecord,
              });
            if (error) throw error;
          } catch (e) {
            const { error } = await db
              .from('elements')
              .insert({
                id: elId,
                library_id: req.params.id,
                created_at: timestamp,
                ...baseRecord,
              });
            if (error) throw error;
          }
          existingIds.add(elId);
        }
      }

      // 兼容旧库：同步维护 field_mappings（mapping_type='element'），用于 GET 回显 toolId/fieldId/fieldLabel
      // 先清理本次最终列表对应的旧映射（target_id 维度）
      const finalIds = processedElements.map(p => p.id);
      if (finalIds.length > 0) {
        const { error: delMapErr } = await db
          .from('field_mappings')
          .delete()
          .eq('mapping_type', 'element')
          .in('target_id', finalIds);
        if (delMapErr) throw delMapErr;
      }

      const mappingRecords = processedElements
        .filter(p => p.elementType === '基础要素' && p.toolId && p.fieldId)
        .map(p => ({
          id: generateId(),
          tool_id: p.toolId,
          field_id: p.fieldId,
          field_label: p.fieldLabel || null,
          mapping_type: 'element',
          target_id: p.id,
          created_at: timestamp,
          updated_at: timestamp,
        }));

      if (mappingRecords.length > 0) {
        // 如果 field_label 列不存在，回退只插入必要字段（tool_id/field_id/mapping_type/target_id）
        try {
          const { error: insMapErr } = await db.from('field_mappings').insert(mappingRecords);
          if (insMapErr) throw insMapErr;
        } catch (e) {
          const fallbackRecords = mappingRecords.map(r => ({
            id: r.id,
            tool_id: r.tool_id,
            field_id: r.field_id,
            mapping_type: r.mapping_type,
            target_id: r.target_id,
            created_at: r.created_at,
            updated_at: r.updated_at,
          }));
          const { error: insMapErr } = await db.from('field_mappings').insert(fallbackRecords);
          if (insMapErr) throw insMapErr;
        }
      }

      // 重置 element_count
      const { error: updCountErr } = await db
        .from('element_libraries')
        .update({ element_count: elements.length, updated_at: timestamp })
        .eq('id', req.params.id);
      if (updCountErr) throw updCountErr;

      return res.json({ code: 200, message: '更新成功' });
    }

    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(status !== undefined ? { status } : {}),
      updated_by: 'admin',
      updated_at: timestamp,
    };

    const { data, error } = await db
      .from('element_libraries')
      .update(updates)
      .eq('id', req.params.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除要素库（使用级联删除服务）
router.delete('/element-libraries/:id', async (req, res) => {
  try {
    const libraryId = req.params.id;
    const timestamp = now();

    // 先确认要素库是否存在
    const { data: library, error: libErr } = await db
      .from('element_libraries')
      .select('id')
      .eq('id', libraryId)
      .maybeSingle();
    if (libErr) throw libErr;
    if (!library) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    // 查出该库下所有要素
    const { data: elements, error: elErr } = await db
      .from('elements')
      .select('id')
      .eq('library_id', libraryId);
    if (elErr) throw elErr;
    const elementIds = (elements || []).map(e => e.id);

    // SET NULL：compliance_rules.element_id
    if (elementIds.length > 0) {
      const { error: setNullErr } = await db
        .from('compliance_rules')
        .update({ element_id: null, updated_at: timestamp })
        .in('element_id', elementIds);
      if (setNullErr) throw setNullErr;

      // 删除 data_indicator_elements 引用
      const { error: dieErr } = await db
        .from('data_indicator_elements')
        .delete()
        .in('element_id', elementIds);
      if (dieErr) throw dieErr;

      // 删除 field_mappings 中指向要素的映射，避免孤儿数据
      const { error: fmErr } = await db
        .from('field_mappings')
        .delete()
        .eq('mapping_type', 'element')
        .in('target_id', elementIds);
      if (fmErr) throw fmErr;

      // 删除 elements
      const { data: deletedElements, error: delElErr } = await db
        .from('elements')
        .delete()
        .in('id', elementIds)
        .select('id');
      if (delElErr) throw delElErr;
    }

    // 删除 element_libraries
    const { data: deletedLibraries, error: delLibErr } = await db
      .from('element_libraries')
      .delete()
      .eq('id', libraryId)
      .select('id');
    if (delLibErr) throw delLibErr;

    return res.json({
      code: 200,
      message: '删除成功',
      data: {
        element_libraries: deletedLibraries?.length || 0,
        elements: elementIds.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加要素
router.post('/element-libraries/:id/elements', async (req, res) => {
  try {
    const { code, name, elementType, dataType, formula, toolId, fieldId, fieldLabel } = req.body;
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

    // 新库支持 tool_id/field_id/field_label；旧库没有这些列时，回退插入基础字段
    try {
      const { data: inserted, error: insErr } = await db
        .from('elements')
        .insert({
          id,
          library_id: libraryId,
          code,
          name,
          element_type: elementType,
          data_type: dataType,
          tool_id: normalizeNullableText(toolId),
          field_id: normalizeNullableText(fieldId),
          field_label: normalizeNullableText(fieldLabel),
          formula: formula || null,
          sort_order: sortOrder,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select('id');
      if (insErr) throw insErr;
    } catch (e) {
      const { error: insErr } = await db
        .from('elements')
        .insert({
          id,
          library_id: libraryId,
          code,
          name,
          element_type: elementType,
          data_type: dataType,
          formula: formula || null,
          sort_order: sortOrder,
          created_at: timestamp,
          updated_at: timestamp,
        });
      if (insErr) throw insErr;
    }

    // 重新计算 element_count（避免无法原子自增）
    const { count, error: countErr } = await db
      .from('elements')
      .select('id', { count: 'exact', head: true })
      .eq('library_id', libraryId);
    if (countErr) throw countErr;

    const { error: updCountErr } = await db
      .from('element_libraries')
      .update({ element_count: count || 0, updated_at: timestamp })
      .eq('id', libraryId);
    if (updCountErr) throw updCountErr;

    return res.json({ code: 200, data: { id: inserted?.[0]?.id || id }, message: '添加成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量导入要素
router.post('/element-libraries/:id/elements/import', async (req, res) => {
  try {
    const { elements, mode = 'append' } = req.body; // mode: 'append' | 'replace'
    const libraryId = req.params.id;
    const timestamp = now();

    if (!Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ code: 400, message: '要素列表不能为空' });
    }

    // 验证要素库是否存在
    const libraryResult = await db.query('SELECT id FROM element_libraries WHERE id = $1', [libraryId]);
    if (!libraryResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '要素库不存在' });
    }

    // 如果是替换模式，先删除现有要素
    if (mode === 'replace') {
      const { error: delErr } = await db
        .from('elements')
        .delete()
        .eq('library_id', libraryId);
      if (delErr) throw delErr;
    }

    // 获取当前最大排序号
    const maxOrderResult = await db.query('SELECT MAX(sort_order) as "maxOrder" FROM elements WHERE library_id = $1', [libraryId]);
    let sortOrder = mode === 'replace' ? 0 : (maxOrderResult.rows[0]?.maxOrder ?? -1) + 1;

    // 批量插入要素
    const insertedIds = [];
    const errors = [];

    for (const element of elements) {
      try {
        // 验证必填字段
        if (!element.code || !element.name || !element.elementType || !element.dataType) {
          errors.push({ code: element.code, error: '缺少必填字段' });
          continue;
        }

        // 验证要素类型
        try {
          validateEnum('ELEMENT_TYPE', element.elementType, 'elementType');
        } catch (e) {
          errors.push({ code: element.code, error: e.message });
          continue;
        }

        const id = generateId();

        const { error: insErr } = await db
          .from('elements')
          .insert({
            id,
            library_id: libraryId,
            code: element.code,
            name: element.name,
            element_type: element.elementType,
            data_type: element.dataType,
            tool_id: normalizeNullableText(element.toolId),
            field_id: normalizeNullableText(element.fieldId),
            field_label: normalizeNullableText(element.fieldLabel),
            formula: element.formula || null,
            sort_order: sortOrder++,
            created_at: timestamp,
            updated_at: timestamp,
          });

        if (insErr) {
          errors.push({ code: element.code, error: insErr.message });
        } else {
          insertedIds.push({ id, code: element.code });
        }
      } catch (e) {
        errors.push({ code: element.code, error: e.message });
      }
    }

    // 重新计算 element_count
    const { count, error: countErr } = await db
      .from('elements')
      .select('id', { count: 'exact', head: true })
      .eq('library_id', libraryId);
    if (countErr) throw countErr;

    const { error: updCountErr } = await db
      .from('element_libraries')
      .update({ element_count: count || 0, updated_at: timestamp })
      .eq('id', libraryId);
    if (updCountErr) throw updCountErr;

    return res.json({
      code: 200,
      data: {
        imported: insertedIds.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `成功导入 ${insertedIds.length} 个要素${errors.length > 0 ? `，${errors.length} 个失败` : ''}`,
    });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新要素
router.put('/elements/:id', async (req, res) => {
  try {
    const { code, name, elementType, dataType, formula, toolId, fieldId, fieldLabel } = req.body;
    const timestamp = now();

    // 程序层面枚举验证
    try {
      validateEnum('ELEMENT_TYPE', elementType, 'elementType');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    let data;
    let error;
    // 新库支持 tool_id/field_id/field_label；旧库没有这些列时，回退更新基础字段
    try {
      const result = await db
        .from('elements')
        .update({
          code,
          name,
          element_type: elementType,
          data_type: dataType,
          tool_id: normalizeNullableOrUndefined(toolId),
          field_id: normalizeNullableOrUndefined(fieldId),
          field_label: normalizeNullableOrUndefined(fieldLabel),
          formula: formula || null,
          updated_at: timestamp,
        })
        .eq('id', req.params.id)
        .select('id');
      data = result.data;
      error = result.error;
    } catch (e) {
      const result = await db
        .from('elements')
        .update({
          code,
          name,
          element_type: elementType,
          data_type: dataType,
          formula: formula || null,
          updated_at: timestamp,
        })
        .eq('id', req.params.id)
        .select('id');
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除要素
router.delete('/elements/:id', async (req, res) => {
  try {
    const elementId = req.params.id;
    const { data: element, error: elErr } = await db
      .from('elements')
      .select('id, library_id')
      .eq('id', elementId)
      .maybeSingle();
    if (elErr) throw elErr;
    if (!element) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    const timestamp = now();

    // 检查要素是否被引用（程序层面引用检查）
    const { count: refCount, error: refErr } = await db
      .from('data_indicator_elements')
      .select('id', { count: 'exact', head: true })
      .eq('element_id', elementId);
    if (refErr) throw refErr;
    if ((refCount || 0) > 0) {
      return res.status(400).json({ code: 400, message: '该要素已被数据指标引用，无法删除' });
    }

    // SET NULL：compliance_rules.element_id
    const { error: setNullErr } = await db
      .from('compliance_rules')
      .update({ element_id: null, updated_at: timestamp })
      .eq('element_id', elementId);
    if (setNullErr) throw setNullErr;

    // 删除 elements
    // 先清理字段映射，避免 field_mappings 指向不存在的 element
    const { error: fmErr } = await db
      .from('field_mappings')
      .delete()
      .eq('mapping_type', 'element')
      .eq('target_id', elementId);
    if (fmErr) throw fmErr;

    const { data: deleted, error: delErr } = await db
      .from('elements')
      .delete()
      .eq('id', elementId)
      .select('id');
    if (delErr) throw delErr;
    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    // 重新计算 element_count
    const { count, error: countErr } = await db
      .from('elements')
      .select('id', { count: 'exact', head: true })
      .eq('library_id', element.library_id);
    if (countErr) throw countErr;

    const { error: updCountErr } = await db
      .from('element_libraries')
      .update({ element_count: count || 0, updated_at: timestamp })
      .eq('id', element.library_id);
    if (updCountErr) throw updCountErr;

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
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

    // 删除旧的映射
    const { error: delErr } = await db.from('field_mappings').delete().eq('tool_id', toolId);
    if (delErr) throw delErr;

    // 插入新的映射
    if (mappings && Array.isArray(mappings) && mappings.length > 0) {
      const records = mappings.map(m => ({
        id: generateId(),
        tool_id: toolId,
        field_id: m.fieldId,
        mapping_type: m.mappingType,
        target_id: m.targetId,
        created_at: timestamp,
        updated_at: timestamp,
      }));
      const { error: insErr } = await db.from('field_mappings').insert(records);
      if (insErr) throw insErr;
    }

    return res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
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
    const { data: existing, error: exErr } = await db
      .from('field_mappings')
      .select('id')
      .eq('tool_id', toolId)
      .eq('field_id', fieldId)
      .maybeSingle();
    if (exErr) throw exErr;

    const id = generateId();
    const timestamp = now();

    if (existing?.id) {
      const { data, error } = await db
        .from('field_mappings')
        .update({ mapping_type: mappingType, target_id: targetId, updated_at: timestamp })
        .eq('id', existing.id)
        .select('id');
      if (error) throw error;
      return res.json({ code: 200, data: { id: data?.[0]?.id || existing.id }, message: '保存成功' });
    }

    const { data, error } = await db
      .from('field_mappings')
      .insert({
        id,
        tool_id: toolId,
        field_id: fieldId,
        mapping_type: mappingType,
        target_id: targetId,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');
    if (error) throw error;

    return res.json({ code: 200, data: { id: data?.[0]?.id || id }, message: '保存成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除单个字段映射
router.delete('/tools/:toolId/field-mappings/:fieldId', async (req, res) => {
  try {
    const { toolId, fieldId } = req.params;

    const { data, error } = await db
      .from('field_mappings')
      .delete()
      .eq('tool_id', toolId)
      .eq('field_id', fieldId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '映射不存在' });
    }

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取完整的表单schema（含字段映射信息）
// 优化：使用批量查询替代 N+1 查询
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

    // 按类型分组收集目标 ID
    const indicatorIds = [];
    const elementIds = [];
    mappings.forEach(mapping => {
      if (mapping.mappingType === 'data_indicator') {
        indicatorIds.push(mapping.targetId);
      } else if (mapping.mappingType === 'element') {
        elementIds.push(mapping.targetId);
      }
    });

    // 批量查询数据指标（一次查询所有）
    const indicatorMap = {};
    if (indicatorIds.length > 0) {
      const indicatorResult = await db.query(`
        SELECT di.id, di.code, di.name, di.threshold, di.description,
               i.name as "indicatorName", i.code as "indicatorCode"
        FROM data_indicators di
        LEFT JOIN indicators i ON di.indicator_id = i.id
        WHERE di.id = ANY($1)
      `, [indicatorIds]);
      indicatorResult.rows.forEach(row => {
        indicatorMap[row.id] = row;
      });
    }

    // 批量查询要素（一次查询所有）
    const elementMap = {};
    if (elementIds.length > 0) {
      const elementResult = await db.query(`
        SELECT id, code, name, element_type as "elementType", data_type as "dataType", formula
        FROM elements WHERE id = ANY($1)
      `, [elementIds]);
      elementResult.rows.forEach(row => {
        elementMap[row.id] = row;
      });
    }

    // 构建映射 Map
    const mappingMap = {};
    mappings.forEach(mapping => {
      if (mapping.mappingType === 'data_indicator') {
        mappingMap[mapping.fieldId] = {
          mappingType: mapping.mappingType,
          targetId: mapping.targetId,
          targetInfo: indicatorMap[mapping.targetId]
        };
      } else if (mapping.mappingType === 'element') {
        mappingMap[mapping.fieldId] = {
          mappingType: mapping.mappingType,
          targetId: mapping.targetId,
          targetInfo: elementMap[mapping.targetId]
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
