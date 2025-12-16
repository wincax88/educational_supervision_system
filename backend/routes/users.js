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
      role: u.role,
      roleName: u.roleName,
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
    const { username, password, role, roleName, status, scopes } = req.body || {};
    const created = userStore.createUser({ username, password, role, roleName, status, scopes });
    res.json({
      code: 200,
      data: {
        username: created.username,
        role: created.role,
        roleName: created.roleName,
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

// 更新用户
router.put('/users/:username', (req, res) => {
  try {
    const { username } = req.params;
    const { password, role, roleName, status, scopes } = req.body || {};
    const updated = userStore.updateUser(username, { password, role, roleName, status, scopes });
    res.json({
      code: 200,
      data: {
        username: updated.username,
        role: updated.role,
        roleName: updated.roleName,
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


