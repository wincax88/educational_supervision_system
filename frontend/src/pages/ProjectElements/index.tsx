/**
 * 项目要素编辑页面
 * 编辑项目级要素库副本
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Table,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import * as projectService from '../../services/projectService';
import * as projectElementService from '../../services/projectElementService';
import type { ProjectElement, ProjectElementLibrary } from '../../services/projectElementService';
import styles from './index.module.css';

const { TextArea } = Input;
const { Option } = Select;

const ProjectElements: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [projectName, setProjectName] = useState<string>('');
  const [library, setLibrary] = useState<ProjectElementLibrary | null>(null);
  const [elements, setElements] = useState<ProjectElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingElement, setEditingElement] = useState<ProjectElement | null>(null);
  const [form] = Form.useForm();

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // 加载项目信息
      const project = await projectService.getById(projectId);
      setProjectName(project.name);

      // 加载要素库信息
      const lib = await projectElementService.getProjectElementLibrary(projectId);
      setLibrary(lib);

      // 加载要素列表
      const elementsData = await projectElementService.getProjectElements(projectId);
      setElements(elementsData);
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

  // 过滤后的数据
  const filteredElements = elements.filter(elem => {
    const matchSearch = !searchText ||
      elem.name.toLowerCase().includes(searchText.toLowerCase()) ||
      elem.code?.toLowerCase().includes(searchText.toLowerCase());
    const matchType = !typeFilter || elem.elementType === typeFilter;
    return matchSearch && matchType;
  });

  // 添加/编辑要素
  const handleOpenModal = (element?: ProjectElement) => {
    if (element) {
      setEditingElement(element);
      form.setFieldsValue({
        code: element.code,
        name: element.name,
        elementType: element.elementType,
        dataType: element.dataType,
        formula: element.formula,
        collectionLevel: element.collectionLevel,
        calculationLevel: element.calculationLevel,
        dataSource: element.dataSource,
      });
    } else {
      setEditingElement(null);
      form.resetFields();
      form.setFieldsValue({
        elementType: '基础要素',
        dataType: '文本',
      });
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!projectId) return;

    try {
      const values = await form.validateFields();

      if (editingElement) {
        // 更新
        await projectElementService.updateProjectElement(projectId, editingElement.id, values);
        message.success('修改成功');
      } else {
        // 添加
        await projectElementService.addProjectElement(projectId, values);
        message.success('添加成功');
      }

      setModalVisible(false);
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 删除要素
  const handleDelete = async (elementId: string) => {
    if (!projectId) return;

    try {
      await projectElementService.deleteProjectElement(projectId, elementId);
      message.success('删除成功');
      loadData();
    } catch (error: any) {
      console.error('删除失败:', error);
      message.error(error.message || '删除失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<ProjectElement> = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string) => code ? <Tag>{code}</Tag> : '-',
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'elementType',
      key: 'elementType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === '基础要素' ? 'blue' : 'purple'}>
          {type || '基础要素'}
        </Tag>
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 100,
      render: (type: string) => type || '-',
    },
    {
      title: '采集级别',
      dataIndex: 'collectionLevel',
      key: 'collectionLevel',
      width: 100,
      render: (level: string) => {
        const levelMap: Record<string, { text: string; color: string }> = {
          school: { text: '学校', color: 'green' },
          district: { text: '区县', color: 'orange' },
          auto: { text: '自动', color: 'blue' },
        };
        const info = levelMap[level];
        return info ? <Tag color={info.color}>{info.text}</Tag> : '-';
      },
    },
    {
      title: '公式',
      dataIndex: 'formula',
      key: 'formula',
      width: 150,
      ellipsis: true,
      render: (formula: string) => formula || '-',
    },
    {
      title: '数据来源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 120,
      ellipsis: true,
      render: (source: string) => source || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此要素吗？"
            description="删除前请确保该要素未被引用"
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
          <h1 className={styles.title}>评估要素</h1>
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
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            添加要素
          </Button>
        </Space>
      </div>

      {/* 要素库信息 */}
      {library && (
        <Card size="small" className={styles.infoCard}>
          <div className={styles.libraryInfo}>
            <SettingOutlined style={{ marginRight: 8 }} />
            <span>要素库：{library.name}</span>
            <span style={{ marginLeft: 16, color: '#666' }}>
              共 {library.elementCount} 个要素
            </span>
          </div>
        </Card>
      )}

      {/* 主内容区 */}
      <Card className={styles.mainCard}>
        {/* 筛选工具栏 */}
        <div className={styles.toolbar}>
          <Space>
            <Input
              placeholder="搜索编码或名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="要素类型"
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="">全部</Option>
              <Option value="基础要素">基础要素</Option>
              <Option value="派生要素">派生要素</Option>
            </Select>
          </Space>
          <span style={{ color: '#666' }}>
            共 {filteredElements.length} 个要素
          </span>
        </div>

        {/* 要素表格 */}
        <Table
          columns={columns}
          dataSource={filteredElements}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={editingElement ? '编辑要素' : '添加要素'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="编码"
          >
            <Input placeholder="请输入要素编码" />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入要素名称' }]}
          >
            <Input placeholder="请输入要素名称" />
          </Form.Item>
          <Form.Item
            name="elementType"
            label="要素类型"
          >
            <Select>
              <Option value="基础要素">基础要素</Option>
              <Option value="派生要素">派生要素</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="dataType"
            label="数据类型"
          >
            <Select>
              <Option value="文本">文本</Option>
              <Option value="数字">数字</Option>
              <Option value="日期">日期</Option>
              <Option value="时间">时间</Option>
              <Option value="逻辑">逻辑</Option>
              <Option value="数组">数组</Option>
              <Option value="文件">文件</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="collectionLevel"
            label="采集级别"
          >
            <Select allowClear placeholder="请选择采集级别">
              <Option value="school">学校</Option>
              <Option value="district">区县</Option>
              <Option value="auto">自动</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="calculationLevel"
            label="计算级别"
          >
            <Select allowClear placeholder="请选择计算级别">
              <Option value="school">学校</Option>
              <Option value="district">区县</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="formula"
            label="公式"
          >
            <TextArea rows={2} placeholder="请输入计算公式（派生要素使用）" />
          </Form.Item>
          <Form.Item
            name="dataSource"
            label="数据来源"
          >
            <Input placeholder="请输入数据来源" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectElements;
