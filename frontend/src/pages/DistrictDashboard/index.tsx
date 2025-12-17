import React, { useState, useEffect } from 'react';
import { Tabs, Select, Tag, message, Spin, Empty } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { getProjects } from '../../services/submissionService';
import IndicatorSummary from './components/IndicatorSummary';
import SchoolIndicators from './components/SchoolIndicators';
import SubmissionList from './components/SubmissionList';
import styles from './index.module.css';

interface Project {
  id: string;
  name: string;
  status: string;
}

const DistrictDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('indicator-summary');

  // 从 user 的 currentScope 获取区县信息
  const districtId = user?.currentScope?.type === 'district' ? user.currentScope.id : '';
  const districtName = user?.currentScope?.name || '未选择区县';

  // 加载项目列表
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const data = await getProjects();
        // 过滤出进行中的项目
        const activeProjects = data.filter(
          (p: Project) => p.status === '填报中' || p.status === '评审中' || p.status === '已完成'
        );
        setProjects(activeProjects);
        if (activeProjects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(activeProjects[0].id);
        }
      } catch (error) {
        message.error('加载项目列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // 如果没有选择区县，显示提示
  if (!districtId) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>
          <Empty description="请先在右上角选择要管理的区县" />
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'indicator-summary',
      label: '指标汇总',
      children: (
        <IndicatorSummary
          districtId={districtId}
          projectId={selectedProjectId}
        />
      ),
    },
    {
      key: 'school-indicators',
      label: '学校指标',
      children: (
        <SchoolIndicators
          districtId={districtId}
          projectId={selectedProjectId}
        />
      ),
    },
    {
      key: 'submissions',
      label: '填报明细',
      children: (
        <SubmissionList
          districtId={districtId}
          projectId={selectedProjectId}
        />
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          区县管理员工作台
          <Tag color="blue" className={styles.districtTag}>{districtName}</Tag>
        </h1>
        <div className={styles.filterBar}>
          <span>选择项目：</span>
          <Select
            className={styles.projectSelector}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            placeholder="请选择项目"
            loading={loading}
            allowClear
            options={[
              { value: '', label: '全部项目' },
              ...projects.map(p => ({
                value: p.id,
                label: (
                  <span>
                    {p.name}
                    <Tag
                      color={p.status === '填报中' ? 'processing' : p.status === '评审中' ? 'warning' : 'success'}
                      style={{ marginLeft: 8 }}
                    >
                      {p.status}
                    </Tag>
                  </span>
                ),
              }))
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : !selectedProjectId ? (
        <div className={styles.noData}>
          <Empty description="暂无可用项目" />
        </div>
      ) : (
        <div className={styles.tabContent}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </div>
      )}
    </div>
  );
};

export default DistrictDashboard;
