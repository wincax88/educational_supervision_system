/**
 * 项目指标体系编辑页面
 * 编辑项目级指标体系副本
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Tree,
  Tag,
  Spin,
  Empty,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Space,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  ReloadOutlined,
  LinkOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import * as projectService from '../../services/projectService';
import * as projectIndicatorService from '../../services/projectIndicatorService';
import type { ProjectIndicator, ProjectDataIndicator, ProjectSupportingMaterial } from '../../services/projectIndicatorService';
import styles from './index.module.css';

const { TextArea } = Input;

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 生成指标编码
const generateCode = (parentCode: string, index: number): string => {
  const num = index + 1;
  return parentCode ? `${parentCode}.${num}` : String(num);
};

// 重新计算所有编码
const recalculateCodes = (nodes: ProjectIndicator[], parentCode: string = ''): ProjectIndicator[] => {
  return nodes.map((node, index) => {
    const newCode = generateCode(parentCode, index);
    return {
      ...node,
      code: newCode,
      children: node.children ? recalculateCodes(node.children, newCode) : undefined,
      dataIndicators: node.dataIndicators?.map((di, idx) => ({
        ...di,
        code: `${newCode}-D${idx + 1}`,
      })),
      supportingMaterials: node.supportingMaterials?.map((sm, idx) => ({
        ...sm,
        code: `${newCode}-M${idx + 1}`,
      })),
    };
  });
};

const ProjectIndicatorSystem: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [projectName, setProjectName] = useState<string>('');
  const [systemName, setSystemName] = useState<string>('');
  const [treeData, setTreeData] = useState<ProjectIndicator[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addLevel, setAddLevel] = useState<number>(1);
  const [editingNode, setEditingNode] = useState<ProjectIndicator | null>(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // 加载项目信息
      const project = await projectService.getById(projectId);
      setProjectName(project.name);

      // 加载项目指标体系
      const system = await projectIndicatorService.getProjectIndicatorSystem(projectId);
      if (system) {
        setSystemName(system.name);
      }

      // 加载指标树
      const tree = await projectIndicatorService.getProjectIndicatorTree(projectId);
      setTreeData(tree);

      // 默认展开所有节点
      const allKeys = new Set<string>();
      const collectKeys = (nodes: ProjectIndicator[]) => {
        nodes.forEach(node => {
          allKeys.add(node.id);
          if (node.children) {
            collectKeys(node.children);
          }
        });
      };
      collectKeys(tree);
      setExpandedKeys(allKeys);
      setHasChanges(false);
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

  // 保存指标树
  const handleSave = async () => {
    if (!projectId) return;

    setSaving(true);
    try {
      // 重新计算编码
      const updatedTree = recalculateCodes(treeData);
      await projectIndicatorService.saveProjectIndicatorTree(projectId, updatedTree);
      message.success('保存成功');
      setTreeData(updatedTree);
      setHasChanges(false);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 添加指标
  const handleAdd = (parentId: string | null, level: number) => {
    setAddParentId(parentId);
    setAddLevel(level);
    form.resetFields();
    setAddModalVisible(true);
  };

  const handleAddConfirm = () => {
    form.validateFields().then(values => {
      const newNode: ProjectIndicator = {
        id: generateId(),
        systemId: '',
        code: '',
        name: values.name,
        description: values.description || '',
        level: addLevel,
        isLeaf: values.isLeaf ?? true,
        weight: values.weight,
        sortOrder: 0,
        children: values.isLeaf ? undefined : [],
        dataIndicators: values.isLeaf ? [] : undefined,
        supportingMaterials: values.isLeaf ? [] : undefined,
      };

      if (addParentId === null) {
        // 添加到根级
        setTreeData(prev => [...prev, newNode]);
      } else {
        // 添加到父节点
        const addToParent = (nodes: ProjectIndicator[]): ProjectIndicator[] => {
          return nodes.map(node => {
            if (node.id === addParentId) {
              return {
                ...node,
                isLeaf: false,
                children: [...(node.children || []), newNode],
                dataIndicators: undefined,
                supportingMaterials: undefined,
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };
        setTreeData(addToParent);
      }

      setAddModalVisible(false);
      setHasChanges(true);
      message.success('添加成功');
    });
  };

  // 编辑指标
  const handleEdit = (node: ProjectIndicator) => {
    setEditingNode(node);
    editForm.setFieldsValue({
      name: node.name,
      description: node.description,
      weight: node.weight,
      isLeaf: node.isLeaf,
    });
    setEditModalVisible(true);
  };

  const handleEditConfirm = () => {
    if (!editingNode) return;

    editForm.validateFields().then(values => {
      const updateNode = (nodes: ProjectIndicator[]): ProjectIndicator[] => {
        return nodes.map(node => {
          if (node.id === editingNode.id) {
            return {
              ...node,
              name: values.name,
              description: values.description || '',
              weight: values.weight,
            };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };

      setTreeData(updateNode);
      setEditModalVisible(false);
      setEditingNode(null);
      setHasChanges(true);
      message.success('修改成功');
    });
  };

  // 删除指标
  const handleDelete = (nodeId: string) => {
    const deleteNode = (nodes: ProjectIndicator[]): ProjectIndicator[] => {
      return nodes.filter(node => {
        if (node.id === nodeId) return false;
        if (node.children) {
          node.children = deleteNode(node.children);
        }
        return true;
      });
    };

    setTreeData(deleteNode);
    setHasChanges(true);
    message.success('删除成功');
  };

  // 展开/收起所有
  const handleExpandAll = () => {
    const allKeys = new Set<string>();
    const collectKeys = (nodes: ProjectIndicator[]) => {
      nodes.forEach(node => {
        allKeys.add(node.id);
        if (node.children) {
          collectKeys(node.children);
        }
      });
    };
    collectKeys(treeData);
    setExpandedKeys(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys(new Set());
  };

  // 构建树形数据
  const buildTreeData = (nodes: ProjectIndicator[]): DataNode[] => {
    return nodes.map(node => {
      const children: DataNode[] = [];

      // 添加子指标
      if (node.children && node.children.length > 0) {
        children.push(...buildTreeData(node.children));
      }

      // 添加数据指标
      if (node.dataIndicators && node.dataIndicators.length > 0) {
        children.push({
          key: `${node.id}-data-indicators`,
          title: (
            <span style={{ color: '#666' }}>
              <LinkOutlined /> 数据指标 ({node.dataIndicators.length})
            </span>
          ),
          selectable: false,
          children: node.dataIndicators.map(di => ({
            key: `di-${di.id}`,
            title: (
              <span>
                <Tag color="blue">{di.code}</Tag>
                {di.name}
                {di.threshold && <Tag color="cyan" style={{ marginLeft: 8 }}>阈值: {di.threshold}</Tag>}
              </span>
            ),
            isLeaf: true,
            selectable: false,
          })),
        });
      }

      // 添加佐证资料
      if (node.supportingMaterials && node.supportingMaterials.length > 0) {
        children.push({
          key: `${node.id}-materials`,
          title: (
            <span style={{ color: '#666' }}>
              <FileTextOutlined /> 佐证资料 ({node.supportingMaterials.length})
            </span>
          ),
          selectable: false,
          children: node.supportingMaterials.map(sm => ({
            key: `sm-${sm.id}`,
            title: (
              <span>
                <Tag color="green">{sm.code}</Tag>
                {sm.name}
                {sm.required && <Tag color="red" style={{ marginLeft: 8 }}>必传</Tag>}
              </span>
            ),
            isLeaf: true,
            selectable: false,
          })),
        });
      }

      const levelColors: Record<number, string> = {
        1: 'blue',
        2: 'green',
        3: 'orange',
      };

      return {
        key: node.id,
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <Tag color={levelColors[node.level] || 'default'}>{node.level}级</Tag>
            <span style={{ fontWeight: 500 }}>{node.code}</span>
            <span>{node.name}</span>
            {node.weight && <Tag style={{ marginLeft: 8 }}>权重: {node.weight}%</Tag>}
            <Space style={{ marginLeft: 'auto' }}>
              {node.level < 3 && (
                <Tooltip title="添加子指标">
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(node.id, node.level + 1);
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title="编辑">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(node);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="确定删除此指标吗？"
                description="删除后将同时删除所有子指标和关联数据"
                onConfirm={() => handleDelete(node.id)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            </Space>
          </div>
        ),
        children: children.length > 0 ? children : undefined,
        icon: ({ expanded }: { expanded?: boolean }) =>
          expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      };
    });
  };

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
          <h1 className={styles.title}>评估指标体系</h1>
          {projectName && <Tag color="blue">{projectName}</Tag>}
        </div>
        <Space>
          <Button
            icon={expandedKeys.size > 0 ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={expandedKeys.size > 0 ? handleCollapseAll : handleExpandAll}
          >
            {expandedKeys.size > 0 ? '收起全部' : '展开全部'}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            保存
          </Button>
        </Space>
      </div>

      {/* 指标体系信息 */}
      {systemName && (
        <Card size="small" className={styles.infoCard}>
          <div className={styles.systemInfo}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            <span>指标体系：{systemName}</span>
            <span style={{ marginLeft: 16, color: '#666' }}>
              共 {treeData.length} 个一级指标
            </span>
          </div>
        </Card>
      )}

      {/* 主内容区 */}
      <Card className={styles.mainCard}>
        <div className={styles.toolbar}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleAdd(null, 1)}
          >
            添加一级指标
          </Button>
        </div>

        <Spin spinning={loading}>
          {treeData.length > 0 ? (
            <Tree
              showLine={{ showLeafIcon: false }}
              showIcon
              expandedKeys={Array.from(expandedKeys)}
              onExpand={(keys) => setExpandedKeys(new Set(keys.map(String)))}
              treeData={buildTreeData(recalculateCodes(treeData))}
              className={styles.indicatorTree}
            />
          ) : (
            <Empty description="暂无指标数据，请添加一级指标" />
          )}
        </Spin>
      </Card>

      {/* 添加指标弹窗 */}
      <Modal
        title={`添加${addLevel}级指标`}
        open={addModalVisible}
        onOk={handleAddConfirm}
        onCancel={() => setAddModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="weight" label="权重（%）">
            <InputNumber min={0} max={100} placeholder="请输入权重" style={{ width: '100%' }} />
          </Form.Item>
          {addLevel < 3 && (
            <Form.Item name="isLeaf" label="是否为末级指标" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 编辑指标弹窗 */}
      <Modal
        title="编辑指标"
        open={editModalVisible}
        onOk={handleEditConfirm}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingNode(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="weight" label="权重（%）">
            <InputNumber min={0} max={100} placeholder="请输入权重" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectIndicatorSystem;
