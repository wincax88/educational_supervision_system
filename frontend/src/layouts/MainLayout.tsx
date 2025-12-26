import React, { useState, useMemo, useEffect } from 'react';
import { Layout, Menu, Dropdown, Space, Tag } from 'antd';
import {
  HomeOutlined,
  LogoutOutlined,
  FormOutlined,
  AuditOutlined,
  FileTextOutlined,
  TeamOutlined,
  DownOutlined,
  BarChartOutlined,
  OrderedListOutlined,
  WarningOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore, UserRole } from '../stores/authStore';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

// 角色名称映射（新角色体系）
const roleNameMap: Record<string, string> = {
  admin: '系统管理员',
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目评估专家',
  decision_maker: '报告决策者',
};

// 角色标签颜色
const roleColorMap: Record<string, string> = {
  admin: 'red',
  project_admin: 'blue',
  data_collector: 'green',
  project_expert: 'orange',
  decision_maker: 'purple',
};

// 路由与角色的映射关系
const routeRoleMap: Record<string, UserRole> = {
  '/home': 'project_admin',
  '/collector': 'data_collector',
  '/expert': 'project_expert',
  '/reports': 'decision_maker',
  '/users': 'admin',
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { user, isAuthenticated, logout, switchRole } = useAuthStore();

  // 获取用户所有角色（并集）
  const userRoles = useMemo(() => {
    if (!user) return [];
    return user.roles && user.roles.length > 0 ? user.roles : [user.role];
  }, [user]);

  // 根据用户所有角色生成菜单项（混合方案：显示所有可用功能）
  const menuItems = useMemo(() => {
    const items = [];
    const isAdmin = userRoles.includes('admin');

    // 教育督导 - 管理员和项目管理员可见
    if (isAdmin || userRoles.includes('project_admin')) {
      items.push({
        key: '/home',
        icon: <HomeOutlined />,
        label: '教育督导',
      });
    }

    // 数据填报 - 仅采集员可见
    if (userRoles.includes('data_collector')) {
      items.push({
        key: '/collector',
        icon: <FormOutlined />,
        label: '数据填报',
      });
    }

    // 专家评审 - 仅专家可见
    if (userRoles.includes('project_expert')) {
      items.push({
        key: '/expert',
        icon: <AuditOutlined />,
        label: '专家评审',
      });
    }

    // 报告查看 - 仅决策者可见
    if (userRoles.includes('decision_maker')) {
      items.push({
        key: '/reports',
        icon: <FileTextOutlined />,
        label: '评估报告',
        children: [
          {
            key: '/reports',
            icon: <FileTextOutlined />,
            label: '报告列表',
          },
          {
            key: '/reports/statistics',
            icon: <BarChartOutlined />,
            label: '统计看板',
          },
          {
            key: '/reports/rankings',
            icon: <OrderedListOutlined />,
            label: '区县排名',
          },
          {
            key: '/reports/alerts',
            icon: <WarningOutlined />,
            label: '预警提醒',
          },
          {
            key: '/reports/comparison',
            icon: <LineChartOutlined />,
            label: '历年对比',
          },
        ],
      });
    }

    // 用户管理 - 仅管理员可见
    if (isAdmin) {
      items.push({
        key: '/users',
        icon: <TeamOutlined />,
        label: '用户管理',
        children: [
          {
            key: '/users/school-account',
            label: '学校&账号管理',
          },
          {
            key: '/users/expert-account',
            label: '专家账号管理',
          },
        ],
      });
    }

    return items;
  }, [userRoles]);

  // 路由变化时自动切换到对应角色（混合方案核心）
  useEffect(() => {
    if (!user) return;

    const path = location.pathname;
    let targetRole: UserRole | null = null;

    // 根据路由前缀匹配目标角色
    for (const [routePrefix, role] of Object.entries(routeRoleMap)) {
      if (path.startsWith(routePrefix)) {
        targetRole = role;
        break;
      }
    }

    if (!targetRole) return;

    // 管理员访问任何页面都保持 admin 角色
    if (userRoles.includes('admin')) {
      if (user.role !== 'admin') {
        switchRole('admin');
      }
      return;
    }

    // 如果用户拥有该角色且当前不是该角色，则自动切换
    if (userRoles.includes(targetRole) && user.role !== targetRole) {
      switchRole(targetRole);
    }
  }, [location.pathname, user, userRoles, switchRole]);

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 获取默认路由（根据角色）
  const getDefaultRouteByRole = (role: UserRole) => {
    if (role === 'admin' || role === 'project_admin') return '/home';
    if (role === 'data_collector') return '/collector';
    if (role === 'project_expert') return '/expert';
    if (role === 'decision_maker') return '/reports';
    return '/home';
  };

  const getDefaultRoute = () => getDefaultRouteByRole(user!.role);

  const handleSwitchRole = (nextRole: UserRole) => {
    if (!user) return;
    if (nextRole === user.role) return;
    switchRole(nextRole);
    // 角色切换后，为避免落到无权限页面，直接跳转到该角色默认入口
    navigate(getDefaultRouteByRole(nextRole));
  };

  // 未登录重定向到登录页
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userMenuItems = (() => {
    const roles = userRoles as UserRole[];
    const hasMultipleRoles = roles.length > 1;

    // 多角色时显示角色切换选项
    const roleItems = hasMultipleRoles
      ? roles.map((r) => ({
          key: `role:${r}`,
          label: (
            <Space>
              <span>{roleNameMap[r] || r}</span>
              {user?.role === r ? <Tag color={roleColorMap[r] || 'default'}>当前</Tag> : null}
            </Space>
          ),
          onClick: () => handleSwitchRole(r),
        }))
      : [];

    return [
      // 多角色时显示切换提示
      ...(hasMultipleRoles
        ? [{ key: 'role-header', label: '切换身份', disabled: true }]
        : []),
      ...roleItems,
      ...(roleItems.length > 0 ? [{ type: 'divider' as const }] : []),
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ];
  })();

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/home')) return '/home';
    if (path.startsWith('/collector')) return '/collector';
    if (path.startsWith('/expert')) return '/expert';
    if (path.startsWith('/reports')) return '/reports';
    if (path.startsWith('/users/school-account')) return '/users/school-account';
    if (path.startsWith('/users/expert-account')) return '/users/expert-account';
    if (path.startsWith('/users')) return '/users/school-account';
    return menuItems[0]?.key || '/home';
  };

  // 获取展开的子菜单
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/users')) return ['/users'];
    return [];
  };

  return (
    <Layout className={styles.mainLayout}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className={styles.mainSider}
        theme="light"
      >
        <div className={styles.logo} onClick={() => navigate(getDefaultRoute())}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#1890ff">
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
          </svg>
          {!collapsed && <span className={styles.logoText}>沈阳市教育督导系统</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className={styles.mainHeader}>
          <div className={styles.headerRight}>
            <Space className={styles.userInfo}>
              <Tag color={roleColorMap[user.role] || 'default'}>
                {user.roleName || roleNameMap[user.role] || user.role}
              </Tag>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                <Space style={{ cursor: 'pointer' }}>
                  <span>{user.name || user.phone}</span>
                  <DownOutlined />
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content className={styles.mainContent}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
