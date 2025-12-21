import React, { useState, useEffect } from 'react';
import { Tabs, Tag, message, Spin, Empty, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, Project } from '../../services/submissionService';
import { getDistrict, District } from '../../services/districtService';
import IndicatorSummary from '../DistrictDashboard/components/IndicatorSummary';
import SchoolIndicators from '../DistrictDashboard/components/SchoolIndicators';
import SubmissionList from '../DistrictDashboard/components/SubmissionList';
import DistrictSelfSubmissionList from '../DistrictDashboard/components/DistrictSelfSubmissionList';
import styles from './index.module.css';

const ProjectDetail: React.FC = () => {
  const { projectId, districtId } = useParams<{ projectId: string; districtId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [activeTab, setActiveTab] = useState('indicator-summary');
  const [indicatorSummaryRefreshKey, setIndicatorSummaryRefreshKey] = useState(0);

  // 加载项目信息和区县信息
  useEffect(() => {
    const loadData = async () => {
      if (!projectId || !districtId) return;

      setLoading(true);
      try {
        const [projectData, districtData] = await Promise.all([
          getProject(projectId),
          getDistrict(districtId),
        ]);
        setProject(projectData);
        setDistrict(districtData);
      } catch (error) {
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, districtId]);

  // 返回区县列表
  const handleBack = () => {
    navigate(`/home/balanced/project/${projectId}/detail`);
  };

  // Tab 切换处理
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // 切换到指标汇总时，刷新数据
    if (key === 'indicator-summary') {
      setIndicatorSummaryRefreshKey(prev => prev + 1);
    }
  };

  if (!districtId) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>
          <Empty description="请选择要查看的区县" />
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
          projectId={projectId || ''}
          refreshKey={indicatorSummaryRefreshKey}
        />
      ),
    },
    {
      key: 'school-indicators',
      label: '学校指标',
      children: (
        <SchoolIndicators
          districtId={districtId}
          projectId={projectId || ''}
        />
      ),
    },
    {
      key: 'submissions',
      label: '学校填报',
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
            <Tag color="blue" className={styles.districtTag}>{district?.name || '加载中...'}</Tag>
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

export default ProjectDetail;
