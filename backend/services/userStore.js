/**
 * 用户存储（简化实现：内存存储）
 * - 供 /api/login 与 /api/users 共用
 * - 生产环境应改为数据库表或 Supabase Auth
 */

const fs = require('fs');
const path = require('path');

const nowDate = () => new Date().toISOString().split('T')[0];

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'userStore.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    const payload = {
      updatedAt: new Date().toISOString(),
      users: Array.from(userMap.values()),
    };
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
  } catch {
    // ignore: 不阻断主流程
  }
}

/**
 * 角色定义：
 * - admin: 系统管理员（省级/国家级）- 创建/维护工具模板、项目全局配置
 * - city_admin: 市级管理员 - 查看区县进度，不可编辑数据
 * - district_admin: 区县管理员 - 审核本区县所有学校数据、退回修改
 * - school_reporter: 学校填报员 - 仅编辑本校原始要素
 * - expert: 评估专家 - 参与评审/评估相关工作（用于专家账号管理）
 * @typedef {'admin'|'city_admin'|'district_admin'|'school_reporter'|'expert'} UserRole
 */

/**
 * @typedef {Object} ScopeItem
 * @property {'city'|'district'|'school'} type
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} SysUser
 * @property {string} username
 * @property {string} password
 * @property {UserRole[]} roles - 角色数组，支持多角色
 * @property {'active'|'inactive'} status
 * @property {ScopeItem[]} scopes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @type {Map<string, SysUser>} */
const userMap = new Map();

function seedIfEmpty() {
  // 优先从磁盘加载，避免开发环境重启导致用户/角色丢失
  const disk = loadFromDisk();
  if (disk && Array.isArray(disk.users) && disk.users.length > 0) {
    disk.users.forEach((u) => {
      if (u && u.username) userMap.set(u.username, u);
    });
    return;
  }

  if (userMap.size > 0) return;
  const ts = nowDate();
  const defaults = [
    { username: 'AAA', password: 'BBB', roles: ['admin'], scopes: [{ type: 'city', id: 'shenyang', name: '沈阳市' }] },
    { username: '111', password: '222', roles: ['city_admin'], scopes: [{ type: 'city', id: 'shenyang', name: '沈阳市' }] },
    { username: '333', password: '444', roles: ['district_admin'], scopes: [{ type: 'district', id: 'd-001', name: '和平区' }] },
    { username: '555', password: '666', roles: ['school_reporter'], scopes: [{ type: 'school', id: 'school1', name: '第一小学' }] },
  ];
  defaults.forEach(u => {
    userMap.set(u.username, {
      ...u,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    });
  });

  // 初始化落盘，方便后续更新持久化
  saveToDisk();
}

seedIfEmpty();

const validRoles = new Set(['admin', 'city_admin', 'district_admin', 'school_reporter']);
validRoles.add('expert');

// 角色显示名称映射
const roleDisplayNames = {
  admin: '系统管理员',
  city_admin: '市级管理员',
  district_admin: '区县管理员',
  school_reporter: '学校填报员',
  expert: '评估专家',
};

function normalizeRole(role) {
  return String(role ?? '').trim();
}

function listUsers({ keyword, role, status } = {}) {
  const kw = (keyword || '').trim().toLowerCase();
  let arr = Array.from(userMap.values()).map(u => ({ ...u }));
  if (kw) {
    arr = arr.filter(u =>
      u.username.toLowerCase().includes(kw) ||
      (u.roles || []).some(r => (roleDisplayNames[r] || '').toLowerCase().includes(kw))
    );
  }
  // 支持按单个角色筛选
  if (role) arr = arr.filter(u => (u.roles || []).includes(role));
  if (status) arr = arr.filter(u => u.status === status);
  // admin 放在最前
  arr.sort((a, b) => ((a.roles || []).includes('admin') ? -1 : 0) - ((b.roles || []).includes('admin') ? -1 : 0));
  return arr;
}

function getUser(username) {
  return userMap.get(username) || null;
}

function createUser({ username, password, roles, status, scopes } = {}) {
  const ts = nowDate();
  const u = (username || '').trim();
  if (!u) throw new Error('用户名为必填项');
  if (userMap.has(u)) throw new Error('用户名已存在');
  if (!password || String(password).length < 2) throw new Error('密码长度至少 2 位');

  // 验证角色数组
  const rolesArr = (Array.isArray(roles) ? roles : []).map(normalizeRole).filter(Boolean);
  if (rolesArr.length === 0) throw new Error('请至少选择一个角色');
  for (const r of rolesArr) {
    if (!validRoles.has(r)) throw new Error(`无效的角色类型: ${r}`);
  }

  const user = {
    username: u,
    password: String(password),
    roles: rolesArr,
    status: status === 'inactive' ? 'inactive' : 'active',
    scopes: Array.isArray(scopes) ? scopes : [],
    createdAt: ts,
    updatedAt: ts,
  };
  userMap.set(u, user);
  saveToDisk();
  return { ...user };
}

function updateUser(username, updates = {}) {
  const existing = userMap.get(username);
  if (!existing) throw new Error('用户不存在');

  // 验证角色数组
  if (updates.roles !== undefined) {
    const rolesArr = (Array.isArray(updates.roles) ? updates.roles : []).map(normalizeRole).filter(Boolean);
    // 内置管理员账号必须保留 admin 角色
    if (existing.username === 'AAA' && !rolesArr.includes('admin')) {
      throw new Error('内置管理员账号必须保留管理员角色');
    }
    if (rolesArr.length === 0) throw new Error('请至少选择一个角色');
    for (const r of rolesArr) {
      if (!validRoles.has(r)) throw new Error(`无效的角色类型: ${r}`);
    }
  }

  if (updates.status && !['active', 'inactive'].includes(updates.status)) throw new Error('无效的状态');
  if (updates.password !== undefined && String(updates.password).length < 2) throw new Error('密码长度至少 2 位');

  const next = {
    ...existing,
    ...(updates.roles !== undefined
      ? { roles: (Array.isArray(updates.roles) ? updates.roles : []).map(normalizeRole).filter(Boolean) }
      : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.password !== undefined ? { password: String(updates.password) } : {}),
    ...(updates.scopes !== undefined ? { scopes: Array.isArray(updates.scopes) ? updates.scopes : [] } : {}),
    updatedAt: nowDate(),
  };
  userMap.set(username, next);
  saveToDisk();
  return { ...next };
}

function deleteUser(username) {
  if (username === 'AAA') throw new Error('内置管理员账号不允许删除');
  if (!userMap.has(username)) throw new Error('用户不存在');
  userMap.delete(username);
  saveToDisk();
  return true;
}

function verifyCredentials(username, password) {
  const u = userMap.get(username);
  if (!u) return null;
  if (u.status !== 'active') return null;
  if (u.password !== password) return null;
  return { ...u };
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  verifyCredentials,
  validRoles: Array.from(validRoles),
};


