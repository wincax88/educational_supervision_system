import React, { useState, useEffect } from 'react';
import { Button, Tree, Tag, Modal, Form, Input, Select, Switch, message, Tabs, Table, InputNumber, Popconfirm } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import {
  getIndicatorSystem,
  getIndicatorTree,
  saveIndicatorTree,
  Indicator,
  DataIndicator,
  SupportingMaterial,
  IndicatorSystem,
} from '../../services/indicatorService';
import './index.css';

const { TextArea } = Input;

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 生成指标编码
const generateCode = (parentCode: string, index: number): string => {
  const num = index + 1;
  return parentCode ? `${parentCode}.${num}` : String(num);
};

// 重新计算所有编码
const recalculateCodes = (nodes: Indicator[], parentCode: string = ''): Indicator[] => {
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

const IndicatorTreeEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id: systemId } = useParams<{ id: string }>();

  const [system, setSystem] = useState<IndicatorSystem | null>(null);
  const [treeData, setTreeData] = useState<Indicator[]>([]);
  const [selectedNode, setSelectedNode] = useState<Indicator | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addLevel, setAddLevel] = useState<number>(1);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载数据
  useEffect(() => {
    if (systemId) {
      loadData();
    }
  }, [systemId]);

  const loadData = async () => {
    if (!systemId) return;
    setLoading(true);
    try {
      const [systemData, tree] = await Promise.all([
        getIndicatorSystem(systemId),
        getIndicatorTree(systemId),
      ]);
      setSystem(systemData);
      setTreeData(tree);
      // 默认展开第一级
      setExpandedKeys(tree.map(node => node.id));
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 保存指标树
  const handleSave = async () => {
    if (!systemId) return;
    setSaving(true);
    try {
      await saveIndicatorTree(systemId, treeData);
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // 转换为Tree组件数据格式
  const convertToTreeData = (nodes: Indicator[]): DataNode[] => {
    return nodes.map(node => ({
      key: node.id,
      title: (
        <div className="tree-node-content">
          <Tag className="node-code">{node.code}</Tag>
          <span className="node-name">{node.name}</span>
          {node.isLeaf && <Tag color="green" className="leaf-tag">末级</Tag>}
        </div>
      ),
      children: node.children ? convertToTreeData(node.children) : undefined,
      isLeaf: node.isLeaf,
    }));
  };

  // 查找节点
  const findNode = (nodes: Indicator[], id: string): Indicator | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 选择节点
  const handleSelectNode = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const node = findNode(treeData, selectedKeys[0] as string);
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  };

  // 打开添加弹窗
  const handleOpenAddModal = (parentId: string | null, level: number) => {
    setAddParentId(parentId);
    setAddLevel(level);
    form.resetFields();
    form.setFieldsValue({ isLeaf: level === 3 });
    setAddModalVisible(true);
  };

  // 添加指标
  const handleAddIndicator = (values: { name: string; description?: string; isLeaf: boolean }) => {
    const newNode: Indicator = {
      id: generateId(),
      code: '', // 将重新计算
      name: values.name,
      description: values.description || '',
      level: addLevel,
      isLeaf: values.isLeaf,
      dataIndicators: values.isLeaf ? [] : undefined,
      supportingMaterials: values.isLeaf ? [] : undefined,
      children: values.isLeaf ? undefined : [],
    };

    const updateTree = (nodes: Indicator[], parentId: string | null): Indicator[] => {
      if (parentId === null) {
        return [...nodes, newNode];
      }
      return nodes.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            isLeaf: false,
            children: [...(node.children || []), newNode],
            dataIndicators: undefined,
            supportingMaterials: undefined,
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children, parentId) };
        }
        return node;
      });
    };

    const newTree = recalculateCodes(updateTree(treeData, addParentId));
    setTreeData(newTree);
    setAddModalVisible(false);
    message.success('添加成功');

    // 展开父节点
    if (addParentId) {
      setExpandedKeys([...expandedKeys, addParentId]);
    }
  };

  // 打开编辑弹窗
  const handleOpenEditModal = () => {
    if (!selectedNode) return;
    editForm.setFieldsValue({
      name: selectedNode.name,
      description: selectedNode.description,
      isLeaf: selectedNode.isLeaf,
      weight: selectedNode.weight,
    });
    setEditModalVisible(true);
  };

  // 更新指标
  const handleUpdateIndicator = (values: { name: string; description?: string; isLeaf: boolean; weight?: number }) => {
    if (!selectedNode) return;

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          const updated: Indicator = {
            ...node,
            name: values.name,
            description: values.description || '',
            isLeaf: values.isLeaf,
            weight: values.weight,
          };
          // 如果变为末级，初始化数据指标和佐证资料
          if (values.isLeaf && !node.isLeaf) {
            updated.dataIndicators = [];
            updated.supportingMaterials = [];
            updated.children = undefined;
          }
          // 如果变为非末级，初始化children
          if (!values.isLeaf && node.isLeaf) {
            updated.children = [];
            updated.dataIndicators = undefined;
            updated.supportingMaterials = undefined;
          }
          return updated;
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    const newTree = updateTree(treeData);
    setTreeData(newTree);
    setSelectedNode({ ...selectedNode, ...values });
    setEditModalVisible(false);
    message.success('更新成功');
  };

  // 删除指标
  const handleDeleteIndicator = () => {
    if (!selectedNode) return;

    const deleteFromTree = (nodes: Indicator[]): Indicator[] => {
      return nodes
        .filter(node => node.id !== selectedNode.id)
        .map(node => ({
          ...node,
          children: node.children ? deleteFromTree(node.children) : undefined,
        }));
    };

    const newTree = recalculateCodes(deleteFromTree(treeData));
    setTreeData(newTree);
    setSelectedNode(null);
    message.success('删除成功');
  };

  // 添加数据指标
  const handleAddDataIndicator = () => {
    if (!selectedNode || !selectedNode.isLeaf) return;

    const newDI: DataIndicator = {
      id: generateId(),
      code: `${selectedNode.code}-D${(selectedNode.dataIndicators?.length || 0) + 1}`,
      name: '新数据指标',
      threshold: '',
      description: '',
    };

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            dataIndicators: [...(node.dataIndicators || []), newDI],
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    setTreeData(updateTree(treeData));
    setSelectedNode({
      ...selectedNode,
      dataIndicators: [...(selectedNode.dataIndicators || []), newDI],
    });
  };

  // 更新数据指标
  const handleUpdateDataIndicator = (diId: string, field: keyof DataIndicator, value: string) => {
    if (!selectedNode) return;

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            dataIndicators: node.dataIndicators?.map(di =>
              di.id === diId ? { ...di, [field]: value } : di
            ),
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    const newTree = updateTree(treeData);
    setTreeData(newTree);
    setSelectedNode({
      ...selectedNode,
      dataIndicators: selectedNode.dataIndicators?.map(di =>
        di.id === diId ? { ...di, [field]: value } : di
      ),
    });
  };

  // 删除数据指标
  const handleDeleteDataIndicator = (diId: string) => {
    if (!selectedNode) return;

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            dataIndicators: node.dataIndicators?.filter(di => di.id !== diId),
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    const newTree = updateTree(treeData);
    setTreeData(newTree);
    setSelectedNode({
      ...selectedNode,
      dataIndicators: selectedNode.dataIndicators?.filter(di => di.id !== diId),
    });
  };

  // 添加佐证资料
  const handleAddMaterial = () => {
    if (!selectedNode || !selectedNode.isLeaf) return;

    const newSM: SupportingMaterial = {
      id: generateId(),
      code: `${selectedNode.code}-M${(selectedNode.supportingMaterials?.length || 0) + 1}`,
      name: '新佐证资料',
      fileTypes: 'PDF,Word,Excel',
      maxSize: '10MB',
      description: '',
      required: false,
    };

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            supportingMaterials: [...(node.supportingMaterials || []), newSM],
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    setTreeData(updateTree(treeData));
    setSelectedNode({
      ...selectedNode,
      supportingMaterials: [...(selectedNode.supportingMaterials || []), newSM],
    });
  };

  // 更新佐证资料
  const handleUpdateMaterial = (smId: string, field: keyof SupportingMaterial, value: string | boolean) => {
    if (!selectedNode) return;

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            supportingMaterials: node.supportingMaterials?.map(sm =>
              sm.id === smId ? { ...sm, [field]: value } : sm
            ),
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    const newTree = updateTree(treeData);
    setTreeData(newTree);
    setSelectedNode({
      ...selectedNode,
      supportingMaterials: selectedNode.supportingMaterials?.map(sm =>
        sm.id === smId ? { ...sm, [field]: value } : sm
      ),
    });
  };

  // 删除佐证资料
  const handleDeleteMaterial = (smId: string) => {
    if (!selectedNode) return;

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            supportingMaterials: node.supportingMaterials?.filter(sm => sm.id !== smId),
          };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    const newTree = updateTree(treeData);
    setTreeData(newTree);
    setSelectedNode({
      ...selectedNode,
      supportingMaterials: selectedNode.supportingMaterials?.filter(sm => sm.id !== smId),
    });
  };

  // 数据指标表格列
  const dataIndicatorColumns = [
    { title: '编码', dataIndex: 'code', key: 'code', width: 100 },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DataIndicator) => (
        <Input
          value={text}
          size="small"
          onChange={e => handleUpdateDataIndicator(record.id, 'name', e.target.value)}
        />
      ),
    },
    {
      title: '阈值要求',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 150,
      render: (text: string, record: DataIndicator) => (
        <Input
          value={text}
          size="small"
          placeholder="如: >=0.8"
          onChange={e => handleUpdateDataIndicator(record.id, 'threshold', e.target.value)}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, record: DataIndicator) => (
        <Input
          value={text}
          size="small"
          placeholder="指标说明"
          onChange={e => handleUpdateDataIndicator(record.id, 'description', e.target.value)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: unknown, record: DataIndicator) => (
        <Popconfirm title="确定删除?" onConfirm={() => handleDeleteDataIndicator(record.id)}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // 佐证资料表格列
  const materialColumns = [
    { title: '编码', dataIndex: 'code', key: 'code', width: 100 },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: SupportingMaterial) => (
        <Input
          value={text}
          size="small"
          onChange={e => handleUpdateMaterial(record.id, 'name', e.target.value)}
        />
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'fileTypes',
      key: 'fileTypes',
      width: 140,
      render: (text: string, record: SupportingMaterial) => (
        <Input
          value={text}
          size="small"
          placeholder="PDF,Word"
          onChange={e => handleUpdateMaterial(record.id, 'fileTypes', e.target.value)}
        />
      ),
    },
    {
      title: '大小限制',
      dataIndex: 'maxSize',
      key: 'maxSize',
      width: 100,
      render: (text: string, record: SupportingMaterial) => (
        <Input
          value={text}
          size="small"
          placeholder="10MB"
          onChange={e => handleUpdateMaterial(record.id, 'maxSize', e.target.value)}
        />
      ),
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: 60,
      render: (value: boolean, record: SupportingMaterial) => (
        <Switch
          size="small"
          checked={value}
          onChange={checked => handleUpdateMaterial(record.id, 'required', checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: unknown, record: SupportingMaterial) => (
        <Popconfirm title="确定删除?" onConfirm={() => handleDeleteMaterial(record.id)}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="indicator-tree-edit-page">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="header-left">
          <span className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className="page-title">编辑指标树</h1>
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存指标树
        </Button>
      </div>

      {/* 指标体系信息 */}
      {system && (
        <div className="system-info-card">
          <div className="system-info-header">
            <span className="system-name">{system.name}</span>
            <Tag color={system.type === '达标类' ? 'blue' : 'purple'}>{system.type}</Tag>
            <Tag color="cyan">评估对象: {system.target}</Tag>
          </div>
          <p className="system-desc">{system.description}</p>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="main-content">
        {/* 左侧指标树 */}
        <div className="tree-panel">
          <div className="panel-header">
            <h3>指标结构</h3>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleOpenAddModal(null, 1)}>
              添加一级指标
            </Button>
          </div>
          <div className="tree-container">
            {treeData.length > 0 ? (
              <Tree
                treeData={convertToTreeData(treeData)}
                selectedKeys={selectedNode ? [selectedNode.id] : []}
                expandedKeys={expandedKeys}
                onSelect={handleSelectNode}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                blockNode
              />
            ) : (
              <div className="empty-tree">
                <FileTextOutlined className="empty-icon" />
                <p>暂无指标，点击上方按钮添加</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧详情面板 */}
        <div className="detail-panel">
          {selectedNode ? (
            <>
              <div className="panel-header">
                <h3>
                  <Tag color="blue">{selectedNode.code}</Tag>
                  {selectedNode.name}
                </h3>
                <div className="header-actions">
                  {selectedNode.level < 3 && !selectedNode.isLeaf && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenAddModal(selectedNode.id, selectedNode.level + 1)}
                    >
                      添加子指标
                    </Button>
                  )}
                  <Button size="small" icon={<EditOutlined />} onClick={handleOpenEditModal}>
                    编辑
                  </Button>
                  <Popconfirm title="确定删除该指标及其子指标?" onConfirm={handleDeleteIndicator}>
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <div className="indicator-info">
                <div className="info-item">
                  <label>层级</label>
                  <span>{selectedNode.level}级指标</span>
                </div>
                <div className="info-item">
                  <label>类型</label>
                  <Tag color={selectedNode.isLeaf ? 'green' : 'default'}>
                    {selectedNode.isLeaf ? '末级指标' : '分类指标'}
                  </Tag>
                </div>
                {selectedNode.description && (
                  <div className="info-item full">
                    <label>描述</label>
                    <span>{selectedNode.description}</span>
                  </div>
                )}
              </div>

              {selectedNode.isLeaf && (
                <Tabs
                  defaultActiveKey="dataIndicators"
                  items={[
                    {
                      key: 'dataIndicators',
                      label: (
                        <span>
                          <DatabaseOutlined /> 数据指标 ({selectedNode.dataIndicators?.length || 0})
                        </span>
                      ),
                      children: (
                        <div className="config-section">
                          <div className="section-header">
                            <span>配置该指标的评价数据指标</span>
                            <Button size="small" icon={<PlusOutlined />} onClick={handleAddDataIndicator}>
                              添加
                            </Button>
                          </div>
                          <Table
                            dataSource={selectedNode.dataIndicators || []}
                            columns={dataIndicatorColumns}
                            rowKey="id"
                            size="small"
                            pagination={false}
                          />
                        </div>
                      ),
                    },
                    {
                      key: 'materials',
                      label: (
                        <span>
                          <FileTextOutlined /> 佐证资料 ({selectedNode.supportingMaterials?.length || 0})
                        </span>
                      ),
                      children: (
                        <div className="config-section">
                          <div className="section-header">
                            <span>配置需要上传的佐证资料</span>
                            <Button size="small" icon={<PlusOutlined />} onClick={handleAddMaterial}>
                              添加
                            </Button>
                          </div>
                          <Table
                            dataSource={selectedNode.supportingMaterials || []}
                            columns={materialColumns}
                            rowKey="id"
                            size="small"
                            pagination={false}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              )}

              {!selectedNode.isLeaf && selectedNode.children && selectedNode.children.length > 0 && (
                <div className="children-list">
                  <h4>子指标 ({selectedNode.children.length})</h4>
                  <div className="children-items">
                    {selectedNode.children.map(child => (
                      <div key={child.id} className="child-item" onClick={() => setSelectedNode(child)}>
                        <Tag>{child.code}</Tag>
                        <span>{child.name}</span>
                        {child.isLeaf && <Tag color="green" className="leaf-tag">末级</Tag>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-detail">
              <FileTextOutlined className="empty-icon" />
              <p>选择一个指标查看详情</p>
            </div>
          )}
        </div>
      </div>

      {/* 添加指标弹窗 */}
      <Modal
        title={`添加${addLevel}级指标`}
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} onFinish={handleAddIndicator} layout="vertical">
          <Form.Item
            label="指标名称"
            name="name"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea placeholder="请输入指标描述" rows={3} />
          </Form.Item>
          <Form.Item
            label="是否末级指标"
            name="isLeaf"
            valuePropName="checked"
            extra={addLevel === 3 ? '三级指标必须为末级指标' : '末级指标可配置数据指标和佐证资料'}
          >
            <Switch disabled={addLevel === 3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setAddModalVisible(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑指标弹窗 */}
      <Modal
        title="编辑指标"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={editForm} onFinish={handleUpdateIndicator} layout="vertical">
          <Form.Item
            label="指标名称"
            name="name"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea placeholder="请输入指标描述" rows={3} />
          </Form.Item>
          <Form.Item label="权重" name="weight">
            <InputNumber placeholder="如: 10" min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="是否末级指标"
            name="isLeaf"
            valuePropName="checked"
            extra="切换后将影响子指标和数据指标配置"
          >
            <Switch disabled={selectedNode?.level === 3 || (selectedNode?.children?.length || 0) > 0} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setEditModalVisible(false)} style={{ marginRight: 8 }}>
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

export default IndicatorTreeEdit;
