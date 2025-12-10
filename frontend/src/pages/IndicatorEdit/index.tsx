import React, { useState, useEffect } from 'react';
import { Button, Tag, Modal, Form, Input, Switch, Checkbox, message, Select, InputNumber } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UpOutlined,
  DownOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CloseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  indicatorSystems,
  indicatorTrees,
  Indicator,
  IndicatorSystem,
  DataIndicator,
  SupportingMaterial,
} from '../../mock/data';
import './index.css';

const IndicatorEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [system, setSystem] = useState<IndicatorSystem | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // 弹窗状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addFirstLevelModalVisible, setAddFirstLevelModalVisible] = useState(false);
  const [addChildModalVisible, setAddChildModalVisible] = useState(false);
  const [currentIndicator, setCurrentIndicator] = useState<Indicator | null>(null);
  const [parentIndicator, setParentIndicator] = useState<Indicator | null>(null);

  // 编辑指标弹窗中的数据指标和佐证资料状态
  const [editingDataIndicators, setEditingDataIndicators] = useState<DataIndicator[]>([]);
  const [editingSupportingMaterials, setEditingSupportingMaterials] = useState<SupportingMaterial[]>([]);

  // 新增数据指标/佐证资料的编辑状态
  const [addingDataIndicator, setAddingDataIndicator] = useState(false);
  const [addingSupportingMaterial, setAddingSupportingMaterial] = useState(false);
  const [editingDataIndicatorId, setEditingDataIndicatorId] = useState<string | null>(null);
  const [editingSupportingMaterialId, setEditingSupportingMaterialId] = useState<string | null>(null);

  // 新增数据指标表单数据
  const [newDataIndicator, setNewDataIndicator] = useState({
    elementType: '幼儿园',
    name: '',
    thresholdType: '单值比较',
    precision: '2位',
    compareOp: '>=',
    thresholdValue: '',
    description: '',
  });

  // 新增佐证资料表单数据
  const [newSupportingMaterial, setNewSupportingMaterial] = useState({
    elementType: '幼儿园',
    name: '',
    maxSize: 10,
    fileTypes: ['PDF', 'Word'],
    description: '',
  });

  const [editForm] = Form.useForm();
  const [addFirstLevelForm] = Form.useForm();
  const [addChildForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      const foundSystem = indicatorSystems.find(s => s.id === id);
      if (foundSystem) {
        setSystem(foundSystem);
        const tree = indicatorTrees[id] || [];
        setIndicators(tree);
        // 默认展开所有一级指标
        setExpandedKeys(tree.map(i => i.id));
      }
    }
  }, [id]);

  const toggleExpand = (indicatorId: string) => {
    setExpandedKeys(prev =>
      prev.includes(indicatorId)
        ? prev.filter(k => k !== indicatorId)
        : [...prev, indicatorId]
    );
  };

  const expandAll = () => {
    const getAllKeys = (items: Indicator[]): string[] => {
      let keys: string[] = [];
      items.forEach(item => {
        keys.push(item.id);
        if (item.children) {
          keys = keys.concat(getAllKeys(item.children));
        }
      });
      return keys;
    };
    setExpandedKeys(getAllKeys(indicators));
  };

  const collapseAll = () => {
    setExpandedKeys([]);
  };

  const handleEditIndicator = (indicator: Indicator) => {
    setCurrentIndicator(indicator);
    setEditingDataIndicators(indicator.dataIndicators ? [...indicator.dataIndicators] : []);
    setEditingSupportingMaterials(indicator.supportingMaterials ? [...indicator.supportingMaterials] : []);
    setAddingDataIndicator(false);
    setAddingSupportingMaterial(false);
    setEditingDataIndicatorId(null);
    setEditingSupportingMaterialId(null);
    editForm.setFieldsValue({
      name: indicator.name,
      description: indicator.description,
      isLeaf: indicator.isLeaf,
      hasDataIndicator: indicator.dataIndicators && indicator.dataIndicators.length > 0,
      hasSupportingMaterial: indicator.supportingMaterials && indicator.supportingMaterials.length > 0,
    });
    setEditModalVisible(true);
  };

  const handleSaveIndicator = (values: any) => {
    if (currentIndicator) {
      const updateIndicator = (items: Indicator[]): Indicator[] => {
        return items.map(item => {
          if (item.id === currentIndicator.id) {
            return {
              ...item,
              name: values.name,
              description: values.description,
              isLeaf: values.isLeaf,
              dataIndicators: values.isLeaf ? editingDataIndicators : undefined,
              supportingMaterials: values.isLeaf ? editingSupportingMaterials : undefined,
            };
          }
          if (item.children) {
            return { ...item, children: updateIndicator(item.children) };
          }
          return item;
        });
      };
      setIndicators(updateIndicator(indicators));
      setEditModalVisible(false);
      message.success('保存成功');
    }
  };

  // 新增数据指标
  const handleAddDataIndicator = () => {
    setAddingDataIndicator(true);
    setNewDataIndicator({
      elementType: '幼儿园',
      name: '',
      thresholdType: '单值比较',
      precision: '2位',
      compareOp: '>=',
      thresholdValue: '',
      description: '',
    });
  };

  const handleConfirmAddDataIndicator = () => {
    if (!newDataIndicator.name) {
      message.error('请输入数据指标名称');
      return;
    }
    const newId = `D${Date.now()}`;
    const code = `${currentIndicator?.code}-D${editingDataIndicators.length + 1}`;
    const threshold = `${newDataIndicator.compareOp} ${newDataIndicator.thresholdValue}`;

    const newItem: DataIndicator = {
      id: newId,
      code,
      name: `${newDataIndicator.name} ${threshold}`,
      threshold,
      description: newDataIndicator.description || '根据国家和省级相关标准要求，结合学校实际情况进行综合评估',
    };

    setEditingDataIndicators([...editingDataIndicators, newItem]);
    setAddingDataIndicator(false);
  };

  const handleCancelAddDataIndicator = () => {
    setAddingDataIndicator(false);
  };

  const handleDeleteDataIndicator = (dataId: string) => {
    setEditingDataIndicators(editingDataIndicators.filter(d => d.id !== dataId));
  };

  // 编辑数据指标
  const handleEditDataIndicator = (dataIndicator: DataIndicator) => {
    setEditingDataIndicatorId(dataIndicator.id);
    // 解析现有数据填充表单
    const thresholdMatch = dataIndicator.threshold.match(/(>=|<=|>|<|=)\s*(.+)/);
    setNewDataIndicator({
      elementType: '幼儿园',
      name: dataIndicator.name.replace(/\s*(>=|<=|>|<|=)\s*[\d.]+$/, ''),
      thresholdType: '单值比较',
      precision: '2位',
      compareOp: thresholdMatch ? thresholdMatch[1] : '>=',
      thresholdValue: thresholdMatch ? thresholdMatch[2] : '',
      description: dataIndicator.description,
    });
  };

  const handleConfirmEditDataIndicator = () => {
    if (!newDataIndicator.name) {
      message.error('请输入数据指标名称');
      return;
    }
    const threshold = `${newDataIndicator.compareOp} ${newDataIndicator.thresholdValue}`;

    setEditingDataIndicators(editingDataIndicators.map(d => {
      if (d.id === editingDataIndicatorId) {
        return {
          ...d,
          name: `${newDataIndicator.name} ${threshold}`,
          threshold,
          description: newDataIndicator.description || d.description,
        };
      }
      return d;
    }));
    setEditingDataIndicatorId(null);
  };

  const handleCancelEditDataIndicator = () => {
    setEditingDataIndicatorId(null);
  };

  // 新增佐证资料
  const handleAddSupportingMaterial = () => {
    setAddingSupportingMaterial(true);
    setNewSupportingMaterial({
      elementType: '幼儿园',
      name: '',
      maxSize: 10,
      fileTypes: ['PDF', 'Word'],
      description: '',
    });
  };

  const handleConfirmAddSupportingMaterial = () => {
    if (!newSupportingMaterial.name) {
      message.error('请输入佐证资料名称');
      return;
    }
    const newId = `M${Date.now()}`;
    const code = `${currentIndicator?.code}-M${editingSupportingMaterials.length + 1}`;

    const newItem: SupportingMaterial = {
      id: newId,
      code,
      name: newSupportingMaterial.name,
      fileTypes: newSupportingMaterial.fileTypes.join(', '),
      maxSize: `${newSupportingMaterial.maxSize}MB`,
      description: newSupportingMaterial.description || '需提供能够证明该指标达标情况的相关文件、数据统计表或其他支撑材料',
    };

    setEditingSupportingMaterials([...editingSupportingMaterials, newItem]);
    setAddingSupportingMaterial(false);
  };

  const handleCancelAddSupportingMaterial = () => {
    setAddingSupportingMaterial(false);
  };

  const handleDeleteSupportingMaterial = (materialId: string) => {
    setEditingSupportingMaterials(editingSupportingMaterials.filter(m => m.id !== materialId));
  };

  // 编辑佐证资料
  const handleEditSupportingMaterial = (material: SupportingMaterial) => {
    setEditingSupportingMaterialId(material.id);
    const fileTypes = material.fileTypes.split(', ').map(t => t.trim());
    const maxSizeMatch = material.maxSize.match(/(\d+)/);
    setNewSupportingMaterial({
      elementType: '幼儿园',
      name: material.name,
      maxSize: maxSizeMatch ? parseInt(maxSizeMatch[1]) : 10,
      fileTypes,
      description: material.description,
    });
  };

  const handleConfirmEditSupportingMaterial = () => {
    if (!newSupportingMaterial.name) {
      message.error('请输入佐证资料名称');
      return;
    }

    setEditingSupportingMaterials(editingSupportingMaterials.map(m => {
      if (m.id === editingSupportingMaterialId) {
        return {
          ...m,
          name: newSupportingMaterial.name,
          fileTypes: newSupportingMaterial.fileTypes.join(', '),
          maxSize: `${newSupportingMaterial.maxSize}MB`,
          description: newSupportingMaterial.description || m.description,
        };
      }
      return m;
    }));
    setEditingSupportingMaterialId(null);
  };

  const handleCancelEditSupportingMaterial = () => {
    setEditingSupportingMaterialId(null);
  };

  const handleAddFirstLevel = () => {
    addFirstLevelForm.resetFields();
    setAddFirstLevelModalVisible(true);
  };

  const handleSaveFirstLevel = (values: any) => {
    const newIndicator: Indicator = {
      id: `I${indicators.length + 1}`,
      code: String(indicators.length + 1),
      name: values.name,
      description: values.description || '',
      level: 1,
      isLeaf: values.isLeaf || false,
      children: values.isLeaf ? undefined : [],
      dataIndicators: values.isLeaf ? [] : undefined,
      supportingMaterials: values.isLeaf ? [] : undefined,
    };
    setIndicators([...indicators, newIndicator]);
    setAddFirstLevelModalVisible(false);
    message.success('添加成功');
  };

  const handleAddChild = (parent: Indicator) => {
    setParentIndicator(parent);
    addChildForm.resetFields();
    setAddChildModalVisible(true);
  };

  const handleSaveChild = (values: any) => {
    if (parentIndicator) {
      const childCount = parentIndicator.children?.length || 0;
      const newIndicator: Indicator = {
        id: `${parentIndicator.id}-${childCount + 1}`,
        code: `${parentIndicator.code}.${childCount + 1}`,
        name: values.name,
        description: values.description || '',
        level: parentIndicator.level + 1,
        isLeaf: values.isLeaf || false,
        children: values.isLeaf ? undefined : [],
        dataIndicators: values.isLeaf ? [] : undefined,
        supportingMaterials: values.isLeaf ? [] : undefined,
      };

      const addChildToParent = (items: Indicator[]): Indicator[] => {
        return items.map(item => {
          if (item.id === parentIndicator.id) {
            return {
              ...item,
              children: [...(item.children || []), newIndicator],
            };
          }
          if (item.children) {
            return { ...item, children: addChildToParent(item.children) };
          }
          return item;
        });
      };

      setIndicators(addChildToParent(indicators));
      setExpandedKeys(prev => prev.includes(parentIndicator.id) ? prev : [...prev, parentIndicator.id]);
      setAddChildModalVisible(false);
      message.success('添加成功');
    }
  };

  const handleDeleteIndicator = (indicatorId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该指标吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const deleteFromTree = (items: Indicator[]): Indicator[] => {
          return items
            .filter(item => item.id !== indicatorId)
            .map(item => ({
              ...item,
              children: item.children ? deleteFromTree(item.children) : undefined,
            }));
        };
        setIndicators(deleteFromTree(indicators));
        message.success('删除成功');
      },
    });
  };

  // 上移指标
  const handleMoveUp = (indicator: Indicator, index: number, siblings: Indicator[], parentPath: Indicator[]) => {
    if (index === 0) {
      message.warning('已经是第一个，无法上移');
      return;
    }

    const newSiblings = [...siblings];
    [newSiblings[index - 1], newSiblings[index]] = [newSiblings[index], newSiblings[index - 1]];

    if (parentPath.length === 0) {
      // 一级指标
      setIndicators(newSiblings);
    } else {
      // 子指标，需要更新父级
      const updateTree = (items: Indicator[]): Indicator[] => {
        return items.map(item => {
          if (item.id === parentPath[parentPath.length - 1].id) {
            return { ...item, children: newSiblings };
          }
          if (item.children) {
            return { ...item, children: updateTree(item.children) };
          }
          return item;
        });
      };
      setIndicators(updateTree(indicators));
    }
    message.success('上移成功');
  };

  // 下移指标
  const handleMoveDown = (indicator: Indicator, index: number, siblings: Indicator[], parentPath: Indicator[]) => {
    if (index === siblings.length - 1) {
      message.warning('已经是最后一个，无法下移');
      return;
    }

    const newSiblings = [...siblings];
    [newSiblings[index], newSiblings[index + 1]] = [newSiblings[index + 1], newSiblings[index]];

    if (parentPath.length === 0) {
      // 一级指标
      setIndicators(newSiblings);
    } else {
      // 子指标，需要更新父级
      const updateTree = (items: Indicator[]): Indicator[] => {
        return items.map(item => {
          if (item.id === parentPath[parentPath.length - 1].id) {
            return { ...item, children: newSiblings };
          }
          if (item.children) {
            return { ...item, children: updateTree(item.children) };
          }
          return item;
        });
      };
      setIndicators(updateTree(indicators));
    }
    message.success('下移成功');
  };

  // 升级指标（提升一个层级，变成父级的兄弟）
  const handlePromote = (indicator: Indicator, index: number, siblings: Indicator[], parentPath: Indicator[]) => {
    if (parentPath.length === 0) {
      message.warning('一级指标无法升级');
      return;
    }

    const parent = parentPath[parentPath.length - 1];
    const grandParentPath = parentPath.slice(0, -1);

    // 从当前位置移除指标
    const newSiblings = siblings.filter(s => s.id !== indicator.id);

    // 更新指标的层级
    const promotedIndicator: Indicator = {
      ...indicator,
      level: indicator.level - 1,
      children: indicator.children?.map(child => updateChildLevel(child, -1)),
    };

    const updateTree = (items: Indicator[]): Indicator[] => {
      return items.map(item => {
        if (item.id === parent.id) {
          // 更新父级的子节点（移除当前指标）
          return { ...item, children: newSiblings.length > 0 ? newSiblings : undefined };
        }
        if (item.children) {
          return { ...item, children: updateTree(item.children) };
        }
        return item;
      });
    };

    // 先更新树（移除指标）
    let newIndicators = updateTree(indicators);

    // 然后在父级的后面插入指标
    if (grandParentPath.length === 0) {
      // 父级是一级指标，插入到一级指标列表中父级后面
      const parentIndex = newIndicators.findIndex(i => i.id === parent.id);
      newIndicators = [
        ...newIndicators.slice(0, parentIndex + 1),
        promotedIndicator,
        ...newIndicators.slice(parentIndex + 1),
      ];
    } else {
      // 父级是子指标
      const grandParent = grandParentPath[grandParentPath.length - 1];
      const insertAfterParent = (items: Indicator[]): Indicator[] => {
        return items.map(item => {
          if (item.id === grandParent.id && item.children) {
            const parentIndex = item.children.findIndex(c => c.id === parent.id);
            const newChildren = [
              ...item.children.slice(0, parentIndex + 1),
              promotedIndicator,
              ...item.children.slice(parentIndex + 1),
            ];
            return { ...item, children: newChildren };
          }
          if (item.children) {
            return { ...item, children: insertAfterParent(item.children) };
          }
          return item;
        });
      };
      newIndicators = insertAfterParent(newIndicators);
    }

    setIndicators(newIndicators);
    message.success('升级成功');
  };

  // 降级指标（降低一个层级，变成前一个兄弟的子级）
  const handleDemote = (indicator: Indicator, index: number, siblings: Indicator[], parentPath: Indicator[]) => {
    if (index === 0) {
      message.warning('第一个指标无法降级，需要有前一个兄弟指标');
      return;
    }

    const prevSibling = siblings[index - 1];
    if (prevSibling.isLeaf) {
      message.warning('前一个指标是末级指标，无法将当前指标降级为其子指标');
      return;
    }

    // 更新指标的层级
    const demotedIndicator: Indicator = {
      ...indicator,
      level: indicator.level + 1,
      children: indicator.children?.map(child => updateChildLevel(child, 1)),
    };

    const updateTree = (items: Indicator[]): Indicator[] => {
      return items.map(item => {
        if (item.id === prevSibling.id) {
          // 将指标添加到前一个兄弟的子节点末尾
          return {
            ...item,
            children: [...(item.children || []), demotedIndicator],
          };
        }
        if (item.children) {
          return { ...item, children: updateTree(item.children) };
        }
        return item;
      });
    };

    if (parentPath.length === 0) {
      // 一级指标
      let newIndicators = indicators.filter(i => i.id !== indicator.id);
      newIndicators = updateTree(newIndicators);
      setIndicators(newIndicators);
    } else {
      // 子指标
      const updateParent = (items: Indicator[]): Indicator[] => {
        return items.map(item => {
          if (item.id === parentPath[parentPath.length - 1].id) {
            // 更新父级的子节点
            let updatedChildren = (item.children || []).filter(c => c.id !== indicator.id);
            updatedChildren = updatedChildren.map(child => {
              if (child.id === prevSibling.id) {
                return {
                  ...child,
                  children: [...(child.children || []), demotedIndicator],
                };
              }
              return child;
            });
            return { ...item, children: updatedChildren };
          }
          if (item.children) {
            return { ...item, children: updateParent(item.children) };
          }
          return item;
        });
      };
      setIndicators(updateParent(indicators));
    }

    // 展开前一个兄弟节点
    setExpandedKeys(prev => prev.includes(prevSibling.id) ? prev : [...prev, prevSibling.id]);
    message.success('降级成功');
  };

  // 辅助函数：更新子节点的层级
  const updateChildLevel = (indicator: Indicator, levelDiff: number): Indicator => {
    return {
      ...indicator,
      level: indicator.level + levelDiff,
      children: indicator.children?.map(child => updateChildLevel(child, levelDiff)),
    };
  };

  const getLevelTag = (level: number) => {
    const colors: { [key: number]: string } = {
      1: '#1890ff',
      2: '#722ed1',
      3: '#13c2c2',
    };
    return (
      <Tag color={colors[level]} className="level-tag">
        L{level}
      </Tag>
    );
  };

  // 渲染数据指标表单（新增或编辑）
  const renderDataIndicatorForm = (isEdit: boolean = false, dataIndicator?: DataIndicator) => {
    const code = isEdit && dataIndicator ? dataIndicator.code : `${currentIndicator?.code}-D${editingDataIndicators.length + 1}`;

    return (
      <div className="inline-form data-indicator-form">
        <div className="form-row">
          <Tag color="orange" className="form-code">{code}</Tag>
          <Select
            value={newDataIndicator.elementType}
            onChange={(v) => setNewDataIndicator({ ...newDataIndicator, elementType: v })}
            style={{ width: 100 }}
            size="small"
          >
            <Select.Option value="幼儿园">【幼儿园】</Select.Option>
            <Select.Option value="小学">【小学】</Select.Option>
            <Select.Option value="初中">【初中】</Select.Option>
          </Select>
          <span className="form-dot">.</span>
          <Input
            placeholder="数据指标名称"
            value={newDataIndicator.name}
            onChange={(e) => setNewDataIndicator({ ...newDataIndicator, name: e.target.value })}
            style={{ width: 200 }}
            size="small"
          />
        </div>
        <div className="form-row">
          <span className="form-label">达标阈值</span>
          <Select
            value={newDataIndicator.thresholdType}
            onChange={(v) => setNewDataIndicator({ ...newDataIndicator, thresholdType: v })}
            style={{ width: 100 }}
            size="small"
          >
            <Select.Option value="单值比较">单值比较</Select.Option>
            <Select.Option value="区间比较">区间比较</Select.Option>
          </Select>
          <span className="form-label">精确位数</span>
          <Select
            value={newDataIndicator.precision}
            onChange={(v) => setNewDataIndicator({ ...newDataIndicator, precision: v })}
            style={{ width: 80 }}
            size="small"
          >
            <Select.Option value="0位">0位</Select.Option>
            <Select.Option value="1位">1位</Select.Option>
            <Select.Option value="2位">2位</Select.Option>
            <Select.Option value="3位">3位</Select.Option>
          </Select>
        </div>
        <div className="form-row">
          <Tag color="orange">【数据指标】</Tag>
          <Select
            value={newDataIndicator.compareOp}
            onChange={(v) => setNewDataIndicator({ ...newDataIndicator, compareOp: v })}
            style={{ width: 70 }}
            size="small"
          >
            <Select.Option value=">">{'>'}</Select.Option>
            <Select.Option value="<">{'<'}</Select.Option>
            <Select.Option value=">=">{'>='}</Select.Option>
            <Select.Option value="<=">{'<='}</Select.Option>
            <Select.Option value="=">{'='}</Select.Option>
          </Select>
          <Input
            placeholder="精确到2位小数"
            value={newDataIndicator.thresholdValue}
            onChange={(e) => setNewDataIndicator({ ...newDataIndicator, thresholdValue: e.target.value })}
            style={{ width: 200 }}
            size="small"
          />
        </div>
        <div className="form-row">
          <span className="form-label">数据指标说明</span>
        </div>
        <Input.TextArea
          placeholder="请输入数据指标说明（非必填）"
          value={newDataIndicator.description}
          onChange={(e) => setNewDataIndicator({ ...newDataIndicator, description: e.target.value })}
          rows={2}
          style={{ marginBottom: 12 }}
        />
        <div className="form-actions">
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={isEdit ? handleCancelEditDataIndicator : handleCancelAddDataIndicator}
          >
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={isEdit ? handleConfirmEditDataIndicator : handleConfirmAddDataIndicator}
          >
            确认
          </Button>
        </div>
      </div>
    );
  };

  // 渲染佐证资料表单（新增或编辑）
  const renderSupportingMaterialForm = (isEdit: boolean = false, material?: SupportingMaterial) => {
    const code = isEdit && material ? material.code : `${currentIndicator?.code}-M${editingSupportingMaterials.length + 1}`;
    const fileTypeOptions = ['PDF', 'Word', 'Excel', 'JPG', 'PNG'];

    return (
      <div className="inline-form supporting-material-form">
        <div className="form-row">
          <Tag color="cyan" className="form-code">{code}</Tag>
          <Select
            value={newSupportingMaterial.elementType}
            onChange={(v) => setNewSupportingMaterial({ ...newSupportingMaterial, elementType: v })}
            style={{ width: 100 }}
            size="small"
          >
            <Select.Option value="幼儿园">【幼儿园】</Select.Option>
            <Select.Option value="小学">【小学】</Select.Option>
            <Select.Option value="初中">【初中】</Select.Option>
          </Select>
          <span className="form-dot">.</span>
          <Input
            placeholder="佐证资料名称"
            value={newSupportingMaterial.name}
            onChange={(e) => setNewSupportingMaterial({ ...newSupportingMaterial, name: e.target.value })}
            style={{ width: 200 }}
            size="small"
          />
          <span className="form-label" style={{ marginLeft: 16 }}>大小(MB)</span>
          <InputNumber
            value={newSupportingMaterial.maxSize}
            onChange={(v) => setNewSupportingMaterial({ ...newSupportingMaterial, maxSize: v || 10 })}
            style={{ width: 80 }}
            size="small"
            min={1}
            max={100}
          />
        </div>
        <div className="form-row">
          <span className="form-label">文件格式:</span>
          <div className="file-type-tags">
            {fileTypeOptions.map(type => (
              <Tag
                key={type}
                className={`file-type-tag ${newSupportingMaterial.fileTypes.includes(type) ? 'selected' : ''}`}
                onClick={() => {
                  const types = newSupportingMaterial.fileTypes.includes(type)
                    ? newSupportingMaterial.fileTypes.filter(t => t !== type)
                    : [...newSupportingMaterial.fileTypes, type];
                  setNewSupportingMaterial({ ...newSupportingMaterial, fileTypes: types });
                }}
              >
                {type}
              </Tag>
            ))}
          </div>
        </div>
        <div className="form-row">
          <span className="form-label">佐证资料说明</span>
        </div>
        <Input.TextArea
          placeholder="请输入佐证资料说明（选填）"
          value={newSupportingMaterial.description}
          onChange={(e) => setNewSupportingMaterial({ ...newSupportingMaterial, description: e.target.value })}
          rows={2}
          style={{ marginBottom: 12 }}
        />
        <div className="form-actions">
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={isEdit ? handleCancelEditSupportingMaterial : handleCancelAddSupportingMaterial}
          >
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={isEdit ? handleConfirmEditSupportingMaterial : handleConfirmAddSupportingMaterial}
          >
            确认
          </Button>
        </div>
      </div>
    );
  };

  const renderIndicatorItem = (indicator: Indicator, index: number, siblings: Indicator[], parentPath: Indicator[] = []) => {
    const isExpanded = expandedKeys.includes(indicator.id);
    const hasChildren = indicator.children && indicator.children.length > 0;

    return (
      <div key={indicator.id} className="indicator-item">
        <div className="indicator-row">
          <div className="indicator-main">
            {(hasChildren || !indicator.isLeaf) && (
              <span
                className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(indicator.id)}
              >
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </span>
            )}
            {indicator.isLeaf && !hasChildren && <span className="expand-placeholder" />}
            {getLevelTag(indicator.level)}
            <Tag className="code-tag">{indicator.code}</Tag>
            <span className="indicator-name">{indicator.name}</span>
          </div>
          {indicator.description && (
            <div className="indicator-desc">{indicator.description}</div>
          )}
          {indicator.isLeaf && (
            <div className="indicator-details">
              {indicator.dataIndicators && indicator.dataIndicators.map(d => (
                <div key={d.id} className="detail-row">
                  <Tag color="orange" className="detail-code">{d.code}</Tag>
                  <Tag color="orange">数据指标</Tag>
                  <Tag>{d.name} {d.threshold}</Tag>
                  <div className="detail-desc">{d.description}</div>
                </div>
              ))}
              {indicator.supportingMaterials && indicator.supportingMaterials.map(m => (
                <div key={m.id} className="detail-row">
                  <Tag color="cyan" className="detail-code">{m.code}</Tag>
                  <Tag color="cyan">佐证资料</Tag>
                  <span className="material-name">{m.name} ({m.fileTypes})</span>
                  <div className="detail-desc">{m.description}</div>
                </div>
              ))}
            </div>
          )}
          <div className="indicator-actions">
            <UpOutlined
              className={`action-icon ${index === 0 ? 'disabled' : ''}`}
              title="上移"
              onClick={() => handleMoveUp(indicator, index, siblings, parentPath)}
            />
            <DownOutlined
              className={`action-icon ${index === siblings.length - 1 ? 'disabled' : ''}`}
              title="下移"
              onClick={() => handleMoveDown(indicator, index, siblings, parentPath)}
            />
            <LeftOutlined
              className={`action-icon ${parentPath.length === 0 ? 'disabled' : ''}`}
              title="升级"
              onClick={() => handlePromote(indicator, index, siblings, parentPath)}
            />
            <RightOutlined
              className={`action-icon ${index === 0 || siblings[index - 1]?.isLeaf ? 'disabled' : ''}`}
              title="降级"
              onClick={() => handleDemote(indicator, index, siblings, parentPath)}
            />
            {!indicator.isLeaf && (
              <PlusOutlined className="action-icon" title="添加下级" onClick={() => handleAddChild(indicator)} />
            )}
            <EditOutlined className="action-icon" title="编辑" onClick={() => handleEditIndicator(indicator)} />
            <DeleteOutlined className="action-icon danger" title="删除" onClick={() => handleDeleteIndicator(indicator.id)} />
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="indicator-children">
            {indicator.children!.map((child, idx) =>
              renderIndicatorItem(child, idx, indicator.children!, [...parentPath, indicator])
            )}
          </div>
        )}
      </div>
    );
  };

  if (!system) {
    return <div className="indicator-edit-page">加载中...</div>;
  }

  return (
    <div className="indicator-edit-page">
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate('/home/balanced/indicators')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className="page-title">编辑指标</h1>
      </div>

      <div className="system-info-card">
        <div className="system-info-header">
          <div className="system-info-title">
            <span className="title-text">{system.name}</span>
            <Tag color="orange">{system.type}</Tag>
            <Tag color="cyan">评估对象: {system.target}</Tag>
          </div>
          <div className="system-info-stats">
            <span>指标数: {system.indicatorCount}</span>
            <Tag color="green">
              <CheckCircleOutlined /> {system.status === 'published' ? '已发布' : system.status === 'editing' ? '编辑中' : '草稿'}
            </Tag>
          </div>
        </div>
        <p className="system-info-desc">{system.description}</p>
        <div className="system-attachments">
          {system.attachments.map(att => (
            <Tag key={att.name} color="blue" className="attachment-tag">
              <FileTextOutlined /> {att.name} ({att.size})
              <DownloadOutlined style={{ marginLeft: 8 }} />
            </Tag>
          ))}
        </div>
        <div className="system-info-meta">
          创建时间: {system.createdAt} &nbsp;&nbsp; 创建人: {system.createdBy} &nbsp;&nbsp;
          更新时间: {system.updatedAt} &nbsp;&nbsp; 更新人: {system.updatedBy}
        </div>
      </div>

      <div className="indicator-list-section">
        <div className="indicator-list-header">
          <div className="header-left">
            <h3>指标列表</h3>
            <span className="expand-actions">
              <span onClick={expandAll}>全部展开</span>
              <span onClick={collapseAll}>全部收缩</span>
            </span>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFirstLevel}>
            添加一级指标
          </Button>
        </div>

        <div className="indicator-tree">
          {indicators.map((indicator, index) =>
            renderIndicatorItem(indicator, index, indicators)
          )}
          {indicators.length === 0 && (
            <div className="empty-indicator">
              暂无指标，请点击"添加一级指标"开始创建
            </div>
          )}
        </div>
      </div>

      {/* 编辑指标弹窗 */}
      <Modal
        title="编辑指标"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={700}
        className="indicator-modal"
      >
        <p className="modal-subtitle">修改指标信息</p>
        <Form form={editForm} onFinish={handleSaveIndicator} layout="vertical">
          <Form.Item
            label="指标名称"
            name="name"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item label="指标说明" name="description">
            <Input.TextArea placeholder="该指标用于评估教育资源配置的均衡性" rows={3} />
          </Form.Item>
          <Form.Item label="是否为末级指标" name="isLeaf" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.isLeaf !== curr.isLeaf}>
            {({ getFieldValue }) =>
              getFieldValue('isLeaf') && (
                <>
                  <Form.Item label="评价依据">
                    <Checkbox.Group
                      value={[
                        ...(editingDataIndicators.length > 0 ? ['dataIndicator'] : []),
                        ...(editingSupportingMaterials.length > 0 ? ['supportingMaterial'] : []),
                      ]}
                    >
                      <Checkbox value="dataIndicator">数据指标</Checkbox>
                      <Checkbox value="supportingMaterial">佐证资料</Checkbox>
                    </Checkbox.Group>
                  </Form.Item>

                  {/* 数据指标区域 */}
                  <div className="evaluation-section data-indicator-section">
                    <div className="section-header">
                      <span className="section-title">数据指标</span>
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={handleAddDataIndicator}
                        disabled={addingDataIndicator}
                      >
                        添加
                      </Button>
                    </div>

                    {editingDataIndicators.map(d => (
                      <div key={d.id}>
                        {editingDataIndicatorId === d.id ? (
                          renderDataIndicatorForm(true, d)
                        ) : (
                          <div className="evaluation-item">
                            <div className="item-header">
                              <Tag color="orange">{d.code}</Tag>
                              <Tag>{d.threshold}</Tag>
                              <div className="item-actions">
                                <EditOutlined onClick={() => handleEditDataIndicator(d)} />
                                <DeleteOutlined onClick={() => handleDeleteDataIndicator(d.id)} />
                              </div>
                            </div>
                            <div className="item-desc">{d.description}</div>
                          </div>
                        )}
                      </div>
                    ))}

                    {addingDataIndicator && renderDataIndicatorForm()}
                  </div>

                  {/* 佐证资料区域 */}
                  <div className="evaluation-section supporting-material-section">
                    <div className="section-header">
                      <span className="section-title">佐证资料</span>
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={handleAddSupportingMaterial}
                        disabled={addingSupportingMaterial}
                      >
                        添加
                      </Button>
                    </div>

                    {editingSupportingMaterials.map(m => (
                      <div key={m.id}>
                        {editingSupportingMaterialId === m.id ? (
                          renderSupportingMaterialForm(true, m)
                        ) : (
                          <div className="evaluation-item">
                            <div className="item-header">
                              <Tag color="cyan">{m.code}</Tag>
                              <span className="item-name">{m.name} ({m.fileTypes})</span>
                              <Tag>{m.maxSize}</Tag>
                              <div className="item-actions">
                                <EditOutlined onClick={() => handleEditSupportingMaterial(m)} />
                                <DeleteOutlined onClick={() => handleDeleteSupportingMaterial(m.id)} />
                              </div>
                            </div>
                            <div className="item-desc">{m.description}</div>
                          </div>
                        )}
                      </div>
                    ))}

                    {addingSupportingMaterial && renderSupportingMaterialForm()}
                  </div>
                </>
              )
            }
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setEditModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加一级指标弹窗 */}
      <Modal
        title="添加一级指标"
        open={addFirstLevelModalVisible}
        onCancel={() => setAddFirstLevelModalVisible(false)}
        footer={null}
        width={500}
        className="indicator-modal"
      >
        <p className="modal-subtitle">创建新的一级指标</p>
        <Form form={addFirstLevelForm} onFinish={handleSaveFirstLevel} layout="vertical">
          <Form.Item
            label="指标名称"
            name="name"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item label="指标说明" name="description">
            <Input.TextArea placeholder="请输入指标说明" rows={3} />
          </Form.Item>
          <Form.Item label="是否为末级指标" name="isLeaf" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setAddFirstLevelModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加下级指标弹窗 */}
      <Modal
        title="添加下级指标"
        open={addChildModalVisible}
        onCancel={() => setAddChildModalVisible(false)}
        footer={null}
        width={500}
        className="indicator-modal"
      >
        <p className="modal-subtitle">在选中的指标下添加子指标</p>
        <Form form={addChildForm} onFinish={handleSaveChild} layout="vertical">
          <Form.Item
            label="指标名称"
            name="name"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item label="指标说明" name="description">
            <Input.TextArea placeholder="请输入指标说明" rows={3} />
          </Form.Item>
          <Form.Item label="是否为末级指标" name="isLeaf" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setAddChildModalVisible(false)}>
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

export default IndicatorEdit;
