/**
 * 项目要素库路由
 * 管理项目级要素库副本的 CRUD 操作
 */

const express = require('express');
const router = express.Router();
const { verifyToken, roles, checkProjectPermission } = require('../dist/middleware/auth');
const { copyElementLibraryToProject, deleteProjectElementLibrary } = require('../services/projectCopyService');

// 数据库连接
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 获取当前时间
const now = () => new Date().toISOString();

// ==================== 项目要素库 API ====================

/**
 * 从模板复制要素库到项目
 * POST /projects/:projectId/element-library/copy
 */
router.post('/projects/:projectId/element-library/copy', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { elementLibraryId } = req.body;

    if (!elementLibraryId) {
      return res.status(400).json({ code: 400, message: '请指定要复制的要素库模板' });
    }

    const result = await copyElementLibraryToProject(projectId, elementLibraryId);
    res.json({ code: 200, message: '复制成功', data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目要素库
 * GET /projects/:projectId/element-library
 */
router.get('/projects/:projectId/element-library', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!db) {
      return res.status(500).json({ code: 500, message: '数据库未初始化' });
    }

    const { data, error } = await db.from('project_element_libraries')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json({ code: 200, data: null, message: '项目暂无要素库' });
    }

    res.json({ code: 200, data });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新项目要素库基本信息
 * PUT /projects/:projectId/element-library
 */
router.put('/projects/:projectId/element-library', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

    const { data: existing, error: findErr } = await db.from('project_element_libraries')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ code: 404, message: '项目要素库不存在' });
    }

    const updates = { updated_at: now() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { error: updateErr } = await db.from('project_element_libraries')
      .update(updates)
      .eq('id', existing.id);

    if (updateErr) throw updateErr;

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除项目要素库
 * DELETE /projects/:projectId/element-library
 */
router.delete('/projects/:projectId/element-library', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    await deleteProjectElementLibrary(projectId);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 项目要素 API ====================

/**
 * 获取项目要素列表
 * GET /projects/:projectId/elements
 */
router.get('/projects/:projectId/elements', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { elementType, keyword } = req.query;

    let query = db.from('project_elements')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (elementType) {
      query = query.eq('element_type', elementType);
    }

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];

    // 关键词搜索
    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.filter(e =>
        (e.code && e.code.toLowerCase().includes(kw)) ||
        (e.name && e.name.toLowerCase().includes(kw))
      );
    }

    // 格式化响应
    const formatted = result.map(e => ({
      id: e.id,
      libraryId: e.library_id,
      code: e.code,
      name: e.name,
      elementType: e.element_type,
      dataType: e.data_type,
      toolId: e.tool_id,
      fieldId: e.field_id,
      fieldLabel: e.field_label,
      formula: e.formula,
      collectionLevel: e.collection_level,
      calculationLevel: e.calculation_level,
      dataSource: e.data_source,
      aggregation: e.aggregation ? (typeof e.aggregation === 'string' ? JSON.parse(e.aggregation) : e.aggregation) : null,
      sortOrder: e.sort_order
    }));

    res.json({ code: 200, data: formatted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 添加要素
 * POST /projects/:projectId/elements
 */
router.post('/projects/:projectId/elements', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      code, name, elementType, dataType, toolId, fieldId, fieldLabel,
      formula, collectionLevel, calculationLevel, dataSource, aggregation
    } = req.body;

    // 获取要素库
    const { data: library, error: libErr } = await db.from('project_element_libraries')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (libErr || !library) {
      return res.status(404).json({ code: 404, message: '项目要素库不存在，请先复制模板' });
    }

    // 获取排序位置
    const { data: maxOrderResult } = await db.from('project_elements')
      .select('sort_order')
      .eq('library_id', library.id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const sortOrder = (maxOrderResult?.[0]?.sort_order ?? -1) + 1;
    const timestamp = now();
    const id = generateId();

    await db.from('project_elements').insert({
      id,
      project_id: projectId,
      library_id: library.id,
      code: code || '',
      name,
      element_type: elementType || '基础要素',
      data_type: dataType || '文本',
      tool_id: toolId || null,
      field_id: fieldId || null,
      field_label: fieldLabel || null,
      formula: formula || null,
      collection_level: collectionLevel || null,
      calculation_level: calculationLevel || null,
      data_source: dataSource || null,
      aggregation: aggregation ? JSON.stringify(aggregation) : null,
      sort_order: sortOrder,
      created_at: timestamp,
      updated_at: timestamp
    });

    // 更新计数
    const { data: countResult } = await db.from('project_elements')
      .select('id')
      .eq('library_id', library.id);
    await db.from('project_element_libraries')
      .update({ element_count: countResult?.length || 0, updated_at: timestamp })
      .eq('id', library.id);

    res.json({ code: 200, message: '添加成功', data: { id } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新要素
 * PUT /projects/:projectId/elements/:elementId
 */
router.put('/projects/:projectId/elements/:elementId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, elementId } = req.params;
    const {
      code, name, elementType, dataType, toolId, fieldId, fieldLabel,
      formula, collectionLevel, calculationLevel, dataSource, aggregation
    } = req.body;

    const updates = { updated_at: now() };
    if (code !== undefined) updates.code = code;
    if (name !== undefined) updates.name = name;
    if (elementType !== undefined) updates.element_type = elementType;
    if (dataType !== undefined) updates.data_type = dataType;
    if (toolId !== undefined) updates.tool_id = toolId;
    if (fieldId !== undefined) updates.field_id = fieldId;
    if (fieldLabel !== undefined) updates.field_label = fieldLabel;
    if (formula !== undefined) updates.formula = formula;
    if (collectionLevel !== undefined) updates.collection_level = collectionLevel;
    if (calculationLevel !== undefined) updates.calculation_level = calculationLevel;
    if (dataSource !== undefined) updates.data_source = dataSource;
    if (aggregation !== undefined) updates.aggregation = JSON.stringify(aggregation);

    const { error } = await db.from('project_elements')
      .update(updates)
      .eq('id', elementId)
      .eq('project_id', projectId);

    if (error) throw error;

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除要素
 * DELETE /projects/:projectId/elements/:elementId
 */
router.delete('/projects/:projectId/elements/:elementId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, elementId } = req.params;

    // 检查是否被引用
    const { data: diRefs } = await db.from('project_data_indicator_elements')
      .select('id')
      .eq('project_id', projectId)
      .eq('element_id', elementId);

    const { data: smRefs } = await db.from('project_supporting_material_elements')
      .select('id')
      .eq('project_id', projectId)
      .eq('element_id', elementId);

    const refCount = (diRefs?.length || 0) + (smRefs?.length || 0);
    if (refCount > 0) {
      return res.status(400).json({
        code: 400,
        message: `该要素被 ${refCount} 处引用，请先解除关联后再删除`
      });
    }

    // 获取库ID用于更新计数
    const { data: element } = await db.from('project_elements')
      .select('library_id')
      .eq('id', elementId)
      .single();

    // 删除
    await db.from('project_elements')
      .delete()
      .eq('id', elementId)
      .eq('project_id', projectId);

    // 更新计数
    if (element?.library_id) {
      const { data: remaining } = await db.from('project_elements')
        .select('id')
        .eq('library_id', element.library_id);
      await db.from('project_element_libraries')
        .update({ element_count: remaining?.length || 0, updated_at: now() })
        .eq('id', element.library_id);
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 批量导入要素
 * POST /projects/:projectId/elements/import
 */
router.post('/projects/:projectId/elements/import', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { elements, mode = 'append' } = req.body;

    if (!Array.isArray(elements)) {
      return res.status(400).json({ code: 400, message: 'elements 必须是数组' });
    }

    // 获取要素库
    const { data: library, error: libErr } = await db.from('project_element_libraries')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (libErr || !library) {
      return res.status(404).json({ code: 404, message: '项目要素库不存在' });
    }

    const timestamp = now();

    // 替换模式：先删除所有
    if (mode === 'replace') {
      await db.from('project_data_indicator_elements').delete().eq('project_id', projectId);
      await db.from('project_supporting_material_elements').delete().eq('project_id', projectId);
      await db.from('project_elements').delete().eq('library_id', library.id);
    }

    // 获取当前最大排序
    let sortOrder = 0;
    if (mode === 'append') {
      const { data: maxOrderResult } = await db.from('project_elements')
        .select('sort_order')
        .eq('library_id', library.id)
        .order('sort_order', { ascending: false })
        .limit(1);
      sortOrder = (maxOrderResult?.[0]?.sort_order ?? -1) + 1;
    }

    // 插入
    let inserted = 0;
    for (const elem of elements) {
      await db.from('project_elements').insert({
        id: generateId(),
        project_id: projectId,
        library_id: library.id,
        code: elem.code || '',
        name: elem.name,
        element_type: elem.elementType || elem.element_type || '基础要素',
        data_type: elem.dataType || elem.data_type || '文本',
        tool_id: elem.toolId || elem.tool_id || null,
        field_id: elem.fieldId || elem.field_id || null,
        field_label: elem.fieldLabel || elem.field_label || null,
        formula: elem.formula || null,
        collection_level: elem.collectionLevel || elem.collection_level || null,
        calculation_level: elem.calculationLevel || elem.calculation_level || null,
        data_source: elem.dataSource || elem.data_source || null,
        aggregation: elem.aggregation ? JSON.stringify(elem.aggregation) : null,
        sort_order: sortOrder++,
        created_at: timestamp,
        updated_at: timestamp
      });
      inserted++;
    }

    // 更新计数
    const { data: countResult } = await db.from('project_elements')
      .select('id')
      .eq('library_id', library.id);
    await db.from('project_element_libraries')
      .update({ element_count: countResult?.length || 0, updated_at: timestamp })
      .eq('id', library.id);

    res.json({ code: 200, message: '导入成功', data: { inserted } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
module.exports.setDb = setDb;
