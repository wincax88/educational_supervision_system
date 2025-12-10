import React from 'react';
import { Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  BookOutlined,
  SmileOutlined,
  FileSearchOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import './index.css';

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

const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleCardClick = (module: ModuleCard) => {
    if (!module.status) {
      navigate(module.path);
    }
  };

  return (
    <div className="home-container">
      <h2 className="section-title">督导模块</h2>
      <div className="module-grid">
        {modules.map(module => (
          <Card
            key={module.key}
            className={`module-card ${module.status ? 'disabled' : ''}`}
            onClick={() => handleCardClick(module)}
          >
            <div className="module-content">
              <div className="module-icon" style={{ color: module.color }}>
                {module.icon}
              </div>
              <span className="module-title">{module.title}</span>
            </div>
            {module.status && (
              <Tag className="status-tag">开发中</Tag>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Home;
