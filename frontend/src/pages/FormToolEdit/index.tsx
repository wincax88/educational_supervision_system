import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Button, Tag, Tabs, Input, Select, Switch, message, Tooltip, InputNumber, Modal, Upload } from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  CopyOutlined,
  FontSizeOutlined,
  AlignLeftOutlined,
  NumberOutlined,
  DownOutlined,
  CheckSquareOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  SwapOutlined,
  LineOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FormOutlined,
  HolderOutlined,
  LinkOutlined,
  DisconnectOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { dataTools, DataTool } from '../../mock/data';
import styles from './index.module.css';
import DataIndicatorSelector from '../../components/DataIndicatorSelector';
import ElementSelector from '../../components/ElementSelector';
import * as toolService from '../../services/toolService';

// 控件类型定义
type ControlType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'file'
  | 'switch'
  | 'divider'
  | 'group'
  | 'dynamicList';

// 控件定义
interface Control {
  type: ControlType;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'basic' | 'advanced';
}

// 字段映射信息类型
interface FieldMappingInfo {
  mappingType: 'data_indicator' | 'element';
  targetId: string;
  targetInfo?: {
    code: string;
    name: string;
    threshold?: string;
    description?: string;
    indicatorName?: string;
    indicatorCode?: string;
    elementType?: string;
    dataType?: string;
    formula?: string;
  };
}

// 动态列表子字段类型（支持的类型）
type DynamicListFieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'time';

// 动态列表子字段定义
interface DynamicListChildField {
  id: string;
  label: string;
  type: DynamicListFieldType;
  required: boolean;
  // 评价依据关联
  evaluationMapping?: 'none' | 'data_indicator' | 'element';
  mapping?: FieldMappingInfo | null;
  // 选择类型特有属性
  options?: { label: string; value: string }[];
}

// 表单字段定义
interface FormField {
  id: string;
  type: ControlType;
  label: string;
  placeholder?: string;
  helpText?: string;
  width: '25%' | '50%' | '75%' | '100%';
  required: boolean;
  options?: { label: string; value: string }[];
  optionLayout?: 'horizontal' | 'vertical';
  conditionalDisplay?: boolean;
  // 数字类型特有属性
  decimalPlaces?: '整数' | '1位小数' | '2位小数';
  minValue?: string;
  maxValue?: string;
  unit?: string;
  // 分组容器特有属性
  children?: FormField[];
  // 动态列表特有属性
  minItems?: number;
  maxItems?: number;
  dynamicListFields?: DynamicListChildField[];
  // 映射信息
  mapping?: FieldMappingInfo | null;
}

// 控件库配置
const controls: Control[] = [
  { type: 'text', name: '单行文本', icon: <FontSizeOutlined />, description: '输入单行文字内容', category: 'basic' },
  { type: 'textarea', name: '多行文本', icon: <AlignLeftOutlined />, description: '输入多行文字内容', category: 'basic' },
  { type: 'number', name: '数字', icon: <NumberOutlined />, description: '输入数字', category: 'basic' },
  { type: 'select', name: '下拉选择', icon: <DownOutlined />, description: '从选项中选择一个', category: 'basic' },
  { type: 'checkbox', name: '多选框', icon: <CheckSquareOutlined />, description: '可选择多个选项', category: 'basic' },
  { type: 'radio', name: '单选框', icon: <CheckCircleOutlined />, description: '只能选择一个', category: 'basic' },
  { type: 'date', name: '日期', icon: <CalendarOutlined />, description: '选择日期', category: 'advanced' },
  { type: 'time', name: '时间', icon: <ClockCircleOutlined />, description: '选择时间', category: 'advanced' },
  { type: 'file', name: '文件上传', icon: <CloudUploadOutlined />, description: '上传文件', category: 'advanced' },
  { type: 'switch', name: '开关', icon: <SwapOutlined />, description: '是/否选择', category: 'advanced' },
  { type: 'divider', name: '分割线', icon: <LineOutlined />, description: '分隔内容区域', category: 'advanced' },
  { type: 'group', name: '分组容器', icon: <AppstoreOutlined />, description: '将控件分组管理', category: 'advanced' },
  { type: 'dynamicList', name: '动态列表', icon: <UnorderedListOutlined />, description: '可重复添加的字段组', category: 'advanced' },
];

// 创建默认字段
const createDefaultField = (type: ControlType): FormField => {
  const baseField: FormField = {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    label: controls.find(c => c.type === type)?.name || '字段',
    placeholder: '请输入',
    helpText: '',
    width: '50%',
    required: false,
  };

  // 根据控件类型添加特定属性
  if (['select', 'checkbox', 'radio'].includes(type)) {
    baseField.options = [
      { label: '选项1', value: '1' },
      { label: '选项2', value: '2' },
      { label: '选项3', value: '3' },
    ];
    baseField.optionLayout = 'vertical';
    baseField.conditionalDisplay = false;
  }

  if (type === 'number') {
    baseField.decimalPlaces = '整数';
    baseField.minValue = '';
    baseField.maxValue = '';
    baseField.unit = '';
  }

  if (type === 'group') {
    baseField.children = [];
  }

  if (type === 'dynamicList') {
    baseField.width = '100%';
    baseField.minItems = 1;
    baseField.maxItems = 10;
    baseField.dynamicListFields = [
      {
        id: `dlf_${Date.now()}_1`,
        label: '字段1',
        type: 'text',
        required: false,
        evaluationMapping: 'none',
      },
      {
        id: `dlf_${Date.now()}_2`,
        label: '字段2',
        type: 'text',
        required: false,
        evaluationMapping: 'none',
      },
    ];
  }

  return baseField;
};

const FormToolEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [tool, setTool] = useState<DataTool | null>(null);
  const [controlTab, setControlTab] = useState<string>('all');
  const [propertyTab, setPropertyTab] = useState<string>('basic');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [selectedField, setSelectedField] = useState<FormField | null>(null);

  // 拖拽相关状态
  const [isDraggingControl, setIsDraggingControl] = useState(false);
  const [isDraggingField, setIsDraggingField] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const draggedControlRef = useRef<ControlType | null>(null);
  const draggedFieldIndexRef = useRef<number | null>(null);

  // 选择器相关状态
  const [mappingType, setMappingType] = useState<'data_indicator' | 'element'>('data_indicator');
  const [showIndicatorSelector, setShowIndicatorSelector] = useState(false);
  const [showElementSelector, setShowElementSelector] = useState(false);
  // 动态列表子字段关联状态
  const [editingDynamicFieldId, setEditingDynamicFieldId] = useState<string | null>(null);

  // 导入相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [pendingImportFields, setPendingImportFields] = useState<FormField[]>([]);

  useEffect(() => {
    if (id) {
      const foundTool = dataTools.find(t => t.id === id);
      if (foundTool) {
        setTool(foundTool);
      }
    }
  }, [id]);

  // 控件拖拽开始
  const handleControlDragStart = (e: React.DragEvent, controlType: ControlType) => {
    e.dataTransfer.setData('controlType', controlType);
    e.dataTransfer.effectAllowed = 'copy';
    draggedControlRef.current = controlType;
    setIsDraggingControl(true);
  };

  // 控件拖拽结束
  const handleControlDragEnd = () => {
    draggedControlRef.current = null;
    setIsDraggingControl(false);
    setDragOverCanvas(false);
    setDragOverIndex(null);
  };

  // 字段拖拽开始
  const handleFieldDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('fieldIndex', String(index));
    e.dataTransfer.effectAllowed = 'move';
    draggedFieldIndexRef.current = index;
    setIsDraggingField(true);
  };

  // 字段拖拽结束
  const handleFieldDragEnd = () => {
    draggedFieldIndexRef.current = null;
    setIsDraggingField(false);
    setDragOverIndex(null);
  };

  // 画布拖拽悬停
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = isDraggingControl ? 'copy' : 'move';
    if (!dragOverIndex && formFields.length === 0) {
      setDragOverCanvas(true);
    }
  };

  // 画布拖拽离开
  const handleCanvasDragLeave = (e: React.DragEvent) => {
    // 只有离开画布区域才重置状态
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverCanvas(false);
      setDragOverIndex(null);
    }
  };

  // 画布放置
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCanvas(false);
    setDragOverIndex(null);

    const controlType = e.dataTransfer.getData('controlType') as ControlType;
    if (controlType) {
      // 从控件库拖拽新控件
      const newField = createDefaultField(controlType);
      if (dragOverIndex !== null) {
        const newFields = [...formFields];
        newFields.splice(dragOverIndex, 0, newField);
        setFormFields(newFields);
      } else {
        setFormFields([...formFields, newField]);
      }
      setSelectedField(newField);
      return;
    }

    const fieldIndexStr = e.dataTransfer.getData('fieldIndex');
    if (fieldIndexStr !== '') {
      // 字段排序
      const fromIndex = parseInt(fieldIndexStr, 10);
      if (dragOverIndex !== null && fromIndex !== dragOverIndex) {
        const newFields = [...formFields];
        const [movedField] = newFields.splice(fromIndex, 1);
        const toIndex = fromIndex < dragOverIndex ? dragOverIndex - 1 : dragOverIndex;
        newFields.splice(toIndex, 0, movedField);
        setFormFields(newFields);
      }
    }
  };

  // 字段拖拽悬停
  const handleFieldDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isDraggingControl ? 'copy' : 'move';
    setDragOverIndex(index);
    setDragOverCanvas(false);
  };

  // 字段放置
  const handleFieldDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    const controlType = e.dataTransfer.getData('controlType') as ControlType;
    if (controlType) {
      // 从控件库拖拽新控件到指定位置
      const newField = createDefaultField(controlType);
      const newFields = [...formFields];
      newFields.splice(index, 0, newField);
      setFormFields(newFields);
      setSelectedField(newField);
      return;
    }

    const fieldIndexStr = e.dataTransfer.getData('fieldIndex');
    if (fieldIndexStr !== '') {
      // 字段排序
      const fromIndex = parseInt(fieldIndexStr, 10);
      if (fromIndex !== index) {
        const newFields = [...formFields];
        const [movedField] = newFields.splice(fromIndex, 1);
        const toIndex = fromIndex < index ? index - 1 : index;
        newFields.splice(toIndex, 0, movedField);
        setFormFields(newFields);
      }
    }
  };

  // 末尾拖拽悬停
  const handleEndDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isDraggingControl ? 'copy' : 'move';
    setDragOverIndex(formFields.length);
    setDragOverCanvas(false);
  };

  // 末尾放置
  const handleEndDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    const controlType = e.dataTransfer.getData('controlType') as ControlType;
    if (controlType) {
      const newField = createDefaultField(controlType);
      setFormFields([...formFields, newField]);
      setSelectedField(newField);
      return;
    }

    const fieldIndexStr = e.dataTransfer.getData('fieldIndex');
    if (fieldIndexStr !== '') {
      const fromIndex = parseInt(fieldIndexStr, 10);
      if (fromIndex !== formFields.length - 1) {
        const newFields = [...formFields];
        const [movedField] = newFields.splice(fromIndex, 1);
        newFields.push(movedField);
        setFormFields(newFields);
      }
    }
  };

  // 获取当前分类的控件
  const getFilteredControls = () => {
    if (controlTab === 'all') return controls;
    if (controlTab === 'basic') return controls.filter(c => c.category === 'basic');
    return controls.filter(c => c.category === 'advanced');
  };

  // 添加控件到表单
  const handleAddControl = (control: Control) => {
    const newField = createDefaultField(control.type);
    setFormFields([...formFields, newField]);
    setSelectedField(newField);
  };

  // 选择字段
  const handleSelectField = (field: FormField) => {
    setSelectedField(field);
    setPropertyTab('basic');
  };

  // 更新字段属性（支持嵌套子字段）
  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    // 递归查找并更新字段
    const updateFieldInArray = (fields: FormField[]): FormField[] => {
      return fields.map(f => {
        if (f.id === fieldId) {
          return { ...f, ...updates };
        }
        // 递归检查 group 的 children
        if (f.type === 'group' && f.children && f.children.length > 0) {
          const updatedChildren = updateFieldInArray(f.children);
          // 检查 children 是否有变化
          if (updatedChildren !== f.children) {
            return { ...f, children: updatedChildren };
          }
        }
        return f;
      });
    };

    const updatedFields = updateFieldInArray(formFields);
    setFormFields(updatedFields);

    if (selectedField?.id === fieldId) {
      setSelectedField({ ...selectedField, ...updates });
    }
  };

  // 复制字段
  const handleCopyField = (field: FormField) => {
    const newField = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `${field.label} (副本)`,
    };
    const index = formFields.findIndex(f => f.id === field.id);
    const newFields = [...formFields];
    newFields.splice(index + 1, 0, newField);
    setFormFields(newFields);
  };

  // 删除字段
  const handleDeleteField = (fieldId: string) => {
    setFormFields(formFields.filter(f => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  // 清空表单
  const handleClearForm = () => {
    setFormFields([]);
    setSelectedField(null);
    message.success('表单已清空');
  };

  // 验证导入的字段格式
  const validateImportedField = (field: any): field is FormField => {
    if (!field || typeof field !== 'object') return false;
    if (!field.id || typeof field.id !== 'string') return false;
    if (!field.type || !controls.some(c => c.type === field.type)) return false;
    if (!field.label || typeof field.label !== 'string') return false;
    return true;
  };

  // 为导入的字段生成新ID（避免ID冲突）
  const regenerateFieldIds = (fields: FormField[]): FormField[] => {
    return fields.map(field => {
      const newId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newField = { ...field, id: newId };

      // 递归处理子字段
      if (field.children && field.children.length > 0) {
        newField.children = regenerateFieldIds(field.children);
      }

      // 处理动态列表字段
      if (field.dynamicListFields && field.dynamicListFields.length > 0) {
        newField.dynamicListFields = field.dynamicListFields.map(df => ({
          ...df,
          id: `dlf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }));
      }

      return newField;
    });
  };

  // 处理文件选择
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.json')) {
      message.error('请选择 JSON 格式的文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // 支持数组格式或带 schema 字段的对象格式
        let fieldsToImport: any[] = [];
        if (Array.isArray(parsed)) {
          fieldsToImport = parsed;
        } else if (parsed.schema && Array.isArray(parsed.schema)) {
          fieldsToImport = parsed.schema;
        } else {
          message.error('无效的 schema 格式，请确保是字段数组或包含 schema 字段的对象');
          return;
        }

        // 验证每个字段
        const validFields: FormField[] = [];
        const invalidCount = { count: 0 };

        fieldsToImport.forEach((field, index) => {
          if (validateImportedField(field)) {
            validFields.push(field as FormField);
          } else {
            invalidCount.count++;
            console.warn(`字段 ${index + 1} 格式无效:`, field);
          }
        });

        if (validFields.length === 0) {
          message.error('没有找到有效的表单字段');
          return;
        }

        if (invalidCount.count > 0) {
          message.warning(`已跳过 ${invalidCount.count} 个无效字段`);
        }

        // 生成新ID避免冲突
        const fieldsWithNewIds = regenerateFieldIds(validFields);

        // 如果当前有字段，显示确认弹窗
        if (formFields.length > 0) {
          setPendingImportFields(fieldsWithNewIds);
          setImportModalVisible(true);
        } else {
          // 直接导入
          setFormFields(fieldsWithNewIds);
          message.success(`成功导入 ${fieldsWithNewIds.length} 个字段`);
        }
      } catch (error) {
        console.error('解析 JSON 失败:', error);
        message.error('解析文件失败，请确保是有效的 JSON 格式');
      }
    };

    reader.onerror = () => {
      message.error('读取文件失败');
    };

    reader.readAsText(file);

    // 重置 input 以便可以重复选择同一文件
    e.target.value = '';
  };

  // 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 确认导入 - 覆盖现有字段
  const handleImportReplace = () => {
    setFormFields(pendingImportFields);
    setSelectedField(null);
    setImportModalVisible(false);
    setPendingImportFields([]);
    message.success(`成功导入 ${pendingImportFields.length} 个字段（已覆盖原有字段）`);
  };

  // 确认导入 - 追加到现有字段
  const handleImportAppend = () => {
    setFormFields([...formFields, ...pendingImportFields]);
    setImportModalVisible(false);
    setPendingImportFields([]);
    message.success(`成功追加 ${pendingImportFields.length} 个字段`);
  };

  // 取消导入
  const handleImportCancel = () => {
    setImportModalVisible(false);
    setPendingImportFields([]);
  };

  // 更新选项
  const handleUpdateOptions = (optionIndex: number, value: string) => {
    if (!selectedField || !selectedField.options) return;
    const newOptions = [...selectedField.options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], label: value, value: value };
    handleUpdateField(selectedField.id, { options: newOptions });
  };

  // 添加选项
  const handleAddOption = () => {
    if (!selectedField) return;
    const newOptions = [...(selectedField.options || [])];
    newOptions.push({ label: `选项${newOptions.length + 1}`, value: `${newOptions.length + 1}` });
    handleUpdateField(selectedField.id, { options: newOptions });
  };

  // 删除选项
  const handleDeleteOption = (optionIndex: number) => {
    if (!selectedField || !selectedField.options) return;
    const newOptions = selectedField.options.filter((_, i) => i !== optionIndex);
    handleUpdateField(selectedField.id, { options: newOptions });
  };

  // 动态列表子字段操作
  // 添加动态列表字段
  const handleAddDynamicField = () => {
    if (!selectedField || selectedField.type !== 'dynamicList') return;
    const currentFields = selectedField.dynamicListFields || [];
    const newField: DynamicListChildField = {
      id: `dlf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `字段${currentFields.length + 1}`,
      type: 'text',
      required: false,
      evaluationMapping: 'none',
    };
    handleUpdateField(selectedField.id, {
      dynamicListFields: [...currentFields, newField],
    });
  };

  // 更新动态列表字段
  const handleUpdateDynamicField = (fieldId: string, updates: Partial<DynamicListChildField>) => {
    if (!selectedField || selectedField.type !== 'dynamicList') return;
    const updatedFields = selectedField.dynamicListFields?.map((f) =>
      f.id === fieldId ? { ...f, ...updates } : f
    );
    handleUpdateField(selectedField.id, { dynamicListFields: updatedFields });
  };

  // 删除动态列表字段
  const handleDeleteDynamicField = (fieldId: string) => {
    if (!selectedField || selectedField.type !== 'dynamicList') return;
    const currentFields = selectedField.dynamicListFields || [];
    if (currentFields.length <= 1) {
      message.warning('动态列表至少需要保留一个字段');
      return;
    }
    const updatedFields = currentFields.filter((f) => f.id !== fieldId);
    handleUpdateField(selectedField.id, { dynamicListFields: updatedFields });
  };

  // 获取状态标签
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

  // 渲染控件预览
  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'text':
        return <Input placeholder={field.placeholder || '请输入'} disabled />;
      case 'textarea':
        return <Input.TextArea placeholder={field.placeholder || '请输入'} rows={3} disabled />;
      case 'number':
        return (
          <Input
            placeholder={field.placeholder || '请输入数字'}
            disabled
            addonAfter={field.unit || null}
          />
        );
      case 'select':
        return <Select placeholder="请选择" style={{ width: '100%' }} disabled />;
      case 'checkbox':
      case 'radio':
        return (
          <div className={`${styles.optionsPreview} ${field.optionLayout === 'vertical' ? styles.vertical : ''}`}>
            {field.options?.map((opt, i) => (
              <span key={i} className={styles.optionItem}>
                {field.type === 'radio' ? <CheckCircleOutlined /> : <CheckSquareOutlined />}
                {opt.label}
              </span>
            ))}
          </div>
        );
      case 'date':
        return <Input placeholder="选择日期" disabled suffix={<CalendarOutlined />} />;
      case 'time':
        return <Input placeholder="选择时间" disabled suffix={<ClockCircleOutlined />} />;
      case 'file':
        return <Button icon={<CloudUploadOutlined />} disabled>上传文件</Button>;
      case 'switch':
        return <Switch disabled />;
      case 'divider':
        return <div className={styles.dividerPreview} />;
      case 'group':
        return (
          <div className={styles.groupPreview}>
            <div className={styles.groupChildrenContainer}>
              {field.children && field.children.length > 0 ? (
                field.children.map((childField, idx) => (
                  <div
                    key={childField.id}
                    className={`${styles.groupChildItem} ${selectedField?.id === childField.id ? styles.selected : ''} ${styles[`width${childField.width?.replace('%', '') || '50'}`]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectField(childField);
                    }}
                  >
                    <div className={styles.childFieldHeader}>
                      <span className={styles.childFieldLabel}>
                        {childField.label}
                        {childField.required && <span className={styles.requiredMark}>*</span>}
                      </span>
                      <div className={styles.childFieldActions}>
                        <CopyOutlined
                          onClick={(e) => {
                            e.stopPropagation();
                            // 复制子字段到 group 中
                            const newChild = {
                              ...childField,
                              id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                              label: `${childField.label} (副本)`,
                            };
                            const newChildren = [...(field.children || [])];
                            newChildren.splice(idx + 1, 0, newChild);
                            handleUpdateField(field.id, { children: newChildren });
                          }}
                        />
                        <DeleteOutlined
                          onClick={(e) => {
                            e.stopPropagation();
                            const newChildren = field.children?.filter(c => c.id !== childField.id);
                            handleUpdateField(field.id, { children: newChildren });
                            if (selectedField?.id === childField.id) {
                              setSelectedField(null);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className={styles.childFieldContent}>
                      {renderFieldPreview(childField)}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyGroup}>
                  <p>暂无子字段，请从控件库拖拽或在属性面板添加</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'dynamicList':
        return (
          <div className={styles.dynamicListPreview}>
            <div className={styles.dynamicListHeader}>
              <UnorderedListOutlined />
              <span className={styles.dynamicListTitle}>{field.label}</span>
              <Tag color="blue">可重复</Tag>
              <span className={styles.dynamicListRange}>({field.minItems || 1}-{field.maxItems || 10}条)</span>
              <div className={styles.dynamicListActions}>
                <CopyOutlined />
                <DeleteOutlined />
              </div>
            </div>
            <div className={styles.dynamicListContent}>
              <div className={styles.dynamicListFieldsLabel}>字段模板：</div>
              <div className={styles.dynamicListFieldsRow}>
                {field.dynamicListFields?.map((childField) => (
                  <div key={childField.id} className={styles.dynamicListFieldItem}>
                    <div className={styles.childFieldLabel}>{childField.label}</div>
                    <div className={styles.childFieldType}>
                      {childField.type === 'text' && '单行文本'}
                      {childField.type === 'textarea' && '多行文本'}
                      {childField.type === 'number' && '数字'}
                      {childField.type === 'select' && '下拉选择'}
                      {childField.type === 'date' && '日期'}
                      {childField.type === 'time' && '时间'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.dynamicListHint}>
              <span className={styles.hintIcon}>💡</span>
              填写表单时可以重复添加多组数据
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!tool) {
    return <div className={styles.formToolEditPage}>加载中...</div>;
  }

  return (
    <div className={styles.formToolEditPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>表单工具编辑</h1>
        </div>
      </div>

      {/* 工具信息卡片 */}
      <div className={styles.toolInfoCard}>
        <div className={styles.toolInfoHeader}>
          <div className={styles.toolInfoLeft}>
            <span className={styles.toolName}>{tool.name}</span>
            <Tag icon={<FormOutlined />}>{tool.type}</Tag>
          </div>
          {getStatusTag(tool.status)}
        </div>
        <p className={styles.toolDescription}>{tool.description}</p>
        <div className={styles.toolMeta}>
          <span>创建时间: {tool.createdAt}</span>
          <span>创建人: {tool.createdBy}</span>
          <span>更新时间: {tool.updatedAt}</span>
          <span>更新人: {tool.updatedBy}</span>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className={styles.mainContent}>
        {/* 左侧控件库 */}
        <div className={styles.controlLibrary}>
          <h3 className={styles.panelTitle}>控件库</h3>
          <Tabs
            activeKey={controlTab}
            onChange={setControlTab}
            items={[
              { key: 'all', label: '全部' },
              { key: 'basic', label: '基础' },
              { key: 'advanced', label: '高级' },
            ]}
            size="small"
          />
          <div className={styles.controlList}>
            {getFilteredControls().map(control => (
              <div
                key={control.type}
                className={styles.controlItem}
                draggable
                onDragStart={(e) => handleControlDragStart(e, control.type)}
                onDragEnd={handleControlDragEnd}
                onClick={() => handleAddControl(control)}
              >
                <span className={styles.controlIcon}>{control.icon}</span>
                <div className={styles.controlInfo}>
                  <span className={styles.controlName}>{control.name}</span>
                  <span className={styles.controlDesc}>{control.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 中间表单设计区 */}
        <div className={styles.formDesigner}>
          <div className={styles.designerHeader}>
            <h3>表单设计</h3>
            <div className={styles.designerActions}>
              <Button icon={<UploadOutlined />} onClick={handleImportClick}>
                导入
              </Button>
              <Button icon={<DeleteOutlined />} danger onClick={handleClearForm}>
                清除数据
              </Button>
              <Button icon={<EyeOutlined />}>在新窗口预览</Button>
            </div>
          </div>

          <div className={styles.designerCanvas}>
            <div className={styles.formHeader}>
              <div className={styles.formHeaderContent}>
                <h2 className={styles.formTitle}>
                  {tool.name}
                  <Tag>{tool.target}</Tag>
                </h2>
                <EditOutlined className={styles.editIcon} />
              </div>
              <p className={styles.formDesc}>{tool.description}</p>
            </div>

            <div
              className={`${styles.formFields} ${dragOverCanvas ? styles.dragOver : ''} ${isDraggingControl || isDraggingField ? styles.dragging : ''}`}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
            >
              {formFields.length === 0 ? (
                <div className={`${styles.emptyCanvas} ${dragOverCanvas ? styles.dragOver : ''}`}>
                  <p>从左侧控件库拖拽或点击控件添加到表单</p>
                </div>
              ) : (
                <>
                  {formFields.map((field, index) => (
                    <React.Fragment key={field.id}>
                      {/* 拖拽放置指示器 */}
                      {dragOverIndex === index && (
                        <div className={styles.dropIndicator} />
                      )}
                      <div
                        className={`${styles.formFieldItem} ${selectedField?.id === field.id ? styles.selected : ''} ${
                          isDraggingField && draggedFieldIndexRef.current === index ? styles.dragging : ''
                        } ${styles[`width${field.width.replace('%', '')}`]}`}
                        draggable
                        onDragStart={(e) => handleFieldDragStart(e, index)}
                        onDragEnd={handleFieldDragEnd}
                        onDragOver={(e) => handleFieldDragOver(e, index)}
                        onDrop={(e) => handleFieldDrop(e, index)}
                        onClick={() => handleSelectField(field)}
                      >
                        <div className={styles.fieldHeader}>
                          <div className={styles.fieldDragHandle}>
                            <HolderOutlined />
                          </div>
                          <span className={styles.fieldLabel}>
                            {field.label}
                            {field.required && <span className={styles.requiredMark}>*</span>}
                          </span>
                          <div className={styles.fieldActions}>
                            <CopyOutlined onClick={(e) => { e.stopPropagation(); handleCopyField(field); }} />
                            <DeleteOutlined onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id); }} />
                          </div>
                        </div>
                        <div className={styles.fieldContent}>
                          {renderFieldPreview(field)}
                        </div>
                        {field.helpText && <div className={styles.fieldHelp}>{field.helpText}</div>}
                      </div>
                    </React.Fragment>
                  ))}
                  {/* 末尾放置区域 */}
                  <div
                    className={`${styles.dropZoneEnd} ${dragOverIndex === formFields.length ? styles.active : ''}`}
                    onDragOver={handleEndDragOver}
                    onDrop={handleEndDrop}
                  >
                    {dragOverIndex === formFields.length && <div className={styles.dropIndicator} />}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 右侧属性面板 */}
        <div className={styles.propertyPanel}>
          <h3 className={styles.panelTitle}>控件属性</h3>
          {selectedField ? (
            <>
              <Tabs
                activeKey={propertyTab}
                onChange={setPropertyTab}
                items={[
                  { key: 'basic', label: '基础属性' },
                  ...(selectedField.options ? [{ key: 'options', label: '选项配置' }] : []),
                  ...(selectedField.type === 'dynamicList' ? [{ key: 'advanced', label: '高级设置' }] : []),
                ]}
                size="small"
              />

              {propertyTab === 'basic' && (
                <div className={styles.propertyContent}>
                  <div className={styles.propertyItem}>
                    <label>标签</label>
                    <Input
                      value={selectedField.label}
                      onChange={e => handleUpdateField(selectedField.id, { label: e.target.value })}
                    />
                  </div>

                  {!['divider', 'group', 'dynamicList'].includes(selectedField.type) && (
                    <div className={styles.propertyItem}>
                      <label>占位提示</label>
                      <Input
                        value={selectedField.placeholder}
                        placeholder="请输入占位提示"
                        onChange={e => handleUpdateField(selectedField.id, { placeholder: e.target.value })}
                      />
                    </div>
                  )}

                  {!['divider', 'group'].includes(selectedField.type) && (
                    <div className={styles.propertyItem}>
                      <label>帮助文本</label>
                      <Input
                        value={selectedField.helpText}
                        placeholder="请输入帮助文本"
                        onChange={e => handleUpdateField(selectedField.id, { helpText: e.target.value })}
                      />
                    </div>
                  )}

                  <div className={styles.propertyItem}>
                    <label>宽度</label>
                    <Select
                      value={selectedField.width}
                      onChange={value => handleUpdateField(selectedField.id, { width: value })}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="25%">小 (25%)</Select.Option>
                      <Select.Option value="50%">中 (50%)</Select.Option>
                      <Select.Option value="75%">大 (75%)</Select.Option>
                      <Select.Option value="100%">全宽 (100%)</Select.Option>
                    </Select>
                  </div>

                  {!['divider', 'dynamicList'].includes(selectedField.type) && (
                    <div className={`${styles.propertyItem} ${styles.inline}`}>
                      <label>必填</label>
                      <Switch
                        checked={selectedField.required}
                        onChange={checked => handleUpdateField(selectedField.id, { required: checked })}
                      />
                    </div>
                  )}

                  {selectedField.type === 'number' && (
                    <>
                      <div className={styles.propertyItem}>
                        <label>小数位数</label>
                        <Select
                          value={selectedField.decimalPlaces}
                          onChange={value => handleUpdateField(selectedField.id, { decimalPlaces: value })}
                          style={{ width: '100%' }}
                        >
                          <Select.Option value="整数">整数</Select.Option>
                          <Select.Option value="1位小数">1位小数</Select.Option>
                          <Select.Option value="2位小数">2位小数</Select.Option>
                        </Select>
                      </div>

                      <div className={styles.propertyItem}>
                        <label>最小值</label>
                        <Input
                          value={selectedField.minValue}
                          placeholder="不限制"
                          onChange={e => handleUpdateField(selectedField.id, { minValue: e.target.value })}
                        />
                      </div>

                      <div className={styles.propertyItem}>
                        <label>最大值</label>
                        <Input
                          value={selectedField.maxValue}
                          placeholder="不限制"
                          onChange={e => handleUpdateField(selectedField.id, { maxValue: e.target.value })}
                        />
                      </div>

                      <div className={styles.propertyItem}>
                        <label>单位</label>
                        <Input
                          value={selectedField.unit}
                          placeholder="如：个、间、元等"
                          onChange={e => handleUpdateField(selectedField.id, { unit: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {!['divider', 'dynamicList'].includes(selectedField.type) && (
                    <div className={styles.propertyItem}>
                      <label>评价依据</label>
                      <div className={styles.evaluationConfig}>
                        <Select
                          value={mappingType}
                          onChange={(value) => setMappingType(value as 'data_indicator' | 'element')}
                          style={{ flex: 1 }}
                        >
                          <Select.Option value="data_indicator">数据指标</Select.Option>
                          <Select.Option value="element">要素</Select.Option>
                        </Select>
                        <Button
                          type="primary"
                          icon={<LinkOutlined />}
                          onClick={() => {
                            if (mappingType === 'data_indicator') {
                              setShowIndicatorSelector(true);
                            } else {
                              setShowElementSelector(true);
                            }
                          }}
                        >
                          关联
                        </Button>
                        {selectedField.mapping && (
                          <Tooltip title="取消关联">
                            <Button
                              danger
                              icon={<DisconnectOutlined />}
                              onClick={() => handleUpdateField(selectedField.id, { mapping: null })}
                            />
                          </Tooltip>
                        )}
                      </div>
                      {selectedField.mapping ? (
                        <div className={styles.mappingInfo}>
                          <Tag color={selectedField.mapping.mappingType === 'data_indicator' ? 'blue' : 'green'}>
                            {selectedField.mapping.mappingType === 'data_indicator' ? '数据指标' : '要素'}
                          </Tag>
                          <span className={styles.mappingName}>
                            {selectedField.mapping.targetInfo?.code} - {selectedField.mapping.targetInfo?.name}
                          </span>
                          {selectedField.mapping.targetInfo?.threshold && (
                            <Tag color="orange" style={{ marginLeft: 8 }}>
                              阈值: {selectedField.mapping.targetInfo.threshold}
                            </Tag>
                          )}
                        </div>
                      ) : (
                        <div className={styles.evaluationHint}>
                          可关联数据指标或要素，用于数据校验和计算
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {propertyTab === 'options' && selectedField.options && (
                <div className={styles.propertyContent}>
                  <div className={styles.propertyItem}>
                    <label>选项</label>
                    <div className={styles.optionsList}>
                      {selectedField.options.map((opt, index) => (
                        <div key={index} className={styles.optionRow}>
                          <Input
                            value={opt.label}
                            onChange={e => handleUpdateOptions(index, e.target.value)}
                          />
                          <DeleteOutlined
                            className={styles.deleteOption}
                            onClick={() => handleDeleteOption(index)}
                          />
                        </div>
                      ))}
                    </div>
                    <Button block onClick={handleAddOption} className={styles.addOptionBtn}>
                      添加选项
                    </Button>
                  </div>

                  <div className={styles.propertyItem}>
                    <label>选项布局</label>
                    <Select
                      value={selectedField.optionLayout}
                      onChange={value => handleUpdateField(selectedField.id, { optionLayout: value })}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="vertical">垂直</Select.Option>
                      <Select.Option value="horizontal">水平</Select.Option>
                    </Select>
                  </div>

                  <div className={`${styles.propertyItem} ${styles.inline}`}>
                    <label>条件显示</label>
                    <Switch
                      checked={selectedField.conditionalDisplay}
                      onChange={checked => handleUpdateField(selectedField.id, { conditionalDisplay: checked })}
                    />
                  </div>
                </div>
              )}

              {/* 动态列表高级设置 */}
              {propertyTab === 'advanced' && selectedField.type === 'dynamicList' && (
                <div className={styles.propertyContent}>
                  {/* 数量限制 */}
                  <div className={styles.propertyItem}>
                    <label>数量限制</label>
                    <div className={styles.itemCountConfig}>
                      <div className={styles.countItem}>
                        <span>最少条目</span>
                        <InputNumber
                          min={0}
                          max={selectedField.maxItems || 10}
                          value={selectedField.minItems}
                          onChange={(value) => handleUpdateField(selectedField.id, { minItems: value || 0 })}
                          style={{ width: 80 }}
                        />
                      </div>
                      <div className={styles.countItem}>
                        <span>最多条目</span>
                        <InputNumber
                          min={selectedField.minItems || 1}
                          max={100}
                          value={selectedField.maxItems}
                          onChange={(value) => handleUpdateField(selectedField.id, { maxItems: value || 10 })}
                          style={{ width: 80 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 字段列表 */}
                  <div className={styles.propertyItem}>
                    <label>字段列表</label>
                    <div className={styles.dynamicFieldList}>
                      {selectedField.dynamicListFields?.map((childField, index) => (
                        <div key={childField.id} className={styles.dynamicFieldCard}>
                          <div className={styles.dynamicFieldHeader}>
                            <span className={styles.dynamicFieldIndex}>字段 {index + 1}</span>
                            <DeleteOutlined
                              className={styles.dynamicFieldDelete}
                              onClick={() => handleDeleteDynamicField(childField.id)}
                            />
                          </div>
                          <div className={styles.dynamicFieldBody}>
                            <div className={styles.dynamicFieldRow}>
                              <label>标签</label>
                              <Input
                                value={childField.label}
                                onChange={(e) => handleUpdateDynamicField(childField.id, { label: e.target.value })}
                              />
                            </div>
                            <div className={styles.dynamicFieldRow}>
                              <label>类型</label>
                              <Select
                                value={childField.type}
                                onChange={(value) => handleUpdateDynamicField(childField.id, { type: value as DynamicListFieldType })}
                                style={{ width: '100%' }}
                              >
                                <Select.Option value="text">单行文本</Select.Option>
                                <Select.Option value="textarea">多行文本</Select.Option>
                                <Select.Option value="number">数字</Select.Option>
                                <Select.Option value="select">下拉选择</Select.Option>
                                <Select.Option value="date">日期</Select.Option>
                                <Select.Option value="time">时间</Select.Option>
                              </Select>
                            </div>
                            <div className={`${styles.dynamicFieldRow} ${styles.inline}`}>
                              <label>必填</label>
                              <Switch
                                checked={childField.required}
                                onChange={(checked) => handleUpdateDynamicField(childField.id, { required: checked })}
                              />
                            </div>
                            <div className={styles.dynamicFieldRow}>
                              <label>评价依据</label>
                              <div className={styles.evaluationConfig}>
                                <Select
                                  value={childField.evaluationMapping || 'none'}
                                  onChange={(value) => {
                                    handleUpdateDynamicField(childField.id, {
                                      evaluationMapping: value as 'none' | 'data_indicator' | 'element',
                                      mapping: value === 'none' ? null : childField.mapping
                                    });
                                  }}
                                  style={{ flex: 1 }}
                                >
                                  <Select.Option value="none">不关联</Select.Option>
                                  <Select.Option value="data_indicator">数据指标</Select.Option>
                                  <Select.Option value="element">要素</Select.Option>
                                </Select>
                                {childField.evaluationMapping && childField.evaluationMapping !== 'none' && (
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<LinkOutlined />}
                                    onClick={() => {
                                      setEditingDynamicFieldId(childField.id);
                                      if (childField.evaluationMapping === 'data_indicator') {
                                        setShowIndicatorSelector(true);
                                      } else {
                                        setShowElementSelector(true);
                                      }
                                    }}
                                  >
                                    关联
                                  </Button>
                                )}
                                {childField.mapping && (
                                  <Tooltip title="取消关联">
                                    <Button
                                      danger
                                      size="small"
                                      icon={<DisconnectOutlined />}
                                      onClick={() => handleUpdateDynamicField(childField.id, { mapping: null })}
                                    />
                                  </Tooltip>
                                )}
                              </div>
                              {childField.mapping && (
                                <div className={styles.mappingInfo}>
                                  <Tag color={childField.mapping.mappingType === 'data_indicator' ? 'blue' : 'green'}>
                                    {childField.mapping.mappingType === 'data_indicator' ? '数据指标' : '要素'}
                                  </Tag>
                                  <span className={styles.mappingName}>
                                    {childField.mapping.targetInfo?.code} - {childField.mapping.targetInfo?.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        block
                        icon={<PlusOutlined />}
                        onClick={handleAddDynamicField}
                        className={styles.addDynamicFieldBtn}
                      >
                        添加字段
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyProperties}>
              <p>选择一个控件查看属性</p>
            </div>
          )}
        </div>
      </div>

      {/* 数据指标选择器 */}
      <DataIndicatorSelector
        visible={showIndicatorSelector}
        onCancel={() => {
          setShowIndicatorSelector(false);
          setEditingDynamicFieldId(null);
        }}
        onSelect={(indicator) => {
          const mappingInfo: FieldMappingInfo = {
            mappingType: 'data_indicator',
            targetId: indicator.id,
            targetInfo: {
              code: indicator.code,
              name: indicator.name,
              threshold: indicator.threshold,
              description: indicator.description,
              indicatorName: indicator.indicatorName,
              indicatorCode: indicator.indicatorCode,
            },
          };

          if (editingDynamicFieldId) {
            // 动态列表子字段的关联
            handleUpdateDynamicField(editingDynamicFieldId, { mapping: mappingInfo });
          } else if (selectedField) {
            // 普通字段的关联
            handleUpdateField(selectedField.id, { mapping: mappingInfo });
          }
          setShowIndicatorSelector(false);
          setEditingDynamicFieldId(null);
        }}
        selectedId={selectedField?.mapping?.mappingType === 'data_indicator' ? selectedField.mapping.targetId : undefined}
      />

      {/* 要素选择器 */}
      <ElementSelector
        visible={showElementSelector}
        onCancel={() => {
          setShowElementSelector(false);
          setEditingDynamicFieldId(null);
        }}
        onSelect={(element) => {
          const mappingInfo: FieldMappingInfo = {
            mappingType: 'element',
            targetId: element.id,
            targetInfo: {
              code: element.code,
              name: element.name,
              elementType: element.elementType,
              dataType: element.dataType,
              formula: element.formula,
            },
          };

          if (editingDynamicFieldId) {
            // 动态列表子字段的关联
            handleUpdateDynamicField(editingDynamicFieldId, { mapping: mappingInfo });
          } else if (selectedField) {
            // 普通字段的关联
            handleUpdateField(selectedField.id, { mapping: mappingInfo });
          }
          setShowElementSelector(false);
          setEditingDynamicFieldId(null);
        }}
        selectedId={selectedField?.mapping?.mappingType === 'element' ? selectedField.mapping.targetId : undefined}
      />

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileSelect}
      />

      {/* 导入确认弹窗 */}
      <Modal
        title="导入表单字段"
        open={importModalVisible}
        onCancel={handleImportCancel}
        footer={[
          <Button key="cancel" onClick={handleImportCancel}>
            取消
          </Button>,
          <Button key="append" onClick={handleImportAppend}>
            追加到末尾
          </Button>,
          <Button key="replace" type="primary" danger onClick={handleImportReplace}>
            覆盖现有字段
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p>检测到当前表单已有 <strong>{formFields.length}</strong> 个字段。</p>
          <p>即将导入 <strong>{pendingImportFields.length}</strong> 个新字段。</p>
        </div>
        <p>请选择导入方式：</p>
        <ul style={{ paddingLeft: 20, color: '#666' }}>
          <li><strong>追加到末尾</strong>：保留现有字段，将新字段添加到表单末尾</li>
          <li><strong>覆盖现有字段</strong>：清空现有字段，只保留导入的字段</li>
        </ul>
      </Modal>
    </div>
  );
};

export default FormToolEdit;
