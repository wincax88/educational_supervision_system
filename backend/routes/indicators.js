const express = require('express');
const router = express.Router();
const { indicatorSystemRules, listQueryRules, idParamRules } = require('../middleware/validate');
const { validateEnum } = require('../constants/enums');
const { deleteIndicatorSystem, deleteIndicator } = require('../services/cascadeService');
const { verifyToken, roles } = require('../src/middleware/auth');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

/**
 * 清空指标体系下的“树数据”（不删除指标体系本身）
 * @param {string} systemId
 * @param {string} timestamp
 */
async function clearIndicatorSystemTree(systemId, timestamp) {
  // 1) 获取该体系下所有指标
  const { data: indicators, error: indErr } = await db
    .from('indicators')
    .select('id')
    .eq('system_id', systemId);
  if (indErr) throw indErr;

  const indicatorIds = (indicators || []).map(i => i.id);
  if (indicatorIds.length === 0) {
    return {
      data_indicator_elements: 0,
      threshold_standards: 0,
      data_indicators: 0,
      supporting_materials: 0,
      indicators: 0,
    };
  }

  // 2) 获取体系下所有数据指标（依附于指标叶子）
  const { data: dataIndicators, error: diErr } = await db
    .from('data_indicators')
    .select('id')
    .in('indicator_id', indicatorIds);
  if (diErr) throw diErr;
  const dataIndicatorIds = (dataIndicators || []).map(d => d.id);

  // 3) 删除 data_indicator_elements / threshold_standards（依赖 dataIndicatorIds）
  if (dataIndicatorIds.length > 0) {
    const { error: dieErr } = await db
      .from('data_indicator_elements')
      .delete()
      .in('data_indicator_id', dataIndicatorIds);
    if (dieErr) throw dieErr;

    const { error: tsErr } = await db
      .from('threshold_standards')
      .delete()
      .in('indicator_id', dataIndicatorIds);
    if (tsErr) throw tsErr;

    const { error: diDelErr } = await db
      .from('data_indicators')
      .delete()
      .in('id', dataIndicatorIds);
    if (diDelErr) throw diDelErr;
  }

  // 4) 删除 supporting_materials（依赖 indicatorIds）
  const { error: smErr } = await db
    .from('supporting_materials')
    .delete()
    .in('indicator_id', indicatorIds);
  if (smErr) throw smErr;

  // 5) 删除 indicators
  const { error: indDelErr } = await db
    .from('indicators')
    .delete()
    .eq('system_id', systemId);
  if (indDelErr) throw indDelErr;

  // 6) 重置指标数量（保持与数据一致）
  const { error: resetErr } = await db
    .from('indicator_systems')
    .update({ indicator_count: 0, updated_at: timestamp })
    .eq('id', systemId);
  if (resetErr) throw resetErr;

  return {
    data_indicator_elements: dataIndicatorIds.length,
    threshold_standards: dataIndicatorIds.length,
    data_indicators: dataIndicatorIds.length,
    supporting_materials: indicatorIds.length,
    indicators: indicatorIds.length,
  };
}

/**
 * 删除整个指标体系（含树数据）
 * @param {string} systemId
 * @param {string} timestamp
 */
async function deleteIndicatorSystemCascade(systemId, timestamp) {
  await clearIndicatorSystemTree(systemId, timestamp);

  const { data, error } = await db
    .from('indicator_systems')
    .delete()
    .eq('id', systemId)
    .select('id');
  if (error) throw error;

  return { indicator_systems: data?.length || 0 };
}

/**
 * 收集某个指标节点的子树（包含自身）
 * @param {string} indicatorId
 * @returns {Promise<string[]>}
 */
async function collectIndicatorSubtreeIds(indicatorId) {
  const ids = [indicatorId];
  const { data: children, error } = await db
    .from('indicators')
    .select('id')
    .eq('parent_id', indicatorId);
  if (error) throw error;

  for (const child of children || []) {
    const childIds = await collectIndicatorSubtreeIds(child.id);
    ids.push(...childIds);
  }
  return ids;
}

// 生成UUID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 指标体系 CRUD ====================

// 获取指标体系列表
router.get('/indicator-systems', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, type, target, tags, description, indicator_count as "indicatorCount",
             attachments, status, created_by as "createdBy", created_at as "createdAt",
             updated_by as "updatedBy", updated_at as "updatedAt"
      FROM indicator_systems
      ORDER BY created_at DESC
    `);

    // 解析JSON字段
    const systems = result.rows.map(sys => ({
      ...sys,
      tags: sys.tags ? JSON.parse(sys.tags) : [],
      attachments: sys.attachments ? JSON.parse(sys.attachments) : []
    }));

    res.json({ code: 200, data: systems });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个指标体系
router.get('/indicator-systems/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, type, target, tags, description, indicator_count as "indicatorCount",
             attachments, status, created_by as "createdBy", created_at as "createdAt",
             updated_by as "updatedBy", updated_at as "updatedAt"
      FROM indicator_systems WHERE id = $1
    `, [req.params.id]);

    const system = result.rows[0];

    if (!system) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    system.tags = system.tags ? JSON.parse(system.tags) : [];
    system.attachments = system.attachments ? JSON.parse(system.attachments) : [];

    res.json({ code: 200, data: system });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建指标体系（仅 admin）
router.post('/indicator-systems', verifyToken, roles.admin, indicatorSystemRules.create, async (req, res) => {
  try {
    const { name, type, target, tags, description, attachments } = req.body;

    // 程序层面枚举验证
    try {
      validateEnum('INDICATOR_SYSTEM_TYPE', type, 'type');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    const id = generateId();
    const timestamp = now();

    const { data, error } = await db
      .from('indicator_systems')
      .insert({
        id,
        name,
        type,
        target,
        tags: JSON.stringify(tags || []),
        description,
        attachments: JSON.stringify(attachments || []),
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

// 更新指标体系（仅 admin）
router.put('/indicator-systems/:id', verifyToken, roles.admin, indicatorSystemRules.update, async (req, res) => {
  try {
    const { name, type, target, tags, description, attachments, status } = req.body;

    // 程序层面枚举验证
    try {
      if (type) validateEnum('INDICATOR_SYSTEM_TYPE', type, 'type');
      if (status) validateEnum('INDICATOR_SYSTEM_STATUS', status, 'status');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    const timestamp = now();

    const { data, error } = await db
      .from('indicator_systems')
      .update({
        name,
        type,
        target,
        tags: JSON.stringify(tags || []),
        description,
        attachments: JSON.stringify(attachments || []),
        status,
        updated_by: 'admin',
        updated_at: timestamp,
      })
      .eq('id', req.params.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除指标体系（使用级联删除服务，仅 admin）
router.delete('/indicator-systems/:id', verifyToken, roles.admin, async (req, res) => {
  try {
    const timestamp = now();
    const deleted = await deleteIndicatorSystemCascade(req.params.id, timestamp);

    if (!deleted.indicator_systems) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    return res.json({ code: 200, message: '删除成功', data: deleted });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 指标树操作 ====================

/**
 * 标准化数据指标的数据类型
 * - 兼容前端使用 dataType（驼峰）或 data_type（下划线）
 * - 缺省时给一个安全默认值，避免 DB NOT NULL 约束报错
 * @param {object} di
 * @returns {string}
 */
function normalizeDataIndicatorDataType(di) {
  const dt = di?.dataType ?? di?.data_type;
  // 当前项目里“数据类型”语义与要素一致，沿用同一套取值
  const allowed = ['文本', '数字', '日期', '时间', '逻辑', '数组', '文件'];
  if (dt && allowed.includes(dt)) return dt;
  // 兜底：大多数数据指标是数值型（阈值比较/比例等）
  return '数字';
}

// 获取指标树
router.get('/indicator-systems/:id/tree', async (req, res) => {
  try {
    const systemId = req.params.id;

    // 获取所有指标
    const indicatorsResult = await db.query(`
      SELECT id, system_id as "systemId", parent_id as "parentId", code, name, description,
             level, is_leaf as "isLeaf", weight, sort_order as "sortOrder"
      FROM indicators WHERE system_id = $1 ORDER BY sort_order
    `, [systemId]);

    // 获取数据指标
    const dataIndicatorsResult = await db.query(`
      SELECT di.id, di.indicator_id as "indicatorId", di.code, di.name,
             di.description, di.data_type as "dataType", di.unit,
             di.threshold, di.calculation_method as "calculationMethod",
             di.data_source as "dataSource", di.collection_frequency as "collectionFrequency",
             di.sort_order as "sortOrder"
      FROM data_indicators di
      JOIN indicators i ON di.indicator_id = i.id
      WHERE i.system_id = $1
      ORDER BY di.sort_order
    `, [systemId]);

    // 获取佐证资料
    const materialsResult = await db.query(`
      SELECT sm.id, sm.indicator_id as "indicatorId", sm.code, sm.name, sm.file_types as "fileTypes",
             sm.max_size as "maxSize", sm.description, sm.required, sm.sort_order as "sortOrder"
      FROM supporting_materials sm
      JOIN indicators i ON sm.indicator_id = i.id
      WHERE i.system_id = $1
      ORDER BY sm.sort_order
    `, [systemId]);

    const indicators = indicatorsResult.rows;
    const dataIndicators = dataIndicatorsResult.rows;
    const materials = materialsResult.rows;

    // 构建指标到数据指标/佐证资料的映射
    const diMap = {};
    dataIndicators.forEach(di => {
      if (!diMap[di.indicatorId]) diMap[di.indicatorId] = [];
      diMap[di.indicatorId].push(di);
    });

    const smMap = {};
    materials.forEach(sm => {
      sm.required = !!sm.required;
      if (!smMap[sm.indicatorId]) smMap[sm.indicatorId] = [];
      smMap[sm.indicatorId].push(sm);
    });

    // 构建树
    const buildTree = (parentId) => {
      return indicators
        .filter(ind => ind.parentId === parentId)
        .map(ind => {
          ind.isLeaf = !!ind.isLeaf;
          const node = { ...ind };
          if (ind.isLeaf) {
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

// 保存整个指标树（仅 admin）
router.put('/indicator-systems/:id/tree', verifyToken, roles.admin, async (req, res) => {
  const systemId = req.params.id;
  const tree = req.body.tree;
  const timestamp = now();

  try {
    if (!Array.isArray(tree)) {
      return res.status(400).json({ code: 400, message: '参数错误：tree 必须是数组' });
    }

    // 1) 清空旧树
    await clearIndicatorSystemTree(systemId, timestamp);

    // 2) 递归插入新树
    let indicatorCount = 0;

    // 检查ID是否已存在的辅助函数
    const ensureUniqueId = async (id, table) => {
      if (!id) return generateId();
      const { data, error } = await db.from(table).select('id').eq('id', id).limit(1);
      if (error) throw error;
      return data && data.length > 0 ? generateId() : id;
    };

    const insertNode = async (node, parentId, sortOrder) => {
      const nodeId = await ensureUniqueId(node.id, 'indicators');
      const { error: indErr } = await db.from('indicators').insert({
        id: nodeId,
        system_id: systemId,
        parent_id: parentId,
        code: node.code,
        name: node.name,
        description: node.description || '',
        level: node.level,
        is_leaf: node.isLeaf ? 1 : 0,
        weight: node.weight || null,
        sort_order: sortOrder,
        created_at: timestamp,
        updated_at: timestamp,
      });
      if (indErr) throw indErr;
      indicatorCount++;

      // 数据指标
      if (node.isLeaf && node.dataIndicators && Array.isArray(node.dataIndicators)) {
        const records = await Promise.all(
          node.dataIndicators.map(async (di, idx) => ({
            id: await ensureUniqueId(di.id, 'data_indicators'),
            indicator_id: nodeId,
            code: di.code,
            name: di.name,
            data_type: normalizeDataIndicatorDataType(di),
            unit: di.unit || '',
            threshold: di.threshold || '',
            description: di.description || '',
            calculation_method: di.calculationMethod || di.calculation_method || '',
            data_source: di.dataSource || di.data_source || '',
            collection_frequency: di.collectionFrequency || di.collection_frequency || '',
            sort_order: idx,
            created_at: timestamp,
            updated_at: timestamp,
          }))
        );
        if (records.length > 0) {
          const { error: diErr } = await db.from('data_indicators').insert(records);
          if (diErr) throw diErr;
        }
      }

      // 佐证资料
      if (node.isLeaf && node.supportingMaterials && Array.isArray(node.supportingMaterials)) {
        const records = await Promise.all(
          node.supportingMaterials.map(async (sm, idx) => ({
            id: await ensureUniqueId(sm.id, 'supporting_materials'),
            indicator_id: nodeId,
            code: sm.code,
            name: sm.name,
            file_types: sm.fileTypes || '',
            max_size: sm.maxSize || '',
            description: sm.description || '',
            required: sm.required ? 1 : 0,
            sort_order: idx,
            created_at: timestamp,
            updated_at: timestamp,
          }))
        );
        if (records.length > 0) {
          const { error: smErr } = await db.from('supporting_materials').insert(records);
          if (smErr) throw smErr;
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (let idx = 0; idx < node.children.length; idx++) {
          await insertNode(node.children[idx], nodeId, idx);
        }
      }
    };

    for (let idx = 0; idx < tree.length; idx++) {
      await insertNode(tree[idx], null, idx);
    }

    // 3) 更新数量
    const { error: updErr } = await db
      .from('indicator_systems')
      .update({ indicator_count: indicatorCount, updated_at: timestamp })
      .eq('id', systemId);
    if (updErr) throw updErr;

    return res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    // 常见的约束错误：尽量给出可读提示，避免前端只看到 500
    const msg = error?.message || '';
    if (msg.includes('data_indicators') && msg.includes('data_type') && msg.includes('not-null')) {
      return res.status(400).json({
        code: 400,
        message: '保存失败：数据指标缺少 dataType（数据类型）。可在前端补填，或由后端默认"数字"后重试。'
      });
    }
    if (msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('indicators_pkey')) {
      return res.status(400).json({
        code: 400,
        message: '保存失败：检测到重复的ID。系统已自动生成新ID，请重试。如果问题持续，请联系管理员。'
      });
    }
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加单个指标节点（仅 admin）
router.post('/indicator-systems/:systemId/indicators', verifyToken, roles.admin, async (req, res) => {
  try {
    const { parentId, code, name, description, level, isLeaf } = req.body;
    const id = generateId();
    const timestamp = now();
    const systemId = req.params.systemId;

    // 程序层面枚举验证
    try {
      validateEnum('INDICATOR_LEVEL', level, 'level');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    // 获取排序位置
    let maxOrderResult;
    if (parentId) {
      maxOrderResult = await db.query(
        'SELECT MAX(sort_order) as "maxOrder" FROM indicators WHERE system_id = $1 AND parent_id = $2',
        [systemId, parentId]
      );
    } else {
      maxOrderResult = await db.query(
        'SELECT MAX(sort_order) as "maxOrder" FROM indicators WHERE system_id = $1 AND parent_id IS NULL',
        [systemId]
      );
    }

    const sortOrder = (maxOrderResult.rows[0]?.maxOrder ?? -1) + 1;

    const { error: insErr } = await db.from('indicators').insert({
      id,
      system_id: systemId,
      parent_id: parentId || null,
      code,
      name,
      description: description || '',
      level,
      is_leaf: isLeaf ? 1 : 0,
      sort_order: sortOrder,
      created_at: timestamp,
      updated_at: timestamp,
    });
    if (insErr) throw insErr;

    // 重新计算数量，避免无法原子自增
    const { count, error: countErr } = await db
      .from('indicators')
      .select('id', { count: 'exact', head: true })
      .eq('system_id', systemId);
    if (countErr) throw countErr;
    const { error: updErr } = await db
      .from('indicator_systems')
      .update({ indicator_count: count || 0, updated_at: timestamp })
      .eq('id', systemId);
    if (updErr) throw updErr;

    return res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新指标节点（仅 admin）
router.put('/indicator-systems/:systemId/indicators/:indicatorId', verifyToken, roles.admin, async (req, res) => {
  try {
    const { code, name, description, isLeaf, weight } = req.body;
    const timestamp = now();

    const { data, error } = await db
      .from('indicators')
      .update({
        code,
        name,
        description: description || '',
        is_leaf: isLeaf ? 1 : 0,
        weight: weight || null,
        updated_at: timestamp,
      })
      .eq('id', req.params.indicatorId)
      .eq('system_id', req.params.systemId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除指标节点（使用级联删除服务，仅 admin）
router.delete('/indicator-systems/:systemId/indicators/:indicatorId', verifyToken, roles.admin, async (req, res) => {
  try {
    const systemId = req.params.systemId;
    const indicatorId = req.params.indicatorId;
    const timestamp = now();

    // 收集子树
    const indicatorIds = await collectIndicatorSubtreeIds(indicatorId);

    // 查出数据指标
    const { data: dataIndicators, error: diErr } = await db
      .from('data_indicators')
      .select('id')
      .in('indicator_id', indicatorIds);
    if (diErr) throw diErr;
    const dataIndicatorIds = (dataIndicators || []).map(d => d.id);

    // 删除 data_indicator_elements / threshold_standards / data_indicators
    if (dataIndicatorIds.length > 0) {
      const { error: dieErr } = await db
        .from('data_indicator_elements')
        .delete()
        .in('data_indicator_id', dataIndicatorIds);
      if (dieErr) throw dieErr;

      const { error: tsErr } = await db
        .from('threshold_standards')
        .delete()
        .in('indicator_id', dataIndicatorIds);
      if (tsErr) throw tsErr;

      const { error: diDelErr } = await db
        .from('data_indicators')
        .delete()
        .in('id', dataIndicatorIds);
      if (diDelErr) throw diDelErr;
    }

    // 删除 supporting_materials
    const { error: smErr } = await db
      .from('supporting_materials')
      .delete()
      .in('indicator_id', indicatorIds);
    if (smErr) throw smErr;

    // 删除 indicators
    const { data: deletedIndicators, error: indDelErr } = await db
      .from('indicators')
      .delete()
      .in('id', indicatorIds)
      .eq('system_id', systemId)
      .select('id');
    if (indDelErr) throw indDelErr;
    if (!deletedIndicators || deletedIndicators.length === 0) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    // 重新计算数量
    const { count, error: countErr } = await db
      .from('indicators')
      .select('id', { count: 'exact', head: true })
      .eq('system_id', systemId);
    if (countErr) throw countErr;
    const { error: updErr } = await db
      .from('indicator_systems')
      .update({ indicator_count: count || 0, updated_at: timestamp })
      .eq('id', systemId);
    if (updErr) throw updErr;

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 数据指标-评估要素关联 ====================

// 获取数据指标的要素关联列表
router.get('/data-indicators/:dataIndicatorId/elements', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        die.id, die.data_indicator_id as "dataIndicatorId", die.element_id as "elementId",
        die.mapping_type as "mappingType", die.description,
        die.created_by as "createdBy", die.created_at as "createdAt",
        e.code as "elementCode", e.name as "elementName", e.element_type as "elementType",
        e.data_type as "dataType", e.formula,
        el.id as "libraryId", el.name as "libraryName"
      FROM data_indicator_elements die
      JOIN elements e ON die.element_id = e.id
      JOIN element_libraries el ON e.library_id = el.id
      WHERE die.data_indicator_id = $1
      ORDER BY die.created_at DESC
    `, [req.params.dataIndicatorId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加数据指标-要素关联（仅 admin）
router.post('/data-indicators/:dataIndicatorId/elements', verifyToken, roles.admin, async (req, res) => {
  try {
    const { elementId, mappingType, description } = req.body;
    const dataIndicatorId = req.params.dataIndicatorId;
    const id = generateId();
    const timestamp = now();

    // 检查数据指标是否存在（程序层面引用验证）
    const indicatorResult = await db.query('SELECT id FROM data_indicators WHERE id = $1', [dataIndicatorId]);
    if (!indicatorResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '数据指标不存在' });
    }

    // 检查要素是否存在（程序层面引用验证）
    const elementResult = await db.query('SELECT id FROM elements WHERE id = $1', [elementId]);
    if (!elementResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    // 检查是否已存在关联
    const existingResult = await db.query(`
      SELECT id FROM data_indicator_elements WHERE data_indicator_id = $1 AND element_id = $2
    `, [dataIndicatorId, elementId]);
    if (existingResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '该关联已存在' });
    }

    const { error } = await db.from('data_indicator_elements').insert({
      id,
      data_indicator_id: dataIndicatorId,
      element_id: elementId,
      mapping_type: mappingType || 'primary',
      description: description || '',
      created_by: 'admin',
      created_at: timestamp,
      updated_at: timestamp,
    });
    if (error) throw error;

    return res.json({ code: 200, data: { id }, message: '关联成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新数据指标-要素关联（仅 admin）
router.put('/data-indicators/:dataIndicatorId/elements/:associationId', verifyToken, roles.admin, async (req, res) => {
  try {
    const { mappingType, description } = req.body;
    const timestamp = now();

    const { data, error } = await db
      .from('data_indicator_elements')
      .update({
        mapping_type: mappingType,
        description: description || '',
        updated_at: timestamp,
      })
      .eq('id', req.params.associationId)
      .eq('data_indicator_id', req.params.dataIndicatorId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除数据指标-要素关联（仅 admin）
router.delete('/data-indicators/:dataIndicatorId/elements/:associationId', verifyToken, roles.admin, async (req, res) => {
  try {
    const { data, error } = await db
      .from('data_indicator_elements')
      .delete()
      .eq('id', req.params.associationId)
      .eq('data_indicator_id', req.params.dataIndicatorId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量保存数据指标-要素关联（仅 admin）
router.put('/data-indicators/:dataIndicatorId/elements', verifyToken, roles.admin, async (req, res) => {
  const dataIndicatorId = req.params.dataIndicatorId;
  const associations = req.body.associations || [];
  const timestamp = now();

  try {
    const { error: delErr } = await db
      .from('data_indicator_elements')
      .delete()
      .eq('data_indicator_id', dataIndicatorId);
    if (delErr) throw delErr;

    if (associations && Array.isArray(associations) && associations.length > 0) {
      const records = associations.map(a => ({
        id: a.id || generateId(),
        data_indicator_id: dataIndicatorId,
        element_id: a.elementId,
        mapping_type: a.mappingType || 'primary',
        description: a.description || '',
        created_by: 'admin',
        created_at: timestamp,
        updated_at: timestamp,
      }));
      const { error: insErr } = await db.from('data_indicator_elements').insert(records);
      if (insErr) throw insErr;
    }

    return res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取指标体系下所有数据指标及其要素关联
router.get('/indicator-systems/:systemId/data-indicator-elements', async (req, res) => {
  try {
    const systemId = req.params.systemId;

    // 获取该指标体系下所有数据指标
    const dataIndicatorsResult = await db.query(`
      SELECT di.id, di.code, di.name, di.threshold, di.description,
             i.id as "indicatorId", i.code as "indicatorCode", i.name as "indicatorName"
      FROM data_indicators di
      JOIN indicators i ON di.indicator_id = i.id
      WHERE i.system_id = $1
      ORDER BY i.sort_order, di.sort_order
    `, [systemId]);

    // 获取所有关联
    const associationsResult = await db.query(`
      SELECT
        die.id, die.data_indicator_id as "dataIndicatorId", die.element_id as "elementId",
        die.mapping_type as "mappingType", die.description,
        e.code as "elementCode", e.name as "elementName", e.element_type as "elementType",
        e.data_type as "dataType", e.formula,
        el.id as "libraryId", el.name as "libraryName"
      FROM data_indicator_elements die
      JOIN elements e ON die.element_id = e.id
      JOIN element_libraries el ON e.library_id = el.id
      JOIN data_indicators di ON die.data_indicator_id = di.id
      JOIN indicators i ON di.indicator_id = i.id
      WHERE i.system_id = $1
    `, [systemId]);

    // 构建映射
    const assocMap = {};
    associationsResult.rows.forEach(a => {
      if (!assocMap[a.dataIndicatorId]) assocMap[a.dataIndicatorId] = [];
      assocMap[a.dataIndicatorId].push(a);
    });

    // 组装结果
    const result = dataIndicatorsResult.rows.map(di => ({
      ...di,
      elements: assocMap[di.id] || []
    }));

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 佐证材料-评估要素关联 ====================

// 获取佐证材料的要素关联列表
router.get('/supporting-materials/:supportingMaterialId/elements', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        sme.id, sme.supporting_material_id as "supportingMaterialId", sme.element_id as "elementId",
        sme.mapping_type as "mappingType", sme.description,
        sme.created_by as "createdBy", sme.created_at as "createdAt",
        e.code as "elementCode", e.name as "elementName", e.element_type as "elementType",
        e.data_type as "dataType", e.formula,
        el.id as "libraryId", el.name as "libraryName"
      FROM supporting_material_elements sme
      JOIN elements e ON sme.element_id = e.id
      JOIN element_libraries el ON e.library_id = el.id
      WHERE sme.supporting_material_id = $1
      ORDER BY sme.created_at DESC
    `, [req.params.supportingMaterialId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加佐证材料-要素关联（仅 admin）
router.post('/supporting-materials/:supportingMaterialId/elements', verifyToken, roles.admin, async (req, res) => {
  try {
    const { elementId, mappingType, description } = req.body;
    const supportingMaterialId = req.params.supportingMaterialId;
    const id = generateId();
    const timestamp = now();

    // 检查佐证材料是否存在
    const materialResult = await db.query('SELECT id FROM supporting_materials WHERE id = $1', [supportingMaterialId]);
    if (!materialResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '佐证材料不存在' });
    }

    // 检查要素是否存在
    const elementResult = await db.query('SELECT id FROM elements WHERE id = $1', [elementId]);
    if (!elementResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    // 检查是否已存在关联
    const existingResult = await db.query(`
      SELECT id FROM supporting_material_elements WHERE supporting_material_id = $1 AND element_id = $2
    `, [supportingMaterialId, elementId]);
    if (existingResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '该关联已存在' });
    }

    const { error } = await db.from('supporting_material_elements').insert({
      id,
      supporting_material_id: supportingMaterialId,
      element_id: elementId,
      mapping_type: mappingType || 'primary',
      description: description || '',
      created_by: 'admin',
      created_at: timestamp,
      updated_at: timestamp,
    });
    if (error) throw error;

    return res.json({ code: 200, data: { id }, message: '关联成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新佐证材料-要素关联（仅 admin）
router.put('/supporting-materials/:supportingMaterialId/elements/:associationId', verifyToken, roles.admin, async (req, res) => {
  try {
    const { mappingType, description } = req.body;
    const timestamp = now();

    const { data, error } = await db
      .from('supporting_material_elements')
      .update({
        mapping_type: mappingType,
        description: description || '',
        updated_at: timestamp,
      })
      .eq('id', req.params.associationId)
      .eq('supporting_material_id', req.params.supportingMaterialId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除佐证材料-要素关联（仅 admin）
router.delete('/supporting-materials/:supportingMaterialId/elements/:associationId', verifyToken, roles.admin, async (req, res) => {
  try {
    const { data, error } = await db
      .from('supporting_material_elements')
      .delete()
      .eq('id', req.params.associationId)
      .eq('supporting_material_id', req.params.supportingMaterialId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量保存佐证材料-要素关联（仅 admin）
router.put('/supporting-materials/:supportingMaterialId/elements', verifyToken, roles.admin, async (req, res) => {
  const supportingMaterialId = req.params.supportingMaterialId;
  const associations = req.body.associations || [];
  const timestamp = now();

  try {
    const { error: delErr } = await db
      .from('supporting_material_elements')
      .delete()
      .eq('supporting_material_id', supportingMaterialId);
    if (delErr) throw delErr;

    if (associations && Array.isArray(associations) && associations.length > 0) {
      const records = associations.map(a => ({
        id: a.id || generateId(),
        supporting_material_id: supportingMaterialId,
        element_id: a.elementId,
        mapping_type: a.mappingType || 'primary',
        description: a.description || '',
        created_by: 'admin',
        created_at: timestamp,
        updated_at: timestamp,
      }));
      const { error: insErr } = await db.from('supporting_material_elements').insert(records);
      if (insErr) throw insErr;
    }

    return res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
