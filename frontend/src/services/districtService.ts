import { get, post, put, del } from './api';

// 区县类型定义
export interface District {
  id: string;
  code: string;
  name: string;
  type: '市辖区' | '县' | '县级市';
  parentCode?: string;
  sortOrder: number;
  schoolCount?: number;
  createdAt: string;
  updatedAt: string;
  statistics?: DistrictStatistics;
}

export interface DistrictStatistics {
  totalSchools: number;
  primarySchools: number;
  middleSchools: number;
  nineYearSchools: number;
  totalStudents: number;
  totalTeachers: number;
}

export interface DistrictSummary {
  cityTotal: {
    districtCount: number;
    schoolCount: number;
    studentCount: number;
    teacherCount: number;
  };
  districts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    schoolCount: number;
    primarySchoolCount: number;
    middleSchoolCount: number;
    studentCount: number;
    teacherCount: number;
  }>;
}

export interface DistrictDetailStats {
  district: { id: string; name: string };
  total: {
    totalSchools: number;
    totalStudents: number;
    totalTeachers: number;
    avgStudentTeacherRatio: number;
  };
  bySchoolType: Array<{ type: string; count: number; students: number; teachers: number }>;
  byUrbanRural: Array<{ type: string; count: number }>;
  byCategory: Array<{ type: string; count: number }>;
}

// 获取区县列表
export async function getDistricts(params?: {
  type?: string;
  keyword?: string;
}): Promise<District[]> {
  return get<District[]>('/districts', params as Record<string, string>);
}

// 获取单个区县详情
export async function getDistrict(id: string): Promise<District> {
  return get<District>(`/districts/${id}`);
}

// 创建区县
export async function createDistrict(data: {
  code: string;
  name: string;
  type?: string;
  parentCode?: string;
  sortOrder?: number;
}): Promise<{ id: string }> {
  return post<{ id: string }>('/districts', data);
}

// 更新区县
export async function updateDistrict(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    type: string;
    parentCode: string;
    sortOrder: number;
  }>
): Promise<void> {
  return put(`/districts/${id}`, data);
}

// 删除区县
export async function deleteDistrict(id: string): Promise<void> {
  return del(`/districts/${id}`);
}

// 获取区县下的学校列表
export async function getDistrictSchools(
  districtId: string,
  params?: {
    schoolType?: string;
    urbanRural?: string;
    keyword?: string;
    status?: string;
  }
): Promise<School[]> {
  return get<School[]>(`/districts/${districtId}/schools`, params as Record<string, string>);
}

// 获取区县统计数据
export async function getDistrictStatistics(id: string): Promise<DistrictDetailStats> {
  return get<DistrictDetailStats>(`/districts/${id}/statistics`);
}

// 获取所有区县汇总
export async function getDistrictsSummary(): Promise<DistrictSummary> {
  return get<DistrictSummary>('/districts-summary');
}

// 学校类型（从 schoolService 导入的类型，这里重新定义以避免循环依赖）
interface School {
  id: string;
  code: string;
  name: string;
  schoolType: string;
  schoolCategory: string;
  urbanRural: string;
  address: string;
  principal: string;
  contactPhone: string;
  studentCount: number;
  teacherCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
