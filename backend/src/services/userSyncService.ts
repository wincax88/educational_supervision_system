/**
 * 用户同步服务
 * 负责项目人员与系统用户之间的同步
 *
 * 同步规则：
 * 1. 添加项目人员时，如果系统用户不存在则创建，存在则累加角色
 * 2. 批量导入项目人员时，批量同步到系统用户
 * 3. 默认密码为手机号后6位
 */

import userStore, { UserRole, SysUser } from './userStore';

// 项目角色到系统角色的映射
const ROLE_MAPPING: Record<string, UserRole | null> = {
  // 新角色体系
  project_admin: 'project_admin',
  data_collector: 'data_collector',
  project_expert: 'project_expert',

  // 旧角色体系（向后兼容）
  district_admin: 'project_admin',
  district_reporter: 'data_collector',
  school_reporter: 'data_collector',
  city_admin: 'project_admin',
  system_admin: 'admin',
};

export interface PersonnelData {
  phone: string;
  name?: string;
  organization?: string;
  idCard?: string;
  role: string;
}

export interface SyncResult {
  success: boolean;
  user?: SysUser;
  created: boolean;
  error?: string;
}

export interface BatchSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    phone: string;
    error: string;
  }>;
}

/**
 * 同步单个项目人员到系统用户
 * @param personnel 项目人员数据
 * @returns 同步结果
 */
export async function syncPersonnelToSysUser(personnel: PersonnelData): Promise<SyncResult> {
  const { phone, name, organization, idCard, role } = personnel;

  // 验证手机号
  if (!phone || phone.trim() === '') {
    return {
      success: false,
      created: false,
      error: '手机号为必填项',
    };
  }

  // 验证手机号格式（至少6位用于生成密码）
  if (phone.length < 6) {
    return {
      success: false,
      created: false,
      error: '手机号格式不正确（至少6位）',
    };
  }

  // 获取对应的系统角色
  const sysRole = ROLE_MAPPING[role];
  if (!sysRole) {
    // 非需要同步的角色，跳过
    return {
      success: true,
      created: false,
      error: `角色 ${role} 不需要同步到系统用户`,
    };
  }

  try {
    const result = await userStore.upsertUser({
      phone: phone.trim(),
      name: name || undefined,
      organization: organization || undefined,
      id_card: idCard || undefined,
      role: sysRole,
    });

    return {
      success: true,
      user: result.user,
      created: result.created,
    };
  } catch (error: any) {
    console.error('同步用户失败:', error);
    return {
      success: false,
      created: false,
      error: error.message || '同步失败',
    };
  }
}

/**
 * 批量同步项目人员到系统用户
 * @param personnelList 项目人员列表
 * @returns 批量同步结果
 */
export async function batchSyncPersonnelToSysUsers(personnelList: PersonnelData[]): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const personnel of personnelList) {
    // 跳过无效数据
    if (!personnel.phone || personnel.phone.trim() === '') {
      result.skipped++;
      continue;
    }

    // 获取对应的系统角色
    const sysRole = ROLE_MAPPING[personnel.role];
    if (!sysRole) {
      // 非需要同步的角色
      result.skipped++;
      continue;
    }

    try {
      const syncResult = await syncPersonnelToSysUser(personnel);

      if (syncResult.success) {
        if (syncResult.created) {
          result.created++;
        } else if (syncResult.user) {
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        result.errors.push({
          phone: personnel.phone,
          error: syncResult.error || '未知错误',
        });
      }
    } catch (error: any) {
      result.errors.push({
        phone: personnel.phone,
        error: error.message || '同步失败',
      });
    }
  }

  return result;
}

/**
 * 检查手机号是否已存在系统用户
 * @param phone 手机号
 * @returns 是否存在
 */
export async function checkUserExists(phone: string): Promise<boolean> {
  if (!phone) return false;
  const user = await userStore.getUser(phone);
  return user !== null;
}

/**
 * 获取项目角色对应的系统角色
 * @param projectRole 项目角色
 * @returns 系统角色或 null
 */
export function getSystemRole(projectRole: string): UserRole | null {
  return ROLE_MAPPING[projectRole] || null;
}

/**
 * 检查角色是否需要同步到系统用户
 * @param role 项目角色
 * @returns 是否需要同步
 */
export function shouldSyncRole(role: string): boolean {
  return ROLE_MAPPING[role] !== undefined && ROLE_MAPPING[role] !== null;
}

export default {
  syncPersonnelToSysUser,
  batchSyncPersonnelToSysUsers,
  checkUserExists,
  getSystemRole,
  shouldSyncRole,
};
