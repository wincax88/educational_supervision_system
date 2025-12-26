/**
 * 项目采集工具编辑页面
 * 编辑项目级采集工具副本
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Tooltip,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  FormOutlined,
  CopyOutlined,
  SendOutlined,
  StopOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import * as projectService from '../../services/projectService';
import * as projectDataToolService from '../../services/projectDataToolService';
import * as toolService from '../../services/toolService';
import type { ProjectDataTool } from '../../services/projectDataToolService';
import styles from './index.module.css';

const { TextArea } = Input;
const { Option } = Select;

const ProjectDataTools: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();

  const [projectName, setProjectName] = useState<string>('');
  const [tools, setTools] = useState<ProjectDataTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 弹窗状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<ProjectDataTool | null>(null);
  const [templateTools, setTemplateTools] = useState<toolService.DataTool[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  const [editForm] = Form.useForm();

  // 获取表单编辑器的URL
  const getFormEditorUrl = (toolId: string) => {
    // 使用项目级的表单编辑路由
    const basePath = location.pathname.includes('/home/balanced/')
      ? '/home/balanced'
      : '/home/kindergarten';
    return `${basePath}/project/${projectId}/data-tools/${toolId}/edit`;
  };

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // 加载项目信息
      const project = await projectService.getById(projectId);
      setProjectName(project.name);

      // 加载采集工具列表
      const toolsData = await projectDataToolService.getProjectDataTools(projectId);
      setTools(toolsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 加载模板工具列表
  const loadTemplateTools = async () => {
    try {
      const templates = await toolService.getTools();
      // 过滤掉已添加的工具
      const existingNames = new Set(tools.map((t: ProjectDataTool) => t.name));
      const available = templates.filter((t: toolService.DataTool) => !existingNames.has(t.name));
      setTemplateTools(available);
    } catch (error) {
      console.error('加载模板工具失败:', error);
      message.error('加载模板工具失败');
    }
  };

  // 打开复制弹窗
  const handleOpenCopyModal = async () => {
    await loadTemplateTools();
    setSelectedTemplateIds([]);
    setCopyModalVisible(true);
  };

  // 从模板复制
  const handleCopyFromTemplate = async () => {
    if (!projectId || selectedTemplateIds.length === 0) return;

    setSaving(true);
    try {
      for (const templateId of selectedTemplateIds) {
        await projectDataToolService.copyDataToolToProject(projectId, templateId);
      }
      message.success(`成功添加 ${selectedTemplateIds.length} 个采集工具`);
      setCopyModalVisible(false);
      loadData();
    } catch (error) {
      console.error('复制失败:', error);
      message.error('复制失败');
    } finally {
      setSaving(false);
    }
  };

  // 编辑工具
  const handleEdit = (tool: ProjectDataTool) => {
    setEditingTool(tool);
    editForm.setFieldsValue({
      name: tool.name,
      type: tool.type,
      target: tool.target,
      description: tool.description,
      isRequired: tool.isRequired,
      requireReview: tool.requireReview,
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    if (!projectId || !editingTool) return;

    try {
      const values = await editForm.validateFields();
      await projectDataToolService.updateProjectDataTool(projectId, editingTool.id, values);
      message.success('修改成功');
      setEditModalVisible(false);
      loadData();
    } catch (error) {
      console.error('修改失败:', error);
      message.error('修改失败');
    }
  };

  // 删除工具
  const handleDelete = async (toolId: string) => {
    if (!projectId) return;

    try {
      await projectDataToolService.deleteProjectDataTool(projectId, toolId);
      message.success('删除成功');
      loadData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 发布/取消发布
  const handleTogglePublish = async (tool: ProjectDataTool) => {
    if (!projectId) return;

    try {
      if (tool.status === 'published') {
        await projectDataToolService.unpublishProjectDataTool(projectId, tool.id);
        message.success('已取消发布');
      } else {
        await projectDataToolService.publishProjectDataTool(projectId, tool.id);
        message.success('发布成功');
      }
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 移动顺序
  const handleMoveUp = async (index: number) => {
    if (index === 0 || !projectId) return;

    const newTools = [...tools];
    [newTools[index - 1], newTools[index]] = [newTools[index], newTools[index - 1]];
    setTools(newTools);

    try {
      await projectDataToolService.reorderProjectDataTools(
        projectId,
        newTools.map(t => t.id)
      );
    } catch (error) {
      console.error('排序失败:', error);
      loadData(); // 恢复原顺序
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === tools.length - 1 || !projectId) return;

    const newTools = [...tools];
    [newTools[index], newTools[index + 1]] = [newTools[index + 1], newTools[index]];
    setTools(newTools);

    try {
      await projectDataToolService.reorderProjectDataTools(
        projectId,
        newTools.map(t => t.id)
      );
    } catch (error) {
      console.error('排序失败:', error);
      loadData(); // 恢复原顺序
    }
  };

  // 表格列定义
  const columns: ColumnsType<ProjectDataTool> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === '表单' ? 'blue' : 'purple'}>
          {type || '表单'}
        </Tag>
      ),
    },
    {
      title: '对象',
      dataIndex: 'target',
      key: 'target',
      width: 100,
      render: (target: string) => target || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Badge
          status={status === 'published' ? 'success' : 'default'}
          text={status === 'published' ? '已发布' : '草稿'}
        />
      ),
    },
    {
      title: '必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 80,
      render: (required: boolean) => (
        <Tag color={required ? 'red' : 'default'}>
          {required ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '需审核',
      dataIndex: 'requireReview',
      key: 'requireReview',
      width: 80,
      render: (review: boolean) => (
        <Tag color={review ? 'orange' : 'default'}>
          {review ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '排序',
      key: 'sort',
      width: 80,
      render: (_, __, index) => (
        <Space>
          <Tooltip title="上移">
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => handleMoveUp(index)}
            />
          </Tooltip>
          <Tooltip title="下移">
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index === tools.length - 1}
              onClick={() => handleMoveDown(index)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑表单">
            <Button
              type="link"
              size="small"
              icon={<FormOutlined />}
              onClick={() => navigate(`/form-tool/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="编辑信息">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'published' ? '取消发布' : '发布'}>
            <Button
              type="link"
              size="small"
              icon={record.status === 'published' ? <StopOutlined /> : <SendOutlined />}
              onClick={() => handleTogglePublish(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此采集工具吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {/* 页面头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            返回
          </Button>
          <h1 className={styles.title}>采集工具</h1>
          {projectName && <Tag color="blue">{projectName}</Tag>}
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleOpenCopyModal}
          >
            从模板添加
          </Button>
        </Space>
      </div>

      {/* 主内容区 */}
      <Card className={styles.mainCard}>
        <div className={styles.toolbar}>
          <span>共 {tools.length} 个采集工具</span>
        </div>

        {/* 工具表格 */}
        <Table
          columns={columns}
          dataSource={tools}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={false}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑采集工具"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select>
              <Option value="表单">表单</Option>
              <Option value="问卷">问卷</Option>
            </Select>
          </Form.Item>
          <Form.Item name="target" label="采集对象">
            <Input placeholder="请输入采集对象" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="isRequired" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="requireReview" label="是否需要审核" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 从模板复制弹窗 */}
      <Modal
        title="从模板添加采集工具"
        open={copyModalVisible}
        onOk={handleCopyFromTemplate}
        onCancel={() => setCopyModalVisible(false)}
        okText="添加"
        cancelText="取消"
        confirmLoading={saving}
        width={600}
      >
        <div style={{ marginBottom: 16, color: '#666' }}>
          请选择要添加到项目的采集工具模板：
        </div>
        <Select
          mode="multiple"
          placeholder="请选择采集工具模板"
          style={{ width: '100%' }}
          value={selectedTemplateIds}
          onChange={setSelectedTemplateIds}
          optionFilterProp="children"
        >
          {templateTools.map(tool => (
            <Option key={tool.id} value={tool.id}>
              {tool.name}
              {tool.type && <Tag style={{ marginLeft: 8 }}>{tool.type}</Tag>}
            </Option>
          ))}
        </Select>
        {templateTools.length === 0 && (
          <div style={{ marginTop: 16, color: '#999', textAlign: 'center' }}>
            没有可用的模板，或所有模板已添加
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectDataTools;
