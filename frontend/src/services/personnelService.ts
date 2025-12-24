// 项目人员管理 API 服务

import { get, post, put, del } from './api';

// 角色定义
// | 角色 | 所属层级 | 可操作的采集工具 | 权限范围 |
// | 系统管理员 | 省级/国家级 | 所有工具模板 | 创建/维护工具模板、项目全局配置 |
// | 市级管理员 | 市级 | 查看工具、汇总报表 | 查看区县进度，不可编辑数据 |
// | 区县管理员 | 区县 | 表单审核工具、Excel汇总模板 | 审核本区县所有学校数据、退回修改 |
// | 学校填报员 | 学校 | 在线表单、Excel填报模板 | 仅编辑本校原始要素 |

// 人员角色类型（支持新旧两套角色体系）
export type PersonnelRole =
  // 新角色体系
  | 'project_admin'
  | 'data_collector'
  | 'project_expert'
  // 旧角色体系（兼容）
  | 'system_admin'
  | 'city_admin'
  | 'district_admin'
  | 'district_reporter'
  | 'school_reporter';

// 人员类型
export interface Personnel {
  id: string;
  projectId: string;
  name: string;
  organization: string;
  phone: string;
  idCard: string;
  role: PersonnelRole;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  districtId?: string;     // 关联区县ID（数据采集员使用）
  districtName?: string;   // 关联区县名称
}

// 人员统计类型（支持新旧两套角色体系）
export interface PersonnelStats {
  total: number;
  // 新角色体系
  project_admin?: number;
  data_collector?: number;
  project_expert?: number;
  // 旧角色体系
  system_admin?: number;
  city_admin?: number;
  district_admin?: number;
  district_reporter?: number;
  school_reporter?: number;
}

// 导入结果类型
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// 获取项目人员列表
export async function getPersonnel(
  projectId: string,
  params?: { role?: string; status?: string }
): Promise<Personnel[]> {
  return get<Personnel[]>(`/projects/${projectId}/personnel`, params as Record<string, string>);
}

// 获取单个人员
export async function getPersonnelById(projectId: string, id: string): Promise<Personnel> {
  return get<Personnel>(`/projects/${projectId}/personnel/${id}`);
}

// 添加人员
export async function addPersonnel(
  projectId: string,
  data: Partial<Personnel>
): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${projectId}/personnel`, data);
}

// 更新人员
export async function updatePersonnel(
  projectId: string,
  id: string,
  data: Partial<Personnel>
): Promise<void> {
  return put(`/projects/${projectId}/personnel/${id}`, data);
}

// 删除人员
export async function deletePersonnel(projectId: string, id: string): Promise<void> {
  return del(`/projects/${projectId}/personnel/${id}`);
}

// 批量导入人员
export async function importPersonnel(
  projectId: string,
  personnel: Array<Partial<Personnel>>
): Promise<ImportResult> {
  return post<ImportResult>(`/projects/${projectId}/personnel/import`, { personnel });
}

// 获取人员统计
export async function getPersonnelStats(projectId: string): Promise<PersonnelStats> {
  return get<PersonnelStats>(`/projects/${projectId}/personnel/stats`);
}

// 角色映射（支持新旧两套角色体系）
export const roleMap: Record<string, string> = {
  // 新角色体系
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目评估专家',
  // 旧角色体系
  system_admin: '系统管理员',
  city_admin: '市级管理员',
  district_admin: '区县管理员',
  district_reporter: '区县填报员',
  school_reporter: '学校填报员',
};

// 反向角色映射（支持新旧两套角色体系）
export const roleReverseMap: Record<string, string> = {
  // 新角色体系
  '项目管理员': 'project_admin',
  '数据采集员': 'data_collector',
  '项目评估专家': 'project_expert',
  // 旧角色体系
  '系统管理员': 'system_admin',
  '市级管理员': 'city_admin',
  '区县管理员': 'district_admin',
  '区县填报员': 'district_reporter',
  '学校填报员': 'school_reporter',
};
