import { get, post, put, del } from './api';

// 角色定义：
// - admin: 系统管理员（省级/国家级）- 创建/维护工具模板、项目全局配置
// - city_admin: 市级管理员 - 查看区县进度，不可编辑数据
// - district_admin: 区县管理员 - 审核本区县所有学校数据、退回修改
// - district_reporter: 区县填报员 - 填报区县级采集工具数据
// - school_reporter: 学校填报员 - 仅编辑本校原始要素
// - expert: 评估专家 - 参与评审/评估相关工作（用于专家账号管理）
export type UserRole = 'admin' | 'city_admin' | 'district_admin' | 'district_reporter' | 'school_reporter' | 'expert';
export type UserStatus = 'active' | 'inactive';

export interface ScopeItem {
  type: 'city' | 'district' | 'school';
  id: string;
  name: string;
}

export interface SystemUser {
  username: string;
  roles: UserRole[];  // 支持多角色
  status: UserStatus;
  scopes: ScopeItem[];
  createdAt: string;
  updatedAt: string;
}

export async function getUsers(params?: {
  keyword?: string;
  role?: UserRole | '';  // 按单个角色筛选
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
  roles: UserRole[];  // 支持多角色
  status?: UserStatus;
  scopes?: ScopeItem[];
}): Promise<SystemUser> {
  return post<SystemUser>('/users', data);
}

export async function updateUser(
  username: string,
  data: Partial<{
    password: string;
    roles: UserRole[];  // 支持多角色
    status: UserStatus;
    scopes: ScopeItem[];
  }>
): Promise<SystemUser> {
  return put<SystemUser>(`/users/${encodeURIComponent(username)}`, data);
}

export async function deleteUser(username: string): Promise<void> {
  return del<void>(`/users/${encodeURIComponent(username)}`);
}

// 批量导入用户
export interface ImportUserData {
  username: string;
  password: string;
  roles?: UserRole[];
  status?: UserStatus;
  scopes?: ScopeItem[];
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  created: string[];
}

export async function importUsers(users: ImportUserData[]): Promise<ImportResult> {
  return post<ImportResult>('/users/import', { users });
}

// 角色显示名称映射
export const roleDisplayNames: Record<UserRole, string> = {
  admin: '系统管理员',
  city_admin: '市级管理员',
  district_admin: '区县管理员',
  district_reporter: '区县填报员',
  school_reporter: '学校填报员',
  expert: '评估专家',
};

// 账号管理页面使用的角色选项
export const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员（省级/国家级）', value: 'admin' },
  { label: '市级管理员', value: 'city_admin' },
  { label: '区县管理员', value: 'district_admin' },
  { label: '区县填报员', value: 'district_reporter' },
  { label: '学校填报员', value: 'school_reporter' },
  { label: '评估专家', value: 'expert' },
];

// 所有角色选项（用于筛选等场景）
export const allRoleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '市级管理员', value: 'city_admin' },
  { label: '区县管理员', value: 'district_admin' },
  { label: '区县填报员', value: 'district_reporter' },
  { label: '学校填报员', value: 'school_reporter' },
  { label: '评估专家', value: 'expert' },
];


