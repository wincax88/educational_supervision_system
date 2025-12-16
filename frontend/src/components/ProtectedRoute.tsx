/**
 * 路由权限保护组件
 * 根据用户角色控制路由访问权限
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore, useUserPermissions, UserRole } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** 允许访问的角色列表，不指定则所有已登录用户可访问 */
  allowedRoles?: UserRole[];
  /** 需要的权限，如 'canManageProjects' */
  requiredPermission?: keyof ReturnType<typeof useUserPermissions>;
  /** 无权限时的重定向路径，默认显示无权限页面 */
  redirectTo?: string;
}

/**
 * 路由保护组件
 * 支持基于角色和权限的访问控制
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  redirectTo,
}) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const permissions = useUserPermissions();

  // 未登录，重定向到登录页
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 检查角色权限
  if (allowedRoles && allowedRoles.length > 0) {
    // admin 拥有所有权限
    if (user.role !== 'admin' && !allowedRoles.includes(user.role)) {
      if (redirectTo) {
        return <Navigate to={redirectTo} replace />;
      }
      return (
        <Result
          status="403"
          title="无权访问"
          subTitle="抱歉，您没有权限访问此页面"
          extra={
            <Button type="primary" onClick={() => window.history.back()}>
              返回上一页
            </Button>
          }
        />
      );
    }
  }

  // 检查功能权限
  if (requiredPermission) {
    const hasPermission = permissions[requiredPermission];
    if (!hasPermission) {
      if (redirectTo) {
        return <Navigate to={redirectTo} replace />;
      }
      return (
        <Result
          status="403"
          title="无权访问"
          subTitle="抱歉，您没有权限访问此页面"
          extra={
            <Button type="primary" onClick={() => window.history.back()}>
              返回上一页
            </Button>
          }
        />
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

/**
 * 权限检查 Hook
 * 用于在组件内部检查是否有某项权限
 */
export const useHasPermission = (
  allowedRoles?: UserRole[],
  requiredPermission?: keyof ReturnType<typeof useUserPermissions>
): boolean => {
  const { user } = useAuthStore();
  const permissions = useUserPermissions();

  if (!user) return false;

  // admin 拥有所有权限
  if (user.role === 'admin') return true;

  // 检查角色
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) return false;
  }

  // 检查功能权限
  if (requiredPermission) {
    if (!permissions[requiredPermission]) return false;
  }

  return true;
};

/**
 * 条件渲染组件
 * 根据权限决定是否渲染子组件
 */
interface PermissionGateProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof ReturnType<typeof useUserPermissions>;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  fallback = null,
}) => {
  const hasPermission = useHasPermission(allowedRoles, requiredPermission);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
};
