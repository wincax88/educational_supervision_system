import { get, post, put, del } from './api';

export type UserRole = 'admin' | 'project_manager' | 'collector' | 'expert' | 'decision_maker';
export type UserStatus = 'active' | 'inactive';

export interface ScopeItem {
  type: 'city' | 'district' | 'school';
  id: string;
  name: string;
}

export interface SystemUser {
  username: string;
  role: UserRole;
  roleName: string;
  status: UserStatus;
  scopes: ScopeItem[];
  createdAt: string;
  updatedAt: string;
}

export async function getUsers(params?: {
  keyword?: string;
  role?: UserRole | '';
  status?: UserStatus | '';
}): Promise<SystemUser[]> {
  const cleaned: Record<string, string> = {};
  if (params?.keyword) cleaned.keyword = params.keyword;
  if (params?.role) cleaned.role = params.role;
  if (params?.status) cleaned.status = params.status;
  return get<SystemUser[]>('/users', cleaned);
}

export async function createUser(data: {
  username: string;
  password: string;
  role: UserRole;
  roleName?: string;
  status?: UserStatus;
  scopes?: ScopeItem[];
}): Promise<SystemUser> {
  return post<SystemUser>('/users', data);
}

export async function updateUser(
  username: string,
  data: Partial<{
    password: string;
    role: UserRole;
    roleName: string;
    status: UserStatus;
    scopes: ScopeItem[];
  }>
): Promise<SystemUser> {
  return put<SystemUser>(`/users/${encodeURIComponent(username)}`, data);
}

export async function deleteUser(username: string): Promise<void> {
  return del<void>(`/users/${encodeURIComponent(username)}`);
}

export const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '项目管理员', value: 'project_manager' },
  { label: '数据采集员', value: 'collector' },
  { label: '评估专家', value: 'expert' },
  { label: '报告决策者', value: 'decision_maker' },
];


