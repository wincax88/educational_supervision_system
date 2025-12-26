/**
 * 统计看板页面
 * 展示评估项目的整体统计数据和可视化图表
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Select } from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import * as reportService from '../../../services/reportService';
import type { StatisticsOverview } from '../../../services/reportService';
import styles from './index.module.css';

const Statistics: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsOverview | null>(null);

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportService.getStatisticsOverview();
      setStatistics(data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // 项目状态分布饼图配置
  const getProjectStatusPieOption = () => {
    if (!statistics?.projectStats) return {};

    const data = [
      { value: statistics.projectStats.completedProjects || 0, name: '已完成' },
      { value: statistics.projectStats.reviewingProjects || 0, name: '评审中' },
      { value: statistics.projectStats.fillingProjects || 0, name: '填报中' },
    ].filter(item => item.value > 0);

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '项目状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}: {c}',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          data,
          color: ['#52c41a', '#fa8c16', '#1890ff'],
        },
      ],
    };
  };

  // 评估类型分布饼图配置
  const getAssessmentTypePieOption = () => {
    if (!statistics?.projectStats) return {};

    const data = [
      { value: statistics.projectStats.balancedProjects || 0, name: '优质均衡' },
      { value: statistics.projectStats.preschoolProjects || 0, name: '普及普惠' },
    ].filter(item => item.value > 0);

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '评估类型',
          type: 'pie',
          radius: '60%',
          label: {
            show: true,
            formatter: '{b}: {c}',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          data,
          color: ['#13c2c2', '#722ed1'],
        },
      ],
    };
  };

  // 年度趋势柱状图配置
  const getYearlyTrendOption = () => {
    if (!statistics?.yearlyStats || statistics.yearlyStats.length === 0) return {};

    const years = statistics.yearlyStats.map(item => String(item.year)).reverse();
    const counts = statistics.yearlyStats.map(item => item.count).reverse();
    const completed = statistics.yearlyStats.map(item => item.completed).reverse();

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['项目总数', '已完成'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: years,
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '项目总数',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: '#1890ff',
          },
        },
        {
          name: '已完成',
          type: 'bar',
          data: completed,
          itemStyle: {
            color: '#52c41a',
          },
        },
      ],
    };
  };

  // 填报状态饼图配置
  const getSubmissionStatusPieOption = () => {
    if (!statistics?.submissionStats) return {};

    const data = [
      { value: statistics.submissionStats.approvedSubmissions || 0, name: '已通过' },
      { value: statistics.submissionStats.pendingSubmissions || 0, name: '待审核' },
      { value: statistics.submissionStats.rejectedSubmissions || 0, name: '已驳回' },
    ].filter(item => item.value > 0);

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '填报状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}: {c}',
          },
          data,
          color: ['#52c41a', '#fa8c16', '#ff4d4f'],
        },
      ],
    };
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  const projectStats = statistics?.projectStats;
  const submissionStats = statistics?.submissionStats;

  return (
    <div className={styles.statisticsPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>统计看板</h1>
        <p className={styles.pageSubtitle}>评估项目整体数据概览</p>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="项目总数"
              value={projectStats?.totalProjects || 0}
              prefix={<ProjectOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="已完成"
              value={projectStats?.completedProjects || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="评审中"
              value={projectStats?.reviewingProjects || 0}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="填报总数"
              value={submissionStats?.totalSubmissions || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="已审核"
              value={submissionStats?.approvedSubmissions || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="待审核"
              value={submissionStats?.pendingSubmissions || 0}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} className={styles.chartsRow}>
        <Col span={12}>
          <Card title="项目状态分布" className={styles.chartCard}>
            <ReactECharts
              option={getProjectStatusPieOption()}
              style={{ height: 300 }}
              notMerge
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="评估类型分布" className={styles.chartCard}>
            <ReactECharts
              option={getAssessmentTypePieOption()}
              style={{ height: 300 }}
              notMerge
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className={styles.chartsRow}>
        <Col span={12}>
          <Card title="年度项目趋势" className={styles.chartCard}>
            <ReactECharts
              option={getYearlyTrendOption()}
              style={{ height: 300 }}
              notMerge
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="填报审核状态" className={styles.chartCard}>
            <ReactECharts
              option={getSubmissionStatusPieOption()}
              style={{ height: 300 }}
              notMerge
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Statistics;
