const express = require('express');
const { verifyToken, roles } = require('../middleware/auth');
const userStore = require('../services/userStore');

const router = express.Router();

// 仅管理员可访问（仅作用于 /users 下的接口，避免影响 /api/login 等其他接口）
router.use('/users', verifyToken, roles.admin);

// 获取用户列表
router.get('/users', (req, res) => {
  try {
    const { keyword, role, status } = req.query;
    const users = userStore.listUsers({ keyword, role, status }).map(u => ({
      username: u.username,
      roles: u.roles || [],
      status: u.status,
      scopes: u.scopes || [],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
    res.json({ code: 200, data: users });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建用户
router.post('/users', (req, res) => {
  try {
    const { username, password, roles, status, scopes } = req.body || {};
    const created = userStore.createUser({ username, password, roles, status, scopes });
    res.json({
      code: 200,
      data: {
        username: created.username,
        roles: created.roles || [],
        status: created.status,
        scopes: created.scopes || [],
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      message: '创建成功',
    });
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 批量导入用户（注意：必须在 /users/:username 之前定义，避免被参数路由捕获）
router.post('/users/import', (req, res) => {
  try {
    const { users } = req.body || {};

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供用户数据' });
    }

    const results = { success: 0, failed: 0, errors: [], created: [] };

    for (const user of users) {
      try {
        const { username, password, roles, status, scopes } = user;

        if (!username || !password) {
          results.failed++;
          results.errors.push(`${username || '未知'}: 用户名和密码为必填项`);
          continue;
        }

        // 检查用户是否已存在
        const existing = userStore.getUser(username);
        if (existing) {
          results.failed++;
          results.errors.push(`${username}: 用户名已存在`);
          continue;
        }

        const created = userStore.createUser({
          username,
          password,
          roles: roles || ['school_reporter'],
          status: status || 'active',
          scopes: scopes || [],
        });

        results.success++;
        results.created.push(created.username);
      } catch (err) {
        results.failed++;
        results.errors.push(`${user.username || '未知'}: ${err.message}`);
      }
    }

    res.json({
      code: 200,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`,
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新用户
router.put('/users/:username', (req, res) => {
  try {
    const { username } = req.params;
    const { password, roles, status, scopes } = req.body || {};
    const updated = userStore.updateUser(username, { password, roles, status, scopes });
    res.json({
      code: 200,
      data: {
        username: updated.username,
        roles: updated.roles || [],
        status: updated.status,
        scopes: updated.scopes || [],
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      message: '更新成功',
    });
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 删除用户
router.delete('/users/:username', (req, res) => {
  try {
    const { username } = req.params;
    userStore.deleteUser(username);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

module.exports = { router };


