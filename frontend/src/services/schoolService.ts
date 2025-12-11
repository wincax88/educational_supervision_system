import { get, post, put, del } from './api';

// 学校类型定义
export interface School {
  id: string;
  code: string;
  name: string;
  districtId: string;
  districtName?: string;
  districtCode?: string;
  schoolType: '小学' | '初中' | '九年一贯制' | '完全中学';
  schoolCategory: '公办' | '民办';
  urbanRural: '城区' | '镇区' | '乡村';
  address: string;
  principal: string;
  contactPhone: string;
  studentCount: number;
  teacherCount: number;
  studentTeacherRatio?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SchoolListResponse {
  list: School[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SchoolIndicatorData {
  id: string;
  dataIndicatorId: string;
  value: number | null;
  textValue: string | null;
  isCompliant: number | null;
  collectedAt: string;
  indicatorCode: string;
  indicatorName: string;
  threshold: string;
}

export interface SchoolCompliance {
  school: {
    id: string;
    name: string;
    schoolType: string;
    districtName: string;
  };
  statistics: {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  };
  complianceRate: string | null;
  nonCompliantIndicators: Array<{
    indicatorId: string;
    value: number;
    code: string;
    name: string;
    threshold: string;
  }>;
}

export interface SchoolImportResult {
  success: number;
  failed: number;
  errors: Array<{ code: string; error: string }>;
}

// 获取学校列表
export async function getSchools(params?: {
  districtId?: string;
  schoolType?: string;
  schoolCategory?: string;
  urbanRural?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<SchoolListResponse> {
  const queryParams: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams[key] = String(value);
      }
    });
  }
  return get<SchoolListResponse>('/schools', queryParams);
}

// 获取单个学校详情
export async function getSchool(id: string): Promise<School> {
  return get<School>(`/schools/${id}`);
}

// 创建学校
export async function createSchool(data: {
  code: string;
  name: string;
  districtId: string;
  schoolType: string;
  schoolCategory?: string;
  urbanRural?: string;
  address?: string;
  principal?: string;
  contactPhone?: string;
  studentCount?: number;
  teacherCount?: number;
}): Promise<{ id: string }> {
  return post<{ id: string }>('/schools', data);
}

// 更新学校
export async function updateSchool(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    districtId: string;
    schoolType: string;
    schoolCategory: string;
    urbanRural: string;
    address: string;
    principal: string;
    contactPhone: string;
    studentCount: number;
    teacherCount: number;
    status: string;
  }>
): Promise<void> {
  return put(`/schools/${id}`, data);
}

// 删除学校
export async function deleteSchool(id: string): Promise<void> {
  return del(`/schools/${id}`);
}

// 批量导入学校
export async function importSchools(schools: Array<{
  code: string;
  name: string;
  districtId: string;
  schoolType: string;
  schoolCategory?: string;
  urbanRural?: string;
  address?: string;
  principal?: string;
  contactPhone?: string;
  studentCount?: number;
  teacherCount?: number;
}>): Promise<SchoolImportResult> {
  return post<SchoolImportResult>('/schools/import', { schools });
}

// 获取学校的指标数据
export async function getSchoolIndicatorData(
  schoolId: string,
  projectId: string
): Promise<SchoolIndicatorData[]> {
  return get<SchoolIndicatorData[]>(`/schools/${schoolId}/indicator-data`, { projectId });
}

// 获取学校的达标情况
export async function getSchoolCompliance(
  schoolId: string,
  projectId: string
): Promise<SchoolCompliance> {
  return get<SchoolCompliance>(`/schools/${schoolId}/compliance`, { projectId });
}

// 获取学校类型选项
export async function getSchoolTypes(): Promise<Array<{ value: string; label: string }>> {
  return get<Array<{ value: string; label: string }>>('/school-types');
}

// 获取城乡类型选项
export async function getUrbanRuralTypes(): Promise<Array<{ value: string; label: string }>> {
  return get<Array<{ value: string; label: string }>>('/urban-rural-types');
}

// 学校类型常量
export const SCHOOL_TYPES = [
  { value: '小学', label: '小学' },
  { value: '初中', label: '初中' },
  { value: '九年一贯制', label: '九年一贯制' },
  { value: '完全中学', label: '完全中学' },
];

// 城乡类型常量
export const URBAN_RURAL_TYPES = [
  { value: '城区', label: '城区' },
  { value: '镇区', label: '镇区' },
  { value: '乡村', label: '乡村' },
];

// 办学性质常量
export const SCHOOL_CATEGORIES = [
  { value: '公办', label: '公办' },
  { value: '民办', label: '民办' },
];
