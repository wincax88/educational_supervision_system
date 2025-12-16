import React, { useState, useMemo } from 'react';
import { Layout, Menu, Dropdown, Space, Tag } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  FormOutlined,
  AuditOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore, useUserPermissions } from '../stores/authStore';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

// 角色名称映射
const roleNameMap: Record<string, string> = {
  admin: '系统管理员',
  project_manager: '项目管理员',
  collector: '数据采集员',
  expert: '评估专家',
  decision_maker: '报告决策者',
};

// 角色标签颜色
const roleColorMap: Record<string, string> = {
  admin: 'red',
  project_manager: 'blue',
  collector: 'green',
  expert: 'orange',
  decision_maker: 'purple',
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { user, isAuthenticated, logout } = useAuthStore();
  const permissions = useUserPermissions();

  // 根据角色生成菜单项
  const menuItems = useMemo(() => {
    const items = [];

    // 教育督导 - 管理员和项目管理员可见完整内容
    if (permissions.canManageProjects) {
      items.push({
        key: '/home',
        icon: <HomeOutlined />,
        label: '教育督导',
      });
    }

    // 数据填报 - 采集员专用入口
    if (permissions.isCollector && !permissions.isAdmin) {
      items.push({
        key: '/collector',
        icon: <FormOutlined />,
        label: '数据填报',
      });
    }

    // 专家评审 - 专家专用入口
    if (permissions.isExpert && !permissions.isAdmin) {
      items.push({
        key: '/expert',
        icon: <AuditOutlined />,
        label: '专家评审',
      });
    }

    // 报告查看 - 决策者专用入口
    if (permissions.isDecisionMaker && !permissions.isAdmin) {
      items.push({
        key: '/reports',
        icon: <FileTextOutlined />,
        label: '评估报告',
      });
    }

    // 系统配置 - 仅管理员可见
    if (permissions.canManageSystem) {
      items.push({
        key: '/system',
        icon: <SettingOutlined />,
        label: '系统配置',
      });
    }

    // 用户管理 - 仅管理员可见
    if (permissions.canManageSystem) {
      items.push({
        key: '/users',
        icon: <TeamOutlined />,
        label: '用户管理',
      });
    }

    return items;
  }, [permissions]);

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 获取默认路由（根据角色）
  const getDefaultRoute = () => {
    if (permissions.canManageProjects) return '/home';
    if (permissions.isCollector) return '/collector';
    if (permissions.isExpert) return '/expert';
    if (permissions.isDecisionMaker) return '/reports';
    return '/home';
  };

  // 未登录重定向到登录页
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/home')) return '/home';
    if (path.startsWith('/collector')) return '/collector';
    if (path.startsWith('/expert')) return '/expert';
    if (path.startsWith('/reports')) return '/reports';
    if (path.startsWith('/system')) return '/system';
    if (path.startsWith('/users')) return '/users';
    return menuItems[0]?.key || '/home';
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
              <span>{user.username}</span>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <LogoutOutlined style={{ cursor: 'pointer', marginLeft: 8 }} />
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
