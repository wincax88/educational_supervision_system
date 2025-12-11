import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Space } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{"username": "admin", "roleName": "系统管理员"}');

  const menuItems = [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: '教育督导',
    },
    {
      key: '/system',
      icon: <SettingOutlined />,
      label: '系统配置',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
  ];

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className={styles.mainLayout}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className={styles.mainSider}
        theme="light"
      >
        <div className={styles.logo} onClick={() => navigate('/home')}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#1890ff">
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
          </svg>
          {!collapsed && <span className={styles.logoText}>沈阳市教育督导系统</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.split('/').slice(0, 2).join('/') || '/home']}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className={styles.mainHeader}>
          <div className={styles.headerRight}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space className={styles.userInfo}>
                <span>{user.username}</span>
                <LogoutOutlined onClick={handleLogout} style={{ cursor: 'pointer' }} />
                <span style={{ marginLeft: 8 }}>退出</span>
              </Space>
            </Dropdown>
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
