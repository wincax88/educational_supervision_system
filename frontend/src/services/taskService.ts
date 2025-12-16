// 任务分配 API 服务

import { get, post, put, del } from './api';

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

// 任务分配类型
export interface Task {
  id: string;
  projectId: string;
  toolId: string;
  toolName?: string;
  toolType?: string;
  assigneeId: string;
  assigneeName?: string;
  assigneeOrg?: string;
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

// 获取任务统计
export async function getTaskStats(projectId: string): Promise<TaskStats> {
  return get<TaskStats>(`/projects/${projectId}/tasks/stats`);
}

// 获取采集员的任务列表
export async function getMyTasks(params?: {
  projectId?: string;
  status?: TaskStatus;
}): Promise<Task[]> {
  return get<Task[]>('/my/tasks', params as Record<string, string>);
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
};

// 目标类型显示配置
export const targetTypeConfig: Record<string, string> = {
  district: '区县',
  school: '学校',
  all: '全部',
};
