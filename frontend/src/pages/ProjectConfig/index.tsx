/**
 * 项目配置页面
 * 管理项目基本信息和关联的采集工具
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  message,
  Spin,
  Descriptions,
  Space,
  Tooltip,
  Empty,
  Switch,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as projectService from '../../services/projectService';
import * as projectToolService from '../../services/projectToolService';
import type { ProjectTool, AvailableTool } from '../../services/projectToolService';
import styles from './index.module.css';

interface Project {
  id: string;
  name: string;
  keywords?: string;
  description?: string;
  indicatorSystemId?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  createdAt?: string;
}

const ProjectConfig: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [tools, setTools] = useState<ProjectTool[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 加载项目信息
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectService.getById(projectId);
      setProject(data);
    } catch (error) {
      console.error('加载项目信息失败:', error);
      message.error('加载项目信息失败');
    }
  }, [projectId]);

  // 加载关联的工具
  const loadTools = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectToolService.getProjectTools(projectId);
      setTools(data);
    } catch (error) {
      console.error('加载关联工具失败:', error);
    }
  }, [projectId]);

  // 加载可用工具
  const loadAvailableTools = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectToolService.getAvailableTools(projectId);
      setAvailableTools(data);
    } catch (error) {
      console.error('加载可用工具失败:', error);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProject(), loadTools()]).finally(() => {
      setLoading(false);
    });
  }, [loadProject, loadTools]);

  // 打开添加工具弹窗
  const handleOpenAddModal = async () => {
    await loadAvailableTools();
    setSelectedToolIds([]);
    setAddModalVisible(true);
  };

  // 添加工具
  const handleAddTools = async () => {
    if (!projectId || selectedToolIds.length === 0) return;

    setSaving(true);
    try {
      await projectToolService.batchAddProjectTools(projectId, selectedToolIds);
      message.success('添加成功');
      setAddModalVisible(false);
      await loadTools();
    } catch (error: any) {
      message.error(error.message || '添加失败');
    } finally {
      setSaving(false);
    }
  };

  // 移除工具
  const handleRemoveTool = (tool: ProjectTool) => {
    Modal.confirm({
      title: '确认移除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要移除工具 "${tool.toolName}" 吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!projectId) return;
        try {
          await projectToolService.removeProjectTool(projectId, tool.toolId);
          message.success('移除成功');
          await loadTools();
        } catch (error: any) {
          message.error(error.message || '移除失败');
        }
      },
    });
  };

  // 切换必填状态
  const handleToggleRequired = async (tool: ProjectTool) => {
    if (!projectId) return;
    try {
      await projectToolService.updateProjectTool(
        projectId,
        tool.toolId,
        tool.isRequired !== 1
      );
      await loadTools();
    } catch (error: any) {
      message.error(error.message || '更新失败');
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      '配置中': { color: 'default', text: '配置中' },
      '填报中': { color: 'processing', text: '填报中' },
      '评审中': { color: 'warning', text: '评审中' },
      '已中止': { color: 'error', text: '已中止' },
      '已完成': { color: 'success', text: '已完成' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 工具表格列
  const toolColumns: ColumnsType<ProjectTool> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '工具名称',
      dataIndex: 'toolName',
      key: 'toolName',
      render: (name, record) => (
        <div>
          <div className={styles.toolName}>{name}</div>
          <div className={styles.toolDesc}>{record.toolDescription}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'toolType',
      key: 'toolType',
      width: 80,
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '对象',
      dataIndex: 'toolTarget',
      key: 'toolTarget',
      width: 100,
    },
    {
      title: '必填',
      key: 'isRequired',
      width: 80,
      render: (_, record) => (
        <Switch
          checked={record.isRequired === 1}
          size="small"
          onChange={() => handleToggleRequired(record)}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'toolStatus',
      key: 'toolStatus',
      width: 80,
      render: (status) => (
        <Tag color={status === 'published' ? 'success' : 'default'}>
          {status === 'published' ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑表单">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/home/balanced/tools/${record.toolId}/edit`)}
            />
          </Tooltip>
          <Tooltip title="移除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveTool(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 可用工具表格列
  const availableToolColumns: ColumnsType<AvailableTool> = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <div className={styles.toolName}>{name}</div>
          <div className={styles.toolDesc}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '对象',
      dataIndex: 'target',
      key: 'target',
      width: 100,
    },
  ];

  if (loading) {
    return (
      <div className={styles.projectConfigPage}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.projectConfigPage}>
        <Empty description="项目不存在" />
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  return (
    <div className={styles.projectConfigPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>项目配置</h1>
        </div>
      </div>

      {/* 项目信息卡片 */}
      <Card className={styles.projectCard}>
        <Descriptions column={3}>
          <Descriptions.Item label="项目名称" span={2}>
            {project.name}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {getStatusTag(project.status)}
          </Descriptions.Item>
          <Descriptions.Item label="项目描述" span={3}>
            {project.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {project.startDate || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结束日期">
            {project.endDate || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {project.createdAt || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 采集工具配置 */}
      <Card
        title="采集工具"
        className={styles.toolsCard}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAddModal}
          >
            添加工具
          </Button>
        }
      >
        {tools.length === 0 ? (
          <Empty description="暂无关联的采集工具" />
        ) : (
          <Table
            rowKey="id"
            columns={toolColumns}
            dataSource={tools}
            pagination={false}
            className={styles.toolsTable}
          />
        )}
      </Card>

      {/* 添加工具弹窗 */}
      <Modal
        title="添加采集工具"
        open={addModalVisible}
        onOk={handleAddTools}
        onCancel={() => setAddModalVisible(false)}
        confirmLoading={saving}
        okText="添加"
        cancelText="取消"
        width={700}
      >
        {availableTools.length === 0 ? (
          <Empty description="没有可添加的工具" />
        ) : (
          <Table
            rowKey="id"
            columns={availableToolColumns}
            dataSource={availableTools}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedToolIds,
              onChange: (keys) => setSelectedToolIds(keys as string[]),
            }}
            scroll={{ y: 400 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ProjectConfig;
