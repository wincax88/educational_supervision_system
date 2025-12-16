import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Modal, Form, Input, Switch, message, InputNumber, Popconfirm, Spin, Checkbox, Select, Upload } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  CloseOutlined,
  CheckOutlined,
  UpOutlined,
  DownOutlined,
  LeftOutlined,
  RightOutlined,
  PaperClipOutlined,
  StarOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getIndicatorSystem,
  getIndicatorTree,
  saveIndicatorTree,
  Indicator,
  DataIndicator,
  SupportingMaterial,
  IndicatorSystem,
} from '../../services/indicatorService';
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

// 将导入的 JSON 标准化为系统可保存的 Indicator 树（最多 3 层）
const normalizeImportedTree = (raw: unknown): Indicator[] => {
  const parseBoolean = (v: any): boolean | undefined => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
      if (s === '1') return true;
      if (s === '0') return false;
    }
    return undefined;
  };

  const normalizeNode = (node: any, level: number): Indicator => {
    if (!node || typeof node !== 'object') {
      throw new Error('指标节点格式错误：节点不是对象');
    }
    if (level < 1 || level > 3) {
      throw new Error('指标层级不合法：仅支持 1-3 级');
    }

    const id = typeof node.id === 'string' && node.id.trim() ? node.id : generateId();
    const name = typeof node.name === 'string' ? node.name.trim() : String(node.name ?? '').trim();
    if (!name) throw new Error('指标节点缺少 name');

    const description = typeof node.description === 'string' ? node.description : '';
    const weight = typeof node.weight === 'number' ? node.weight : undefined;

    const rawChildren = Array.isArray(node.children) ? node.children : [];
    const inputIsLeaf = parseBoolean(node.isLeaf);
    const isLeaf = level === 3 ? true : (rawChildren.length > 0 ? false : (inputIsLeaf ?? true));

    if (level === 3 && rawChildren.length > 0) {
      throw new Error(`三级指标“${name}”不允许包含 children`);
    }

    if (!isLeaf) {
      const children = rawChildren.map((c: any) => normalizeNode(c, level + 1));
      if (children.length === 0) {
        // 非末级但无子节点，自动降级为末级
        return {
          id,
          code: typeof node.code === 'string' ? node.code : '',
          name,
          description,
          level,
          isLeaf: true,
          weight,
          dataIndicators: [],
          supportingMaterials: [],
        };
      }
      return {
        id,
        code: typeof node.code === 'string' ? node.code : '',
        name,
        description,
        level,
        isLeaf: false,
        weight,
        children,
      };
    }

    const diRaw = Array.isArray(node.dataIndicators) ? node.dataIndicators : [];
    const smRaw = Array.isArray(node.supportingMaterials) ? node.supportingMaterials : [];

    const dataIndicators: DataIndicator[] = diRaw.map((di: any, idx: number) => {
      const diName = typeof di?.name === 'string' ? di.name.trim() : String(di?.name ?? '').trim();
      return {
        id: typeof di?.id === 'string' && di.id.trim() ? di.id : generateId(),
        code: typeof di?.code === 'string' ? di.code : '',
        name: diName || `数据指标${idx + 1}`,
        threshold: typeof di?.threshold === 'string' ? di.threshold : (di?.threshold == null ? '' : String(di.threshold)),
        description: typeof di?.description === 'string' ? di.description : '',
        thresholdType: di?.thresholdType === 'range' ? 'range' : 'single',
        precision: typeof di?.precision === 'number' ? di.precision : 2,
        targetType: typeof di?.targetType === 'string' ? di.targetType : undefined,
      };
    });

    const supportingMaterials: SupportingMaterial[] = smRaw.map((sm: any, idx: number) => {
      const smName = typeof sm?.name === 'string' ? sm.name.trim() : String(sm?.name ?? '').trim();
      return {
        id: typeof sm?.id === 'string' && sm.id.trim() ? sm.id : generateId(),
        code: typeof sm?.code === 'string' ? sm.code : '',
        name: smName || `佐证资料${idx + 1}`,
        fileTypes: typeof sm?.fileTypes === 'string' ? sm.fileTypes : 'PDF,Word,Excel,JPG,PNG',
        maxSize: typeof sm?.maxSize === 'string' ? sm.maxSize : '10MB',
        description: typeof sm?.description === 'string' ? sm.description : '',
        required: typeof sm?.required === 'boolean' ? sm.required : (parseBoolean(sm?.required) ?? false),
        targetType: typeof sm?.targetType === 'string' ? sm.targetType : undefined,
      };
    });

    return {
      id,
      code: typeof node.code === 'string' ? node.code : '',
      name,
      description,
      level,
      isLeaf: true,
      weight,
      dataIndicators,
      supportingMaterials,
    };
  };

  const payload: any = raw;
  const treeRaw = Array.isArray(payload) ? payload : payload?.tree;
  if (!Array.isArray(treeRaw)) {
    throw new Error('导入失败：JSON 必须是 Indicator[] 或包含 tree: Indicator[]');
  }
  return treeRaw.map((n: any) => normalizeNode(n, 1));
};

const IndicatorTreeEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id: systemId } = useParams<{ id: string }>();

  const [system, setSystem] = useState<IndicatorSystem | null>(null);
  const [treeData, setTreeData] = useState<Indicator[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addLevel, setAddLevel] = useState<number>(1);
  const [editingNode, setEditingNode] = useState<Indicator | null>(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 编辑弹窗中的数据指标和佐证资料状态
  const [editDataIndicators, setEditDataIndicators] = useState<DataIndicator[]>([]);
  const [editMaterials, setEditMaterials] = useState<SupportingMaterial[]>([]);
  const [editingDataIndicatorId, setEditingDataIndicatorId] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [tempDataIndicator, setTempDataIndicator] = useState<Partial<DataIndicator>>({});
  const [tempMaterial, setTempMaterial] = useState<Partial<SupportingMaterial>>({});
  const [evaluationBasis, setEvaluationBasis] = useState<string[]>(['dataIndicators', 'materials']);

  // 统计指标数量
  const countIndicators = (nodes: Indicator[]): number => {
    let count = 0;
    for (const node of nodes) {
      count++;
      if (node.children) {
        count += countIndicators(node.children);
      }
    }
    return count;
  };

  // 加载数据
  const loadData = useCallback(async () => {
    if (!systemId) return;
    setLoading(true);
    try {
      const [systemData, tree] = await Promise.all([
        getIndicatorSystem(systemId),
        getIndicatorTree(systemId),
      ]);
      setSystem(systemData);
      setTreeData(tree);
      // 默认展开所有节点
      const allKeys = new Set<string>();
      const collectKeys = (nodes: Indicator[]) => {
        nodes.forEach(node => {
          allKeys.add(node.id);
          if (node.children) collectKeys(node.children);
        });
      };
      collectKeys(tree);
      setExpandedKeys(allKeys);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [systemId]);

  useEffect(() => {
    if (systemId) {
      loadData();
    }
  }, [systemId, loadData]);

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

  // 导入指标树（JSON 文件）
  const handleImportJsonFile = async (file: File) => {
    if (!file) return;
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type.includes('json');
    if (!isJson) {
      message.error('请选择 .json 文件');
      return;
    }

    const doImport = async () => {
      setImporting(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const normalized = normalizeImportedTree(parsed);
        const newTree = recalculateCodes(normalized);
        setTreeData(newTree);

        // 默认展开所有节点
        const allKeys = new Set<string>();
        const collectKeys = (nodes: Indicator[]) => {
          nodes.forEach(node => {
            allKeys.add(node.id);
            if (node.children) collectKeys(node.children);
          });
        };
        collectKeys(newTree);
        setExpandedKeys(allKeys);

        message.success('导入成功（已覆盖当前指标树，记得点击“保存”）');
      } catch (e: any) {
        message.error(`导入失败：${e?.message || '未知错误'}`);
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        setImporting(false);
      }
    };

    Modal.confirm({
      title: '导入指标树',
      content: '导入将覆盖当前页面的指标树（未保存的修改会丢失），是否继续？',
      okText: '继续导入',
      cancelText: '取消',
      okButtonProps: { danger: true, loading: importing },
      onOk: doImport,
    });
  };

  // 切换节点展开状态
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedKeys(newExpanded);
  };

  // 全部收缩
  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  // 全部展开
  const expandAll = () => {
    const allKeys = new Set<string>();
    const collectKeys = (nodes: Indicator[]) => {
      nodes.forEach(node => {
        allKeys.add(node.id);
        if (node.children) collectKeys(node.children);
      });
    };
    collectKeys(treeData);
    setExpandedKeys(allKeys);
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
      code: '',
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
      const newKeys = new Set(expandedKeys);
      newKeys.add(addParentId);
      setExpandedKeys(newKeys);
    }
  };

  // 打开编辑弹窗
  const handleOpenEditModal = (node: Indicator) => {
    setEditingNode(node);
    editForm.setFieldsValue({
      name: node.name,
      description: node.description,
      isLeaf: node.isLeaf,
      weight: node.weight,
    });
    setEditDataIndicators(node.dataIndicators ? [...node.dataIndicators] : []);
    setEditMaterials(node.supportingMaterials ? [...node.supportingMaterials] : []);
    setEditingDataIndicatorId(null);
    setEditingMaterialId(null);
    setTempDataIndicator({});
    setTempMaterial({});

    const basis: string[] = [];
    if (node.dataIndicators && node.dataIndicators.length > 0) {
      basis.push('dataIndicators');
    }
    if (node.supportingMaterials && node.supportingMaterials.length > 0) {
      basis.push('materials');
    }
    if (basis.length === 0 && node.isLeaf) {
      basis.push('dataIndicators', 'materials');
    }
    setEvaluationBasis(basis);
    setEditModalVisible(true);
  };

  // 更新指标
  const handleUpdateIndicator = (values: { name: string; description?: string; isLeaf: boolean; weight?: number }) => {
    if (!editingNode) return;

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(node => {
        if (node.id === editingNode.id) {
          const updated: Indicator = {
            ...node,
            name: values.name,
            description: values.description || '',
            isLeaf: values.isLeaf,
            weight: values.weight,
          };
          if (values.isLeaf) {
            updated.dataIndicators = evaluationBasis.includes('dataIndicators') ? editDataIndicators : [];
            updated.supportingMaterials = evaluationBasis.includes('materials') ? editMaterials : [];
            updated.children = undefined;
          } else {
            updated.children = node.children || [];
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
    setEditModalVisible(false);
    setEditingNode(null);
    message.success('更新成功');
  };

  // 删除指标
  const handleDeleteIndicator = (nodeId: string) => {
    const deleteFromTree = (nodes: Indicator[]): Indicator[] => {
      return nodes
        .filter(node => node.id !== nodeId)
        .map(node => ({
          ...node,
          children: node.children ? deleteFromTree(node.children) : undefined,
        }));
    };

    const newTree = recalculateCodes(deleteFromTree(treeData));
    setTreeData(newTree);
    message.success('删除成功');
  };

  // 上移指标
  const handleMoveUp = (nodeId: string, parentNodes: Indicator[]) => {
    const index = parentNodes.findIndex(n => n.id === nodeId);
    if (index <= 0) return;

    const newNodes = [...parentNodes];
    [newNodes[index - 1], newNodes[index]] = [newNodes[index], newNodes[index - 1]];
    return newNodes;
  };

  // 下移指标
  const handleMoveDown = (nodeId: string, parentNodes: Indicator[]) => {
    const index = parentNodes.findIndex(n => n.id === nodeId);
    if (index < 0 || index >= parentNodes.length - 1) return;

    const newNodes = [...parentNodes];
    [newNodes[index], newNodes[index + 1]] = [newNodes[index + 1], newNodes[index]];
    return newNodes;
  };

  // 移动指标
  const handleMove = (nodeId: string, direction: 'up' | 'down') => {
    const moveInTree = (nodes: Indicator[]): Indicator[] | null => {
      const index = nodes.findIndex(n => n.id === nodeId);
      if (index >= 0) {
        const result = direction === 'up'
          ? handleMoveUp(nodeId, nodes)
          : handleMoveDown(nodeId, nodes);
        return result || null;
      }

      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].children) {
          const result = moveInTree(nodes[i].children!);
          if (result) {
            return nodes.map((n, idx) =>
              idx === i ? { ...n, children: result } : n
            );
          }
        }
      }
      return null;
    };

    const result = moveInTree(treeData);
    if (result) {
      setTreeData(recalculateCodes(result));
    }
  };

  // 升级指标（提升到父级的兄弟位置）
  const handlePromote = (nodeId: string) => {
    // 查找节点及其父节点路径
    const findNodePath = (nodes: Indicator[], path: Indicator[] = []): { node: Indicator; parent: Indicator | null; grandParent: Indicator | null } | null => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) {
          return {
            node: nodes[i],
            parent: path.length > 0 ? path[path.length - 1] : null,
            grandParent: path.length > 1 ? path[path.length - 2] : null,
          };
        }
        if (nodes[i].children) {
          const result = findNodePath(nodes[i].children!, [...path, nodes[i]]);
          if (result) return result;
        }
      }
      return null;
    };

    const pathInfo = findNodePath(treeData);
    if (!pathInfo || !pathInfo.parent) {
      message.warning('一级指标无法升级');
      return;
    }

    const { node, parent, grandParent } = pathInfo;

    // 更新层级
    const updateLevel = (n: Indicator, levelDelta: number): Indicator => ({
      ...n,
      level: n.level + levelDelta,
      children: n.children?.map(child => updateLevel(child, levelDelta))
    });

    const promotedNode = updateLevel(node, -1);

    // 从父节点移除
    const removeFromParent = (nodes: Indicator[]): Indicator[] => {
      return nodes.map(n => {
        if (n.id === parent.id) {
          return {
            ...n,
            children: n.children?.filter(c => c.id !== nodeId),
            isLeaf: (n.children?.filter(c => c.id !== nodeId).length || 0) === 0
          };
        }
        if (n.children) {
          return { ...n, children: removeFromParent(n.children) };
        }
        return n;
      });
    };

    // 插入到祖父节点的children中（父节点之后）
    const insertAfterParent = (nodes: Indicator[]): Indicator[] => {
      const result: Indicator[] = [];
      for (const n of nodes) {
        if (n.id === parent.id) {
          result.push(n);
          result.push(promotedNode);
        } else if (n.children) {
          result.push({ ...n, children: insertAfterParent(n.children) });
        } else {
          result.push(n);
        }
      }
      return result;
    };

    let newTree: Indicator[];
    if (grandParent) {
      // 有祖父节点，插入到祖父节点的children中
      newTree = removeFromParent(treeData);
      newTree = insertAfterParent(newTree);
    } else {
      // 父节点是一级，升级后变成一级指标
      newTree = removeFromParent(treeData);
      const parentIdx = newTree.findIndex(n => n.id === parent.id);
      newTree.splice(parentIdx + 1, 0, promotedNode);
    }

    setTreeData(recalculateCodes(newTree));
    message.success('升级成功');
  };

  // 降级指标（变成前一个兄弟的子节点）
  const handleDemote = (nodeId: string, siblings: Indicator[], index: number) => {
    if (index <= 0) {
      message.warning('没有前一个兄弟节点，无法降级');
      return;
    }

    const prevSibling = siblings[index - 1];
    if (prevSibling.isLeaf) {
      message.warning('前一个兄弟是末级指标，无法降级');
      return;
    }

    const node = siblings[index];

    // 更新层级
    const updateLevel = (n: Indicator, levelDelta: number): Indicator => ({
      ...n,
      level: n.level + levelDelta,
      children: n.children?.map(child => updateLevel(child, levelDelta))
    });

    const demotedNode = updateLevel(node, 1);

    // 检查降级后层级是否超过3级
    const maxLevel = (n: Indicator): number => {
      if (!n.children || n.children.length === 0) return n.level;
      return Math.max(n.level, ...n.children.map(maxLevel));
    };

    if (maxLevel(demotedNode) > 3) {
      message.warning('降级后将超过3级，无法降级');
      return;
    }

    const updateTree = (nodes: Indicator[]): Indicator[] => {
      const result: Indicator[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.id === nodeId) {
          // 跳过当前节点（会被移到前一个兄弟的children中）
          continue;
        }
        if (n.id === prevSibling.id) {
          // 将降级节点添加到前一个兄弟的children中
          result.push({
            ...n,
            isLeaf: false,
            children: [...(n.children || []), demotedNode]
          });
        } else if (n.children) {
          result.push({ ...n, children: updateTree(n.children) });
        } else {
          result.push(n);
        }
      }
      return result;
    };

    const newTree = updateTree(treeData);
    setTreeData(recalculateCodes(newTree));

    // 展开前一个兄弟节点
    const newKeys = new Set(expandedKeys);
    newKeys.add(prevSibling.id);
    setExpandedKeys(newKeys);

    message.success('降级成功');
  };

  // 检查是否可以升级（不是一级指标）
  const canPromote = (node: Indicator) => {
    return node.level > 1;
  };

  // 检查是否可以降级
  const canDemote = (node: Indicator, siblings: Indicator[], index: number) => {
    if (index <= 0) return false; // 没有前一个兄弟
    const prevSibling = siblings[index - 1];
    if (prevSibling.isLeaf) return false; // 前一个兄弟是末级指标

    // 检查降级后是否会超过3级
    const maxLevel = (n: Indicator): number => {
      if (!n.children || n.children.length === 0) return n.level;
      return Math.max(n.level, ...n.children.map(maxLevel));
    };
    const currentMaxLevel = maxLevel(node);
    return currentMaxLevel < 3; // 降级后level+1，所以当前最大level必须<3
  };

  // ========== 编辑弹窗中的数据指标操作 ==========
  const handleAddEditDataIndicator = () => {
    const newDI: DataIndicator = {
      id: generateId(),
      code: `${editingNode?.code}-D${editDataIndicators.length + 1}`,
      name: '',
      threshold: '',
      description: '',
      thresholdType: 'single',
      precision: 2,
      targetType: '幼儿园',
    };
    setEditDataIndicators([...editDataIndicators, newDI]);
    setEditingDataIndicatorId(newDI.id);
    setTempDataIndicator(newDI);
  };

  const handleStartEditDataIndicator = (di: DataIndicator) => {
    setEditingDataIndicatorId(di.id);
    setTempDataIndicator({ ...di });
  };

  const handleConfirmEditDataIndicator = () => {
    if (!editingDataIndicatorId) return;
    setEditDataIndicators(editDataIndicators.map(di =>
      di.id === editingDataIndicatorId ? { ...di, ...tempDataIndicator } as DataIndicator : di
    ));
    setEditingDataIndicatorId(null);
    setTempDataIndicator({});
  };

  const handleCancelEditDataIndicator = () => {
    const di = editDataIndicators.find(d => d.id === editingDataIndicatorId);
    if (di && !di.name) {
      setEditDataIndicators(editDataIndicators.filter(d => d.id !== editingDataIndicatorId));
    }
    setEditingDataIndicatorId(null);
    setTempDataIndicator({});
  };

  const handleDeleteEditDataIndicator = (diId: string) => {
    setEditDataIndicators(editDataIndicators.filter(di => di.id !== diId));
  };

  // ========== 编辑弹窗中的佐证资料操作 ==========
  const handleAddEditMaterial = () => {
    const newSM: SupportingMaterial = {
      id: generateId(),
      code: `${editingNode?.code}-M${editMaterials.length + 1}`,
      name: '',
      fileTypes: 'PDF,Word',
      maxSize: '10MB',
      description: '',
      required: false,
      targetType: '幼儿园',
    };
    setEditMaterials([...editMaterials, newSM]);
    setEditingMaterialId(newSM.id);
    setTempMaterial(newSM);
  };

  const handleStartEditMaterial = (sm: SupportingMaterial) => {
    setEditingMaterialId(sm.id);
    setTempMaterial({ ...sm });
  };

  const handleConfirmEditMaterial = () => {
    if (!editingMaterialId) return;
    setEditMaterials(editMaterials.map(sm =>
      sm.id === editingMaterialId ? { ...sm, ...tempMaterial } as SupportingMaterial : sm
    ));
    setEditingMaterialId(null);
    setTempMaterial({});
  };

  const handleCancelEditMaterial = () => {
    const sm = editMaterials.find(m => m.id === editingMaterialId);
    if (sm && !sm.name) {
      setEditMaterials(editMaterials.filter(m => m.id !== editingMaterialId));
    }
    setEditingMaterialId(null);
    setTempMaterial({});
  };

  const handleDeleteEditMaterial = (smId: string) => {
    setEditMaterials(editMaterials.filter(sm => sm.id !== smId));
  };

  const fileTypeOptions = ['PDF', 'Word', 'Excel', 'JPG', 'PNG'];

  const handleToggleFileType = (fileType: string) => {
    const currentTypes = tempMaterial.fileTypes?.split(',').map(t => t.trim()).filter(t => t) || [];
    const index = currentTypes.indexOf(fileType);
    if (index > -1) {
      currentTypes.splice(index, 1);
    } else {
      currentTypes.push(fileType);
    }
    setTempMaterial({ ...tempMaterial, fileTypes: currentTypes.join(',') });
  };

  // 获取层级标签颜色
  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return '#1677ff';
      case 2: return '#722ed1';
      case 3: return '#13c2c2';
      default: return '#666';
    }
  };

  // 渲染指标树节点
  const renderIndicatorNode = (node: Indicator, siblings: Indicator[], depth: number = 0) => {
    const isExpanded = expandedKeys.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const index = siblings.findIndex(n => n.id === node.id);
    const isFirst = index === 0;
    const isLast = index === siblings.length - 1;

    return (
      <div key={node.id} className={styles.indicatorTreeNode}>
        {/* 指标行 */}
        <div className={styles.indicatorRow} style={{ paddingLeft: depth * 24 }}>
          {/* 展开/收缩按钮 */}
          <span
            className={`${styles.expandIcon} ${hasChildren ? styles.clickable : styles.hidden}`}
            onClick={() => hasChildren && toggleExpand(node.id)}
          >
            {hasChildren && (isExpanded ? '∨' : '>')}
          </span>

          {/* 层级标签 */}
          <Tag
            className={styles.levelTag}
            style={{ backgroundColor: getLevelColor(node.level), color: '#fff', border: 'none' }}
          >
            L{node.level}
          </Tag>

          {/* 编码标签 */}
          <Tag className={styles.codeTag}>{node.code}</Tag>

          {/* 名称 */}
          <span className={styles.indicatorName}>{node.name}</span>

          {/* 操作按钮 */}
          <div className={styles.indicatorActions}>
            <Button
              type="text"
              size="small"
              icon={<UpOutlined />}
              disabled={isFirst}
              onClick={() => handleMove(node.id, 'up')}
              title="上移"
            />
            <Button
              type="text"
              size="small"
              icon={<DownOutlined />}
              disabled={isLast}
              onClick={() => handleMove(node.id, 'down')}
              title="下移"
            />
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              disabled={!canPromote(node)}
              onClick={() => handlePromote(node.id)}
              title="升级"
            />
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              disabled={!canDemote(node, siblings, index)}
              onClick={() => handleDemote(node.id, siblings, index)}
              title="降级"
            />
            {node.level < 3 && !node.isLeaf && (
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleOpenAddModal(node.id, node.level + 1)}
                title="添加子指标"
              />
            )}
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditModal(node)}
              title="编辑"
            />
            <Popconfirm
              title="确定删除该指标及其子指标?"
              onConfirm={() => handleDeleteIndicator(node.id)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                title="删除"
              />
            </Popconfirm>
          </div>
        </div>

        {/* 描述 */}
        {node.description && (
          <div className={styles.indicatorDescription} style={{ paddingLeft: depth * 24 + 76 }}>
            {node.description}
          </div>
        )}

        {/* 数据指标和佐证资料 - 仅末级指标显示 */}
        {node.isLeaf && (
          <div className={styles.indicatorDetails} style={{ paddingLeft: depth * 24 + 76 }}>
            {node.dataIndicators?.map(di => (
              <div key={di.id} className={styles.detailItem}>
                <Tag className={styles.detailCode}>{di.code}</Tag>
                <Tag color="blue">数据指标</Tag>
                <span className={styles.detailName}>{di.name}</span>
                {di.threshold && <Tag color="orange">{di.threshold}</Tag>}
              </div>
            ))}
            {node.dataIndicators && node.dataIndicators.length > 0 && node.dataIndicators[0].description && (
              <div className={styles.detailDescription}>
                {node.dataIndicators[0].description}
              </div>
            )}
            {node.supportingMaterials?.map(sm => (
              <div key={sm.id} className={styles.detailItem}>
                <Tag className={styles.detailCode}>{sm.code}</Tag>
                <Tag color="green">佐证资料</Tag>
                <span className={styles.detailName}>{sm.name}</span>
                <span className={styles.detailFileType}>({sm.fileTypes})</span>
              </div>
            ))}
            {node.supportingMaterials && node.supportingMaterials.length > 0 && node.supportingMaterials[0].description && (
              <div className={styles.detailDescription}>
                {node.supportingMaterials[0].description}
              </div>
            )}
          </div>
        )}

        {/* 子节点 */}
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderIndicatorNode(child, node.children!, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Spin spinning={loading} size="large" tip="加载中..." style={{ width: '100%' }}>
      <div className={styles.indicatorTreeEditPage}>
        {/* 页面头部 */}
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.backBtn} onClick={() => navigate(-1)}>
              <ArrowLeftOutlined /> 返回
            </span>
            <h1 className={styles.pageTitle}>编辑指标</h1>
          </div>
          <div className={styles.headerRight}>
            <Upload
              accept=".json,application/json"
              showUploadList={false}
              beforeUpload={(file) => {
                void handleImportJsonFile(file as unknown as File);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} loading={importing}>
                导入JSON
              </Button>
            </Upload>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>

        {/* 指标体系信息卡片 */}
        {system && (
          <div className={styles.systemInfoCardV2}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleRow}>
                <h2 className={styles.systemTitle}>{system.name}</h2>
                <Tag color={system.type === '达标类' ? 'blue' : 'purple'}>{system.type}</Tag>
                <Tag color="cyan">评估对象: {system.target}</Tag>
              </div>
              <div className={styles.cardStats}>
                <span className={styles.statItem}>指标数: {countIndicators(treeData)}</span>
                <Tag color={system.status === 'published' ? 'green' : 'orange'}>
                  {system.status === 'published' ? '已发布' : system.status === 'editing' ? '编辑中' : '草稿'}
                </Tag>
              </div>
            </div>

            <div className={styles.cardTags}>
              {system.tags.map((tag, idx) => (
                <Tag key={idx}>{tag}</Tag>
              ))}
            </div>

            <p className={styles.cardDescription}>{system.description}</p>

            {system.attachments && system.attachments.length > 0 && (
              <div className={styles.cardAttachments}>
                {system.attachments.map((att, idx) => (
                  <a key={idx} className={styles.attachmentLink}>
                    <PaperClipOutlined /> {att.name} ({att.size})
                  </a>
                ))}
              </div>
            )}

            <div className={styles.cardMeta}>
              <span>创建时间: {system.createdAt}</span>
              <span>创建人: {system.createdBy}</span>
              <span>更新时间: {system.updatedAt}</span>
              <span>更新人: {system.updatedBy}</span>
            </div>
          </div>
        )}

        {/* 指标列表 */}
        <div className={styles.indicatorListSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <h3>指标列表</h3>
              <Button type="link" icon={<StarOutlined />} onClick={collapseAll}>
                全部收缩
              </Button>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenAddModal(null, 1)}>
              添加一级指标
            </Button>
          </div>

          <div className={styles.indicatorTreeList}>
            {treeData.length > 0 ? (
              treeData.map(node => renderIndicatorNode(node, treeData, 0))
            ) : (
              <div className={styles.emptyTree}>
                <FileTextOutlined className={styles.emptyIcon} />
                <p>暂无指标，点击上方按钮添加</p>
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
          onCancel={() => { setEditModalVisible(false); setEditingNode(null); }}
          footer={null}
          width={680}
          className={styles.editIndicatorModal}
        >
          <div className={styles.editModalSubtitle}>修改指标信息</div>
          <Form form={editForm} onFinish={handleUpdateIndicator} layout="vertical">
            <Form.Item
              label="指标名称"
              name="name"
              rules={[{ required: true, message: '请输入指标名称' }]}
            >
              <Input placeholder="请输入指标名称" />
            </Form.Item>
            <Form.Item label="指标说明" name="description">
              <TextArea placeholder="该指标用于评估教育资源配置的均衡性" rows={3} />
            </Form.Item>
            <Form.Item
              label="是否为末级指标"
              name="isLeaf"
              valuePropName="checked"
            >
              <Switch disabled={editingNode?.level === 3 || (editingNode?.children?.length || 0) > 0} />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.isLeaf !== curr.isLeaf}>
              {({ getFieldValue }) => getFieldValue('isLeaf') && (
                <>
                  <Form.Item label="评价依据" className={styles.evaluationBasisItem}>
                    <Checkbox.Group
                      value={evaluationBasis}
                      onChange={(values) => setEvaluationBasis(values as string[])}
                    >
                      <Checkbox value="dataIndicators">数据指标</Checkbox>
                      <Checkbox value="materials">佐证资料</Checkbox>
                    </Checkbox.Group>
                  </Form.Item>

                  {evaluationBasis.includes('dataIndicators') && (
                    <div className={`${styles.editSection} ${styles.dataIndicatorsSection}`}>
                      <div className={styles.editSectionHeader}>
                        <span className={styles.sectionTitle}>数据指标</span>
                        <Button type="link" icon={<PlusOutlined />} onClick={handleAddEditDataIndicator}>
                          添加
                        </Button>
                      </div>
                      <div className={styles.editSectionContent}>
                        {editDataIndicators.map((di, index) => (
                          <div key={di.id} className={styles.indicatorCard}>
                            {editingDataIndicatorId === di.id ? (
                              <div className={styles.indicatorCardEdit}>
                                <div className={styles.cardEditRow}>
                                  <Tag className={styles.cardCode}>{editingNode?.code}-D{index + 1}</Tag>
                                  <Select
                                    value={tempDataIndicator.targetType || '幼儿园'}
                                    onChange={(val) => setTempDataIndicator({ ...tempDataIndicator, targetType: val })}
                                    size="small"
                                    style={{ width: 100 }}
                                    options={[
                                      { value: '幼儿园', label: '【幼儿园】' },
                                      { value: '小学', label: '【小学】' },
                                      { value: '初中', label: '【初中】' },
                                      { value: '高中', label: '【高中】' },
                                    ]}
                                  />
                                  <span className={styles.separator}>.</span>
                                  <Input
                                    value={tempDataIndicator.name}
                                    onChange={(e) => setTempDataIndicator({ ...tempDataIndicator, name: e.target.value })}
                                    placeholder="数据指标名称"
                                    style={{ flex: 1 }}
                                  />
                                </div>
                                <div className={styles.cardEditRow}>
                                  <span className={styles.rowLabel}>达标阈值</span>
                                  <Select
                                    value={tempDataIndicator.thresholdType || 'single'}
                                    onChange={(val) => setTempDataIndicator({ ...tempDataIndicator, thresholdType: val })}
                                    size="small"
                                    style={{ width: 100 }}
                                    options={[
                                      { value: 'single', label: '单值比较' },
                                      { value: 'range', label: '区间' },
                                    ]}
                                  />
                                  <span className={styles.rowLabel} style={{ marginLeft: 16 }}>精确位数</span>
                                  <Select
                                    value={tempDataIndicator.precision || 2}
                                    onChange={(val) => setTempDataIndicator({ ...tempDataIndicator, precision: val })}
                                    size="small"
                                    style={{ width: 80 }}
                                    options={[
                                      { value: 0, label: '整数' },
                                      { value: 1, label: '1位' },
                                      { value: 2, label: '2位' },
                                      { value: 3, label: '3位' },
                                    ]}
                                  />
                                </div>
                                <div className={styles.cardEditRow}>
                                  <span className={styles.thresholdLabel}>【数据指标】</span>
                                  <Select
                                    value={tempDataIndicator.threshold?.split(' ')[0] || '>='}
                                    onChange={(val) => {
                                      const parts = tempDataIndicator.threshold?.split(' ') || ['>=', ''];
                                      setTempDataIndicator({ ...tempDataIndicator, threshold: `${val} ${parts[1] || ''}` });
                                    }}
                                    size="small"
                                    style={{ width: 70 }}
                                    options={[
                                      { value: '>=', label: '>=' },
                                      { value: '>', label: '>' },
                                      { value: '<=', label: '<=' },
                                      { value: '<', label: '<' },
                                      { value: '=', label: '=' },
                                    ]}
                                  />
                                  <Input
                                    value={tempDataIndicator.threshold?.split(' ')[1] || ''}
                                    onChange={(e) => {
                                      const parts = tempDataIndicator.threshold?.split(' ') || ['>=', ''];
                                      setTempDataIndicator({ ...tempDataIndicator, threshold: `${parts[0]} ${e.target.value}` });
                                    }}
                                    placeholder="精确到2位小数"
                                    style={{ flex: 1 }}
                                  />
                                </div>
                                <div className={styles.cardEditRow}>
                                  <span className={styles.rowLabel}>数据指标说明</span>
                                </div>
                                <TextArea
                                  value={tempDataIndicator.description}
                                  onChange={(e) => setTempDataIndicator({ ...tempDataIndicator, description: e.target.value })}
                                  placeholder="请输入数据指标说明（非必填）"
                                  rows={2}
                                />
                                <div className={styles.cardEditActions}>
                                  <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEditDataIndicator}>
                                    取消
                                  </Button>
                                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleConfirmEditDataIndicator}>
                                    确认
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.indicatorCardView}>
                                <div className={styles.cardViewHeader}>
                                  <Tag className={styles.cardCode}>{di.code}</Tag>
                                  <span className={styles.cardName}>
                                    {di.name} {di.threshold && <Tag color="orange">{di.threshold}</Tag>}
                                  </span>
                                  <div className={styles.cardActions}>
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => handleStartEditDataIndicator(di)}
                                    />
                                    <Popconfirm title="确定删除?" onConfirm={() => handleDeleteEditDataIndicator(di.id)}>
                                      <Button type="text" size="small" icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  </div>
                                </div>
                                {di.description && <div className={styles.cardDescription}>{di.description}</div>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evaluationBasis.includes('materials') && (
                    <div className={`${styles.editSection} ${styles.materialsSection}`}>
                      <div className={styles.editSectionHeader}>
                        <span className={styles.sectionTitle}>佐证资料</span>
                        <Button type="link" icon={<PlusOutlined />} onClick={handleAddEditMaterial}>
                          添加
                        </Button>
                      </div>
                      <div className={styles.editSectionContent}>
                        {editMaterials.map((sm, index) => (
                          <div key={sm.id} className={styles.indicatorCard}>
                            {editingMaterialId === sm.id ? (
                              <div className={styles.indicatorCardEdit}>
                                <div className={styles.cardEditRow}>
                                  <Tag className={styles.cardCode}>{editingNode?.code}-M{index + 1}</Tag>
                                  <Select
                                    value={tempMaterial.targetType || '幼儿园'}
                                    onChange={(val) => setTempMaterial({ ...tempMaterial, targetType: val })}
                                    size="small"
                                    style={{ width: 100 }}
                                    options={[
                                      { value: '幼儿园', label: '【幼儿园】' },
                                      { value: '小学', label: '【小学】' },
                                      { value: '初中', label: '【初中】' },
                                      { value: '高中', label: '【高中】' },
                                    ]}
                                  />
                                  <span className={styles.separator}>.</span>
                                  <Input
                                    value={tempMaterial.name}
                                    onChange={(e) => setTempMaterial({ ...tempMaterial, name: e.target.value })}
                                    placeholder="佐证资料名称"
                                    style={{ flex: 1 }}
                                  />
                                  <span className={styles.rowLabel} style={{ marginLeft: 16 }}>大小(MB)</span>
                                  <InputNumber
                                    value={parseInt(tempMaterial.maxSize || '10')}
                                    onChange={(val) => setTempMaterial({ ...tempMaterial, maxSize: `${val}MB` })}
                                    min={1}
                                    max={100}
                                    style={{ width: 70 }}
                                  />
                                </div>
                                <div className={styles.cardEditRow}>
                                  <span className={styles.rowLabel}>文件格式:</span>
                                  <div className={styles.fileTypeTags}>
                                    {fileTypeOptions.map(type => (
                                      <Tag
                                        key={type}
                                        className={`${styles.fileTypeTag} ${tempMaterial.fileTypes?.includes(type) ? styles.selected : ''}`}
                                        onClick={() => handleToggleFileType(type)}
                                      >
                                        {type}
                                      </Tag>
                                    ))}
                                  </div>
                                </div>
                                <div className={styles.cardEditRow}>
                                  <span className={styles.rowLabel}>佐证资料说明</span>
                                </div>
                                <TextArea
                                  value={tempMaterial.description}
                                  onChange={(e) => setTempMaterial({ ...tempMaterial, description: e.target.value })}
                                  placeholder="请输入佐证资料说明（选填）"
                                  rows={2}
                                />
                                <div className={styles.cardEditActions}>
                                  <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEditMaterial}>
                                    取消
                                  </Button>
                                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleConfirmEditMaterial}>
                                    确认
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.indicatorCardView}>
                                <div className={styles.cardViewHeader}>
                                  <Tag className={styles.cardCode}>{sm.code}</Tag>
                                  <span className={styles.cardName}>{sm.name}</span>
                                  <Tag>{sm.fileTypes}</Tag>
                                  <Tag>{sm.maxSize}</Tag>
                                  <div className={styles.cardActions}>
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => handleStartEditMaterial(sm)}
                                    />
                                    <Popconfirm title="确定删除?" onConfirm={() => handleDeleteEditMaterial(sm.id)}>
                                      <Button type="text" size="small" icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  </div>
                                </div>
                                {sm.description && <div className={styles.cardDescription}>{sm.description}</div>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
              <Button onClick={() => { setEditModalVisible(false); setEditingNode(null); }} style={{ marginRight: 8 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Spin>
  );
};

export default IndicatorTreeEdit;
