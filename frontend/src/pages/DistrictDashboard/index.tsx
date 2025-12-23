import React, { useState, useEffect } from 'react';
import { Tabs, Tag, message, Spin, Empty, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getProject, Project } from '../../services/submissionService';
import IndicatorSummary from './components/IndicatorSummary';
import SchoolIndicators from './components/SchoolIndicators';
import SubmissionList from './components/SubmissionList';
import DistrictSelfSubmissionList from './components/DistrictSelfSubmissionList';
import styles from './index.module.css';

const DistrictDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('indicator-summary');
  const [indicatorSummaryRefreshKey, setIndicatorSummaryRefreshKey] = useState(0);

  // 从 user 的 currentScope 获取区县信息
  const districtId = user?.currentScope?.type === 'district' ? user.currentScope.id : '';
  const districtName = user?.currentScope?.name || '未选择区县';

  // 加载项目信息
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;

      setLoading(true);
      try {
        const data = await getProject(projectId);
        setProject(data);
      } catch (error) {
        message.error('加载项目信息失败');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  // 返回项目列表
  const handleBack = () => {
    navigate('/district');
  };

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

  // Tab 切换处理
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // 切换到指标汇总时，刷新数据
    if (key === 'indicator-summary') {
      setIndicatorSummaryRefreshKey(prev => prev + 1);
    }
  };

  // 根据评估类型动态设置标签名称
  const isPreschool = project?.assessmentType === '普及普惠';

  const tabItems = [
    {
      key: 'indicator-summary',
      label: '指标汇总',
      children: (
        <IndicatorSummary
          districtId={districtId}
          projectId={projectId || ''}
          refreshKey={indicatorSummaryRefreshKey}
          assessmentType={project?.assessmentType}
        />
      ),
    },
    {
      key: 'school-indicators',
      label: isPreschool ? '幼儿园指标' : '学校指标',
      children: (
        <SchoolIndicators
          districtId={districtId}
          projectId={projectId || ''}
          assessmentType={project?.assessmentType}
        />
      ),
    },
    {
      key: 'submissions',
      label: isPreschool ? '幼儿园填报' : '学校填报',
      children: (
        <SubmissionList
          districtId={districtId}
          projectId={projectId || ''}
        />
      ),
    },
    {
      key: 'district-submissions',
      label: '区县填报',
      children: (
        <DistrictSelfSubmissionList
          districtId={districtId}
          projectId={projectId || ''}
        />
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            className={styles.backButton}
          >
            返回
          </Button>
          <h1 className={styles.title}>
            {project?.name || '加载中...'}
            <Tag color="blue" className={styles.districtTag}>{districtName}</Tag>
            {project?.assessmentType && (
              <Tag
                color={project.assessmentType === '普及普惠' ? 'green' : 'purple'}
                className={styles.statusTag}
              >
                {project.assessmentType}
              </Tag>
            )}
            {project && (
              <Tag
                color={project.status === '填报中' ? 'processing' : project.status === '评审中' ? 'warning' : 'success'}
                className={styles.statusTag}
              >
                {project.status}
              </Tag>
            )}
          </h1>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : !projectId ? (
        <div className={styles.noData}>
          <Empty description="请选择一个项目" />
        </div>
      ) : (
        <div className={styles.tabContent}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems}
          />
        </div>
      )}
    </div>
  );
};

export default DistrictDashboard;
