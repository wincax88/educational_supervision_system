/**
 * 项目指标体系路由
 * 管理项目级指标体系副本的 CRUD 操作
 */

const express = require('express');
const router = express.Router();
const { verifyToken, roles, checkProjectPermission } = require('../dist/middleware/auth');
const { copyIndicatorSystemToProject, deleteProjectIndicatorSystem } = require('../services/projectCopyService');

// 数据库连接
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 获取当前时间
const now = () => new Date().toISOString();

/**
 * 规范化数据类型
 */
function normalizeDataType(di) {
  const dt = di.dataType || di.data_type;
  const allowed = ['文本', '数字', '日期', '时间', '逻辑', '数组', '文件'];
  if (dt && allowed.includes(dt)) return dt;
  return '数字';
}

/**
 * 清空项目指标体系的树数据
 */
async function clearProjectIndicatorTree(projectId, systemId, timestamp) {
  // 1) 获取该体系下所有指标
  const { data: indicators, error: indErr } = await db
    .from('project_indicators')
    .select('id')
    .eq('project_id', projectId)
    .eq('system_id', systemId);
  if (indErr) throw indErr;

  const indicatorIds = (indicators || []).map(i => i.id);
  if (indicatorIds.length === 0) {
    return { indicators: 0, dataIndicators: 0, thresholds: 0, materials: 0 };
  }

  // 2) 获取数据指标
  const { data: dataIndicators, error: diErr } = await db
    .from('project_data_indicators')
    .select('id')
    .in('indicator_id', indicatorIds);
  if (diErr) throw diErr;
  const dataIndicatorIds = (dataIndicators || []).map(d => d.id);

  // 3) 删除关联数据
  if (dataIndicatorIds.length > 0) {
    await db.from('project_data_indicator_elements').delete().in('data_indicator_id', dataIndicatorIds);
    await db.from('project_threshold_standards').delete().in('indicator_id', dataIndicatorIds);
    await db.from('project_data_indicators').delete().in('id', dataIndicatorIds);
  }

  // 4) 删除佐证资料及其关联
  const { data: materials } = await db.from('project_supporting_materials')
    .select('id')
    .in('indicator_id', indicatorIds);
  const materialIds = (materials || []).map(m => m.id);
  if (materialIds.length > 0) {
    await db.from('project_supporting_material_elements').delete().in('supporting_material_id', materialIds);
  }
  await db.from('project_supporting_materials').delete().in('indicator_id', indicatorIds);

  // 5) 删除指标
  await db.from('project_indicators').delete().eq('system_id', systemId);

  // 6) 重置计数
  await db.from('project_indicator_systems')
    .update({ indicator_count: 0, updated_at: timestamp })
    .eq('id', systemId);

  return {
    indicators: indicatorIds.length,
    dataIndicators: dataIndicatorIds.length,
    thresholds: dataIndicatorIds.length,
    materials: materialIds.length
  };
}

// ==================== 项目指标体系 API ====================

/**
 * 从模板复制指标体系到项目
 * POST /projects/:projectId/indicator-system/copy
 */
router.post('/projects/:projectId/indicator-system/copy', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { indicatorSystemId } = req.body;

    if (!indicatorSystemId) {
      return res.status(400).json({ code: 400, message: '请指定要复制的指标体系模板' });
    }

    const result = await copyIndicatorSystemToProject(projectId, indicatorSystemId);
    res.json({ code: 200, message: '复制成功', data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目指标体系
 * GET /projects/:projectId/indicator-system
 */
router.get('/projects/:projectId/indicator-system', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await db.from('project_indicator_systems')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json({ code: 200, data: null, message: '项目暂无指标体系' });
    }

    // 解析 JSON 字段
    const result = {
      ...data,
      tags: data.tags ? JSON.parse(data.tags) : [],
      attachments: data.attachments ? JSON.parse(data.attachments) : []
    };

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新项目指标体系基本信息
 * PUT /projects/:projectId/indicator-system
 */
router.put('/projects/:projectId/indicator-system', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, type, target, description, tags, attachments } = req.body;

    const { data: existing, error: findErr } = await db.from('project_indicator_systems')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ code: 404, message: '项目指标体系不存在' });
    }

    const updates = {
      updated_at: now()
    };
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (target !== undefined) updates.target = target;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    if (attachments !== undefined) updates.attachments = JSON.stringify(attachments);

    const { error: updateErr } = await db.from('project_indicator_systems')
      .update(updates)
      .eq('id', existing.id);

    if (updateErr) {
      throw updateErr;
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除项目指标体系
 * DELETE /projects/:projectId/indicator-system
 */
router.delete('/projects/:projectId/indicator-system', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    await deleteProjectIndicatorSystem(projectId);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 项目指标树 API ====================

/**
 * 获取项目指标树
 * GET /projects/:projectId/indicator-system/tree
 */
router.get('/projects/:projectId/indicator-system/tree', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目指标体系
    const { data: system } = await db.from('project_indicator_systems')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!system) {
      return res.json({ code: 200, data: [] });
    }

    // 获取所有指标
    const { data: indicators, error: indErr } = await db.from('project_indicators')
      .select('*')
      .eq('system_id', system.id)
      .order('sort_order', { ascending: true });

    if (indErr) throw indErr;

    if (!indicators || indicators.length === 0) {
      return res.json({ code: 200, data: [] });
    }

    const indicatorIds = indicators.map(i => i.id);

    // 获取数据指标
    const { data: dataIndicators } = await db.from('project_data_indicators')
      .select('*')
      .in('indicator_id', indicatorIds)
      .order('sort_order', { ascending: true });

    // 获取佐证资料
    const { data: materials } = await db.from('project_supporting_materials')
      .select('*')
      .in('indicator_id', indicatorIds)
      .order('sort_order', { ascending: true });

    // 构建映射
    const diMap = {};
    (dataIndicators || []).forEach(di => {
      if (!diMap[di.indicator_id]) diMap[di.indicator_id] = [];
      diMap[di.indicator_id].push({
        id: di.id,
        indicatorId: di.indicator_id,
        code: di.code,
        name: di.name,
        description: di.description,
        dataType: di.data_type,
        unit: di.unit,
        threshold: di.threshold,
        calculationMethod: di.calculation_method,
        dataSource: di.data_source,
        collectionFrequency: di.collection_frequency,
        sortOrder: di.sort_order
      });
    });

    const smMap = {};
    (materials || []).forEach(sm => {
      if (!smMap[sm.indicator_id]) smMap[sm.indicator_id] = [];
      smMap[sm.indicator_id].push({
        id: sm.id,
        indicatorId: sm.indicator_id,
        code: sm.code,
        name: sm.name,
        fileTypes: sm.file_types,
        maxSize: sm.max_size,
        description: sm.description,
        required: !!sm.required,
        sortOrder: sm.sort_order
      });
    });

    // 构建树
    const buildTree = (parentId) => {
      return indicators
        .filter(ind => ind.parent_id === parentId)
        .map(ind => {
          const node = {
            id: ind.id,
            systemId: ind.system_id,
            parentId: ind.parent_id,
            code: ind.code,
            name: ind.name,
            description: ind.description,
            level: ind.level,
            isLeaf: !!ind.is_leaf,
            weight: ind.weight,
            sortOrder: ind.sort_order
          };
          if (node.isLeaf) {
            node.dataIndicators = diMap[ind.id] || [];
            node.supportingMaterials = smMap[ind.id] || [];
          } else {
            node.children = buildTree(ind.id);
          }
          return node;
        });
    };

    const tree = buildTree(null);
    res.json({ code: 200, data: tree });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 保存项目指标树
 * PUT /projects/:projectId/indicator-system/tree
 *
 * 注意：为了避免丢失佐证材料数据，采用以下策略：
 * - 如果前端传递了 supportingMaterials（包括空数组[]），使用前端数据
 * - 如果前端没有传递 supportingMaterials（undefined），保留数据库中已有的佐证材料
 */
router.put('/projects/:projectId/indicator-system/tree', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tree } = req.body;
    const timestamp = now();

    if (!Array.isArray(tree)) {
      return res.status(400).json({ code: 400, message: '参数错误：tree 必须是数组' });
    }

    // 获取项目指标体系
    const { data: system, error: sysErr } = await db.from('project_indicator_systems')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (sysErr || !system) {
      return res.status(404).json({ code: 404, message: '项目指标体系不存在，请先复制模板' });
    }

    // ========== 备份佐证材料（按指标code映射） ==========
    // 获取旧指标
    const { data: oldIndicators } = await db.from('project_indicators')
      .select('id, code')
      .eq('project_id', projectId);

    const oldIndicatorIds = (oldIndicators || []).map(i => i.id);
    const oldIndicatorCodeMap = {}; // id -> code
    (oldIndicators || []).forEach(i => { oldIndicatorCodeMap[i.id] = i.code; });

    // 获取旧佐证材料并按指标code分组
    let oldMaterialsByCode = {}; // indicatorCode -> materials[]
    if (oldIndicatorIds.length > 0) {
      const { data: oldMaterials } = await db.from('project_supporting_materials')
        .select('*')
        .in('indicator_id', oldIndicatorIds);

      (oldMaterials || []).forEach(m => {
        const indicatorCode = oldIndicatorCodeMap[m.indicator_id];
        if (indicatorCode) {
          if (!oldMaterialsByCode[indicatorCode]) {
            oldMaterialsByCode[indicatorCode] = [];
          }
          oldMaterialsByCode[indicatorCode].push(m);
        }
      });
    }

    // 清空旧树（包括佐证材料，稍后会恢复未传递的）
    await clearProjectIndicatorTree(projectId, system.id, timestamp);

    // 递归插入新树
    let indicatorCount = 0;
    let restoredMaterialCount = 0;

    const ensureUniqueId = async (id, table) => {
      if (!id) return generateId();
      const { data, error } = await db.from(table).select('id').eq('id', id).limit(1);
      if (error) throw error;
      return data && data.length > 0 ? generateId() : id;
    };

    const insertNode = async (node, parentId, sortOrder) => {
      const nodeId = await ensureUniqueId(node.id, 'project_indicators');

      await db.from('project_indicators').insert({
        id: nodeId,
        project_id: projectId,
        system_id: system.id,
        parent_id: parentId,
        code: node.code,
        name: node.name,
        description: node.description || '',
        level: node.level,
        is_leaf: node.isLeaf ? 1 : 0,
        weight: node.weight || null,
        sort_order: sortOrder,
        created_at: timestamp,
        updated_at: timestamp
      });
      indicatorCount++;

      // 数据指标
      if (node.isLeaf && node.dataIndicators && Array.isArray(node.dataIndicators)) {
        for (let idx = 0; idx < node.dataIndicators.length; idx++) {
          const di = node.dataIndicators[idx];
          const diId = await ensureUniqueId(di.id, 'project_data_indicators');
          await db.from('project_data_indicators').insert({
            id: diId,
            project_id: projectId,
            indicator_id: nodeId,
            code: di.code,
            name: di.name,
            data_type: normalizeDataType(di),
            unit: di.unit || '',
            threshold: di.threshold || '',
            description: di.description || '',
            calculation_method: di.calculationMethod || di.calculation_method || '',
            data_source: di.dataSource || di.data_source || '',
            collection_frequency: di.collectionFrequency || di.collection_frequency || '',
            sort_order: idx,
            created_at: timestamp,
            updated_at: timestamp
          });
        }
      }

      // 佐证资料处理策略：
      // - 如果前端传了 supportingMaterials（包括空数组），使用前端数据
      // - 如果前端没传（undefined），从备份中恢复
      if (node.isLeaf) {
        const hasSupportingMaterials = node.supportingMaterials !== undefined;

        if (hasSupportingMaterials && Array.isArray(node.supportingMaterials)) {
          // 前端传了数据，使用前端数据
          for (let idx = 0; idx < node.supportingMaterials.length; idx++) {
            const sm = node.supportingMaterials[idx];
            const smId = await ensureUniqueId(sm.id, 'project_supporting_materials');
            // 处理 max_size 字段（可能是字符串如 "20MB" 或数字）
            let maxSize = sm.maxSize || sm.max_size;
            if (typeof maxSize === 'string') {
              const match = maxSize.match(/^(\d+)/);
              maxSize = match ? parseInt(match[1], 10) : null;
            }
            await db.from('project_supporting_materials').insert({
              id: smId,
              project_id: projectId,
              indicator_id: nodeId,
              code: sm.code || '',
              name: sm.name,
              file_types: sm.fileTypes || sm.file_types || '',
              max_size: maxSize || null,
              description: sm.description || '',
              required: sm.required ? 1 : 0,
              sort_order: idx,
              created_at: timestamp,
              updated_at: timestamp
            });
          }
        } else if (!hasSupportingMaterials && oldMaterialsByCode[node.code]) {
          // 前端没传，从备份中恢复
          const backupMaterials = oldMaterialsByCode[node.code];
          for (let idx = 0; idx < backupMaterials.length; idx++) {
            const oldM = backupMaterials[idx];
            const smId = generateId(); // 使用新ID
            await db.from('project_supporting_materials').insert({
              id: smId,
              project_id: projectId,
              indicator_id: nodeId,
              code: oldM.code || '',
              name: oldM.name,
              file_types: oldM.file_types || '',
              max_size: oldM.max_size || null,
              description: oldM.description || '',
              required: oldM.required ? 1 : 0,
              sort_order: idx,
              created_at: timestamp,
              updated_at: timestamp
            });
            restoredMaterialCount++;
          }
        }
      }

      // 子节点
      if (!node.isLeaf && node.children && Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          await insertNode(node.children[i], nodeId, i);
        }
      }
    };

    // 插入树
    for (let i = 0; i < tree.length; i++) {
      await insertNode(tree[i], null, i);
    }

    // 更新计数
    await db.from('project_indicator_systems')
      .update({ indicator_count: indicatorCount, updated_at: timestamp })
      .eq('id', system.id);

    res.json({
      code: 200,
      message: '保存成功',
      data: {
        indicatorCount,
        restoredMaterialCount // 返回恢复的佐证材料数量，便于调试
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 项目指标 CRUD ====================

/**
 * 添加指标
 * POST /projects/:projectId/indicators
 */
router.post('/projects/:projectId/indicators', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { parentId, code, name, description, level, isLeaf, weight } = req.body;

    // 获取指标体系
    const { data: system } = await db.from('project_indicator_systems')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!system) {
      return res.status(404).json({ code: 404, message: '项目指标体系不存在' });
    }

    // 获取排序位置
    const { data: maxOrderResult } = await db.from('project_indicators')
      .select('sort_order')
      .eq('system_id', system.id)
      .eq('parent_id', parentId || null)
      .order('sort_order', { ascending: false })
      .limit(1);

    const sortOrder = (maxOrderResult?.[0]?.sort_order ?? -1) + 1;
    const timestamp = now();
    const id = generateId();

    await db.from('project_indicators').insert({
      id,
      project_id: projectId,
      system_id: system.id,
      parent_id: parentId || null,
      code,
      name,
      description: description || '',
      level: level || 1,
      is_leaf: isLeaf ? 1 : 0,
      weight: weight || null,
      sort_order: sortOrder,
      created_at: timestamp,
      updated_at: timestamp
    });

    // 更新计数
    const { data: countResult } = await db.from('project_indicators')
      .select('id')
      .eq('system_id', system.id);
    await db.from('project_indicator_systems')
      .update({ indicator_count: countResult?.length || 0, updated_at: timestamp })
      .eq('id', system.id);

    res.json({ code: 200, message: '添加成功', data: { id } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新指标
 * PUT /projects/:projectId/indicators/:indicatorId
 */
router.put('/projects/:projectId/indicators/:indicatorId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, indicatorId } = req.params;
    const { code, name, description, isLeaf, weight } = req.body;

    const updates = { updated_at: now() };
    if (code !== undefined) updates.code = code;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isLeaf !== undefined) updates.is_leaf = isLeaf ? 1 : 0;
    if (weight !== undefined) updates.weight = weight;

    const { error } = await db.from('project_indicators')
      .update(updates)
      .eq('id', indicatorId)
      .eq('project_id', projectId);

    if (error) throw error;

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除指标（级联删除子指标和关联数据）
 * DELETE /projects/:projectId/indicators/:indicatorId
 */
router.delete('/projects/:projectId/indicators/:indicatorId', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, indicatorId } = req.params;

    // 收集要删除的指标ID（包括子指标）
    const collectIds = async (parentId) => {
      const ids = [parentId];
      const { data: children } = await db.from('project_indicators')
        .select('id')
        .eq('parent_id', parentId)
        .eq('project_id', projectId);

      if (children) {
        for (const child of children) {
          const childIds = await collectIds(child.id);
          ids.push(...childIds);
        }
      }
      return ids;
    };

    const indicatorIds = await collectIds(indicatorId);

    // 获取数据指标
    const { data: dataIndicators } = await db.from('project_data_indicators')
      .select('id')
      .in('indicator_id', indicatorIds);
    const diIds = (dataIndicators || []).map(d => d.id);

    // 删除关联
    if (diIds.length > 0) {
      await db.from('project_data_indicator_elements').delete().in('data_indicator_id', diIds);
      await db.from('project_threshold_standards').delete().in('indicator_id', diIds);
      await db.from('project_data_indicators').delete().in('id', diIds);
    }

    // 获取佐证资料
    const { data: materials } = await db.from('project_supporting_materials')
      .select('id')
      .in('indicator_id', indicatorIds);
    const smIds = (materials || []).map(m => m.id);

    if (smIds.length > 0) {
      await db.from('project_supporting_material_elements').delete().in('supporting_material_id', smIds);
    }
    await db.from('project_supporting_materials').delete().in('indicator_id', indicatorIds);

    // 删除指标
    await db.from('project_indicators').delete().in('id', indicatorIds);

    // 更新计数
    const { data: system } = await db.from('project_indicator_systems')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (system) {
      const { data: remaining } = await db.from('project_indicators')
        .select('id')
        .eq('system_id', system.id);
      await db.from('project_indicator_systems')
        .update({ indicator_count: remaining?.length || 0, updated_at: now() })
        .eq('id', system.id);
    }

    res.json({ code: 200, message: '删除成功', data: { deletedCount: indicatorIds.length } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 项目数据指标-要素关联 ====================

/**
 * 获取数据指标的要素关联
 * GET /projects/:projectId/data-indicators/:dataIndicatorId/elements
 */
router.get('/projects/:projectId/data-indicators/:dataIndicatorId/elements', verifyToken, async (req, res) => {
  try {
    const { projectId, dataIndicatorId } = req.params;

    const { data, error } = await db.from('project_data_indicator_elements')
      .select(`
        id,
        data_indicator_id,
        element_id,
        mapping_type,
        description,
        created_at
      `)
      .eq('project_id', projectId)
      .eq('data_indicator_id', dataIndicatorId);

    if (error) throw error;

    // 获取要素详情
    const elementIds = (data || []).map(d => d.element_id);
    let elements = [];
    if (elementIds.length > 0) {
      const { data: elementsData } = await db.from('project_elements')
        .select('id, code, name, element_type, data_type')
        .in('id', elementIds);
      elements = elementsData || [];
    }

    const elementsMap = {};
    elements.forEach(e => { elementsMap[e.id] = e; });

    const result = (data || []).map(d => ({
      id: d.id,
      dataIndicatorId: d.data_indicator_id,
      elementId: d.element_id,
      mappingType: d.mapping_type,
      description: d.description,
      element: elementsMap[d.element_id] || null
    }));

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 批量保存数据指标-要素关联
 * PUT /projects/:projectId/data-indicators/:dataIndicatorId/elements
 */
router.put('/projects/:projectId/data-indicators/:dataIndicatorId/elements', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, dataIndicatorId } = req.params;
    const { elements } = req.body;

    if (!Array.isArray(elements)) {
      return res.status(400).json({ code: 400, message: 'elements 必须是数组' });
    }

    // 删除旧关联
    await db.from('project_data_indicator_elements')
      .delete()
      .eq('project_id', projectId)
      .eq('data_indicator_id', dataIndicatorId);

    // 插入新关联
    const timestamp = now();
    for (const elem of elements) {
      await db.from('project_data_indicator_elements').insert({
        id: generateId(),
        project_id: projectId,
        data_indicator_id: dataIndicatorId,
        element_id: elem.elementId,
        mapping_type: elem.mappingType || 'primary',
        description: elem.description || '',
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 批量获取数据指标要素关联 ====================

/**
 * 获取项目下所有数据指标及其要素关联
 * GET /projects/:projectId/indicator-system/data-indicator-elements
 */
router.get('/projects/:projectId/indicator-system/data-indicator-elements', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目指标体系
    const { data: system } = await db.from('project_indicator_systems')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!system) {
      return res.json({ code: 200, data: [] });
    }

    // 获取所有数据指标
    const { data: dataIndicators, error: diErr } = await db.from('project_data_indicators')
      .select('*')
      .eq('project_id', projectId);

    if (diErr) throw diErr;
    if (!dataIndicators || dataIndicators.length === 0) {
      return res.json({ code: 200, data: [] });
    }

    const diIds = dataIndicators.map(d => d.id);

    // 获取所有要素关联
    const { data: associations, error: assocErr } = await db.from('project_data_indicator_elements')
      .select('*')
      .in('data_indicator_id', diIds);

    if (assocErr) throw assocErr;

    // 获取关联的要素详情
    const elementIds = (associations || []).map(a => a.element_id);
    let elements = [];
    if (elementIds.length > 0) {
      const { data: elementsData } = await db.from('project_elements')
        .select('id, code, name, element_type, data_type, formula, library_id');
      elements = elementsData || [];
    }

    // 获取要素库信息
    const { data: library } = await db.from('project_element_libraries')
      .select('id, name')
      .eq('project_id', projectId)
      .single();

    const elementsMap = {};
    elements.forEach(e => {
      elementsMap[e.id] = {
        ...e,
        libraryName: library?.name || '未知要素库'
      };
    });

    // 获取指标信息
    const { data: indicators } = await db.from('project_indicators')
      .select('id, code, name')
      .eq('project_id', projectId);

    const indicatorMap = {};
    (indicators || []).forEach(i => { indicatorMap[i.id] = i; });

    // 构建关联映射
    const assocMap = {};
    (associations || []).forEach(a => {
      if (!assocMap[a.data_indicator_id]) assocMap[a.data_indicator_id] = [];
      const elem = elementsMap[a.element_id];
      assocMap[a.data_indicator_id].push({
        id: a.id,
        dataIndicatorId: a.data_indicator_id,
        elementId: a.element_id,
        mappingType: a.mapping_type,
        description: a.description,
        elementCode: elem?.code || '',
        elementName: elem?.name || '',
        elementType: elem?.element_type || '',
        dataType: elem?.data_type || '',
        formula: elem?.formula || '',
        libraryId: elem?.library_id || '',
        libraryName: elem?.libraryName || ''
      });
    });

    // 构建结果
    const result = dataIndicators.map(di => {
      const indicator = indicatorMap[di.indicator_id] || {};
      return {
        id: di.id,
        code: di.code,
        name: di.name,
        threshold: di.threshold,
        description: di.description,
        indicatorId: di.indicator_id,
        indicatorCode: indicator.code || '',
        indicatorName: indicator.name || '',
        elements: assocMap[di.id] || []
      };
    });

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 项目佐证材料-要素关联 ====================

/**
 * 获取佐证材料的要素关联
 * GET /projects/:projectId/supporting-materials/:materialId/elements
 */
router.get('/projects/:projectId/supporting-materials/:materialId/elements', verifyToken, async (req, res) => {
  try {
    const { projectId, materialId } = req.params;

    const { data, error } = await db.from('project_supporting_material_elements')
      .select('*')
      .eq('project_id', projectId)
      .eq('supporting_material_id', materialId);

    if (error) throw error;

    // 获取要素详情
    const elementIds = (data || []).map(d => d.element_id);
    let elements = [];
    if (elementIds.length > 0) {
      const { data: elementsData } = await db.from('project_elements')
        .select('id, code, name, element_type, data_type, formula, library_id')
        .in('id', elementIds);
      elements = elementsData || [];
    }

    // 获取要素库信息
    const { data: library } = await db.from('project_element_libraries')
      .select('id, name')
      .eq('project_id', projectId)
      .single();

    const elementsMap = {};
    elements.forEach(e => {
      elementsMap[e.id] = {
        ...e,
        libraryName: library?.name || '未知要素库'
      };
    });

    const result = (data || []).map(d => {
      const elem = elementsMap[d.element_id] || {};
      return {
        id: d.id,
        supportingMaterialId: d.supporting_material_id,
        elementId: d.element_id,
        mappingType: d.mapping_type,
        description: d.description,
        elementCode: elem.code || '',
        elementName: elem.name || '',
        elementType: elem.element_type || '',
        dataType: elem.data_type || '',
        libraryId: elem.library_id || '',
        libraryName: elem.libraryName || ''
      };
    });

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 批量保存佐证材料-要素关联
 * PUT /projects/:projectId/supporting-materials/:materialId/elements
 */
router.put('/projects/:projectId/supporting-materials/:materialId/elements', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId, materialId } = req.params;
    const { elements } = req.body;

    if (!Array.isArray(elements)) {
      return res.status(400).json({ code: 400, message: 'elements 必须是数组' });
    }

    // 删除旧关联
    await db.from('project_supporting_material_elements')
      .delete()
      .eq('project_id', projectId)
      .eq('supporting_material_id', materialId);

    // 插入新关联
    const timestamp = now();
    for (const elem of elements) {
      await db.from('project_supporting_material_elements').insert({
        id: generateId(),
        project_id: projectId,
        supporting_material_id: materialId,
        element_id: elem.elementId,
        mapping_type: elem.mappingType || 'primary',
        description: elem.description || '',
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
module.exports.setDb = setDb;
