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

// 学校指标汇总
export interface SchoolIndicatorSummary {
  school: {
    id: string;
    code: string;
    name: string;
    schoolType: string;
    schoolCategory: string;
    urbanRural: string;
    studentCount: number;
    teacherCount: number;
    studentTeacherRatio: number | null;
  };
  statistics: {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  };
  complianceRate: number | null;
  nonCompliantIndicators: Array<{
    data_indicator_id: string;
    value: number | null;
    text_value: string | null;
    indicatorCode: string;
    indicatorName: string;
    threshold: string;
  }>;
}

// 区县学校指标汇总响应
export interface DistrictSchoolsIndicatorSummary {
  district: {
    id: string;
    name: string;
    code: string;
  };
  summary: {
    schoolCount: number;
    totalIndicators: number;
    totalCompliant: number;
    totalNonCompliant: number;
    avgComplianceRate: number | null;
  };
  schools: SchoolIndicatorSummary[];
}

// 学校详细指标数据
export interface SchoolIndicatorDetail {
  school: {
    id: string;
    code: string;
    name: string;
    schoolType: string;
    studentCount: number;
    teacherCount: number;
    districtId: string;
    districtName: string;
  };
  statistics: {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  };
  complianceRate: number | null;
  indicators: Array<{
    id: string;
    dataIndicatorId: string;
    value: number | null;
    textValue: string | null;
    isCompliant: number | null;
    collectedAt: string;
    submissionId: string | null;
    indicatorCode: string;
    indicatorName: string;
    threshold: string;
    indicatorDescription: string;
  }>;
}

// 区县填报记录
export interface DistrictSubmission {
  id: string;
  projectId: string;
  formId: string;
  schoolId: string;
  submitterId: string;
  submitterName: string;
  submitterOrg: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  formName: string;
  schoolName: string;
  schoolCode: string;
  schoolType: string;
}

// 区县填报记录响应
export interface DistrictSubmissionsResponse {
  district: {
    id: string;
    name: string;
  };
  stats: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  submissions: DistrictSubmission[];
}

// 获取区县下所有学校的指标汇总
export async function getDistrictSchoolsIndicatorSummary(
  districtId: string,
  projectId: string,
  schoolType?: string
): Promise<DistrictSchoolsIndicatorSummary> {
  const params: Record<string, string> = { projectId };
  if (schoolType) params.schoolType = schoolType;
  return get<DistrictSchoolsIndicatorSummary>(`/districts/${districtId}/schools-indicator-summary`, params);
}

// 获取单个学校的详细指标数据
export async function getSchoolIndicatorDetail(
  schoolId: string,
  projectId: string
): Promise<SchoolIndicatorDetail> {
  // 后端返回完整的学校+指标数据结构
  const response = await get<{
    school: {
      id: string;
      code: string;
      name: string;
      schoolType: string;
      studentCount: number;
      teacherCount: number;
      districtId: string;
      districtName?: string;
    };
    statistics: {
      total: number;
      compliant: number;
      nonCompliant: number;
      pending: number;
    };
    complianceRate: number | null;
    indicators: Array<{
      id: string;
      dataIndicatorId: string;
      value: number | null;
      textValue: string | null;
      isCompliant: number | null;
      collectedAt: string;
      indicatorCode: string;
      indicatorName: string;
      threshold: string;
      indicatorDescription?: string;
      submissionId?: string | null;
    }>;
  }>(`/schools/${schoolId}/indicator-data`, { projectId });

  // 直接返回后端返回的数据结构
  return {
    school: {
      id: response.school.id,
      code: response.school.code,
      name: response.school.name,
      schoolType: response.school.schoolType,
      studentCount: response.school.studentCount,
      teacherCount: response.school.teacherCount,
      districtId: response.school.districtId,
      districtName: response.school.districtName || ''
    },
    statistics: response.statistics,
    complianceRate: response.complianceRate,
    indicators: response.indicators.map(indicator => ({
      id: indicator.id,
      dataIndicatorId: indicator.dataIndicatorId,
      value: indicator.value,
      textValue: indicator.textValue,
      isCompliant: indicator.isCompliant,
      collectedAt: indicator.collectedAt,
      submissionId: indicator.submissionId || null,
      indicatorCode: indicator.indicatorCode,
      indicatorName: indicator.indicatorName,
      threshold: indicator.threshold,
      indicatorDescription: indicator.indicatorDescription || ''
    }))
  };
}

// 获取区县下所有学校的填报记录
export async function getDistrictSubmissions(
  districtId: string,
  projectId?: string,
  filters?: {
    schoolId?: string;
    formId?: string;
    status?: string;
  }
): Promise<DistrictSubmissionsResponse> {
  const params: Record<string, string> = {};
  if (projectId) params.projectId = projectId;
  if (filters?.schoolId) params.schoolId = filters.schoolId;
  if (filters?.formId) params.formId = filters.formId;
  if (filters?.status) params.status = filters.status;
  return get<DistrictSubmissionsResponse>(`/districts/${districtId}/submissions`, params);
}

// 差异系数指标项
export interface CVIndicatorItem {
  cv: number | null;
  mean: number;
  stdDev: number;
  count: number;
}

// 区县差异系数响应
export interface DistrictCVData {
  district: {
    id: string;
    name: string;
  };
  schoolType: string;
  schoolCount: number;
  cvIndicators: {
    studentTeacherRatio?: CVIndicatorItem | null;
    [key: string]: CVIndicatorItem | null | undefined;
  };
  cvComposite: number | null;
  threshold: number;
  isCompliant: boolean | null;
}

// 获取区县差异系数
export async function getDistrictCV(
  districtId: string,
  projectId: string,
  schoolType?: string
): Promise<DistrictCVData> {
  const params: Record<string, string> = { projectId };
  if (schoolType) params.schoolType = schoolType;
  return get<DistrictCVData>(`/districts/${districtId}/cv`, params);
}
