const express = require('express');
const router = express.Router();
const { verifyToken, roles, checkProjectPermission } = require('../dist/middleware/auth');
const userStore = require('../services/userStore');

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 项目任务 CRUD ====================

// 获取项目任务列表（需要该项目的管理员权限）
router.get('/projects/:projectId/tasks', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, assigneeId, status } = req.query;

    let sql = `
      SELECT
        t.id,
        t.project_id as "projectId",
        t.tool_id as "toolId",
        t.assignee_id as "assigneeId",
        t.target_type as "targetType",
        t.target_id as "targetId",
        t.status,
        t.due_date as "dueDate",
        t.submission_id as "submissionId",
        t.completed_at as "completedAt",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        dt.name as "toolName",
        dt.type as "toolType",
        -- 优先从 sys_users 获取采集员信息（assignee_id 是用户手机号）
        COALESCE(su.name, pp.name) as "assigneeName",
        -- 从目标评估对象获取名称作为所属单位
        COALESCE(
          (SELECT ps2.name FROM project_samples ps2
           WHERE ps2.id = t.target_id
           LIMIT 1),
          su.organization,
          pp.organization
        ) as "assigneeOrg",
        ps.name as "assigneeDistrict"
      FROM tasks t
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      LEFT JOIN sys_users su ON t.assignee_id = su.phone
      LEFT JOIN project_personnel pp ON t.assignee_id = pp.id
      LEFT JOIN project_samples ps ON pp.district_id = ps.id AND ps.type = 'district'
      WHERE t.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (toolId) {
      sql += ` AND t.tool_id = $${paramIndex++}`;
      params.push(toolId);
    }
    if (assigneeId) {
      sql += ` AND t.assignee_id = $${paramIndex++}`;
      params.push(assigneeId);
    }
    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY t.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 获取任务统计（需要该项目的管理员权限）
router.get('/projects/:projectId/tasks/stats', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as "inProgress",
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM tasks
      WHERE project_id = $1
    `, [projectId]);

    const stats = result.rows[0];
    const total = parseInt(stats.total) || 0;
    const completed = parseInt(stats.completed) || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      code: 200,
      data: {
        total,
        pending: parseInt(stats.pending) || 0,
        inProgress: parseInt(stats.inProgress) || 0,
        completed,
        overdue: parseInt(stats.overdue) || 0,
        rejected: parseInt(stats.rejected) || 0,
        completionRate,
      },
    });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 获取单个任务
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        t.id,
        t.project_id as "projectId",
        t.tool_id as "toolId",
        t.assignee_id as "assigneeId",
        t.target_type as "targetType",
        t.target_id as "targetId",
        t.status,
        t.due_date as "dueDate",
        t.submission_id as "submissionId",
        t.completed_at as "completedAt",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        dt.name as "toolName",
        dt.type as "toolType",
        -- 优先从 sys_users 获取采集员信息（assignee_id 是用户手机号）
        COALESCE(su.name, pp.name) as "assigneeName",
        -- 从目标评估对象获取名称作为所属单位
        COALESCE(
          (SELECT ps2.name FROM project_samples ps2
           WHERE ps2.id = t.target_id
           LIMIT 1),
          su.organization,
          pp.organization
        ) as "assigneeOrg",
        ps.name as "assigneeDistrict"
      FROM tasks t
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      LEFT JOIN sys_users su ON t.assignee_id = su.phone
      LEFT JOIN project_personnel pp ON t.assignee_id = pp.id
      LEFT JOIN project_samples ps ON pp.district_id = ps.id AND ps.type = 'district'
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 创建单个任务（需要该项目的管理员权限）
router.post('/projects/:projectId/tasks', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, assigneeId, targetType, targetId, dueDate } = req.body;

    if (!toolId || !assigneeId) {
      return res.status(400).json({ code: 400, message: '工具ID和采集员ID为必填项' });
    }

    const id = generateId();
    const timestamp = now();

    // 使用 Supabase Data API，避免 exec_sql 仅支持 SELECT 的限制
    const { data, error } = await db
      .from('tasks')
      .insert({
        id,
        project_id: projectId,
        tool_id: toolId,
        assignee_id: assigneeId,
        target_type: targetType || null,
        target_id: targetId || null,
        due_date: dueDate || null,
        status: 'pending',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;

    const createdId = data?.[0]?.id || id;
    res.json({ code: 200, data: { id: createdId }, message: '任务创建成功' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 批量创建任务（需要该项目的管理员权限）
router.post('/projects/:projectId/tasks/batch', verifyToken, checkProjectPermission(['project_admin']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, assigneeIds, targetType, targetIds, dueDate } = req.body;

    if (!toolId || !assigneeIds || assigneeIds.length === 0) {
      return res.status(400).json({ code: 400, message: '工具ID和采集员ID列表为必填项' });
    }

    const timestamp = now();

    // 使用 Supabase Data API：先批量查询已存在任务，再批量插入缺失任务
    const { data: existing, error: existingError } = await db
      .from('tasks')
      .select('assignee_id')
      .eq('project_id', projectId)
      .eq('tool_id', toolId)
      .in('assignee_id', assigneeIds);
    if (existingError) throw existingError;

    const existingSet = new Set((existing || []).map(r => r.assignee_id));
    const toCreate = assigneeIds
      .filter(aid => !existingSet.has(aid))
      .map((assigneeId) => ({
        id: generateId(),
        project_id: projectId,
        tool_id: toolId,
        assignee_id: assigneeId,
        target_type: targetType || null,
        target_id: targetIds?.[0] || null,
        due_date: dueDate || null,
        status: 'pending',
        created_at: timestamp,
        updated_at: timestamp,
      }));

    if (toCreate.length === 0) {
      return res.json({ code: 200, data: { created: 0 }, message: '成功创建 0 个任务' });
    }

    const { data: inserted, error: insertError } = await db
      .from('tasks')
      .insert(toCreate)
      .select('id');
    if (insertError) throw insertError;

    const createdCount = inserted?.length || toCreate.length;
    res.json({ code: 200, data: { created: createdCount }, message: `成功创建 ${createdCount} 个任务` });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 更新任务
router.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dueDate, assigneeId } = req.body;

    // 使用 Supabase Data API，避免 exec_sql 仅支持 SELECT 的限制
    if (status === undefined && dueDate === undefined && assigneeId === undefined) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }

    const updates = {
      ...(status !== undefined ? { status } : {}),
      ...(dueDate !== undefined ? { due_date: dueDate } : {}),
      ...(assigneeId !== undefined ? { assignee_id: assigneeId } : {}),
      updated_at: now(),
    };

    const { data, error } = await db
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 删除任务
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 批量删除任务
router.post('/tasks/batch-delete', async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || taskIds.length === 0) {
      return res.status(400).json({ code: 400, message: '任务ID列表不能为空' });
    }

    const { data, error } = await db
      .from('tasks')
      .delete()
      .in('id', taskIds)
      .select('id');
    if (error) throw error;

    const deleted = data?.length || 0;
    res.json({ code: 200, data: { deleted }, message: `成功删除 ${deleted} 个任务` });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 开始任务
router.post('/tasks/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from('tasks')
      .update({ status: 'in_progress', updated_at: now() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '任务不存在或状态不允许开始' });
    }

    res.json({ code: 200, message: '任务已开始' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 完成任务
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { submissionId } = req.body;

    const timestamp = now();
    const { data, error } = await db
      .from('tasks')
      .update({
        status: 'completed',
        submission_id: submissionId || null,
        completed_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', id)
      .in('status', ['pending', 'in_progress'])
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '任务不存在或状态不允许完成' });
    }

    res.json({ code: 200, message: '任务已完成' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 重置任务状态
router.post('/tasks/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from('tasks')
      .update({
        status: 'pending',
        submission_id: null,
        completed_at: null,
        updated_at: now(),
      })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '任务已重置' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 获取我的任务列表（采集员视角）
router.get('/my/tasks', verifyToken, roles.collector, async (req, res) => {
  try {
    const { projectId, status, scopeType, scopeId, includeSubSchools } = req.query;
    // 通过登录会话（token.timestamp）拿到当前 username/scopes
    const username = req.auth?.username;
    console.log('[/my/tasks] req.auth =', JSON.stringify(req.auth));
    const u = username ? userStore.getUser(username) : null;
    let scopes = (req.auth?.scopes && Array.isArray(req.auth.scopes)) ? req.auth.scopes : (u?.scopes || []);

    // 如果前端指定了当前 scope（例如：学校填报员切换到某一所学校），则只取该 scope
    if (scopeType && scopeId) {
      const st = String(scopeType);
      const sid = String(scopeId);
      const matched = (scopes || []).find(s => s && s.type === st && s.id === sid);
      // 如果能识别到用户 scopes，则做权限校验；否则仅按 scope 参数做过滤（兼容服务重启后旧 token）
      if (Array.isArray(scopes) && scopes.length > 0 && !matched) {
        return res.status(403).json({ code: 403, message: '当前账号无权访问该范围的数据' });
      }
      scopes = matched ? [matched] : scopes;
    }

    // scope 过滤（学校/区县）
    const schoolScopes = (scopes || []).filter(s => s && s.type === 'school');
    const districtScopes = (scopes || []).filter(s => s && s.type === 'district');
    const schoolIds = schoolScopes.map(s => s.id).filter(Boolean);
    const schoolNames = schoolScopes.map(s => s.name).filter(Boolean);
    const districtIds = districtScopes.map(s => s.id).filter(Boolean);
    const districtNames = districtScopes.map(s => s.name).filter(Boolean);

    // 去重：同一项目同一工具，只展示一个入口（避免"同名任务"出现两条）
    // 但如果需要查看下属学校任务，则不去重，以便显示每个学校的每个任务
    const needDistinct = includeSubSchools !== 'true';
    const distinctOn = needDistinct ? `DISTINCT ON (t.project_id, t.tool_id)` : '';

    let sql = `
      SELECT ${distinctOn}
        t.id,
        t.project_id as "projectId",
        t.tool_id as "toolId",
        t.assignee_id as "assigneeId",
        t.target_type as "targetType",
        t.target_id as "targetId",
        COALESCE(
          -- 优先从 project_samples 获取名称（target_id 可能是样本 ID）
          (SELECT name FROM project_samples WHERE id = t.target_id),
          -- 兼容旧数据：从 schools/districts 表获取
          CASE
            WHEN t.target_type = 'school' THEN (SELECT name FROM schools WHERE id = t.target_id)
            WHEN t.target_type = 'district' THEN (SELECT name FROM districts WHERE id = t.target_id)
            ELSE NULL
          END,
          pp.organization
        ) as "targetName",
        t.status,
        t.due_date as "dueDate",
        t.submission_id as "submissionId",
        t.completed_at as "completedAt",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        dt.name as "toolName",
        dt.type as "toolType",
        dt.target as "toolTarget",
        p.name as "projectName",
        pp.name as "assigneeName",
        pp.organization as "assigneeOrg",
        psd.name as "assigneeDistrict"
      FROM tasks t
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_personnel pp ON t.assignee_id = pp.id
      LEFT JOIN project_samples psd ON pp.district_id = psd.id AND psd.type = 'district'
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (projectId) {
      sql += ` AND t.project_id = $${paramIndex++}`;
      params.push(projectId);
    }
    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    // 核心逻辑：通过 phone/name 查找用户对应的 project_personnel 记录
    // 然后通过 assignee_id 匹配任务（任务只与用户ID相关，与scopes无关）
    let personnelIds = [];
    let personnelDistrictIds = [];
    
    // 获取用户标识信息
    let phone = req.auth?.phone || username;
    let name = req.auth?.name;
    
    console.log(`[/my/tasks] 调试信息:`, {
      timestamp: req.auth?.timestamp,
      phone: phone,
      name: name,
      username: username,
      'req.auth': req.auth,
      projectId: projectId
    });
    
    // 如果 session 丢失（服务重启后），尝试从数据库恢复用户信息
    // 通过查询最近登录的用户（基于 timestamp 或其他方式）
    if (!phone && !name && req.auth?.timestamp) {
      try {
        // 尝试从 sys_users 表查询最近活跃的用户
        // 注意：这是一个临时解决方案，不够安全，但可以帮助恢复会话
        console.log(`[/my/tasks] Session 丢失，尝试从数据库恢复用户信息...`);
        
        // 由于无法确定具体用户，我们无法安全地恢复
        // 但我们可以提供更详细的错误信息
        console.warn(`[/my/tasks] 无法从 session 恢复用户信息，需要用户重新登录`);
      } catch (err) {
        console.error('尝试恢复用户信息失败:', err);
      }
    }
    
    // 如果 session 丢失（服务重启后），phone 和 username 可能都是 null
    // 但仍然尝试查询，以便看到详细的错误信息
    if (phone || name || username) {
      try {
        // 查找当前用户对应的 project_personnel 记录
        // 匹配条件优先级：
        // 1. phone = req.auth.phone（优先通过手机号匹配）
        // 2. name = req.auth.name（通过姓名匹配）
        // 3. name = username（兼容旧逻辑）
        let personnelQuery = `
          SELECT pp.id, pp.district_id, pp.role, pp.name, pp.phone, psd.name as district_name
          FROM project_personnel pp
          LEFT JOIN project_samples psd ON pp.district_id = psd.id AND psd.type = 'district'
          WHERE pp.status = 'active' AND (pp.phone = $1 OR pp.name = $2 OR pp.name ILIKE $3)
        `;
        const personnelParams = [phone, name || username, `%${username || ''}%`];

        // 如果有 projectId，限制到特定项目
        if (projectId) {
          personnelQuery += ` AND pp.project_id = $4`;
          personnelParams.push(projectId);
        }

        console.log(`[/my/tasks] 执行查询:`, {
          query: personnelQuery,
          params: personnelParams
        });

        const personnelResult = await db.query(personnelQuery, personnelParams);
        personnelIds = personnelResult.rows.map(r => r.id);
        personnelDistrictIds = personnelResult.rows.map(r => r.district_id).filter(Boolean);

        console.log(`[/my/tasks] 查询结果:`, {
          phone: phone,
          name: name,
          username: username,
          foundPersonnel: personnelResult.rows.length,
          personnelIds: personnelIds,
          personnelDetails: personnelResult.rows.map(r => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            role: r.role,
            district: r.district_name
          }))
        });
      } catch (err) {
        console.error('查询 project_personnel 失败:', err);
        console.error('错误详情:', {
          message: err.message,
          stack: err.stack,
          phone: phone,
          name: name,
          username: username
        });
      }
    } else {
      console.warn(`[/my/tasks] 无法识别用户身份: phone=${phone}, name=${name}, username=${username}`);
      console.warn(`[/my/tasks] 可能原因: 服务重启后 session 丢失，请重新登录`);
    }

    // 如果没有匹配的 personnel 记录，返回空结果
    if (personnelIds.length === 0) {
      const hasSession = req.auth?.phone || req.auth?.name;
      
      if (!hasSession) {
        // Session 丢失的情况
        const errorMsg = `会话已过期或丢失（服务可能已重启），无法识别用户身份`;
        console.warn(`[/my/tasks] ${errorMsg}`);
        console.warn(`[/my/tasks] Token: ${req.auth?.token}, Timestamp: ${req.auth?.timestamp}, Role: ${req.auth?.role}`);
        console.warn(`[/my/tasks] 解决方案: 请重新登录获取新的 token`);
        
        // 返回错误信息（但保持 200 状态码以兼容前端）
        return res.json({ 
          code: 200, 
          data: [],
          message: '会话已过期，请重新登录',
          needRelogin: true 
        });
      } else {
        // 有 session 但没有匹配的 personnel 记录
        const errorMsg = `用户 ${username || phone || '未知'} 没有匹配的 personnel 记录`;
        console.warn(`[/my/tasks] ${errorMsg}`);
        console.warn(`[/my/tasks] 建议检查: 1) project_personnel 表中是否存在该用户的记录 2) 记录的 phone/name 是否匹配 3) 记录状态是否为 'active' 4) 如果指定了 projectId，记录是否属于该项目`);
        
        return res.json({ code: 200, data: [] });
      }
    }

    // 通过 assignee_id 过滤任务（任务只与用户ID相关）
    sql += ` AND t.assignee_id = ANY($${paramIndex++})`;
    params.push(personnelIds);

    // 如果指定了当前 scope（例如用户选择了某个学校），还需要过滤任务的目标范围
    if (scopeType && scopeId) {
      const st = String(scopeType);
      const sid = String(scopeId);

      if (st === 'school') {
        // 学校任务：只显示 target_type='school' 且 target_id 匹配的任务
        sql += ` AND (t.target_type = 'school' AND t.target_id = $${paramIndex++})`;
        params.push(sid);
      } else if (st === 'district') {
        // 区县任务：只显示 target_type='district' 且 target_id 匹配的任务
        sql += ` AND (t.target_type = 'district' AND t.target_id = $${paramIndex++})`;
        params.push(sid);
      }
    }

    // DISTINCT ON 要求 ORDER BY 以 distinct key 作为前缀（并优先返回"更紧急"的那条）
    // 如果不使用 DISTINCT ON（查看下属学校任务），则按学校名称分组排序
    if (needDistinct) {
      sql += `
        ORDER BY
          t.project_id,
          t.tool_id,
          CASE t.status
            WHEN 'overdue' THEN 5
            WHEN 'rejected' THEN 4
            WHEN 'in_progress' THEN 3
            WHEN 'pending' THEN 2
            WHEN 'completed' THEN 1
            ELSE 0
          END DESC,
          t.due_date ASC NULLS LAST,
          t.created_at DESC
      `;
    } else {
      // 按目标名称（学校名称）分组，然后按工具名称排序
      sql += `
        ORDER BY
          COALESCE(
            (SELECT name FROM project_samples WHERE id = t.target_id),
            CASE
              WHEN t.target_type = 'school' THEN (SELECT name FROM schools WHERE id = t.target_id)
              WHEN t.target_type = 'district' THEN (SELECT name FROM districts WHERE id = t.target_id)
              ELSE NULL
            END,
            pp.organization
          ) ASC NULLS LAST,
          dt.name ASC,
          CASE t.status
            WHEN 'overdue' THEN 5
            WHEN 'rejected' THEN 4
            WHEN 'in_progress' THEN 3
            WHEN 'pending' THEN 2
            WHEN 'completed' THEN 1
            ELSE 0
          END DESC,
          t.created_at DESC
      `;
    }

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取我的项目列表（采集员视角，返回有任务的项目）
router.get('/my/projects', verifyToken, roles.collector, async (req, res) => {
  try {
    const { scopeType, scopeId } = req.query;
    const username = req.auth?.username;
    const u = username ? userStore.getUser(username) : null;
    let scopes = (req.auth?.scopes && Array.isArray(req.auth.scopes)) ? req.auth.scopes : (u?.scopes || []);

    // 如果前端指定了当前 scope，则只取该 scope
    if (scopeType && scopeId) {
      const st = String(scopeType);
      const sid = String(scopeId);
      const matched = (scopes || []).find(s => s && s.type === st && s.id === sid);
      if (Array.isArray(scopes) && scopes.length > 0 && !matched) {
        return res.status(403).json({ code: 403, message: '当前账号无权访问该范围的数据' });
      }
      scopes = matched ? [matched] : scopes;
    }

    // scope 过滤
    const schoolScopes = (scopes || []).filter(s => s && s.type === 'school');
    const districtScopes = (scopes || []).filter(s => s && s.type === 'district');
    const schoolIds = schoolScopes.map(s => s.id).filter(Boolean);
    const schoolNames = schoolScopes.map(s => s.name).filter(Boolean);
    const districtIds = districtScopes.map(s => s.id).filter(Boolean);
    const districtNames = districtScopes.map(s => s.name).filter(Boolean);

    // 先查找当前用户对应的 project_personnel 记录
    let phone = req.auth?.phone || username;
    let name = req.auth?.name;
    let personnelIds = [];

    if (phone || name || username) {
      try {
        const personnelQuery = `
          SELECT pp.id
          FROM project_personnel pp
          WHERE pp.status = 'active' AND (pp.phone = $1 OR pp.name = $2 OR pp.name ILIKE $3)
        `;
        const personnelParams = [phone, name || username, `%${username || ''}%`];
        const personnelResult = await db.query(personnelQuery, personnelParams);
        personnelIds = personnelResult.rows.map(r => r.id);
      } catch (err) {
        console.error('查询 project_personnel 失败:', err);
      }
    }

    // 如果没有匹配的 personnel 记录，返回空结果
    if (personnelIds.length === 0) {
      return res.json({ code: 200, data: [] });
    }

    // 将 personnelIds 作为第一个参数传入，用于统计当前用户的任务数
    const params = [personnelIds];
    let paramIndex = 2;

    let sql = `
      SELECT DISTINCT
        p.id,
        p.name,
        p.description,
        p.status,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.indicator_system_id as "indicatorSystemId",
        isys.name as "indicatorSystemName",
        (SELECT COUNT(*) FROM tasks t2 WHERE t2.project_id = p.id AND t2.assignee_id = ANY($1)) as "totalTasks",
        (SELECT COUNT(*) FROM tasks t3 WHERE t3.project_id = p.id AND t3.status = 'completed' AND t3.assignee_id = ANY($1)) as "completedTasks",
        p.created_at as "createdAt"
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_personnel pp ON t.assignee_id = pp.id
      LEFT JOIN indicator_systems isys ON p.indicator_system_id = isys.id
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      WHERE p.is_published = true AND t.assignee_id = ANY($1)
    `;

    // 可选：按范围过滤
    if (scopeType && scopeId) {
      const scopeConds = [];
      const st = String(scopeType);
      const sid = String(scopeId);
      
      // 如果找到了匹配的 scope，使用 scope 中的 id 和 name
      if (schoolIds.length > 0) {
        scopeConds.push(`(t.target_type = 'school' AND t.target_id = ANY($${paramIndex++}))`);
        params.push(schoolIds);
      }
      if (schoolNames.length > 0) {
        scopeConds.push(`(pp.organization = ANY($${paramIndex++}))`);
        params.push(schoolNames);
      }
      if (districtIds.length > 0) {
        scopeConds.push(`(t.target_type = 'district' AND t.target_id = ANY($${paramIndex++}))`);
        params.push(districtIds);
      }
      if (districtNames.length > 0) {
        scopeConds.push(`(pp.organization = ANY($${paramIndex++}))`);
        params.push(districtNames);
      }
      
      // 如果没有匹配的 scope，但用户明确指定了 scopeType 和 scopeId，则尝试查询对应的名称
      // 这样可以兼容服务重启后旧 token 的情况，同时支持通过 organization 匹配
      if (scopeConds.length === 0) {
        try {
          if (st === 'school') {
            // 查询学校名称
            const schoolResult = await db.query('SELECT name FROM schools WHERE id = $1', [sid]);
            const schoolName = schoolResult?.rows?.[0]?.name;
            
            // 同时通过 target_id 和 organization 匹配
            if (schoolName) {
              scopeConds.push(`(t.target_type = 'school' AND t.target_id = $${paramIndex++})`);
              params.push(sid);
              scopeConds.push(`(pp.organization = $${paramIndex++})`);
              params.push(schoolName);
            } else {
              // 如果查询不到学校名称，至少通过 target_id 匹配
              scopeConds.push(`(t.target_type = 'school' AND t.target_id = $${paramIndex++})`);
              params.push(sid);
            }
          } else if (st === 'district') {
            // 查询区县名称
            const districtResult = await db.query('SELECT name FROM districts WHERE id = $1', [sid]);
            const districtName = districtResult?.rows?.[0]?.name;
            
            // 同时通过 target_id 和 organization 匹配
            if (districtName) {
              scopeConds.push(`(t.target_type = 'district' AND t.target_id = $${paramIndex++})`);
              params.push(sid);
              scopeConds.push(`(pp.organization = $${paramIndex++})`);
              params.push(districtName);
            } else {
              // 如果查询不到区县名称，至少通过 target_id 匹配
              scopeConds.push(`(t.target_type = 'district' AND t.target_id = $${paramIndex++})`);
              params.push(sid);
            }
          }
        } catch (err) {
          // 如果查询失败，至少通过 target_id 匹配
          console.warn('查询学校/区县名称失败:', err);
          if (st === 'school') {
            scopeConds.push(`(t.target_type = 'school' AND t.target_id = $${paramIndex++})`);
            params.push(sid);
          } else if (st === 'district') {
            scopeConds.push(`(t.target_type = 'district' AND t.target_id = $${paramIndex++})`);
            params.push(sid);
          }
        }
      }

      // 添加兜底条件：如果任务没有关联到具体学校/区县（target_type 为空且 organization 为空），
      // 也返回这些项目，但需要根据 scopeType 过滤对应的工具类型（dt.target）
      if (st === 'school') {
        scopeConds.push(`(t.target_type IS NULL AND (pp.organization IS NULL OR pp.organization = '') AND dt.target = '学校')`);
      } else if (st === 'district') {
        scopeConds.push(`(t.target_type IS NULL AND (pp.organization IS NULL OR pp.organization = '') AND dt.target = '区县')`);
      } else {
        scopeConds.push(`(t.target_type IS NULL AND (pp.organization IS NULL OR pp.organization = ''))`);
      }

      if (scopeConds.length > 0) {
        sql += ` AND (${scopeConds.join(' OR ')})`;
      }
    }

    sql += ` ORDER BY p.created_at DESC`;

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
