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
  username: string | null;
  scopes: unknown[] | null;
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
    username: session?.username || null,
    scopes: session?.scopes || null,
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

    // 如果 token 中没有角色信息，暂时允许通过
    // 生产环境应该从 JWT 中获取角色
    if (!req.auth.role) {
      next();
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
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
 */
export const roles = {
  // 管理员角色
  admin: requireRole(['admin']),

  // 项目管理员及以上
  projectManager: requireRole(['admin', 'project_manager', 'city_admin', 'district_admin']),

  // 数据采集员及以上
  collector: requireRole(['admin', 'project_manager', 'city_admin', 'district_admin', 'district_reporter', 'collector', 'school_reporter']),

  // 专家及以上
  expert: requireRole(['admin', 'project_manager', 'expert']),

  // 所有登录用户
  authenticated: requireRole([
    'admin',
    'project_manager',
    'city_admin',
    'district_admin',
    'district_reporter',
    'collector',
    'school_reporter',
    'expert',
    'decision_maker'
  ])
};

export default {
  verifyToken,
  optionalAuth,
  requireRole,
  roles
};
