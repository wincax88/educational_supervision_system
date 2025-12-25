import { get, post, put, del } from './api';

// 角色定义（新系统角色体系）：
// - admin: 系统管理员 - 系统全局管理，创建/维护工具模板、项目配置
// - project_admin: 项目管理员 - 项目级管理权限，管理项目人员和配置
// - data_collector: 数据采集员 - 数据采集和填报工作
// - project_expert: 项目专家 - 项目评估和审核工作
// - decision_maker: 决策者 - 查看决策报告和数据分析
export type UserRole = 'admin' | 'project_admin' | 'data_collector' | 'project_expert' | 'decision_maker';
export type UserStatus = 'active' | 'inactive';

export interface ScopeItem {
  type: 'city' | 'district' | 'school';
  id: string;
  name: string;
}

export interface SystemUser {
  phone: string;          // 手机号作为主键和登录账号
  password?: string;      // 密码（创建时需要，查询时不返回）
  name?: string;          // 用户姓名
  organization?: string;  // 所属单位
  idCard?: string;        // 身份证号
  roles: UserRole[];      // 角色数组
  status: UserStatus;     // 状态
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
  phone: string;
  password: string;
  name?: string;
  organization?: string;
  idCard?: string;
  roles: UserRole[];
  status?: UserStatus;
}): Promise<SystemUser> {
  return post<SystemUser>('/users', data);
}

export async function updateUser(
  phone: string,
  data: Partial<{
    password: string;
    name: string;
    organization: string;
    idCard: string;
    roles: UserRole[];
    status: UserStatus;
  }>
): Promise<SystemUser> {
  return put<SystemUser>(`/users/${encodeURIComponent(phone)}`, data);
}

export async function deleteUser(phone: string): Promise<void> {
  return del<void>(`/users/${encodeURIComponent(phone)}`);
}

// 批量导入用户
export interface ImportUserData {
  phone: string;
  password: string;
  name?: string;
  organization?: string;
  idCard?: string;
  roles?: UserRole[];
  status?: UserStatus;
}

export interface ImportError {
  phone?: string;
  error: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: (string | ImportError)[];
  created: string[];
}

export async function importUsers(users: ImportUserData[]): Promise<ImportResult> {
  return post<ImportResult>('/users/import', { users });
}

// 角色显示名称映射
export const roleDisplayNames: Record<UserRole, string> = {
  admin: '系统管理员',
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目专家',
  decision_maker: '决策者',
};

// 账号管理页面使用的角色选项
export const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '项目管理员', value: 'project_admin' },
  { label: '数据采集员', value: 'data_collector' },
  { label: '项目专家', value: 'project_expert' },
  { label: '决策者', value: 'decision_maker' },
];

// 所有角色选项（用于筛选等场景）
export const allRoleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '项目管理员', value: 'project_admin' },
  { label: '数据采集员', value: 'data_collector' },
  { label: '项目专家', value: 'project_expert' },
  { label: '决策者', value: 'decision_maker' },
];


