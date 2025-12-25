/**
 * 认证状态管理
 * 使用 Zustand 管理用户认证状态
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 用户角色类型（新角色体系）
export type UserRole =
  | 'admin'           // 系统管理员
  | 'project_admin'   // 项目管理员
  | 'data_collector'  // 数据采集员
  | 'project_expert'  // 项目评估专家
  | 'decision_maker'; // 报告决策者

const roleNameMap: Record<UserRole, string> = {
  admin: '系统管理员',
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目评估专家',
  decision_maker: '报告决策者',
};

// 用户信息接口
export interface User {
  phone: string;                    // 手机号（登录账号）
  name?: string;                    // 用户姓名
  role: UserRole;                   // 当前角色
  roleName?: string;                // 当前角色显示名
  roles?: UserRole[];               // 用户拥有的所有角色
}

// 登录凭证
export interface LoginCredentials {
  phone: string;      // 手机号
  password: string;
}

// 认证状态接口
interface AuthState {
  // 状态
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // 操作
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  switchRole: (nextRole: UserRole) => void;
  clearError: () => void;
  checkAuth: () => boolean;
}

// API 基础 URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * 认证状态 Store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // 登录
      login: async (credentials: LoginCredentials): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          const data = await response.json();

          if (!response.ok) {
            set({
              isLoading: false,
              error: data.message || '登录失败',
            });
            return false;
          }

          const { phone, name, role, roleName, roles, token } = data.data || {};

          const rolesArr: UserRole[] = Array.isArray(roles)
            ? roles
            : role
              ? [role]
              : [];
          const currentRole: UserRole | undefined = role || rolesArr[0];

          // 兼容旧请求层：部分接口会从 localStorage['token'] 读取
          try {
            localStorage.setItem('token', token);
          } catch {
            // ignore
          }

          set({
            user: currentRole
              ? {
                  phone,
                  name,
                  role: currentRole,
                  roleName: roleName || roleNameMap[currentRole],
                  roles: rolesArr.length > 0 ? rolesArr : [currentRole],
                }
              : null,
            token,
            isAuthenticated: Boolean(currentRole && token),
            isLoading: false,
            error: null,
          });

          return Boolean(currentRole && token);
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '网络错误，请稍后重试',
          });
          return false;
        }
      },

      // 登出
      logout: () => {
        try {
          localStorage.removeItem('token');
        } catch {
          // ignore
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // 切换角色（本地切换：更新 user.role 与 token 中的 role 段）
      switchRole: (nextRole: UserRole) => {
        const state = get();
        const user = state.user;
        if (!user) return;
        if (user.role === nextRole) return;

        const availableRoles = (user.roles && user.roles.length > 0 ? user.roles : [user.role]) as UserRole[];
        if (!availableRoles.includes(nextRole)) return;

        // token 格式: token-{timestamp}-{role}
        const prevToken = state.token || '';
        const parts = prevToken.split('-');
        const ts = parts.length >= 2 && !Number.isNaN(parseInt(parts[1], 10))
          ? parts[1]
          : String(Date.now());
        const nextToken = `token-${ts}-${nextRole}`;

        try {
          localStorage.setItem('token', nextToken);
        } catch {
          // ignore
        }

        set({
          user: {
            ...user,
            role: nextRole,
            roleName: roleNameMap[nextRole],
            roles: availableRoles,
          },
          token: nextToken,
        });
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },

      // 检查认证状态
      checkAuth: (): boolean => {
        const { token, isAuthenticated } = get();

        if (!token || !isAuthenticated) {
          return false;
        }

        // 检查 token 是否过期 (简单实现)
        // token 格式: token-{timestamp}
        const parts = token.split('-');
        if (parts.length >= 2) {
          const timestamp = parseInt(parts[1], 10);
          const now = Date.now();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours

          if (!isNaN(timestamp) && now - timestamp > maxAge) {
            // Token 过期，自动登出
            get().logout();
            return false;
          }
        }

        return true;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * 获取当前用户的角色权限
 *
 * 角色权限说明：
 * - admin: 系统管理员，拥有所有权限
 * - project_admin: 项目管理员，负责项目配置和状态管理
 * - data_collector: 数据采集员，负责数据填报
 * - project_expert: 项目评估专家，负责数据审核和评审
 * - decision_maker: 报告决策者，查看最终报告
 *
 * 注意：各角色权限相互独立，不存在继承关系（admin 除外）
 */
export const useUserPermissions = () => {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  // 角色判断（独立，不继承）
  const isAdmin = role === 'admin';
  const isProjectAdmin = role === 'project_admin';
  const isDataCollector = role === 'data_collector';
  const isProjectExpert = role === 'project_expert';
  const isDecisionMaker = role === 'decision_maker';

  // 权限判断（admin 拥有所有权限）
  return {
    // 角色标识
    isAdmin,
    isProjectAdmin,
    isProjectManager: isProjectAdmin,  // 兼容旧代码
    isDataCollector,
    isCollector: isDataCollector,      // 兼容旧代码
    isProjectExpert,
    isExpert: isProjectExpert,         // 兼容旧代码
    isDecisionMaker,

    // 功能权限（admin 拥有所有权限）
    canManageProjects: isAdmin || isProjectAdmin,   // 项目管理权限
    canCollectData: isAdmin || isDataCollector,     // 数据填报权限
    canReviewData: isAdmin || isProjectExpert,      // 数据审核权限
    canViewReports: isAdmin || isDecisionMaker,     // 查看报告权限

    // 扩展权限
    canManageSystem: isAdmin,                       // 系统管理权限
    canConfigProject: isAdmin || isProjectAdmin,    // 项目配置权限
    canChangeProjectStatus: isAdmin || isProjectAdmin, // 项目状态流转权限
  };
};

/**
 * 选择器：获取认证状态
 */
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectToken = (state: AuthState) => state.token;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
