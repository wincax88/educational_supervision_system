// 任务分配 API 服务

import { get, post, put, del } from './api';

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'rejected';

// 任务分配类型
export interface Task {
  id: string;
  projectId: string;
  toolId: string;
  toolName?: string;
  toolType?: string;
  toolTarget?: string;  // 工具目标对象（学校、区县等）
  assigneeId: string;
  assigneeName?: string;
  assigneeOrg?: string;
  assigneeDistrict?: string;  // 采集员负责的区县名称
  targetType?: 'district' | 'school' | 'all';
  targetId?: string;
  targetName?: string;
  status: TaskStatus;
  dueDate?: string;
  submissionId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 任务统计类型
export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  rejected: number;
  completionRate: number;
}

// 批量分配参数
export interface BatchAssignParams {
  projectId: string;
  toolId: string;
  assigneeIds: string[];
  targetType?: 'district' | 'school' | 'all';
  targetIds?: string[];
  dueDate?: string;
}

// 获取项目任务列表
export async function getProjectTasks(
  projectId: string,
  params?: {
    toolId?: string;
    assigneeId?: string;
    status?: TaskStatus;
  }
): Promise<Task[]> {
  return get<Task[]>(`/projects/${projectId}/tasks`, params as Record<string, string>);
}

// 获取单个任务详情
export async function getTask(taskId: string): Promise<Task> {
  return get<Task>(`/tasks/${taskId}`);
}

// 创建任务分配
export async function createTask(data: {
  projectId: string;
  toolId: string;
  assigneeId: string;
  targetType?: 'district' | 'school' | 'all';
  targetId?: string;
  dueDate?: string;
  // 新增字段
  requiresReview?: boolean;  // 是否需要审核
  accessUrl?: string;        // 访问地址（问卷类型）
  accessMode?: 'anonymous' | 'login';  // 访问模式：匿名/需要登录
}): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${data.projectId}/tasks`, data);
}

// 批量创建任务
export async function batchCreateTasks(params: BatchAssignParams): Promise<{ created: number }> {
  return post<{ created: number }>(`/projects/${params.projectId}/tasks/batch`, params);
}

// 更新任务
export async function updateTask(
  taskId: string,
  data: Partial<Pick<Task, 'status' | 'dueDate' | 'assigneeId'>>
): Promise<void> {
  return put(`/tasks/${taskId}`, data);
}

// 删除任务
export async function deleteTask(taskId: string): Promise<void> {
  return del(`/tasks/${taskId}`);
}

// 批量删除任务
export async function batchDeleteTasks(taskIds: string[]): Promise<{ deleted: number }> {
  return post<{ deleted: number }>('/tasks/batch-delete', { taskIds });
}

// 按 target_id 删除任务（删除评估对象时同步删除相关任务）
export async function deleteTasksByTarget(projectId: string, targetId: string): Promise<{ deleted: number }> {
  return del<{ deleted: number }>(`/projects/${projectId}/tasks/by-target/${targetId}`);
}

// 获取任务统计
export async function getTaskStats(projectId: string): Promise<TaskStats> {
  return get<TaskStats>(`/projects/${projectId}/tasks/stats`);
}

// 获取采集员的任务列表
export async function getMyTasks(params?: {
  projectId?: string;
  status?: TaskStatus;
  /** 可选：当前选中的范围（用于 school_reporter / district_admin 多范围场景，避免看起来"重复"） */
  scopeType?: 'city' | 'district' | 'school';
  scopeId?: string;
  /** 可选：是否包含下属学校的任务（仅对区县填报员有效） */
  includeSubSchools?: boolean;
}): Promise<Task[]> {
  const queryParams: Record<string, string> = {};
  if (params) {
    if (params.projectId) queryParams.projectId = params.projectId;
    if (params.status) queryParams.status = params.status;
    if (params.scopeType) queryParams.scopeType = params.scopeType;
    if (params.scopeId) queryParams.scopeId = params.scopeId;
    if (params.includeSubSchools) queryParams.includeSubSchools = 'true';
  }
  return get<Task[]>('/my/tasks', queryParams);
}

// 我的项目类型
export interface MyProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  indicatorSystemId?: string;
  indicatorSystemName?: string;
  totalTasks: number;
  completedTasks: number;
}

// 获取采集员的项目列表（有任务的项目）
export async function getMyProjects(params?: {
  scopeType?: 'city' | 'district' | 'school';
  scopeId?: string;
}): Promise<MyProject[]> {
  return get<MyProject[]>('/my/projects', params as Record<string, string>);
}

// 开始任务（更新状态为进行中）
export async function startTask(taskId: string): Promise<void> {
  return post(`/tasks/${taskId}/start`);
}

// 完成任务
export async function completeTask(taskId: string, submissionId: string): Promise<void> {
  return post(`/tasks/${taskId}/complete`, { submissionId });
}

// 重置任务状态
export async function resetTask(taskId: string): Promise<void> {
  return post(`/tasks/${taskId}/reset`);
}

// 状态显示配置
export const taskStatusConfig: Record<TaskStatus, { text: string; color: string }> = {
  pending: { text: '待开始', color: 'default' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  overdue: { text: '已逾期', color: 'error' },
  rejected: { text: '已驳回', color: 'warning' },
};

// 目标类型显示配置
export const targetTypeConfig: Record<string, string> = {
  district: '区县',
  school: '学校',
  all: '全部',
};

// 工具字段映射信息
export interface FieldMapping {
  mappingType: 'data_indicator' | 'element';
  targetId: string;
  targetInfo?: {
    code: string;
    name: string;
    threshold?: string;
    description?: string;
    indicatorName?: string;
    indicatorCode?: string;
    elementType?: string;
    dataType?: string;
    formula?: string;
  };
}

// 工具完整Schema类型
export interface ToolFullSchema {
  id: string;
  name: string;
  type: string;
  target: string;
  description?: string;
  status: string;
  schema: Array<{
    id: string;
    label: string;
    type: string;
    mapping?: FieldMapping | null;
  }>;
  mappings: Array<{
    fieldId: string;
    mappingType: string;
    targetId: string;
  }>;
}

// 获取工具完整schema（含字段映射信息）
export async function getToolFullSchema(toolId: string): Promise<ToolFullSchema> {
  return get<ToolFullSchema>(`/tools/${toolId}/full-schema`);
}
