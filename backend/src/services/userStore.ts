/**
 * 用户存储服务（数据库版本）
 * - 使用 PostgreSQL 数据库存储用户信息
 * - 手机号作为主键和登录账号
 * - 支持角色：admin, project_admin, data_collector, project_expert, decision_maker
 */

import * as bcrypt from 'bcrypt';

// 使用 require 兼容 CommonJS 模块
const db = require('../../database/db');

const SALT_ROUNDS = 10;

/**
 * 角色定义：
 * - admin: 系统管理员 - 系统全局配置、用户管理
 * - project_admin: 项目管理员 - 项目配置、人员管理、进度查看
 * - data_collector: 数据采集员 - 数据填报（需关联区县）
 * - project_expert: 项目评估专家 - 数据审核和评估
 * - decision_maker: 报告决策者 - 查看评估报告和决策结果
 */
export type UserRole = 'admin' | 'project_admin' | 'data_collector' | 'project_expert' | 'decision_maker';

export interface SysUser {
  phone: string;
  password: string;
  name: string | null;
  organization: string | null;
  id_card: string | null;
  roles: UserRole[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// 有效角色集合
const validRoles = new Set<UserRole>(['admin', 'project_admin', 'data_collector', 'project_expert', 'decision_maker']);

// 角色显示名称映射
export const roleDisplayNames: Record<UserRole, string> = {
  admin: '系统管理员',
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目评估专家',
  decision_maker: '报告决策者',
};

/**
 * 密码加密
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 密码验证
 */
async function comparePassword(password: string, hash: string): Promise<boolean> {
  // 支持明文密码（兼容迁移期间未加密的密码）
  if (!hash.startsWith('$2')) {
    return password === hash;
  }
  return bcrypt.compare(password, hash);
}

/**
 * 生成默认密码（手机号后6位）
 */
export function generateDefaultPassword(phone: string): string {
  return phone.slice(-6);
}

export interface ListUsersOptions {
  keyword?: string;
  role?: UserRole;
  status?: 'active' | 'inactive';
}

/**
 * 获取用户列表
 */
export async function listUsers(options: ListUsersOptions = {}): Promise<SysUser[]> {
  const { keyword, role, status } = options;

  let query = db.from('sys_users').select('*');

  if (status) {
    query = query.eq('status', status);
  }

  if (role) {
    query = query.contains('roles', [role]);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户列表失败:', error);
    throw new Error(error.message);
  }

  let users: SysUser[] = data || [];

  // 关键词搜索
  if (keyword) {
    const kw = keyword.toLowerCase();
    users = users.filter(u =>
      u.phone.toLowerCase().includes(kw) ||
      (u.name && u.name.toLowerCase().includes(kw)) ||
      (u.organization && u.organization.toLowerCase().includes(kw))
    );
  }

  return users;
}

/**
 * 获取单个用户
 */
export async function getUser(phone: string): Promise<SysUser | null> {
  const { data, error } = await db.from('sys_users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // 未找到
    }
    console.error('获取用户失败:', error);
    return null;
  }

  return data;
}

export interface CreateUserOptions {
  phone: string;
  password: string;
  name?: string;
  organization?: string;
  id_card?: string;
  roles: UserRole[];
  status?: 'active' | 'inactive';
}

/**
 * 创建用户
 */
export async function createUser(options: CreateUserOptions): Promise<SysUser> {
  const { phone, password, name, organization, id_card, roles, status } = options;

  if (!phone || phone.trim() === '') {
    throw new Error('手机号为必填项');
  }

  if (!password || password.length < 6) {
    throw new Error('密码长度至少6位');
  }

  // 检查用户是否已存在
  const existing = await getUser(phone);
  if (existing) {
    throw new Error('该手机号已注册');
  }

  // 验证角色
  const rolesArr = Array.isArray(roles) ? roles : [];
  if (rolesArr.length === 0) {
    throw new Error('请至少选择一个角色');
  }

  for (const r of rolesArr) {
    if (!validRoles.has(r as UserRole)) {
      throw new Error(`无效的角色类型: ${r}`);
    }
  }

  // 加密密码
  const hashedPassword = await hashPassword(password);

  const { data, error } = await db.from('sys_users')
    .insert({
      phone: phone.trim(),
      password: hashedPassword,
      name: name || null,
      organization: organization || null,
      id_card: id_card || null,
      roles: rolesArr,
      status: status || 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('创建用户失败:', error);
    throw new Error(error.message);
  }

  return data;
}

export interface UpdateUserOptions {
  password?: string;
  name?: string;
  organization?: string;
  id_card?: string;
  roles?: UserRole[];
  status?: 'active' | 'inactive';
}

/**
 * 更新用户
 */
export async function updateUser(phone: string, updates: UpdateUserOptions): Promise<SysUser> {
  const existing = await getUser(phone);
  if (!existing) {
    throw new Error('用户不存在');
  }

  const updateData: any = {};

  // 更新密码
  if (updates.password !== undefined) {
    if (updates.password.length < 6) {
      throw new Error('密码长度至少6位');
    }
    updateData.password = await hashPassword(updates.password);
  }

  // 更新角色
  if (updates.roles !== undefined) {
    const rolesArr = Array.isArray(updates.roles) ? updates.roles : [];

    // 内置管理员账号必须保留 admin 角色
    if (phone === '13800000000' && !rolesArr.includes('admin')) {
      throw new Error('内置管理员账号必须保留管理员角色');
    }

    if (rolesArr.length === 0) {
      throw new Error('请至少选择一个角色');
    }

    for (const r of rolesArr) {
      if (!validRoles.has(r as UserRole)) {
        throw new Error(`无效的角色类型: ${r}`);
      }
    }

    updateData.roles = rolesArr;
  }

  // 更新其他字段
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.organization !== undefined) updateData.organization = updates.organization;
  if (updates.id_card !== undefined) updateData.id_card = updates.id_card;
  if (updates.status !== undefined) {
    if (!['active', 'inactive'].includes(updates.status)) {
      throw new Error('无效的状态');
    }
    updateData.status = updates.status;
  }

  const { data, error } = await db.from('sys_users')
    .update(updateData)
    .eq('phone', phone)
    .select()
    .single();

  if (error) {
    console.error('更新用户失败:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * 删除用户
 */
export async function deleteUser(phone: string): Promise<boolean> {
  if (phone === '13800000000') {
    throw new Error('内置管理员账号不允许删除');
  }

  const existing = await getUser(phone);
  if (!existing) {
    throw new Error('用户不存在');
  }

  const { error } = await db.from('sys_users')
    .delete()
    .eq('phone', phone);

  if (error) {
    console.error('删除用户失败:', error);
    throw new Error(error.message);
  }

  return true;
}

/**
 * 验证登录凭据
 */
export async function verifyCredentials(phone: string, password: string): Promise<SysUser | null> {
  const user = await getUser(phone);
  if (!user) {
    console.log(`[verifyCredentials] 用户不存在: ${phone}`);
    return null;
  }

  if (user.status !== 'active') {
    console.log(`[verifyCredentials] 用户状态非激活: ${phone}, status: ${user.status}`);
    return null;
  }

  const match = await comparePassword(password, user.password);
  if (!match) {
    console.log(`[verifyCredentials] 密码不匹配: ${phone}`);
    return null;
  }

  // 返回用户信息（不含密码）
  return {
    ...user,
    password: '', // 不返回密码
  };
}

/**
 * 累加角色到用户
 * 如果用户已有该角色则不重复添加
 */
export async function addRoleToUser(phone: string, newRole: UserRole): Promise<SysUser> {
  const user = await getUser(phone);
  if (!user) {
    throw new Error('用户不存在');
  }

  if (!validRoles.has(newRole)) {
    throw new Error(`无效的角色类型: ${newRole}`);
  }

  const currentRoles = user.roles || [];

  // 如果角色已存在，直接返回
  if (currentRoles.includes(newRole)) {
    return user;
  }

  const newRoles = [...currentRoles, newRole];

  const { data, error } = await db.from('sys_users')
    .update({ roles: newRoles })
    .eq('phone', phone)
    .select()
    .single();

  if (error) {
    console.error('累加角色失败:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * 创建或更新用户（用于人员同步）
 * 如果用户存在则累加角色，不存在则创建
 */
export async function upsertUser(options: {
  phone: string;
  name?: string;
  organization?: string;
  id_card?: string;
  role: UserRole;
}): Promise<{ user: SysUser; created: boolean }> {
  const { phone, name, organization, id_card, role } = options;

  if (!phone || phone.trim() === '') {
    throw new Error('手机号为必填项');
  }

  if (!validRoles.has(role)) {
    throw new Error(`无效的角色类型: ${role}`);
  }

  const existing = await getUser(phone);

  if (existing) {
    // 用户已存在，累加角色
    const updatedUser = await addRoleToUser(phone, role);

    // 可选：更新空字段
    const updateData: any = {};
    if (!existing.name && name) updateData.name = name;
    if (!existing.organization && organization) updateData.organization = organization;
    if (!existing.id_card && id_card) updateData.id_card = id_card;

    if (Object.keys(updateData).length > 0) {
      await db.from('sys_users')
        .update(updateData)
        .eq('phone', phone);
    }

    return { user: updatedUser, created: false };
  } else {
    // 用户不存在，创建新用户
    const defaultPassword = generateDefaultPassword(phone);
    const newUser = await createUser({
      phone,
      password: defaultPassword,
      name,
      organization,
      id_card,
      roles: [role],
      status: 'active',
    });

    return { user: newUser, created: true };
  }
}

export const validRolesList = Array.from(validRoles) as UserRole[];

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  verifyCredentials,
  addRoleToUser,
  upsertUser,
  generateDefaultPassword,
  validRoles: validRolesList,
  roleDisplayNames,
};
