import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Tag, Modal, Form, Select, message, Spin, Empty, Popconfirm } from 'antd';
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
import { useNavigate, useLocation } from 'react-router-dom';
import * as toolService from '../../services/toolService';
import type { DataTool } from '../../services/toolService';
import { useUserPermissions } from '../../stores/authStore';
import styles from './index.module.css';

const { Search } = Input;

const ToolLibrary: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useUserPermissions();
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<DataTool[]>([]);
  const [filteredTools, setFilteredTools] = useState<DataTool[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentTool, setCurrentTool] = useState<DataTool | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 检测项目类型
  const projectType = useMemo(() => {
    if (location.pathname.includes('/home/kindergarten')) {
      return 'preschool';
    }
    return 'balanced';
  }, [location.pathname]);

  // 判断是否为学前教育工具
  const isPreschoolTool = useCallback((tool: DataTool) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${tool.name} ${tool.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 动态基础路径
  const basePath = useMemo(() => {
    return projectType === 'preschool' ? '/home/kindergarten' : '/home/balanced';
  }, [projectType]);

  // 动态页面标题
  const pageTitle = useMemo(() => {
    return projectType === 'preschool' ? '学前教育数据采集工具库' : '数据采集工具库主页';
  }, [projectType]);

  // 加载工具列表
  const loadTools = useCallback(async () => {
    try {
      setLoading(true);
      const data = await toolService.getTools();

      // 根据项目类型过滤
      const typeFilteredData = data.filter(tool => {
        if (projectType === 'preschool') {
          return isPreschoolTool(tool);
        } else {
          return !isPreschoolTool(tool);
        }
      });

      setTools(typeFilteredData);
      setFilteredTools(typeFilteredData);
    } catch (error) {
      console.error('加载工具列表失败:', error);
      message.error('加载工具列表失败');
    } finally {
      setLoading(false);
    }
  }, [projectType, isPreschoolTool]);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  // 搜索
  const handleSearch = (value: string) => {
    if (value) {
      setFilteredTools(tools.filter(tool =>
        tool.name.includes(value) || tool.description.includes(value)
      ));
    } else {
      setFilteredTools(tools);
    }
  };

  // 创建工具
  const handleCreate = async (values: { type: string; name: string; target: string | string[]; description: string }) => {
    try {
      // 多选时 target 为数组，转为逗号分隔字符串存储
      const targetStr = Array.isArray(values.target) ? values.target.join(',') : (values.target || '');
      await toolService.createTool({
        name: values.name,
        type: values.type as '表单' | '问卷',
        target: targetStr,
        description: values.description || '',
      });
      setCreateModalVisible(false);
      form.resetFields();
      message.success('创建成功');
      loadTools();
    } catch (error) {
      console.error('创建工具失败:', error);
      message.error('创建工具失败');
    }
  };

  // 查看工具信息
  const handleViewTool = (tool: DataTool) => {
    setCurrentTool(tool);
    setViewModalVisible(true);
  };

  // 从查看弹窗进入编辑
  const handleEditFromView = () => {
    setViewModalVisible(false);
    if (currentTool) {
      // 将逗号分隔的字符串转回数组用于多选回显
      const targetArray = currentTool.target ? currentTool.target.split(',').filter(Boolean) : [];
      editForm.setFieldsValue({
        type: currentTool.type,
        name: currentTool.name,
        target: targetArray,
        description: currentTool.description,
      });
      setEditModalVisible(true);
    }
  };

  // 保存编辑
  const handleSaveEdit = async (values: { type: string; name: string; target: string | string[]; description: string }) => {
    if (!currentTool) return;

    try {
      // 多选时 target 为数组，转为逗号分隔字符串存储
      const targetStr = Array.isArray(values.target) ? values.target.join(',') : (values.target || '');
      await toolService.updateTool(currentTool.id, {
        name: values.name,
        type: values.type as '表单' | '问卷',
        target: targetStr,
        description: values.description || '',
      });
      setEditModalVisible(false);
      editForm.resetFields();
      setCurrentTool(null);
      message.success('保存成功');
      loadTools();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  // 获取状态标签
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

  // 发布/取消发布
  const handleTogglePublish = async (tool: DataTool) => {
    try {
      if (tool.status === 'published') {
        await toolService.unpublishTool(tool.id);
        message.success('已取消发布');
      } else {
        await toolService.publishTool(tool.id);
        message.success('发布成功');
      }
      loadTools();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 删除工具
  const handleDelete = async (toolId: string) => {
    try {
      await toolService.deleteTool(toolId);
      message.success('删除成功');
      loadTools();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 编辑工具（处理表单类型和问卷类型）
  const handleEditTool = async (tool: DataTool) => {
    if (tool.type === '问卷') {
      // 问卷类型：跳转到第三方问卷系统
      try {
        const action = tool.externalSurveyId ? 'edit' : 'create';
        const result = await toolService.createSurveyUrl(tool.id, action);
        window.open(result.url, '_blank');
      } catch (error) {
        console.error('跳转到问卷系统失败:', error);
        message.error('跳转到问卷系统失败');
      }
    } else {
      // 表单类型：跳转到本地编辑页面
      navigate(`${basePath}/tools/${tool.id}/edit`);
    }
  };

  return (
    <div className={styles.toolLibraryPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate(basePath)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
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
            {permissions.canManageSystem && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                创建数据采集工具
              </Button>
            )}
          </div>
        </div>

        <Spin spinning={loading}>
          {filteredTools.length === 0 && !loading ? (
            <Empty description="暂无采集工具" />
          ) : (
            <div className={styles.toolList}>
              {filteredTools.map(tool => (
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
                    {permissions.canManageSystem && (
                      <span className={styles.actionBtn} onClick={() => handleEditTool(tool)}>
                        <EditOutlined /> 编辑工具
                      </span>
                    )}
                    {permissions.canManageSystem && (
                      tool.status === 'published' ? (
                        <Popconfirm
                          title="取消发布"
                          description="确定要取消发布该工具吗？"
                          onConfirm={() => handleTogglePublish(tool)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <span className={styles.actionBtn}>
                            取消发布
                          </span>
                        </Popconfirm>
                      ) : (
                        <>
                          <Popconfirm
                            title="删除工具"
                            description="确定要删除该工具吗？此操作不可恢复。"
                            onConfirm={() => handleDelete(tool.id)}
                            okText="确定"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <span className={`${styles.actionBtn} ${styles.danger}`}>
                              <DeleteOutlined /> 删除
                            </span>
                          </Popconfirm>
                          <Popconfirm
                            title="发布工具"
                            description="确定要发布该工具吗？"
                            onConfirm={() => handleTogglePublish(tool)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="primary" size="small">
                              发布
                            </Button>
                          </Popconfirm>
                        </>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>
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
            </Select>
          </Form.Item>
          <Form.Item
            label="工具名称"
            name="name"
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item
            label="填报对象"
            name="target"
            rules={[{ required: true, message: '请选择填报对象' }]}
          >
            <Select mode="multiple" placeholder="请选择填报对象（可多选）" maxTagCount="responsive">
              <Select.Option value="区县">区县</Select.Option>
              <Select.Option value="学校">学校</Select.Option>
              <Select.Option value="教师">教师</Select.Option>
              <Select.Option value="学生">学生</Select.Option>
              <Select.Option value="班级">班级</Select.Option>
              <Select.Option value="家长">家长</Select.Option>
            </Select>
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
              {permissions.canManageSystem && (
                <Button type="primary" icon={<EditOutlined />} onClick={handleEditFromView}>
                  编辑
                </Button>
              )}
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
            </Select>
          </Form.Item>
          <Form.Item
            label="工具名称"
            name="name"
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item
            label="填报对象"
            name="target"
            rules={[{ required: true, message: '请选择填报对象' }]}
          >
            <Select mode="multiple" placeholder="请选择填报对象（可多选）" maxTagCount="responsive">
              <Select.Option value="区县">区县</Select.Option>
              <Select.Option value="学校">学校</Select.Option>
              <Select.Option value="教师">教师</Select.Option>
              <Select.Option value="学生">学生</Select.Option>
              <Select.Option value="班级">班级</Select.Option>
              <Select.Option value="家长">家长</Select.Option>
            </Select>
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
