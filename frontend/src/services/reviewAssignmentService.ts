/**
 * 审核任务分配服务
 * 管理评审专家的审核任务分配
 */

import { get, post, del } from './api';

// ==================== 类型定义 ====================

/** 审核任务状态 */
export type ReviewAssignmentStatus = 'pending' | 'completed';

/** 审核结果 */
export type ReviewResult = 'approved' | 'rejected';

/** 审核范围类型 */
export type ScopeType = 'district' | 'school' | 'tool' | 'all';

/** 待分配的填报记录 */
export interface PendingSubmission {
  submissionId: string;
  formId: string;
  submitterName: string;
  submitterOrg: string;
  submittedAt: string;
  toolName: string;
  toolId: string;
  toolTarget?: string;
  assignmentStatus: 'unassigned' | 'assigned';
  currentReviewerId?: string;
  currentReviewerName?: string;
}

/** 审核任务分配 */
export interface ReviewAssignment {
  id: string;
  projectId: string;
  submissionId: string;
  reviewerId: string;
  reviewerName?: string;
  reviewerOrg?: string;
  status: ReviewAssignmentStatus;
  assignedAt: string;
  reviewedAt?: string;
  reviewResult?: ReviewResult;
  reviewComment?: string;
  // 填报记录信息
  submitterName?: string;
  submitterOrg?: string;
  submittedAt?: string;
  submissionStatus?: string;
  toolName?: string;
  toolId?: string;
}

/** 审核范围配置 */
export interface ReviewerScope {
  id: string;
  projectId: string;
  reviewerId: string;
  scopeType: ScopeType;
  scopeId?: string;
  scopeName?: string;
  createdAt?: string;
}

/** 审核统计 */
export interface ReviewAssignmentStats {
  total: number;
  unassigned: number;
  pending: number;
  completed: number;
  approved: number;
  rejected: number;
  byReviewer: Array<{
    reviewerId: string;
    reviewerName: string;
    total: number;
    completed: number;
    pending: number;
  }>;
}

// ==================== 审核任务分配 API ====================

/**
 * 获取待分配的填报记录
 */
export async function getPendingSubmissions(
  projectId: string,
  params?: { toolId?: string; districtId?: string; schoolId?: string }
): Promise<PendingSubmission[]> {
  return get<PendingSubmission[]>(
    `/projects/${projectId}/review-assignments/pending`,
    params as Record<string, string>
  );
}

/**
 * 获取已分配的审核任务列表
 */
export async function getReviewAssignments(
  projectId: string,
  params?: { reviewerId?: string; status?: ReviewAssignmentStatus }
): Promise<ReviewAssignment[]> {
  return get<ReviewAssignment[]>(
    `/projects/${projectId}/review-assignments`,
    params as Record<string, string>
  );
}

/**
 * 获取审核统计
 */
export async function getReviewStats(projectId: string): Promise<ReviewAssignmentStats> {
  return get<ReviewAssignmentStats>(`/projects/${projectId}/review-assignments/stats`);
}

/**
 * 手动分配审核任务
 */
export async function assignReviews(
  projectId: string,
  data: { submissionIds: string[]; reviewerId: string }
): Promise<{ assigned: number }> {
  return post<{ assigned: number }>(
    `/projects/${projectId}/review-assignments/assign`,
    data
  );
}

/**
 * 取消分配
 */
export async function cancelAssignment(projectId: string, assignmentId: string): Promise<void> {
  return del(`/projects/${projectId}/review-assignments/${assignmentId}`);
}

/**
 * 执行审核（通过/驳回）
 */
export async function submitReview(
  assignmentId: string,
  data: { result: ReviewResult; comment?: string }
): Promise<void> {
  return post(`/review-assignments/${assignmentId}/review`, data);
}

// ==================== 专家审核范围 API ====================

/**
 * 获取专家的审核范围
 */
export async function getReviewerScopes(
  projectId: string,
  reviewerId: string
): Promise<ReviewerScope[]> {
  return get<ReviewerScope[]>(`/projects/${projectId}/reviewers/${reviewerId}/scopes`);
}

/**
 * 设置专家的审核范围
 */
export async function setReviewerScopes(
  projectId: string,
  reviewerId: string,
  scopes: Array<{ scopeType: ScopeType; scopeId?: string }>
): Promise<void> {
  return post(`/projects/${projectId}/reviewers/${reviewerId}/scopes`, { scopes });
}

/**
 * 获取所有专家的审核范围
 */
export async function getAllReviewerScopes(projectId: string): Promise<ReviewerScope[]> {
  return get<ReviewerScope[]>(`/projects/${projectId}/reviewer-scopes`);
}

// ==================== 状态配置 ====================

export const reviewStatusConfig: Record<ReviewAssignmentStatus, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
};

export const reviewResultConfig: Record<ReviewResult, { text: string; color: string; icon?: string }> = {
  approved: { text: '通过', color: 'success' },
  rejected: { text: '驳回', color: 'error' },
};

export const scopeTypeConfig: Record<ScopeType, string> = {
  district: '区县',
  school: '学校',
  tool: '工具',
  all: '全部',
};
