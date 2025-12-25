/**
 * 认证中间件
 * 处理用户身份验证和权限控制
 */

const sessionStore = require('../services/sessionStore');

/**
 * 验证 Token 中间件
 * 检查请求头中的 Authorization token
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌'
    });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌格式错误'
    });
  }

  // 简单的 token 验证 (生产环境应使用 JWT)
  // 格式: token-{timestamp} 或 token-{timestamp}-{role}
  if (!token.startsWith('token-')) {
    return res.status(401).json({
      code: 401,
      message: '无效的认证令牌'
    });
  }

  // 解析 token 获取基本信息
  const parts = token.split('-');
  if (parts.length < 2) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌格式错误'
    });
  }

  // 检查 token 是否过期 (24小时有效期)
  const timestamp = parseInt(parts[1], 10);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (isNaN(timestamp) || now - timestamp > maxAge) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌已过期，请重新登录'
    });
  }

  // 从 sessionStore 获取会话信息
  const session = sessionStore.getSession(timestamp);

  // 将解析的信息附加到请求对象
  req.auth = {
    token,
    timestamp,
    role: parts[2] || null,
    phone: session?.phone || null,       // 新增：使用 phone
    username: session?.phone || null,    // 兼容：保留 username 字段
    name: session?.name || null,         // 新增：用户姓名
    roles: session?.roles || [],         // 新增：用户所有角色
  };

  next();
};

/**
 * 可选认证中间件
 * 如果有 token 则验证，没有则继续
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  verifyToken(req, res, next);
};

/**
 * 角色检查中间件工厂
 * @param {string[]} allowedRoles - 允许的角色列表
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        code: 401,
        message: '需要登录'
      });
    }

    // 如果 token 中没有角色信息，检查 session 中的角色
    const currentRole = req.auth.role;
    const userRoles = req.auth.roles || [];

    // 如果没有任何角色信息，暂时允许通过（兼容旧版本）
    if (!currentRole && userRoles.length === 0) {
      return next();
    }

    // 检查当前角色或用户拥有的任一角色是否在允许列表中
    const hasPermission =
      (currentRole && allowedRoles.includes(currentRole)) ||
      userRoles.some(r => allowedRoles.includes(r));

    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: '没有权限执行此操作'
      });
    }

    next();
  };
};

/**
 * 预定义的角色检查中间件
 * 新角色体系：admin, project_admin, data_collector, project_expert, decision_maker
 */
const roles = {
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

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
  roles
};
