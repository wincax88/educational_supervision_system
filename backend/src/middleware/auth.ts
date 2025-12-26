/**
 * 认证中间件
 * 处理用户身份验证和权限控制
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as sessionStore from '../services/sessionStore';
import { query } from '../database/db';

export interface AuthInfo {
  token: string;
  timestamp: number;
  role: string | null;
  phone: string | null;
  name: string | null;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthInfo;
}

/**
 * 验证 Token 中间件
 * 检查请求头中的 Authorization token
 */
export const verifyToken: RequestHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      code: 401,
      message: '未提供认证令牌'
    });
    return;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    res.status(401).json({
      code: 401,
      message: '认证令牌格式错误'
    });
    return;
  }

  // 简单的 token 验证 (生产环境应使用 JWT)
  // 格式: token-{timestamp} 或 token-{timestamp}-{role}
  if (!token.startsWith('token-')) {
    res.status(401).json({
      code: 401,
      message: '无效的认证令牌'
    });
    return;
  }

  // 解析 token 获取基本信息
  // 新格式: token-{timestamp}-{role}-{encodedPhone}
  // 旧格式: token-{timestamp}-{role} (兼容)
  // 注意: 这是简化实现，生产环境应使用 JWT 并验证签名
  const parts = token.split('-');
  if (parts.length < 2) {
    res.status(401).json({
      code: 401,
      message: '认证令牌格式错误'
    });
    return;
  }

  // 检查 token 是否过期 (24小时有效期)
  const timestamp = parseInt(parts[1], 10);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (isNaN(timestamp) || now - timestamp > maxAge) {
    res.status(401).json({
      code: 401,
      message: '认证令牌已过期，请重新登录'
    });
    return;
  }

  // 从 sessionStore 获取会话信息（优先使用）
  const session = sessionStore.getSession(timestamp);

  // 从 token 中提取 phone（如果 session 丢失时的备用方案）
  let phoneFromToken: string | null = null;
  if (parts.length >= 4) {
    // 新格式：token 中包含 phone
    try {
      const encodedPhone = parts.slice(3).join('-'); // 支持 phone 中包含连字符的情况
      phoneFromToken = Buffer.from(encodedPhone, 'base64').toString('utf8');
    } catch (err) {
      console.warn('从 token 解析 phone 失败:', err);
    }
  }

  // 优先使用 session 中的信息，如果 session 丢失则使用 token 中的 phone
  const phone = session?.phone || phoneFromToken;
  const name = session?.name || null;
  const roles = session?.roles || [];

  // 将解析的信息附加到请求对象
  req.auth = {
    token,
    timestamp,
    role: parts[2] || null,
    phone: phone || null,
    name: name || null,
    roles: roles,
  };

  next();
};

/**
 * 可选认证中间件
 * 如果有 token 则验证，没有则继续
 */
export const optionalAuth: RequestHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  verifyToken(req, res, next);
};

/**
 * 角色检查中间件工厂
 * @param allowedRoles - 允许的角色列表
 */
export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        code: 401,
        message: '需要登录'
      });
      return;
    }

    // 如果 token 中没有角色信息，检查 session 中的角色
    const currentRole = req.auth.role;
    const userRoles = req.auth.roles || [];

    // 如果没有任何角色信息，暂时允许通过（兼容旧版本）
    if (!currentRole && userRoles.length === 0) {
      next();
      return;
    }

    // 检查当前角色或用户拥有的任一角色是否在允许列表中
    const hasPermission =
      (currentRole && allowedRoles.includes(currentRole)) ||
      userRoles.some(r => allowedRoles.includes(r));

    if (!hasPermission) {
      res.status(403).json({
        code: 403,
        message: '没有权限执行此操作'
      });
      return;
    }

    next();
  };
};

/**
 * 预定义的角色检查中间件
 * 新角色体系：admin, project_admin, data_collector, project_expert, decision_maker
 */
export const roles = {
  // 系统管理员
  admin: requireRole(['admin']),

  // 项目管理员及以上
  projectManager: requireRole(['admin', 'project_admin']),

  // 数据采集员及以上
  collector: requireRole(['admin', 'project_admin', 'data_collector']),

  // 项目评估专家及以上
  expert: requireRole(['admin', 'project_admin', 'project_expert']),

  // 报告决策者及以上
  decisionMaker: requireRole(['admin', 'project_admin', 'decision_maker']),

  // 所有登录用户
  authenticated: requireRole([
    'admin',
    'project_admin',
    'data_collector',
    'project_expert',
    'decision_maker'
  ])
};

/**
 * 项目级权限检查中间件工厂
 * 检查用户是否是指定项目的指定角色
 * @param allowedRoles - 允许的项目角色列表，默认只允许项目管理员
 */
export const checkProjectPermission = (allowedRoles: string[] = ['project_admin']): RequestHandler => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 从路由参数中获取项目ID（支持 :projectId 和 :id 两种命名）
      const projectId = req.params.projectId || req.params.id;
      const userPhone = req.auth?.phone;

      if (!projectId) {
        res.status(400).json({
          code: 400,
          message: '缺少项目ID'
        });
        return;
      }

      // 系统管理员拥有所有项目的权限
      if (req.auth?.role === 'admin' || req.auth?.roles?.includes('admin')) {
        next();
        return;
      }

      if (!userPhone) {
        res.status(401).json({
          code: 401,
          message: '无法获取用户信息'
        });
        return;
      }

      // 检查用户是否是该项目的指定角色
      const result = await query<{ id: string }>(
        `SELECT id FROM project_personnel
         WHERE project_id = $1
           AND user_phone = $2
           AND role = ANY($3)
           AND status = 'active'
         LIMIT 1`,
        [projectId, userPhone, allowedRoles]
      );

      if (result.rows.length === 0) {
        res.status(403).json({
          code: 403,
          message: '您没有该项目的操作权限'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('项目权限检查失败:', error);
      res.status(500).json({
        code: 500,
        message: '权限检查失败'
      });
    }
  };
};

export default {
  verifyToken,
  optionalAuth,
  requireRole,
  roles,
  checkProjectPermission
};
