import React, { useState, useEffect, useRef } from 'react';
import { Button, Tag, Tabs, Input, Select, Switch, message, Tooltip } from 'antd';
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

  if (type === 'group' || type === 'dynamicList') {
    baseField.children = [];
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

  // 更新字段属性
  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    const updatedFields = formFields.map(f =>
      f.id === fieldId ? { ...f, ...updates } : f
    );
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
        return <Input placeholder={field.placeholder || '请输入数字'} disabled />;
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
              <Button icon={<UploadOutlined />}>导入102字段Schema</Button>
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
                        }`}
                        style={{ width: field.width }}
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
                    <>
                      <div className={styles.propertyItem}>
                        <label>占位提示</label>
                        <Input
                          value={selectedField.placeholder}
                          placeholder="请输入占位提示"
                          onChange={e => handleUpdateField(selectedField.id, { placeholder: e.target.value })}
                        />
                      </div>

                      <div className={styles.propertyItem}>
                        <label>帮助文本</label>
                        <Input
                          value={selectedField.helpText}
                          placeholder="请输入帮助文本"
                          onChange={e => handleUpdateField(selectedField.id, { helpText: e.target.value })}
                        />
                      </div>
                    </>
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

                  {!['divider'].includes(selectedField.type) && (
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
        onCancel={() => setShowIndicatorSelector(false)}
        onSelect={(indicator) => {
          if (selectedField) {
            handleUpdateField(selectedField.id, {
              mapping: {
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
              },
            });
          }
          setShowIndicatorSelector(false);
        }}
        selectedId={selectedField?.mapping?.mappingType === 'data_indicator' ? selectedField.mapping.targetId : undefined}
      />

      {/* 要素选择器 */}
      <ElementSelector
        visible={showElementSelector}
        onCancel={() => setShowElementSelector(false)}
        onSelect={(element) => {
          if (selectedField) {
            handleUpdateField(selectedField.id, {
              mapping: {
                mappingType: 'element',
                targetId: element.id,
                targetInfo: {
                  code: element.code,
                  name: element.name,
                  elementType: element.elementType,
                  dataType: element.dataType,
                  formula: element.formula,
                },
              },
            });
          }
          setShowElementSelector(false);
        }}
        selectedId={selectedField?.mapping?.mappingType === 'element' ? selectedField.mapping.targetId : undefined}
      />
    </div>
  );
};

export default FormToolEdit;
