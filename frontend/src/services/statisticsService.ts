import { get, post } from './api';

// 差异系数分析结果
export interface CVAnalysis {
  district: {
    id: string;
    name: string;
  };
  schoolType: string;
  schoolCount: number;
  cvIndicators: Record<string, {
    cv: number;
    mean: number;
    stdDev: number;
    count: number;
    name?: string;
  }>;
  cvComposite: number | null;
  threshold: number;
  isCompliant: boolean | null;
}

// 差异系数汇总
export interface CVSummary {
  cityTotal: {
    districtCount: number;
    compliantCount: number;
    avgCV: number | null;
  };
  districts: Array<{
    districtId: string;
    districtName: string;
    districtCode: string;
    schoolCount: number;
    cvComposite: number | null;
    threshold: number;
    isCompliant: boolean | null;
  }>;
}

// 达标率统计
export interface ComplianceStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  complianceRate: number | null;
}

// 类别达标率
export interface CategoryCompliance {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  total: number;
  compliant: number;
  complianceRate: number | null;
}

// 区县对比数据
export interface DistrictComparisonItem {
  districtId: string;
  districtName: string;
  districtCode: string;
  schoolCount: number;
  cvComposite: number | null;
  isCvCompliant: boolean | null;
  complianceRate: number | null;
  compliantCount: number;
  totalIndicators: number;
}

// 城乡对比数据
export interface UrbanRuralComparison {
  urbanRuralType: string;
  schoolCount: number;
  avgStudentTeacherRatio: number | null;
  cvStudentTeacherRatio: number | null;
}

// ==================== 差异系数分析 ====================

// 获取区县差异系数分析
export async function getCVAnalysis(
  projectId: string,
  districtId: string,
  schoolType?: string
): Promise<CVAnalysis> {
  const params: Record<string, string> = { districtId };
  if (schoolType) params.schoolType = schoolType;
  return get<CVAnalysis>(`/projects/${projectId}/cv-analysis`, params);
}

// 获取所有区县差异系数汇总
export async function getCVSummary(
  projectId: string,
  schoolType?: string
): Promise<CVSummary> {
  const params: Record<string, string> = {};
  if (schoolType) params.schoolType = schoolType;
  return get<CVSummary>(`/projects/${projectId}/cv-summary`, params);
}

// ==================== 达标率统计 ====================

// 获取达标率统计
export async function getComplianceSummary(
  projectId: string,
  options?: { districtId?: string; schoolId?: string }
): Promise<ComplianceStats> {
  return get<ComplianceStats>(`/projects/${projectId}/compliance-summary`, options as Record<string, string>);
}

// 获取各类别达标率
export async function getComplianceByCategory(
  projectId: string,
  districtId?: string
): Promise<CategoryCompliance[]> {
  const params: Record<string, string> = {};
  if (districtId) params.districtId = districtId;
  return get<CategoryCompliance[]>(`/projects/${projectId}/compliance-by-category`, params);
}

// ==================== 对比分析 ====================

// 获取区县对比数据
export async function getDistrictComparison(
  projectId: string,
  schoolType?: string
): Promise<DistrictComparisonItem[]> {
  const params: Record<string, string> = {};
  if (schoolType) params.schoolType = schoolType;
  return get<DistrictComparisonItem[]>(`/projects/${projectId}/district-comparison`, params);
}

// 获取城乡对比数据
export async function getUrbanRuralComparison(
  projectId: string,
  districtId?: string
): Promise<UrbanRuralComparison[]> {
  const params: Record<string, string> = {};
  if (districtId) params.districtId = districtId;
  return get<UrbanRuralComparison[]>(`/projects/${projectId}/urban-rural-comparison`, params);
}

// ==================== 统计快照 ====================

// 刷新区县统计
export async function refreshStatistics(
  projectId: string,
  districtId?: string,
  schoolType?: string
): Promise<void> {
  return post(`/projects/${projectId}/refresh-statistics`, { districtId, schoolType });
}

// 获取区县统计快照
export async function getDistrictStatistics(
  projectId: string,
  options?: { districtId?: string; schoolType?: string }
): Promise<Array<{
  id: string;
  project_id: string;
  district_id: string;
  district_name: string;
  district_code: string;
  school_type: string;
  school_count: number;
  cv_composite: number | null;
  is_cv_compliant: number | null;
  resource_compliance_rate: number | null;
  calculated_at: string;
}>> {
  return get(`/projects/${projectId}/district-statistics`, options as Record<string, string>);
}

// ==================== 学校指标数据 ====================

// 保存学校指标数据
export async function saveSchoolIndicatorData(data: {
  projectId: string;
  schoolId: string;
  dataIndicatorId: string;
  value?: number;
  textValue?: string;
  submissionId?: string;
}): Promise<void> {
  return post('/school-indicator-data', data);
}

// 批量保存学校指标数据
export async function saveSchoolIndicatorDataBatch(data: {
  projectId: string;
  schoolId: string;
  submissionId?: string;
  data: Array<{
    dataIndicatorId: string;
    value?: number;
    textValue?: string;
  }>;
}): Promise<void> {
  return post('/school-indicator-data/batch', data);
}
