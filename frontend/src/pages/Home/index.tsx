import React from 'react';
import { Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  BookOutlined,
  SmileOutlined,
  FileSearchOutlined,
  AuditOutlined,
  EnvironmentOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useUserPermissions } from '../../stores/authStore';
import styles from './index.module.css';

interface ModuleCard {
  key: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  status?: 'developing';
  path: string;
}

const modules: ModuleCard[] = [
  {
    key: 'balanced',
    title: '义务教育优质均衡督导',
    icon: <BookOutlined />,
    color: '#1890ff',
    path: '/home/balanced',
  },
  {
    key: 'kindergarten',
    title: '幼儿园普惠督导',
    icon: <SmileOutlined />,
    color: '#1890ff',
    path: '/home/kindergarten',
  },
  {
    key: 'special',
    title: '教育专项督导',
    icon: <FileSearchOutlined />,
    color: '#d9d9d9',
    status: 'developing',
    path: '/home/special',
  },
  {
    key: 'inspection',
    title: '挂牌督导',
    icon: <AuditOutlined />,
    color: '#d9d9d9',
    status: 'developing',
    path: '/home/inspection',
  },
];

// 基础数据管理模块
const baseDataModules: ModuleCard[] = [
  {
    key: 'districts',
    title: '区县管理',
    icon: <EnvironmentOutlined />,
    color: '#52c41a',
    path: '/home/system/districts',
  },
  {
    key: 'schools',
    title: '学校管理',
    icon: <BankOutlined />,
    color: '#52c41a',
    path: '/home/system/schools',
  },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const permissions = useUserPermissions();

  const handleCardClick = (module: ModuleCard) => {
    if (!module.status) {
      navigate(module.path);
    }
  };

  return (
    <div className={styles.homeContainer}>
      <h2 className={styles.sectionTitle}>督导模块</h2>
      <div className={styles.moduleGrid}>
        {modules.map(module => (
          <Card
            key={module.key}
            className={`${styles.moduleCard} ${module.status ? styles.moduleCardDisabled : ''}`}
            onClick={() => handleCardClick(module)}
          >
            <div className={styles.moduleContent}>
              <div className={styles.moduleIcon} style={{ color: module.color }}>
                {module.icon}
              </div>
              <span className={styles.moduleTitle}>{module.title}</span>
            </div>
            {module.status && (
              <Tag className={styles.statusTag}>开发中</Tag>
            )}
          </Card>
        ))}
      </div>

      {/* 基础数据管理 - 仅管理员可见 */}
      {permissions.canManageSystem && (
        <>
          <h2 className={styles.sectionTitle} style={{ marginTop: 32 }}>基础数据管理</h2>
          <div className={styles.moduleGrid}>
            {baseDataModules.map(module => (
              <Card
                key={module.key}
                className={styles.moduleCard}
                onClick={() => handleCardClick(module)}
              >
                <div className={styles.moduleContent}>
                  <div className={styles.moduleIcon} style={{ color: module.color }}>
                    {module.icon}
                  </div>
                  <span className={styles.moduleTitle}>{module.title}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
