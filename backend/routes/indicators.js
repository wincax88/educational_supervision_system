const express = require('express');
const router = express.Router();
const { indicatorSystemRules, listQueryRules, idParamRules } = require('../middleware/validate');
const { validateEnum } = require('../constants/enums');
const { deleteIndicatorSystem, deleteIndicator } = require('../services/cascadeService');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

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

// 创建指标体系
router.post('/indicator-systems', indicatorSystemRules.create, async (req, res) => {
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

    await db.query(`
      INSERT INTO indicator_systems
      (id, name, type, target, tags, description, attachments, status, created_by, created_at, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', 'admin', $8, 'admin', $9)
    `, [id, name, type, target, JSON.stringify(tags || []), description, JSON.stringify(attachments || []), timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新指标体系
router.put('/indicator-systems/:id', indicatorSystemRules.update, async (req, res) => {
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

    const result = await db.query(`
      UPDATE indicator_systems
      SET name = $1, type = $2, target = $3, tags = $4, description = $5, attachments = $6, status = $7, updated_by = 'admin', updated_at = $8
      WHERE id = $9
    `, [name, type, target, JSON.stringify(tags || []), description, JSON.stringify(attachments || []), status, timestamp, req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除指标体系（使用级联删除服务）
router.delete('/indicator-systems/:id', async (req, res) => {
  try {
    const result = await deleteIndicatorSystem(req.params.id);

    if (!result.deleted.indicator_systems) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    res.json({ code: 200, message: '删除成功', data: result.deleted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 指标树操作 ====================

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
      SELECT di.id, di.indicator_id as "indicatorId", di.code, di.name, di.threshold, di.description, di.sort_order as "sortOrder"
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

// 保存整个指标树
router.put('/indicator-systems/:id/tree', async (req, res) => {
  const systemId = req.params.id;
  const tree = req.body.tree;
  const timestamp = now();

  try {
    await db.transaction(async (client) => {
      // 1. 删除现有的指标树（级联删除数据指标和佐证资料）
      // 先删除子表数据
      await client.query(`
        DELETE FROM data_indicator_elements WHERE data_indicator_id IN (
          SELECT di.id FROM data_indicators di
          JOIN indicators i ON di.indicator_id = i.id
          WHERE i.system_id = $1
        )
      `, [systemId]);

      await client.query(`
        DELETE FROM threshold_standards WHERE indicator_id IN (
          SELECT di.id FROM data_indicators di
          JOIN indicators i ON di.indicator_id = i.id
          WHERE i.system_id = $1
        )
      `, [systemId]);

      await client.query(`
        DELETE FROM data_indicators WHERE indicator_id IN (
          SELECT id FROM indicators WHERE system_id = $1
        )
      `, [systemId]);

      await client.query(`
        DELETE FROM supporting_materials WHERE indicator_id IN (
          SELECT id FROM indicators WHERE system_id = $1
        )
      `, [systemId]);

      await client.query('DELETE FROM indicators WHERE system_id = $1', [systemId]);

      // 2. 递归插入新的指标树
      let indicatorCount = 0;

      const insertNode = async (node, parentId, sortOrder) => {
        const nodeId = node.id || generateId();
        await client.query(`
          INSERT INTO indicators (id, system_id, parent_id, code, name, description, level, is_leaf, weight, sort_order, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          nodeId, systemId, parentId, node.code, node.name, node.description || '',
          node.level, node.isLeaf ? 1 : 0, node.weight || null, sortOrder, timestamp, timestamp
        ]);
        indicatorCount++;

        // 插入数据指标
        if (node.isLeaf && node.dataIndicators) {
          for (let idx = 0; idx < node.dataIndicators.length; idx++) {
            const di = node.dataIndicators[idx];
            await client.query(`
              INSERT INTO data_indicators (id, indicator_id, code, name, threshold, description, sort_order, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              di.id || generateId(), nodeId, di.code, di.name, di.threshold || '', di.description || '', idx, timestamp, timestamp
            ]);
          }
        }

        // 插入佐证资料
        if (node.isLeaf && node.supportingMaterials) {
          for (let idx = 0; idx < node.supportingMaterials.length; idx++) {
            const sm = node.supportingMaterials[idx];
            await client.query(`
              INSERT INTO supporting_materials (id, indicator_id, code, name, file_types, max_size, description, required, sort_order, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
              sm.id || generateId(), nodeId, sm.code, sm.name, sm.fileTypes || '', sm.maxSize || '', sm.description || '', sm.required ? 1 : 0, idx, timestamp, timestamp
            ]);
          }
        }

        // 递归处理子节点
        if (node.children) {
          for (let idx = 0; idx < node.children.length; idx++) {
            await insertNode(node.children[idx], nodeId, idx);
          }
        }
      };

      for (let idx = 0; idx < tree.length; idx++) {
        await insertNode(tree[idx], null, idx);
      }

      // 3. 更新指标体系的指标数量
      await client.query('UPDATE indicator_systems SET indicator_count = $1, updated_at = $2 WHERE id = $3',
        [indicatorCount, timestamp, systemId]);
    });

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加单个指标节点
router.post('/indicator-systems/:systemId/indicators', async (req, res) => {
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

    await db.query(`
      INSERT INTO indicators (id, system_id, parent_id, code, name, description, level, is_leaf, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [id, systemId, parentId || null, code, name, description || '', level, isLeaf ? 1 : 0, sortOrder, timestamp, timestamp]);

    // 更新指标数量
    await db.query('UPDATE indicator_systems SET indicator_count = indicator_count + 1, updated_at = $1 WHERE id = $2',
      [timestamp, systemId]);

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新指标节点
router.put('/indicator-systems/:systemId/indicators/:indicatorId', async (req, res) => {
  try {
    const { code, name, description, isLeaf, weight } = req.body;
    const timestamp = now();

    const result = await db.query(`
      UPDATE indicators SET code = $1, name = $2, description = $3, is_leaf = $4, weight = $5, updated_at = $6
      WHERE id = $7 AND system_id = $8
    `, [code, name, description || '', isLeaf ? 1 : 0, weight || null, timestamp, req.params.indicatorId, req.params.systemId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除指标节点（使用级联删除服务）
router.delete('/indicator-systems/:systemId/indicators/:indicatorId', async (req, res) => {
  try {
    const timestamp = now();

    // 计算要删除的节点数（包括子节点）
    const countDeleted = async (id) => {
      const childrenResult = await db.query('SELECT id FROM indicators WHERE parent_id = $1', [id]);
      let count = 1;
      for (const child of childrenResult.rows) {
        count += await countDeleted(child.id);
      }
      return count;
    };

    const deleteCount = await countDeleted(req.params.indicatorId);

    const result = await deleteIndicator(req.params.indicatorId);

    if (!result.deleted.indicators) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    // 更新指标数量
    await db.query('UPDATE indicator_systems SET indicator_count = indicator_count - $1, updated_at = $2 WHERE id = $3',
      [deleteCount, timestamp, req.params.systemId]);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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

// 添加数据指标-要素关联
router.post('/data-indicators/:dataIndicatorId/elements', async (req, res) => {
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

    await db.query(`
      INSERT INTO data_indicator_elements (id, data_indicator_id, element_id, mapping_type, description, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'admin', $6, $7)
    `, [id, dataIndicatorId, elementId, mappingType || 'primary', description || '', timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '关联成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新数据指标-要素关联
router.put('/data-indicators/:dataIndicatorId/elements/:associationId', async (req, res) => {
  try {
    const { mappingType, description } = req.body;
    const timestamp = now();

    const result = await db.query(`
      UPDATE data_indicator_elements SET mapping_type = $1, description = $2, updated_at = $3
      WHERE id = $4 AND data_indicator_id = $5
    `, [mappingType, description || '', timestamp, req.params.associationId, req.params.dataIndicatorId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除数据指标-要素关联
router.delete('/data-indicators/:dataIndicatorId/elements/:associationId', async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM data_indicator_elements WHERE id = $1 AND data_indicator_id = $2
    `, [req.params.associationId, req.params.dataIndicatorId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量保存数据指标-要素关联
router.put('/data-indicators/:dataIndicatorId/elements', async (req, res) => {
  const dataIndicatorId = req.params.dataIndicatorId;
  const associations = req.body.associations || [];
  const timestamp = now();

  try {
    await db.transaction(async (client) => {
      // 删除现有关联
      await client.query('DELETE FROM data_indicator_elements WHERE data_indicator_id = $1', [dataIndicatorId]);

      // 插入新关联
      for (const assoc of associations) {
        await client.query(`
          INSERT INTO data_indicator_elements (id, data_indicator_id, element_id, mapping_type, description, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, 'admin', $6, $7)
        `, [
          assoc.id || generateId(),
          dataIndicatorId,
          assoc.elementId,
          assoc.mappingType || 'primary',
          assoc.description || '',
          timestamp,
          timestamp
        ]);
      }
    });

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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

module.exports = { router, setDb };
