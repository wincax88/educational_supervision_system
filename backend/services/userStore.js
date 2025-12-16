/**
 * 用户存储（简化实现：内存存储）
 * - 供 /api/login 与 /api/users 共用
 * - 生产环境应改为数据库表或 Supabase Auth
 */

const nowDate = () => new Date().toISOString().split('T')[0];

/**
 * @typedef {'admin'|'project_manager'|'collector'|'expert'|'decision_maker'} UserRole
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
 * @property {UserRole} role
 * @property {string} roleName
 * @property {'active'|'inactive'} status
 * @property {ScopeItem[]} scopes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @type {Map<string, SysUser>} */
const userMap = new Map();

function seedIfEmpty() {
  if (userMap.size > 0) return;
  const ts = nowDate();
  const defaults = [
    { username: 'AAA', password: 'BBB', role: 'admin', roleName: '系统管理员', scopes: [{ type: 'city', id: 'shenyang', name: '沈阳市' }] },
    { username: '111', password: '222', role: 'project_manager', roleName: '项目管理员', scopes: [{ type: 'city', id: 'shenyang', name: '沈阳市' }] },
    { username: '333', password: '444', role: 'collector', roleName: '数据采集员', scopes: [] },
    { username: '555', password: '666', role: 'expert', roleName: '项目评估专家', scopes: [] },
    { username: '777', password: '888', role: 'decision_maker', roleName: '报告决策者', scopes: [] },
  ];
  defaults.forEach(u => {
    userMap.set(u.username, {
      ...u,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    });
  });
}

seedIfEmpty();

const validRoles = new Set(['admin', 'project_manager', 'collector', 'expert', 'decision_maker']);
const roleNameFallback = {
  admin: '系统管理员',
  project_manager: '项目管理员',
  collector: '数据采集员',
  expert: '评估专家',
  decision_maker: '报告决策者',
};

function listUsers({ keyword, role, status } = {}) {
  const kw = (keyword || '').trim().toLowerCase();
  let arr = Array.from(userMap.values()).map(u => ({ ...u }));
  if (kw) {
    arr = arr.filter(u =>
      u.username.toLowerCase().includes(kw) ||
      (u.roleName || '').toLowerCase().includes(kw)
    );
  }
  if (role) arr = arr.filter(u => u.role === role);
  if (status) arr = arr.filter(u => u.status === status);
  // admin 放在最前
  arr.sort((a, b) => (a.role === 'admin' ? -1 : 0) - (b.role === 'admin' ? -1 : 0));
  return arr;
}

function getUser(username) {
  return userMap.get(username) || null;
}

function createUser({ username, password, role, roleName, status, scopes } = {}) {
  const ts = nowDate();
  const u = (username || '').trim();
  if (!u) throw new Error('用户名为必填项');
  if (userMap.has(u)) throw new Error('用户名已存在');
  if (!password || String(password).length < 2) throw new Error('密码长度至少 2 位');
  if (!role || !validRoles.has(role)) throw new Error('无效的角色类型');

  const user = {
    username: u,
    password: String(password),
    role,
    roleName: (roleName || '').trim() || roleNameFallback[role] || role,
    status: status === 'inactive' ? 'inactive' : 'active',
    scopes: Array.isArray(scopes) ? scopes : [],
    createdAt: ts,
    updatedAt: ts,
  };
  userMap.set(u, user);
  return { ...user };
}

function updateUser(username, updates = {}) {
  const existing = userMap.get(username);
  if (!existing) throw new Error('用户不存在');
  if (existing.username === 'AAA' && updates.role && updates.role !== 'admin') {
    throw new Error('内置管理员账号不允许修改角色');
  }
  if (updates.role && !validRoles.has(updates.role)) throw new Error('无效的角色类型');
  if (updates.status && !['active', 'inactive'].includes(updates.status)) throw new Error('无效的状态');
  if (updates.password !== undefined && String(updates.password).length < 2) throw new Error('密码长度至少 2 位');

  const next = {
    ...existing,
    ...(updates.role !== undefined ? { role: updates.role } : {}),
    ...(updates.roleName !== undefined ? { roleName: String(updates.roleName) } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.password !== undefined ? { password: String(updates.password) } : {}),
    ...(updates.scopes !== undefined ? { scopes: Array.isArray(updates.scopes) ? updates.scopes : [] } : {}),
    updatedAt: nowDate(),
  };
  userMap.set(username, next);
  return { ...next };
}

function deleteUser(username) {
  if (username === 'AAA') throw new Error('内置管理员账号不允许删除');
  if (!userMap.has(username)) throw new Error('用户不存在');
  userMap.delete(username);
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


