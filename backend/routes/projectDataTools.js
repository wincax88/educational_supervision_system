/**
 * 项目采集工具路由
 * 管理项目级采集工具副本的 CRUD 操作
 */

const express = require('express');
const router = express.Router();
const { verifyToken, roles, checkProjectPermission } = require('../dist/middleware/auth');
const { copyDataToolToProject, deleteProjectDataTools } = require('../services/projectCopyService');

// 数据库连接
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 获取当前时间
const now = () => new Date().toISOString();

// ==================== 项目采集工具 API ====================

/**
 * 从模板复制采集工具到项目
 * POST /projects/:projectId/data-tools/copy
 */
router.post('/projects/:projectId/data-tools/copy', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, toolIds } = req.body;

    // 支持单个或批量复制
    const idsToProcess = toolIds || (toolId ? [toolId] : []);

    if (idsToProcess.length === 0) {
      return res.status(400).json({ code: 400, message: '请指定要复制的采集工具模板' });
    }

    const results = [];
    for (const id of idsToProcess) {
      try {
        const result = await copyDataToolToProject(projectId, id);
        results.push(result);
      } catch (err) {
        results.push({ sourceToolId: id, error: err.message });
      }
    }

    res.json({ code: 200, message: '复制完成', data: results });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目采集工具列表
 * GET /projects/:projectId/data-tools
 */
router.get('/projects/:projectId/data-tools', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, status } = req.query;

    let query = db.from('project_data_tools')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formatted = (data || []).map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      target: t.target,
      description: t.description,
      status: t.status,
      sortOrder: t.sort_order,
      isRequired: !!t.is_required,
      requireReview: !!t.require_review,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }));

    res.json({ code: 200, data: formatted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取单个项目采集工具详情
 * GET /projects/:projectId/data-tools/:toolId
 */
router.get('/projects/:projectId/data-tools/:toolId', verifyToken, async (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const { data, error } = await db.from('project_data_tools')
      .select('*')
      .eq('id', toolId)
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return res.status(404).json({ code: 404, message: '采集工具不存在' });
    }

    const result = {
      id: data.id,
      name: data.name,
      type: data.type,
      target: data.target,
      description: data.description,
      schema: data.schema ? JSON.parse(data.schema) : null,
      status: data.status,
      sortOrder: data.sort_order,
      isRequired: !!data.is_required,
      requireReview: !!data.require_review,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新项目采集工具
 * PUT /projects/:projectId/data-tools/:toolId
 */
router.put('/projects/:projectId/data-tools/:toolId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    const { name, type, target, description, status, isRequired, requireReview, sortOrder } = req.body;

    const updates = { updated_at: now() };
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (target !== undefined) updates.target = target;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (isRequired !== undefined) updates.is_required = isRequired ? 1 : 0;
    if (requireReview !== undefined) updates.require_review = requireReview ? 1 : 0;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;

    const { error } = await db.from('project_data_tools')
      .update(updates)
      .eq('id', toolId)
      .eq('project_id', projectId);

    if (error) throw error;

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除项目采集工具
 * DELETE /projects/:projectId/data-tools/:toolId
 */
router.delete('/projects/:projectId/data-tools/:toolId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    await deleteProjectDataTools(projectId, toolId);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 表单 Schema API ====================

/**
 * 获取采集工具的表单配置
 * GET /projects/:projectId/data-tools/:toolId/schema
 */
router.get('/projects/:projectId/data-tools/:toolId/schema', verifyToken, async (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const { data, error } = await db.from('project_data_tools')
      .select('schema')
      .eq('id', toolId)
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return res.status(404).json({ code: 404, message: '采集工具不存在' });
    }

    res.json({
      code: 200,
      data: data.schema ? JSON.parse(data.schema) : null
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 保存采集工具的表单配置
 * PUT /projects/:projectId/data-tools/:toolId/schema
 */
router.put('/projects/:projectId/data-tools/:toolId/schema', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    const { schema } = req.body;

    const { error } = await db.from('project_data_tools')
      .update({
        schema: JSON.stringify(schema),
        updated_at: now()
      })
      .eq('id', toolId)
      .eq('project_id', projectId);

    if (error) throw error;

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 字段映射 API ====================

/**
 * 获取采集工具的字段映射
 * GET /projects/:projectId/data-tools/:toolId/field-mappings
 */
router.get('/projects/:projectId/data-tools/:toolId/field-mappings', verifyToken, async (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const { data, error } = await db.from('project_field_mappings')
      .select('*')
      .eq('project_id', projectId)
      .eq('tool_id', toolId);

    if (error) throw error;

    const formatted = (data || []).map(m => ({
      id: m.id,
      toolId: m.tool_id,
      fieldId: m.field_id,
      fieldLabel: m.field_label,
      mappingType: m.mapping_type,
      targetId: m.target_id
    }));

    res.json({ code: 200, data: formatted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 保存采集工具的字段映射（全量更新）
 * PUT /projects/:projectId/data-tools/:toolId/field-mappings
 */
router.put('/projects/:projectId/data-tools/:toolId/field-mappings', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    const { mappings } = req.body;

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ code: 400, message: 'mappings 必须是数组' });
    }

    // 删除旧映射
    await db.from('project_field_mappings')
      .delete()
      .eq('project_id', projectId)
      .eq('tool_id', toolId);

    // 插入新映射
    const timestamp = now();
    for (const m of mappings) {
      await db.from('project_field_mappings').insert({
        id: generateId(),
        project_id: projectId,
        tool_id: toolId,
        field_id: m.fieldId,
        field_label: m.fieldLabel || '',
        mapping_type: m.mappingType || 'element',
        target_id: m.targetId || null,
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 添加或更新单个字段映射
 * POST /projects/:projectId/data-tools/:toolId/field-mappings
 */
router.post('/projects/:projectId/data-tools/:toolId/field-mappings', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    const { fieldId, fieldLabel, mappingType, targetId } = req.body;

    if (!fieldId) {
      return res.status(400).json({ code: 400, message: 'fieldId 是必填项' });
    }

    const timestamp = now();

    // 尝试更新现有映射
    const { data: existing } = await db.from('project_field_mappings')
      .select('id')
      .eq('project_id', projectId)
      .eq('tool_id', toolId)
      .eq('field_id', fieldId)
      .single();

    if (existing) {
      await db.from('project_field_mappings')
        .update({
          field_label: fieldLabel || '',
          mapping_type: mappingType || 'element',
          target_id: targetId || null,
          updated_at: timestamp
        })
        .eq('id', existing.id);
    } else {
      await db.from('project_field_mappings').insert({
        id: generateId(),
        project_id: projectId,
        tool_id: toolId,
        field_id: fieldId,
        field_label: fieldLabel || '',
        mapping_type: mappingType || 'element',
        target_id: targetId || null,
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除字段映射
 * DELETE /projects/:projectId/data-tools/:toolId/field-mappings/:fieldId
 */
router.delete('/projects/:projectId/data-tools/:toolId/field-mappings/:fieldId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId, fieldId } = req.params;

    await db.from('project_field_mappings')
      .delete()
      .eq('project_id', projectId)
      .eq('tool_id', toolId)
      .eq('field_id', fieldId);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 工具排序 API ====================

/**
 * 调整工具排序
 * PUT /projects/:projectId/data-tools/order
 */
router.put('/projects/:projectId/data-tools/order', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolIds } = req.body;

    if (!Array.isArray(toolIds)) {
      return res.status(400).json({ code: 400, message: 'toolIds 必须是数组' });
    }

    const timestamp = now();
    for (let i = 0; i < toolIds.length; i++) {
      await db.from('project_data_tools')
        .update({ sort_order: i, updated_at: timestamp })
        .eq('id', toolIds[i])
        .eq('project_id', projectId);
    }

    res.json({ code: 200, message: '排序已更新' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 发布状态 API ====================

/**
 * 发布采集工具
 * POST /projects/:projectId/data-tools/:toolId/publish
 */
router.post('/projects/:projectId/data-tools/:toolId/publish', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const { error } = await db.from('project_data_tools')
      .update({ status: 'published', updated_at: now() })
      .eq('id', toolId)
      .eq('project_id', projectId);

    if (error) throw error;

    res.json({ code: 200, message: '发布成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 取消发布采集工具
 * POST /projects/:projectId/data-tools/:toolId/unpublish
 */
router.post('/projects/:projectId/data-tools/:toolId/unpublish', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const { error } = await db.from('project_data_tools')
      .update({ status: 'editing', updated_at: now() })
      .eq('id', toolId)
      .eq('project_id', projectId);

    if (error) throw error;

    res.json({ code: 200, message: '已取消发布' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
module.exports.setDb = setDb;
