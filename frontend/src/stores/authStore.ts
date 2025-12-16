/**
 * 认证状态管理
 * 使用 Zustand 管理用户认证状态
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 用户角色类型
export type UserRole = 'admin' | 'project_manager' | 'collector' | 'expert' | 'decision_maker';

// 用户信息接口
export interface User {
  username: string;
  role: UserRole;
  roleName: string;
}

// 登录凭证
export interface LoginCredentials {
  username: string;
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

          const { username, role, roleName, token } = data.data;

          set({
            user: { username, role, roleName },
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return true;
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
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
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
 * - project_manager: 项目管理员，负责项目配置和状态管理
 * - collector: 数据采集员，负责数据填报
 * - expert: 项目评估专家，负责数据审核和评审
 * - decision_maker: 报告决策者，查看最终报告
 *
 * 注意：各角色权限相互独立，不存在继承关系（admin 除外）
 */
export const useUserPermissions = () => {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  // 角色判断（独立，不继承）
  const isAdmin = role === 'admin';
  const isProjectManager = role === 'project_manager';
  const isCollector = role === 'collector';
  const isExpert = role === 'expert';
  const isDecisionMaker = role === 'decision_maker';

  // 权限判断（admin 拥有所有权限）
  return {
    // 角色标识
    isAdmin,
    isProjectManager,
    isCollector,
    isExpert,
    isDecisionMaker,

    // 功能权限（admin 拥有所有权限）
    canManageProjects: isAdmin || isProjectManager,  // 项目管理权限
    canCollectData: isAdmin || isCollector,          // 数据填报权限
    canReviewData: isAdmin || isExpert,              // 数据审核权限
    canViewReports: isAdmin || isDecisionMaker,      // 查看报告权限

    // 扩展权限
    canManageSystem: isAdmin,                        // 系统管理权限
    canConfigProject: isAdmin || isProjectManager,   // 项目配置权限
    canChangeProjectStatus: isAdmin || isProjectManager, // 项目状态流转权限
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
