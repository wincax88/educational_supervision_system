/**
 * 用户管理路由
 * 使用手机号作为用户标识
 */

import { Router, Request, Response } from 'express';
import { verifyToken, roles } from '../middleware/auth';
import * as userStore from '../services/userStore';

export const router = Router();

// 仅管理员可访问（仅作用于 /users 下的接口）
router.use('/users', verifyToken, roles.admin);

// 获取用户列表
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword, role, status } = req.query as {
      keyword?: string;
      role?: userStore.UserRole;
      status?: 'active' | 'inactive';
    };
    const users = await userStore.listUsers({ keyword, role, status });
    const result = users.map(u => ({
      phone: u.phone,
      name: u.name,
      organization: u.organization,
      roles: u.roles || [],
      status: u.status,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));
    res.json({ code: 200, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ code: 500, message });
  }
});

// 创建用户
router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password, name, organization, roles: userRoles, status } = req.body || {};
    const created = await userStore.createUser({
      phone,
      password,
      name,
      organization,
      roles: userRoles,
      status,
    });
    res.json({
      code: 200,
      data: {
        phone: created.phone,
        name: created.name,
        organization: created.organization,
        roles: created.roles || [],
        status: created.status,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      },
      message: '创建成功',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ code: 400, message });
  }
});

// 更新用户
router.put('/users/:phone', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.params;
    const { password, name, organization, roles: userRoles, status } = req.body || {};
    const updated = await userStore.updateUser(phone, {
      password,
      name,
      organization,
      roles: userRoles,
      status,
    });
    res.json({
      code: 200,
      data: {
        phone: updated.phone,
        name: updated.name,
        organization: updated.organization,
        roles: updated.roles || [],
        status: updated.status,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
      message: '更新成功',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ code: 400, message });
  }
});

// 删除用户
router.delete('/users/:phone', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.params;
    await userStore.deleteUser(phone);
    res.json({ code: 200, message: '删除成功' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ code: 400, message });
  }
});

// 批量导入用户
router.post('/users/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { users } = req.body || {};

    if (!Array.isArray(users) || users.length === 0) {
      res.status(400).json({ code: 400, message: '请提供用户列表' });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ phone: string; error: string }>,
    };

    for (const userData of users) {
      try {
        const { phone, password, name, organization, roles: userRoles, status } = userData;

        if (!phone) {
          results.failed++;
          results.errors.push({ phone: '未知', error: '手机号为必填项' });
          continue;
        }

        // 检查用户是否存在
        const existing = await userStore.getUser(phone);
        if (existing) {
          // 用户已存在，更新角色
          if (userRoles && userRoles.length > 0) {
            for (const role of userRoles) {
              await userStore.addRoleToUser(phone, role);
            }
          }
          results.success++;
        } else {
          // 创建新用户
          await userStore.createUser({
            phone,
            password: password || userStore.generateDefaultPassword(phone),
            name,
            organization,
            roles: userRoles || ['data_collector'],
            status: status || 'active',
          });
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          phone: userData.phone || '未知',
          error: error.message || '导入失败',
        });
      }
    }

    res.json({
      code: 200,
      data: results,
      message: `导入完成：成功 ${results.success} 个，失败 ${results.failed} 个`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ code: 500, message });
  }
});

// 获取有效角色列表
router.get('/users/roles', (req: Request, res: Response): void => {
  res.json({
    code: 200,
    data: {
      roles: userStore.validRolesList,
      displayNames: userStore.roleDisplayNames,
    },
  });
});

export default { router };
