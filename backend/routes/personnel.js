const express = require('express');
const router = express.Router();
const userSyncService = require('../src/services/userSyncService').default;

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 项目人员 CRUD ====================

// 获取项目人员列表（扩展：关联查询区县名称）
router.get('/projects/:projectId/personnel', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { role, status } = req.query;

    // 关联 project_samples 表获取区县名称
    let sql = `
      SELECT pp.id, pp.project_id as "projectId", pp.name, pp.organization, pp.phone, pp.id_card as "idCard",
             pp.role, pp.district_id as "districtId", pp.status,
             pp.created_at as "createdAt", pp.updated_at as "updatedAt",
             ps.name as "districtName"
      FROM project_personnel pp
      LEFT JOIN project_samples ps ON pp.district_id = ps.id AND ps.type = 'district'
      WHERE pp.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (role) {
      sql += ` AND pp.role = $${paramIndex++}`;
      params.push(role);
    }
    if (status) {
      sql += ` AND pp.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY pp.role, pp.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取人员统计（必须放在 /:id 路由之前，否则 stats 会被当作 id 处理）
router.get('/projects/:projectId/personnel/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT role, COUNT(*) as count
      FROM project_personnel
      WHERE project_id = $1 AND status = 'active'
      GROUP BY role
    `, [projectId]);

    // 新角色体系：project_admin, data_collector, project_expert
    const stats = {
      total: 0,
      project_admin: 0,
      data_collector: 0,
      project_expert: 0,
      // 保留旧角色兼容
      system_admin: 0,
      city_admin: 0,
      district_admin: 0,
      district_reporter: 0,
      school_reporter: 0
    };

    result.rows.forEach(row => {
      stats[row.role] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    res.json({ code: 200, data: stats });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个人员（扩展：关联查询区县名称）
router.get('/projects/:projectId/personnel/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;

    const result = await db.query(`
      SELECT pp.id, pp.project_id as "projectId", pp.name, pp.organization, pp.phone, pp.id_card as "idCard",
             pp.role, pp.district_id as "districtId", pp.status,
             pp.created_at as "createdAt", pp.updated_at as "updatedAt",
             ps.name as "districtName"
      FROM project_personnel pp
      LEFT JOIN project_samples ps ON pp.district_id = ps.id AND ps.type = 'district'
      WHERE pp.id = $1 AND pp.project_id = $2
    `, [id, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '人员不存在' });
    }

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加人员（扩展：支持 districtId 字段，同步创建系统用户）
router.post('/projects/:projectId/personnel', async (req, res) => {
  try {
    // 缺表时给出更清晰的提示（Supabase PostgREST 否则会报 schema cache）
    const hasTable = await db.tableExists?.('project_personnel');
    if (hasTable === false) {
      return res.status(500).json({
        code: 500,
        message: "缺少数据表 public.project_personnel。请在 Supabase SQL Editor 执行 backend/database/create-personnel-samples-tables.sql（或重新执行 backend/database/supabase-setup.sql）后重试。"
      });
    }

    const { projectId } = req.params;
    const { name, organization, phone, idCard, role, districtId } = req.body;

    if (!name || !role) {
      return res.status(400).json({ code: 400, message: '姓名和角色为必填项' });
    }

    // 手机号为必填项（用于同步系统用户）
    if (!phone || phone.trim() === '') {
      return res.status(400).json({ code: 400, message: '手机号为必填项' });
    }

    // 新角色体系：
    // project_admin - 项目管理员（项目配置和管理）
    // data_collector - 数据采集员（数据填报，按区县限制）
    // project_expert - 项目评估专家（数据审核和评估）
    const validRoles = ['project_admin', 'data_collector', 'project_expert'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ code: 400, message: '无效的角色类型' });
    }

    // 数据采集员必须关联区县
    if (role === 'data_collector' && !districtId) {
      return res.status(400).json({ code: 400, message: '数据采集员必须选择负责的区县' });
    }

    const id = generateId();
    const timestamp = now();

    // 同步到系统用户
    let syncResult = null;
    try {
      syncResult = await userSyncService.syncPersonnelToSysUser({
        phone: phone.trim(),
        name,
        organization,
        idCard,
        role,
      });
    } catch (syncError) {
      console.error('同步系统用户失败:', syncError.message);
      // 同步失败不阻断项目人员添加，但记录警告
    }

    const { data, error } = await db
      .from('project_personnel')
      .insert({
        id,
        project_id: projectId,
        name,
        organization: organization || '',
        phone: phone.trim(),
        id_card: idCard || '',
        role,
        district_id: districtId || null,
        user_phone: syncResult?.success ? phone.trim() : null,  // 关联系统用户
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;
    return res.json({
      code: 200,
      data: { id: data?.[0]?.id || id },
      message: '添加成功',
      sysUserCreated: syncResult?.created || false,
    });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新人员（扩展：支持 districtId 字段）
router.put('/projects/:projectId/personnel/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { name, organization, phone, idCard, role, districtId, status } = req.body;

    const timestamp = now();

    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(organization !== undefined ? { organization } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(idCard !== undefined ? { id_card: idCard } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(districtId !== undefined ? { district_id: districtId } : {}),
      ...(status !== undefined ? { status } : {}),
      updated_at: timestamp,
    };

    const { data, error } = await db
      .from('project_personnel')
      .update(updates)
      .eq('id', id)
      .eq('project_id', projectId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '人员不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除人员
router.delete('/projects/:projectId/personnel/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;

    const { data, error } = await db
      .from('project_personnel')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '人员不存在' });
    }

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量导入人员（扩展：支持新角色和 districtId，同步系统用户）
router.post('/projects/:projectId/personnel/import', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { personnel } = req.body;

    if (!Array.isArray(personnel) || personnel.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供人员数据' });
    }

    const timestamp = now();
    // 新角色体系
    const validRoles = ['project_admin', 'data_collector', 'project_expert'];
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      sysUsersCreated: 0,
      sysUsersUpdated: 0,
    };

    // 批量同步到系统用户
    const personnelToSync = personnel.filter(p => p.phone && p.phone.trim());
    if (personnelToSync.length > 0) {
      try {
        const syncResult = await userSyncService.batchSyncPersonnelToSysUsers(
          personnelToSync.map(p => ({
            phone: p.phone.trim(),
            name: p.name,
            organization: p.organization,
            idCard: p.idCard,
            role: p.role,
          }))
        );
        results.sysUsersCreated = syncResult.created;
        results.sysUsersUpdated = syncResult.updated;
      } catch (syncError) {
        console.error('批量同步系统用户失败:', syncError.message);
      }
    }

    // 导入项目人员
    for (const person of personnel) {
      try {
        if (!person.name || !person.role) {
          results.failed++;
          results.errors.push(`${person.name || '未知'}: 姓名和角色为必填项`);
          continue;
        }

        // 手机号为必填项
        if (!person.phone || person.phone.trim() === '') {
          results.failed++;
          results.errors.push(`${person.name}: 手机号为必填项`);
          continue;
        }

        if (!validRoles.includes(person.role)) {
          results.failed++;
          results.errors.push(`${person.name}: 无效的角色类型`);
          continue;
        }

        // 数据采集员必须关联区县
        if (person.role === 'data_collector' && !person.districtId) {
          results.failed++;
          results.errors.push(`${person.name}: 数据采集员必须选择负责的区县`);
          continue;
        }

        const id = generateId();
        const { error } = await db
          .from('project_personnel')
          .insert({
            id,
            project_id: projectId,
            name: person.name,
            organization: person.organization || '',
            phone: person.phone.trim(),
            id_card: person.idCard || '',
            role: person.role,
            district_id: person.districtId || null,
            user_phone: person.phone.trim(),  // 关联系统用户
            status: 'active',
            created_at: timestamp,
            updated_at: timestamp,
          });
        if (error) throw error;

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${person.name}: ${err.message}`);
      }
    }

    res.json({
      code: 200,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条。系统用户：新建 ${results.sysUsersCreated} 个，更新 ${results.sysUsersUpdated} 个`
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
