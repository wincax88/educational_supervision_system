/**
 * 用户管理路由
 */

import { Router, Request, Response } from 'express';
import { verifyToken, roles } from '../middleware/auth';
import * as userStore from '../services/userStore';

export const router = Router();

// 仅管理员可访问（仅作用于 /users 下的接口，避免影响 /api/login 等其他接口）
router.use('/users', verifyToken, roles.admin);

// 获取用户列表
router.get('/users', (req: Request, res: Response): void => {
  try {
    const { keyword, role, status } = req.query as {
      keyword?: string;
      role?: userStore.UserRole;
      status?: 'active' | 'inactive';
    };
    const users = userStore.listUsers({ keyword, role, status }).map(u => ({
      username: u.username,
      roles: u.roles || [],
      status: u.status,
      scopes: u.scopes || [],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
    res.json({ code: 200, data: users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ code: 500, message });
  }
});

// 创建用户
router.post('/users', (req: Request, res: Response): void => {
  try {
    const { username, password, roles: userRoles, status, scopes } = req.body || {};
    const created = userStore.createUser({
      username,
      password,
      roles: userRoles,
      status,
      scopes
    });
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ code: 400, message });
  }
});

// 更新用户
router.put('/users/:username', (req: Request, res: Response): void => {
  try {
    const { username } = req.params;
    const { password, roles: userRoles, status, scopes } = req.body || {};
    const updated = userStore.updateUser(username, {
      password,
      roles: userRoles,
      status,
      scopes
    });
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ code: 400, message });
  }
});

// 删除用户
router.delete('/users/:username', (req: Request, res: Response): void => {
  try {
    const { username } = req.params;
    userStore.deleteUser(username);
    res.json({ code: 200, message: '删除成功' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ code: 400, message });
  }
});

export default { router };
