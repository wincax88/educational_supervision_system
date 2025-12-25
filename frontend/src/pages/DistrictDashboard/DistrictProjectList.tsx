import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Empty, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import { getProjects, Project } from '../../services/submissionService';
import styles from './DistrictProjectList.module.css';

const DistrictProjectList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  // 区县工作台功能已移除（新角色体系不再支持区县管理员）
  const districtId = '';
  const districtName = '区县工作台';

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
      } catch (error) {
        message.error('加载项目列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case '填报中':
        return 'processing';
      case '评审中':
        return 'warning';
      case '已完成':
        return 'success';
      default:
        return 'default';
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  // 点击详情
  const handleViewDetail = (projectId: string) => {
    navigate(`/district/${projectId}`);
  };

  // 表格列定义
  const columns: ColumnsType<Project> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '指标体系',
      dataIndex: 'indicatorSystemName',
      key: 'indicatorSystemName',
      width: 150,
      render: (name: string) => name || '-',
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: '项目描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => desc || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          区县管理员工作台
          <Tag color="blue" className={styles.districtTag}>{districtName}</Tag>
        </h1>
      </div>

      <div className={styles.tableWrapper}>
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 个项目`,
          }}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="暂无可用项目" /> }}
        />
      </div>
    </div>
  );
};

export default DistrictProjectList;
