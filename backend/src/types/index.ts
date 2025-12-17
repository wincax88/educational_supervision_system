/**
 * 通用类型定义
 */

import { Request, Response, NextFunction, Router } from 'express';

// ==================== 数据库相关类型 ====================

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
}

export interface DatabaseClient {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
}

export interface Database {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  transaction: <T>(callback: (client: DatabaseClient) => Promise<T>) => Promise<T>;
  testConnection: () => Promise<boolean>;
  ensureSchema: () => Promise<void>;
  tableExists: (tableName: string, schemaName?: string) => Promise<boolean>;
  close: () => Promise<void>;
  from: (table: string) => SupabaseQueryBuilder;
  findById: <T = Record<string, unknown>>(table: string, id: string, select?: string) => Promise<T | null>;
  findAll: <T = Record<string, unknown>>(table: string, filters?: Record<string, unknown>, select?: string) => Promise<T[]>;
  insert: <T = Record<string, unknown>>(table: string, record: Record<string, unknown>) => Promise<T>;
  update: <T = Record<string, unknown>>(table: string, id: string, updates: Record<string, unknown>) => Promise<T>;
  remove: (table: string, id: string) => Promise<boolean>;
  upsert: <T = Record<string, unknown>>(table: string, record: Record<string, unknown>, conflictColumn?: string) => Promise<T>;
}

export interface SupabaseQueryBuilder {
  select: (columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) => SupabaseQueryBuilder;
  insert: (data: Record<string, unknown> | Record<string, unknown>[]) => SupabaseQueryBuilder;
  update: (data: Record<string, unknown>) => SupabaseQueryBuilder;
  delete: () => SupabaseQueryBuilder;
  upsert: (data: Record<string, unknown>, options?: { onConflict?: string }) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  neq: (column: string, value: unknown) => SupabaseQueryBuilder;
  gt: (column: string, value: unknown) => SupabaseQueryBuilder;
  gte: (column: string, value: unknown) => SupabaseQueryBuilder;
  lt: (column: string, value: unknown) => SupabaseQueryBuilder;
  lte: (column: string, value: unknown) => SupabaseQueryBuilder;
  like: (column: string, pattern: string) => SupabaseQueryBuilder;
  ilike: (column: string, pattern: string) => SupabaseQueryBuilder;
  is: (column: string, value: unknown) => SupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder;
  contains: (column: string, value: unknown) => SupabaseQueryBuilder;
  containedBy: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
  range: (from: number, to: number) => SupabaseQueryBuilder;
  single: () => Promise<{ data: Record<string, unknown> | null; error: SupabaseError | null }>;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: SupabaseError | null }>;
  then: <T>(resolve: (result: { data: Record<string, unknown>[] | null; error: SupabaseError | null; count?: number }) => T) => Promise<T>;
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number;
  page?: number;
  pageSize?: number;
}

// ==================== 实体类型 ====================

export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

// 指标体系
export interface IndicatorSystem extends BaseEntity {
  name: string;
  type: '达标类' | '评分类';
  target: string;
  tags?: string[];
  description?: string;
  indicator_count?: number;
  attachments?: Attachment[];
  status: 'draft' | 'editing' | 'published' | 'archived';
}

// 指标
export interface Indicator extends BaseEntity {
  system_id: string;
  parent_id?: string | null;
  code: string;
  name: string;
  description?: string;
  level: number;
  is_leaf: boolean;
  weight?: number;
  sort_order: number;
}

// 数据指标
export interface DataIndicator extends BaseEntity {
  indicator_id: string;
  code: string;
  name: string;
  data_type: '文本' | '数字' | '日期' | '时间' | '逻辑' | '数组' | '文件';
  unit?: string;
  threshold?: string;
  description?: string;
  calculation_method?: string;
  data_source?: string;
  collection_frequency?: string;
  sort_order: number;
}

// 佐证资料
export interface SupportingMaterial extends BaseEntity {
  indicator_id: string;
  code: string;
  name: string;
  file_types?: string;
  max_size?: string;
  description?: string;
  required: boolean;
  sort_order: number;
}

// 要素库
export interface ElementLibrary extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  status: 'draft' | 'published';
  element_count?: number;
}

// 要素
export interface Element extends BaseEntity {
  library_id: string;
  code: string;
  name: string;
  element_type: string;
  data_type: string;
  formula?: string;
  description?: string;
  sort_order: number;
}

// 采集工具
export interface DataTool extends BaseEntity {
  name: string;
  type: string;
  target: string;
  description?: string;
  status: 'draft' | 'editing' | 'published';
  config?: Record<string, unknown>;
}

// 项目
export interface Project extends BaseEntity {
  name: string;
  description?: string;
  indicator_system_id: string;
  start_date?: string;
  end_date?: string;
  status: '配置中' | '填报中' | '评审中' | '已中止' | '已完成';
  keywords?: string[];
  is_published?: boolean;
}

// 提交
export interface Submission extends BaseEntity {
  project_id: string;
  tool_id: string;
  school_id: string;
  data: Record<string, unknown>;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at?: string;
  reviewed_at?: string;
  reviewer_id?: string;
  comments?: string;
}

// 学校
export interface School extends BaseEntity {
  name: string;
  district_id: string;
  type: string;
  category: string;
  address?: string;
  contact?: string;
  phone?: string;
}

// 区县
export interface District extends BaseEntity {
  name: string;
  code: string;
  description?: string;
}

// 用户
export interface User {
  username: string;
  password: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  roleName?: string;
}

// 会话
export interface Session {
  username: string;
  roles: string[];
  scopes: string[];
}

// 附件
export interface Attachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

// ==================== 请求扩展类型 ====================

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
    roles: string[];
    scopes: string[];
  };
}

// ==================== 路由模块类型 ====================

export interface RouteModule {
  router: Router;
  setDb: (database: Database) => void;
}

// ==================== Express 扩展类型 ====================

export type RequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type ErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void;

// ==================== 树节点类型 ====================

export interface IndicatorTreeNode extends Indicator {
  children?: IndicatorTreeNode[];
  dataIndicators?: DataIndicator[];
  supportingMaterials?: SupportingMaterial[];
}

// ==================== 统计类型 ====================

export interface IndicatorSystemStats {
  total: number;
  published: number;
  editing: number;
  standard: number;
  scoring: number;
}

export interface ElementLibraryStats {
  total: number;
  published: number;
  draft: number;
  elementcount: number;
}

export interface ToolStats {
  total: number;
  published: number;
  editing: number;
  draft: number;
}

export interface ProjectStats {
  configuring: number;
  filling: number;
  reviewing: number;
  stopped: number;
  completed: number;
}

export interface AllStats {
  indicatorSystemStats: IndicatorSystemStats;
  elementLibraryStats: ElementLibraryStats;
  toolStats: ToolStats;
  projectStats: ProjectStats;
}
