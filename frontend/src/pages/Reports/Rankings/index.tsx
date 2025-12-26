/**
 * 区县排名页面
 * 展示各区县的评估数据排名
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Select, Space, Spin, Progress } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as reportService from '../../../services/reportService';
import type { DistrictRanking, ReportItem } from '../../../services/reportService';
import styles from './index.module.css';

const Rankings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rankings, setRankings] = useState<DistrictRanking[]>([]);
  const [projects, setProjects] = useState<ReportItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const response = await reportService.getReportList({ pageSize: '100' });
      setProjects(response.list || []);
    } catch (error) {
      console.error('加载项目列表失败:', error);
    }
  }, []);

  // 加载排名数据
  const loadRankings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportService.getDistrictRankings(selectedProject);
      setRankings(data || []);
    } catch (error) {
      console.error('加载排名数据失败:', error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  // 排名图标
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} />;
    if (rank === 2) return <TrophyOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />;
    if (rank === 3) return <TrophyOutlined style={{ color: '#d48806', fontSize: 14 }} />;
    return <span className={styles.rankNumber}>{rank}</span>;
  };

  // 表格列定义
  const columns: TableColumnsType<DistrictRanking> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      align: 'center',
      render: (rank: number) => getRankIcon(rank),
    },
    {
      title: '区县代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
    },
    {
      title: '区县名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '学校数量',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 100,
      align: 'center',
    },
    {
      title: '填报数量',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
      width: 100,
      align: 'center',
    },
    {
      title: '已通过',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 100,
      align: 'center',
      render: (val: number) => (
        <span style={{ color: '#52c41a', fontWeight: 600 }}>{val}</span>
      ),
    },
    {
      title: '通过率',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 180,
      render: (rate: number) => (
        <Progress
          percent={rate || 0}
          size="small"
          strokeColor={rate === 100 ? '#52c41a' : rate >= 80 ? '#1890ff' : '#fa8c16'}
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const rate = record.approvalRate || 0;
        if (rate === 100) {
          return <Tag color="success">已完成</Tag>;
        } else if (rate >= 80) {
          return <Tag color="processing">进行中</Tag>;
        } else if (rate > 0) {
          return <Tag color="warning">待提升</Tag>;
        }
        return <Tag color="default">未开始</Tag>;
      },
    },
  ];

  // 柱状图配置
  const getBarChartOption = () => {
    if (rankings.length === 0) return {};

    const sortedData = [...rankings]
      .sort((a, b) => (b.approvalRate || 0) - (a.approvalRate || 0))
      .slice(0, 15);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: unknown[]) => {
          const data = params[0] as { name: string; value: number };
          return `${data.name}<br/>通过率: ${data.value?.toFixed(1)}%`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: sortedData.map(item => item.name),
        axisLabel: {
          rotate: 30,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: '通过率',
          type: 'bar',
          data: sortedData.map(item => ({
            value: item.approvalRate || 0,
            itemStyle: {
              color: (item.approvalRate || 0) === 100 ? '#52c41a' :
                     (item.approvalRate || 0) >= 80 ? '#1890ff' : '#fa8c16',
            },
          })),
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 10,
          },
        },
      ],
    };
  };

  return (
    <div className={styles.rankingsPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>区县排名</h1>
          <p className={styles.pageSubtitle}>各区县评估数据对比分析</p>
        </div>
        <Space>
          <Select
            placeholder="选择项目"
            allowClear
            style={{ width: 280 }}
            value={selectedProject}
            onChange={setSelectedProject}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
          />
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* 排名可视化 */}
        <Card title="通过率排名" className={styles.chartCard}>
          <ReactECharts
            option={getBarChartOption()}
            style={{ height: 350 }}
            notMerge
          />
        </Card>

        {/* 排名表格 */}
        <Card title="区县排名详情" className={styles.tableCard}>
          <Table
            dataSource={rankings}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="middle"
            rowClassName={(record, index) => {
              if (record.rank === 1) return styles.rankFirst;
              if (record.rank === 2) return styles.rankSecond;
              if (record.rank === 3) return styles.rankThird;
              return '';
            }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default Rankings;
