import React, { useState } from 'react';
import { Button, Input, Tag, Modal, Form, Select, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  FileTextOutlined,
  FormOutlined,
  EyeOutlined,
  EditOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dataTools, DataTool } from '../../mock/data';
import './index.css';

const { Search } = Input;

const ToolLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [tools, setTools] = useState(dataTools);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentTool, setCurrentTool] = useState<DataTool | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const handleSearch = (value: string) => {
    if (value) {
      setTools(dataTools.filter(tool =>
        tool.name.includes(value) || tool.description.includes(value)
      ));
    } else {
      setTools(dataTools);
    }
  };

  const handleCreate = (values: { type: string; name: string; target: string; description: string }) => {
    const newTool = {
      id: String(tools.length + 1),
      name: values.name,
      type: values.type as '表单' | '问卷',
      target: values.target,
      description: values.description || '',
      status: 'draft' as const,
      createdBy: 'admin',
      createdAt: new Date().toISOString().split('T')[0],
      updatedBy: 'admin',
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setTools([newTool, ...tools]);
    setCreateModalVisible(false);
    form.resetFields();
    message.success('创建成功');
  };

  const handleViewTool = (tool: DataTool) => {
    setCurrentTool(tool);
    setViewModalVisible(true);
  };

  const handleEditFromView = () => {
    setViewModalVisible(false);
    if (currentTool) {
      editForm.setFieldsValue({
        type: currentTool.type,
        name: currentTool.name,
        target: currentTool.target,
        description: currentTool.description,
      });
      setEditModalVisible(true);
    }
  };

  const handleSaveEdit = (values: { type: string; name: string; target: string; description: string }) => {
    if (currentTool) {
      const updatedTools = tools.map(tool =>
        tool.id === currentTool.id
          ? {
              ...tool,
              type: values.type as '表单' | '问卷',
              name: values.name,
              target: values.target,
              description: values.description || '',
              updatedAt: new Date().toISOString().split('T')[0],
              updatedBy: 'admin',
            }
          : tool
      );
      setTools(updatedTools);
      setEditModalVisible(false);
      editForm.resetFields();
      setCurrentTool(null);
      message.success('保存成功');
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'published':
        return <Tag color="green">已发布</Tag>;
      case 'editing':
        return <Tag color="orange">编辑中</Tag>;
      default:
        return <Tag>草稿</Tag>;
    }
  };

  return (
    <div className="tool-library-page">
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate('/home/balanced')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className="page-title">数据采集工具库</h1>
      </div>

      <div className="list-header">
        <h3>数据采集工具列表</h3>
        <div className="list-actions">
          <Search
            placeholder="搜索采集工具"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建数据采集工具
          </Button>
        </div>
      </div>

      <div className="tool-list">
        {tools.map(tool => (
          <div key={tool.id} className="tool-card">
            <div className="tool-card-header">
              <div className="tool-info">
                <span className="tool-name">{tool.name}</span>
                <Tag icon={tool.type === '表单' ? <FormOutlined /> : <FileTextOutlined />}>
                  {tool.type}
                </Tag>
                <Tag>{tool.target}</Tag>
              </div>
              {getStatusTag(tool.status)}
            </div>
            <p className="tool-desc">{tool.description}</p>
            <div className="tool-meta">
              创建时间: {tool.createdAt} &nbsp;&nbsp;
              创建人: {tool.createdBy} &nbsp;&nbsp;
              更新时间: {tool.updatedAt} &nbsp;&nbsp;
              更新人: {tool.updatedBy}
            </div>
            <div className="tool-actions">
              <span className="action-btn" onClick={() => handleViewTool(tool)}>
                <EyeOutlined /> 工具信息
              </span>
              <span className="action-btn" onClick={() => navigate(`/home/balanced/tools/${tool.id}/edit`)}>
                <EditOutlined /> 编辑工具
              </span>
              {tool.status === 'published' ? (
                <span className="action-btn">取消发布</span>
              ) : tool.status === 'editing' ? (
                <>
                  <span className="action-btn danger">删除</span>
                  <Button type="primary" size="small">发布</Button>
                </>
              ) : (
                <span className="action-btn">取消发布</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        title="数据采集工具信息管理"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={480}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>填写工具的基本信息</p>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            label="工具类型"
            name="type"
            rules={[{ required: true, message: '请选择工具类型' }]}
          >
            <Select placeholder="请选择工具类型">
              <Select.Option value="表单">表单</Select.Option>
              <Select.Option value="问卷">问卷</Select.Option>
              <Select.Option value="访谈">访谈</Select.Option>
              <Select.Option value="现场查验">现场查验</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="工具名称"
            name="name"
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item label="填报对象" name="target">
            <Input placeholder="请输入填报对象（如：区县、学校、班级等）" />
          </Form.Item>
          <Form.Item label="工具描述" name="description">
            <Input.TextArea placeholder="请输入工具描述" rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setCreateModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看工具信息弹窗 */}
      <Modal
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={520}
        closable={true}
        closeIcon={<CloseOutlined />}
        className="tool-view-modal"
      >
        {currentTool && (
          <div className="tool-view-content">
            <div className="tool-view-header">
              <h2 className="tool-view-title">{currentTool.name}</h2>
              <div className="tool-view-tags">
                <Tag icon={currentTool.type === '表单' ? <FormOutlined /> : <FileTextOutlined />}>
                  {currentTool.type}
                </Tag>
                <Tag>{currentTool.target}</Tag>
              </div>
              {getStatusTag(currentTool.status)}
            </div>
            <div className="tool-view-meta">
              <span>创建时间: {currentTool.createdAt}</span>
              <span className="meta-divider">|</span>
              <span>创建人: {currentTool.createdBy}</span>
              <span className="meta-divider">|</span>
              <span>变更时间: {currentTool.updatedAt}</span>
              <span className="meta-divider">|</span>
              <span>变更人: {currentTool.updatedBy}</span>
            </div>
            <div className="tool-view-desc">
              {currentTool.description}
            </div>
            <div className="tool-view-actions">
              <Button onClick={() => setViewModalVisible(false)}>关闭</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={handleEditFromView}>
                编辑
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑工具信息弹窗 */}
      <Modal
        title="数据采集工具信息管理"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setCurrentTool(null);
        }}
        footer={null}
        width={480}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>修改工具的基本信息</p>
        <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
          <Form.Item
            label="工具类型"
            name="type"
            rules={[{ required: true, message: '请选择工具类型' }]}
          >
            <Select placeholder="请选择工具类型">
              <Select.Option value="表单">表单</Select.Option>
              <Select.Option value="问卷">问卷</Select.Option>
              <Select.Option value="访谈">访谈</Select.Option>
              <Select.Option value="现场查验">现场查验</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="工具名称"
            name="name"
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item label="填报对象" name="target">
            <Input placeholder="请输入填报对象（如：区县、学校、班级等）" />
          </Form.Item>
          <Form.Item label="工具描述" name="description">
            <Input.TextArea placeholder="请输入工具描述" rows={4} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button
              style={{ marginRight: 8 }}
              onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
                setCurrentTool(null);
              }}
            >
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ToolLibrary;
