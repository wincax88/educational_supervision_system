/**
 * 认证中间件
 * 处理用户身份验证和权限控制
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as sessionStore from '../services/sessionStore';

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

  // 将解析的信息附加到请求对象
  const session = sessionStore.getSession(timestamp);
  req.auth = {
    token,
    timestamp,
    role: parts[2] || null,
    phone: session?.phone || null,
    name: session?.name || null,
    roles: session?.roles || [],
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

export default {
  verifyToken,
  optionalAuth,
  requireRole,
  roles
};
