const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 项目人员 CRUD ====================

// 获取项目人员列表
router.get('/projects/:projectId/personnel', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { role, status } = req.query;

    let sql = `
      SELECT id, project_id as "projectId", name, organization, phone, id_card as "idCard",
             role, status, created_at as "createdAt", updated_at as "updatedAt"
      FROM project_personnel
      WHERE project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (role) {
      sql += ` AND role = $${paramIndex++}`;
      params.push(role);
    }
    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY role, created_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个人员
router.get('/projects/:projectId/personnel/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;

    const result = await db.query(`
      SELECT id, project_id as "projectId", name, organization, phone, id_card as "idCard",
             role, status, created_at as "createdAt", updated_at as "updatedAt"
      FROM project_personnel
      WHERE id = $1 AND project_id = $2
    `, [id, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '人员不存在' });
    }

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加人员
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
    const { name, organization, phone, idCard, role } = req.body;

    if (!name || !role) {
      return res.status(400).json({ code: 400, message: '姓名和角色为必填项' });
    }

    // 角色定义：
    // system_admin - 系统管理员（省级/国家级）
    // city_admin - 市级管理员
    // district_admin - 区县管理员
    // district_reporter - 区县填报员
    // school_reporter - 学校填报员
    const validRoles = ['system_admin', 'city_admin', 'district_admin', 'district_reporter', 'school_reporter'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ code: 400, message: '无效的角色类型' });
    }

    const id = generateId();
    const timestamp = now();

    const { data, error } = await db
      .from('project_personnel')
      .insert({
        id,
        project_id: projectId,
        name,
        organization: organization || '',
        phone: phone || '',
        id_card: idCard || '',
        role,
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;
    return res.json({ code: 200, data: { id: data?.[0]?.id || id }, message: '添加成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新人员
router.put('/projects/:projectId/personnel/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { name, organization, phone, idCard, role, status } = req.body;

    const timestamp = now();

    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(organization !== undefined ? { organization } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(idCard !== undefined ? { id_card: idCard } : {}),
      ...(role !== undefined ? { role } : {}),
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

// 批量导入人员
router.post('/projects/:projectId/personnel/import', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { personnel } = req.body;

    if (!Array.isArray(personnel) || personnel.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供人员数据' });
    }

    const timestamp = now();
    const validRoles = ['system_admin', 'city_admin', 'district_admin', 'district_reporter', 'school_reporter'];
    const results = { success: 0, failed: 0, errors: [] };

    for (const person of personnel) {
      try {
        if (!person.name || !person.role) {
          results.failed++;
          results.errors.push(`${person.name || '未知'}: 姓名和角色为必填项`);
          continue;
        }

        if (!validRoles.includes(person.role)) {
          results.failed++;
          results.errors.push(`${person.name}: 无效的角色类型`);
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
            phone: person.phone || '',
            id_card: person.idCard || '',
            role: person.role,
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
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取人员统计
router.get('/projects/:projectId/personnel/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT role, COUNT(*) as count
      FROM project_personnel
      WHERE project_id = $1 AND status = 'active'
      GROUP BY role
    `, [projectId]);

    const stats = {
      total: 0,
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

module.exports = { router, setDb };
