/**
 * 专家评审工作台 - 项目列表页面
 * 显示专家负责的项目列表，支持进入项目评审详情
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Progress,
} from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  RightOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import * as expertService from '../../services/expertService';
import type { ExpertProject, SummaryStats } from '../../services/expertService';
import styles from './index.module.css';

// 项目状态配置
const statusConfig: Record<string, { color: string; text: string }> = {
  '配置中': { color: 'default', text: '配置中' },
  '填报中': { color: 'processing', text: '填报中' },
  'data_collection': { color: 'processing', text: '填报中' },
  '评审中': { color: 'warning', text: '评审中' },
  'review': { color: 'warning', text: '评审中' },
  '已中止': { color: 'error', text: '已中止' },
  '已完成': { color: 'success', text: '已完成' },
  'completed': { color: 'success', text: '已完成' },
};

// 评估类型配置
const assessmentTypeConfig: Record<string, { color: string }> = {
  '普及普惠': { color: '#722ed1' },
  '优质均衡': { color: '#13c2c2' },
};

const ExpertDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ExpertProject[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await expertService.getExpertProjects();
      setProjects(response.projects || []);
      setSummary(response.summary || null);
    } catch (error) {
      console.error('加载项目列表失败:', error);
      setProjects([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 进入项目详情
  const handleEnterProject = (project: ExpertProject) => {
    navigate(`/expert/projects/${project.id}`);
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  return (
    <div className={styles.expertDashboard}>
      {/* 欢迎区域 */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          欢迎，{user?.name || '专家'}
        </h1>
        <p className={styles.welcomeSubtitle}>
          您共负责 <strong>{summary?.totalProjects || 0}</strong> 个项目的评审工作
          {summary && summary.totalSubmitted > 0 && (
            <>，其中 <strong>{summary.totalSubmitted}</strong> 个待审核</>
          )}
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="参与项目"
              value={summary?.totalProjects || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ProjectOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="待审核"
              value={summary?.totalSubmitted || 0}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="已完成"
              value={summary?.totalCompleted || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <div className={styles.progressStat}>
              <span className={styles.progressLabel}>总完成率</span>
              <Progress
                type="circle"
                percent={summary?.overallCompletionRate || 0}
                width={60}
                strokeColor={
                  (summary?.overallCompletionRate || 0) === 100 ? '#52c41a' : '#1890ff'
                }
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 项目列表 */}
      <Spin spinning={loading}>
        {projects.length > 0 ? (
          <div className={styles.projectList}>
            {projects.map((project) => {
              const statusInfo = statusConfig[project.status] || statusConfig['配置中'];
              const typeColor = assessmentTypeConfig[project.assessmentType || '']?.color;
              const stats = project.reviewStats;

              return (
                <Card
                  key={project.id}
                  className={styles.projectCard}
                  hoverable
                  onClick={() => handleEnterProject(project)}
                >
                  <div className={styles.projectHeader}>
                    <div className={styles.projectTitle}>
                      <span className={styles.projectName}>{project.name}</span>
                      <Space size={8}>
                        <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                        {project.assessmentType && (
                          <Tag color={typeColor}>{project.assessmentType}</Tag>
                        )}
                      </Space>
                    </div>
                    <Button
                      type="primary"
                      icon={<RightOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnterProject(project);
                      }}
                    >
                      进入评审
                    </Button>
                  </div>

                  {project.description && (
                    <p className={styles.projectDesc}>{project.description}</p>
                  )}

                  <div className={styles.projectMeta}>
                    <span>
                      评估周期：{formatDate(project.startDate)} ~ {formatDate(project.endDate)}
                    </span>
                  </div>

                  {/* 审核统计 */}
                  <div className={styles.reviewStats}>
                    <div className={styles.statsItems}>
                      <div className={styles.statsItem}>
                        <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                        <span className={styles.statsValue}>{stats.submitted}</span>
                        <span className={styles.statsLabel}>待审核</span>
                      </div>
                      <div className={styles.statsItem}>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <span className={styles.statsValue}>{stats.approved}</span>
                        <span className={styles.statsLabel}>已通过</span>
                      </div>
                      <div className={styles.statsItem}>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <span className={styles.statsValue}>{stats.rejected}</span>
                        <span className={styles.statsLabel}>已驳回</span>
                      </div>
                    </div>
                    <div className={styles.progressWrapper}>
                      <Progress
                        percent={stats.completionRate}
                        size="small"
                        strokeColor={stats.completionRate === 100 ? '#52c41a' : '#1890ff'}
                        format={(percent) => `${percent}%`}
                      />
                      <span className={styles.progressText}>审核进度</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className={styles.emptyCard}>
            <Empty
              image={<FileSearchOutlined style={{ fontSize: 64, color: '#ccc' }} />}
              description={
                <span style={{ color: '#999' }}>
                  暂无负责的评审项目
                  <br />
                  请联系项目管理员分配评审任务
                </span>
              }
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default ExpertDashboard;
