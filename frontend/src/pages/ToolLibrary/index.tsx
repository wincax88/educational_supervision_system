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
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dataTools, DataTool } from '../../mock/data';
import styles from './index.module.css';

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
        return <span className={`${styles.toolStatusTag} ${styles.published}`}>已发布</span>;
      case 'editing':
        return <span className={`${styles.toolStatusTag} ${styles.editing}`}>编辑中</span>;
      default:
        return <span className={`${styles.toolStatusTag} ${styles.draft}`}>草稿</span>;
    }
  };

  const handleTogglePublish = (tool: DataTool) => {
    const newStatus = tool.status === 'published' ? 'editing' : 'published';
    const updatedTools = tools.map(t =>
      t.id === tool.id
        ? { ...t, status: newStatus as 'published' | 'editing' | 'draft', updatedAt: new Date().toISOString().split('T')[0] }
        : t
    );
    setTools(updatedTools);
    message.success(newStatus === 'published' ? '发布成功' : '已取消发布');
  };

  const handleDelete = (toolId: string) => {
    setTools(tools.filter(t => t.id !== toolId));
    message.success('删除成功');
  };

  return (
    <div className={styles.toolLibraryPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home/balanced')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>数据采集工具库</h1>
      </div>

      <div className={styles.toolListSection}>
        <div className={styles.listHeader}>
          <h3>数据采集工具列表</h3>
          <div className={styles.listActions}>
            <Search
              placeholder="搜索采集工具"
              onSearch={handleSearch}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建数据采集工具
            </Button>
          </div>
        </div>

        <div className={styles.toolList}>
          {tools.map(tool => (
            <div key={tool.id} className={styles.toolCard}>
              <div className={styles.toolCardHeader}>
                <div className={styles.toolInfo}>
                  <span className={styles.toolName}>{tool.name}</span>
                  <Tag icon={tool.type === '表单' ? <FormOutlined /> : <FileTextOutlined />}>
                    {tool.type}
                  </Tag>
                  <Tag>{tool.target}</Tag>
                </div>
                {getStatusTag(tool.status)}
              </div>
              <p className={styles.toolDesc}>{tool.description}</p>
              <div className={styles.toolMeta}>
                <span>创建时间: {tool.createdAt}</span>
                <span>创建人: {tool.createdBy}</span>
                <span>更新时间: {tool.updatedAt}</span>
                <span>更新人: {tool.updatedBy}</span>
              </div>
              <div className={styles.toolActions}>
                <span className={styles.actionBtn} onClick={() => handleViewTool(tool)}>
                  <EyeOutlined /> 工具信息
                </span>
                <span className={styles.actionBtn} onClick={() => navigate(`/home/balanced/tools/${tool.id}/edit`)}>
                  <EditOutlined /> 编辑工具
                </span>
                {tool.status === 'published' ? (
                  <span className={styles.actionBtn} onClick={() => handleTogglePublish(tool)}>
                    取消发布
                  </span>
                ) : tool.status === 'editing' ? (
                  <>
                    <span className={`${styles.actionBtn} ${styles.danger}`} onClick={() => handleDelete(tool.id)}>
                      <DeleteOutlined /> 删除
                    </span>
                    <Button type="primary" size="small" onClick={() => handleTogglePublish(tool)}>
                      发布
                    </Button>
                  </>
                ) : (
                  <span className={styles.actionBtn} onClick={() => handleTogglePublish(tool)}>
                    取消发布
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        title="数据采集工具信息管理"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={480}
        className="tool-edit-modal"
      >
        <p className={styles.editSubtitle}>填写工具的基本信息</p>
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
        title={null}
      >
        {currentTool && (
          <div className={styles.toolViewContent}>
            <div className={styles.toolViewHeader}>
              <div className={styles.toolViewTitleRow}>
                <h2 className={styles.toolViewTitle}>{currentTool.name}</h2>
                <div className={styles.toolViewTags}>
                  <Tag icon={currentTool.type === '表单' ? <FormOutlined /> : <FileTextOutlined />}>
                    {currentTool.type}
                  </Tag>
                  <Tag>{currentTool.target}</Tag>
                </div>
              </div>
              <div className={styles.toolViewStatus}>
                {getStatusTag(currentTool.status)}
              </div>
            </div>
            <div className={styles.toolViewMeta}>
              <span>创建时间: {currentTool.createdAt}</span>
              <span className={styles.metaDivider}>|</span>
              <span>创建人: {currentTool.createdBy}</span>
              <span className={styles.metaDivider}>|</span>
              <span>变更时间: {currentTool.updatedAt}</span>
              <span className={styles.metaDivider}>|</span>
              <span>变更人: {currentTool.updatedBy}</span>
            </div>
            <div className={styles.toolViewDesc}>
              {currentTool.description}
            </div>
            <div className={styles.toolViewActions}>
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
        className="tool-edit-modal"
      >
        <p className={styles.editSubtitle}>修改工具的基本信息</p>
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
