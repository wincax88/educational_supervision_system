/**
 * 简易会话存储（内存）
 * 目的：把 token 里的 timestamp 与实际登录用户绑定起来，从而让后端能识别"当前用户"。
 *
 * 为什么用 timestamp：
 * - token 格式固定为 token-{timestamp}-{role}
 * - 前端切换角色会在本地改 token 的 role 段，但 timestamp 不变
 * - 因此用 timestamp 作为会话 key，可以兼容 switchRole
 */

export interface SessionInfo {
  phone: string;
  name?: string | null;
  roles?: string[];
}

const sessions = new Map<number, SessionInfo>();

export function setSession(timestamp: number | string, info: Partial<SessionInfo>): void {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return;
  if (!info || !info.phone) return;
  sessions.set(ts, {
    phone: String(info.phone),
    name: info.name || null,
    roles: Array.isArray(info.roles) ? info.roles : undefined,
  });
}

export function getSession(timestamp: number | string): SessionInfo | null {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return null;
  return sessions.get(ts) || null;
}

export function deleteSession(timestamp: number | string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return sessions.delete(ts);
}

export default {
  setSession,
  getSession,
  deleteSession,
};
