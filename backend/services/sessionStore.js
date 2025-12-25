/**
 * 简易会话存储（内存）
 * 目的：把 token 里的 timestamp 与实际登录用户绑定起来，从而让后端能识别"当前用户"。
 *
 * 为什么用 timestamp：
 * - token 格式固定为 token-{timestamp}-{role}
 * - 前端切换角色会在本地改 token 的 role 段，但 timestamp 不变
 * - 因此用 timestamp 作为会话 key，可以兼容 switchRole
 */

/** @typedef {{ phone?: string, name?: string, username?: string, roles?: string[], scopes?: any[] }} SessionInfo */

/** @type {Map<number, SessionInfo>} */
const sessions = new Map();

function setSession(timestamp, info) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return;
  // 支持新旧两种登录方式：phone/name（新）或 username（旧）
  if (!info || (!info.phone && !info.username)) return;
  sessions.set(ts, {
    phone: info.phone ? String(info.phone) : undefined,
    name: info.name ? String(info.name) : undefined,
    username: info.username ? String(info.username) : undefined,
    roles: Array.isArray(info.roles) ? info.roles : undefined,
    scopes: Array.isArray(info.scopes) ? info.scopes : undefined,
  });
}

function getSession(timestamp) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return null;
  return sessions.get(ts) || null;
}

function deleteSession(timestamp) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return sessions.delete(ts);
}

module.exports = {
  setSession,
  getSession,
  deleteSession,
};


