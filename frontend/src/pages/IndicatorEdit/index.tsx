import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Tag, Modal, Form, Input, Select, message, Radio, Upload, Switch, Divider } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SaveOutlined,
  LinkOutlined,
  FormOutlined,
  ThunderboltOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './index.module.css';
import * as toolService from '../../services/toolService';
import type { DataTool, FormField, Element as ApiElement, AggregationMethod, AggregationConfig } from '../../services/toolService';
import { normalizeOptionalId, normalizeOptionalText } from '../../utils/normalize';
import { AGGREGATION_METHOD_LABELS } from '../../utils/formulaCalculator';

// 扁平化的表单字段项（用于选择器）
interface FlattenedField {
  id: string;
  label: string;
  type: string;
  path: string; // 完整路径，如 "分组名 > 字段名"
}

// 要素类型
type ElementType = '基础要素' | '派生要素';

// 数据类型
type DataType = '文本' | '数字' | '日期' | '时间' | '逻辑' | '数组' | '文件';

// 要素接口
// 页面内部要素结构（沿用后端字段；与 API 的 Element 基本一致）
interface Element extends ApiElement {
  elementType: ElementType;
  dataType: DataType;
  aggregation?: AggregationConfig;
}

// 要素库接口
interface ElementLibrary {
  id: string;
  name: string;
  description: string;
  status: '未发布' | '已发布' | 'published' | 'draft';
  elementCount: number;
  elements: Element[];
}

// 递归扁平化表单字段
const flattenFormFields = (fields: any[], parentPath: string = ''): FlattenedField[] => {
  const result: FlattenedField[] = [];

  fields.forEach(field => {
    const currentPath = parentPath ? `${parentPath} > ${field.label}` : field.label;

    // 跳过分组和分割线，只添加实际输入控件
    if (field.type !== 'group' && field.type !== 'divider') {
      result.push({
        id: field.id,
        label: field.label,
        type: field.type,
        path: currentPath,
      });
    }

    // 处理分组的子字段
    if (field.type === 'group' && field.children) {
      result.push(...flattenFormFields(field.children, field.label));
    }

    // 处理动态列表的子字段
    if (field.type === 'dynamicList') {
      const listFields = field.dynamicListFields || field.fields || [];
      listFields.forEach((childField: any) => {
        result.push({
          id: `${field.id}.${childField.id}`,
          label: childField.label,
          type: childField.type,
          path: `${currentPath} > ${childField.label}`,
        });
      });
    }
  });

  return result;
};

const IndicatorEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [library, setLibrary] = useState<ElementLibrary | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);

  // 采集工具列表和表单schema缓存
  const [dataTools, setDataTools] = useState<DataTool[]>([]);
  const [formSchemas, setFormSchemas] = useState<Record<string, FormField[]>>({});

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  // 导入相关状态
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importData, setImportData] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  // 自动关联弹窗状态
  const [autoLinkModalVisible, setAutoLinkModalVisible] = useState(false);
  const [selectedAutoLinkToolId, setSelectedAutoLinkToolId] = useState<string | undefined>();
  const [autoLinking, setAutoLinking] = useState(false);

  // 筛选状态: 'all' | 'unlinked' | 'linked'
  const [filterType, setFilterType] = useState<'all' | 'unlinked' | 'linked'>('all');

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 监听要素类型变化
  const [addFormElementType, setAddFormElementType] = useState<ElementType>('基础要素');
  const [editFormElementType, setEditFormElementType] = useState<ElementType>('基础要素');

  // 监听选中的工具变化（用于级联选择控件）
  const [addFormToolId, setAddFormToolId] = useState<string | undefined>();
  const [editFormToolId, setEditFormToolId] = useState<string | undefined>();

  // 监听聚合配置变化
  const [addFormAggregationEnabled, setAddFormAggregationEnabled] = useState(false);
  const [editFormAggregationEnabled, setEditFormAggregationEnabled] = useState(false);
  const [addFormAggregationScopeLevel, setAddFormAggregationScopeLevel] = useState<'all' | 'custom'>('all');
  const [editFormAggregationScopeLevel, setEditFormAggregationScopeLevel] = useState<'all' | 'custom'>('all');

  // 加载工具的表单schema（带缓存）
  const loadToolSchema = useCallback(async (toolId: string) => {
    if (formSchemas[toolId]) return formSchemas[toolId];
    try {
      const result = await toolService.getSchema(toolId);
      if (result.schema) {
        setFormSchemas(prev => ({ ...prev, [toolId]: result.schema }));
        return result.schema;
      }
    } catch (error) {
      console.log('No schema found for tool:', toolId);
    }
    return [];
  }, [formSchemas]);

  // 根据选中的工具获取可用的字段列表
  const addFormFields = useMemo(() => {
    if (!addFormToolId) return [];
    const schema = formSchemas[addFormToolId];
    return schema ? flattenFormFields(schema) : [];
  }, [addFormToolId, formSchemas]);

  const editFormFields = useMemo(() => {
    if (!editFormToolId) return [];
    const schema = formSchemas[editFormToolId];
    return schema ? flattenFormFields(schema) : [];
  }, [editFormToolId, formSchemas]);

  // 根据筛选条件过滤要素列表
  const filteredElements = useMemo(() => {
    if (!library) return [];
    return library.elements.filter(element => {
      if (filterType === 'all') return true;
      // 未关联：基础要素且没有有效 fieldId（避免 "null"/"undefined" 误判）
      const isUnlinked = element.elementType === '基础要素' && (!element.toolId || !element.fieldId);
      if (filterType === 'unlinked') return isUnlinked;
      // 已关联：基础要素且有有效 fieldId，或者派生要素
      const isLinked = element.elementType === '派生要素' || (element.elementType === '基础要素' && element.toolId && element.fieldId);
      if (filterType === 'linked') return isLinked;
      return true;
    });
  }, [library, filterType]);

//   {
//     "id": "mj7c54rp80yc0butw",
//     "code": "E002",
//     "name": "小学部学生人数",
//     "elementType": "基础要素",
//     "dataType": "数字",
//     "formula": null,
//     "fieldId": "primary_student_count"
// }

  // 统计未关联要素数量（基础要素且没有 fieldId）
  const unlinkedCount = useMemo(() => {
    if (!library) return 0;
    return library.elements.filter(el =>
      el.elementType === '基础要素' && (!el.toolId || !el.fieldId)
    ).length;
  }, [library]);

  useEffect(() => {
    // 加载要素库数据和采集工具列表
    const loadData = async () => {
      if (!id) return;
      try {
        // 并行加载要素库和工具列表
        const [libraryData, toolsData] = await Promise.all([
          toolService.getElementLibrary(id),
          toolService.getTools()
        ]);

        // 转换要素库数据格式
        const mappedLibrary: ElementLibrary = {
          id: libraryData.id,
          name: libraryData.name,
          description: libraryData.description || '',
          status: libraryData.status === 'published' ? '已发布' : '未发布',
          elementCount: libraryData.elements?.length || 0,
          elements: (libraryData.elements || []).map(el => ({
            id: el.id,
            code: el.code,
            name: el.name,
            elementType: el.elementType,
            dataType: el.dataType,
            formula: el.formula,
            toolId: normalizeOptionalId(el.toolId),
            fieldId: normalizeOptionalId(el.fieldId),
            fieldLabel: normalizeOptionalText(el.fieldLabel),
            aggregation: el.aggregation,
          })),
        };

        setLibrary(mappedLibrary);
        setDataTools(toolsData);
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      }
    };

    loadData();
  }, [id]);

  const handleSelectElement = (element: Element) => {
    setSelectedElement(element);
  };

  const handleAddElement = () => {
    addForm.resetFields();
    setAddFormElementType('基础要素');
    setAddFormToolId(undefined);
    setAddFormAggregationEnabled(false);
    setAddFormAggregationScopeLevel('all');
    setAddModalVisible(true);
  };

  // 工具选择变化时加载schema
  const handleAddToolChange = async (toolId: string | undefined) => {
    setAddFormToolId(toolId);
    addForm.setFieldValue('fieldId', undefined);
    if (toolId) {
      await loadToolSchema(toolId);
    }
  };

  const handleEditToolChange = async (toolId: string | undefined) => {
    setEditFormToolId(toolId);
    editForm.setFieldValue('fieldId', undefined);
    if (toolId) {
      await loadToolSchema(toolId);
    }
  };

  const handleSaveAdd = async (values: any) => {
    if (!library || !id) return;

    try {
      // 获取选中字段的标签
      let fieldLabel: string | undefined;
      if (values.fieldId && addFormToolId) {
        const field = addFormFields.find(f => f.id === values.fieldId);
        fieldLabel = field?.path;
      }

      // 构建聚合配置
      let aggregation: AggregationConfig | undefined;
      if (values.elementType === '基础要素' && addFormAggregationEnabled) {
        aggregation = {
          enabled: true,
          method: values.aggregationMethod || 'sum',
          scope: addFormAggregationScopeLevel === 'custom' && values.filterField ? {
            level: 'custom',
            filter: {
              field: values.filterField,
              operator: values.filterOperator || 'eq',
              value: values.filterValue,
            },
          } : { level: 'all' },
        };
      }

      // 调用API添加要素
      const result = await toolService.addElement(id, {
        code: values.code,
        name: values.name,
        elementType: values.elementType,
        dataType: values.dataType,
        toolId: values.elementType === '基础要素' ? values.toolId : undefined,
        fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
        fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
        formula: values.elementType === '派生要素' ? values.formula : undefined,
        aggregation,
      });

      // 基础要素：保存"表单字段 -> 要素"的映射（持久化）
      if (values.elementType === '基础要素' && values.toolId && values.fieldId) {
        await toolService.addFieldMapping(values.toolId, values.fieldId, 'element', result.id);
      }

      const newElement: Element = {
        id: result.id,
        code: values.code,
        name: values.name,
        elementType: values.elementType,
        dataType: values.dataType,
        formula: values.elementType === '派生要素' ? values.formula : undefined,
        toolId: values.elementType === '基础要素' ? values.toolId : undefined,
        fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
        fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
        aggregation,
      };

      const updatedLibrary = {
        ...library,
        elements: [...library.elements, newElement],
        elementCount: library.elementCount + 1,
      };

      setLibrary(updatedLibrary);
      setAddModalVisible(false);
      setAddFormToolId(undefined);
      setAddFormAggregationEnabled(false);
      message.success('添加成功');
    } catch (error) {
      console.error('添加要素失败:', error);
      message.error('添加要素失败');
    }
  };

  const handleEditElement = async (element: Element) => {
    setSelectedElement(element);
    setEditFormElementType(element.elementType);
    setEditFormToolId(element.toolId);

    // 设置聚合配置状态
    const hasAggregation = element.aggregation?.enabled ?? false;
    setEditFormAggregationEnabled(hasAggregation);
    setEditFormAggregationScopeLevel(
      element.aggregation?.scope?.level === 'custom' ? 'custom' : 'all'
    );

    editForm.setFieldsValue({
      code: element.code,
      name: element.name,
      elementType: element.elementType,
      dataType: element.dataType,
      formula: element.formula,
      toolId: element.toolId,
      fieldId: element.fieldId,
      // 聚合配置
      aggregationMethod: element.aggregation?.method || 'sum',
      filterField: element.aggregation?.scope?.filter?.field,
      filterOperator: element.aggregation?.scope?.filter?.operator || 'eq',
      filterValue: element.aggregation?.scope?.filter?.value,
    });
    // 如果有关联工具，预加载schema
    if (element.toolId) {
      await loadToolSchema(element.toolId);
    }
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!library || !selectedElement) return;

    try {
      // 获取选中字段的标签
      let fieldLabel: string | undefined;
      if (values.fieldId && editFormToolId) {
        const field = editFormFields.find(f => f.id === values.fieldId);
        fieldLabel = field?.path;
      }

      // 构建聚合配置
      let aggregation: AggregationConfig | undefined;
      if (values.elementType === '基础要素' && editFormAggregationEnabled) {
        aggregation = {
          enabled: true,
          method: values.aggregationMethod || 'sum',
          scope: editFormAggregationScopeLevel === 'custom' && values.filterField ? {
            level: 'custom',
            filter: {
              field: values.filterField,
              operator: values.filterOperator || 'eq',
              value: values.filterValue,
            },
          } : { level: 'all' },
        };
      }

      // 调用API更新要素
      await toolService.updateElement(selectedElement.id, {
        code: values.code,
        name: values.name,
        elementType: values.elementType,
        dataType: values.dataType,
        toolId: values.elementType === '基础要素' ? values.toolId : undefined,
        fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
        fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
        formula: values.elementType === '派生要素' ? values.formula : undefined,
        aggregation,
      });

      // 处理"表单字段 -> 要素"的映射变更（持久化）
      const prevToolId = selectedElement.toolId;
      const prevFieldId = selectedElement.fieldId;
      const nextToolId = values.elementType === '基础要素' ? values.toolId : undefined;
      const nextFieldId = values.elementType === '基础要素' ? values.fieldId : undefined;

      // 如果之前存在映射，且本次更换/取消/类型变更，则删除旧映射
      if (prevToolId && prevFieldId) {
        const changed = prevToolId !== nextToolId || prevFieldId !== nextFieldId;
        if (changed) {
          await toolService.deleteFieldMapping(prevToolId, prevFieldId);
        }
      }

      // 如果本次为基础要素且提供了新映射，则保存/覆盖映射
      if (nextToolId && nextFieldId) {
        await toolService.addFieldMapping(nextToolId, nextFieldId, 'element', selectedElement.id);
      }

      const updatedElements = library.elements.map(el => {
        if (el.id === selectedElement.id) {
          return {
            ...el,
            code: values.code,
            name: values.name,
            elementType: values.elementType,
            dataType: values.dataType,
            formula: values.elementType === '派生要素' ? values.formula : undefined,
            toolId: values.elementType === '基础要素' ? values.toolId : undefined,
            fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
            fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
            aggregation,
          };
        }
        return el;
      });

      const updatedElement = updatedElements.find(el => el.id === selectedElement.id);
      setLibrary({ ...library, elements: updatedElements });
      setSelectedElement(updatedElement || null);
      setEditModalVisible(false);
      setEditFormToolId(undefined);
      setEditFormAggregationEnabled(false);
      message.success('保存成功');
    } catch (error) {
      console.error('更新要素失败:', error);
      message.error('更新要素失败');
    }
  };

  const handleDeleteElement = (elementId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该要素吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!library) return;

        try {
          await toolService.deleteElement(elementId);

          const updatedElements = library.elements.filter(el => el.id !== elementId);
          setLibrary({
            ...library,
            elements: updatedElements,
            elementCount: updatedElements.length,
          });

          if (selectedElement?.id === elementId) {
            setSelectedElement(null);
          }

          message.success('删除成功');
        } catch (error) {
          console.error('删除要素失败:', error);
          message.error('删除要素失败');
        }
      },
    });
  };

  const handleSaveLibrary = async () => {
    if (!library || !id) return;

    try {
      await toolService.updateElementLibrary(id, {
        name: library.name,
        description: library.description,
        // 全量覆盖：将当前页面 elements 一并提交
        elements: library.elements.map(el => ({
          id: el.id,
          code: el.code,
          name: el.name,
          elementType: el.elementType,
          dataType: el.dataType,
          formula: el.formula,
          toolId: el.toolId,
          fieldId: el.fieldId,
          fieldLabel: el.fieldLabel,
          aggregation: el.aggregation,
        })),
      });
      message.success('要素库保存成功');
    } catch (error) {
      console.error('保存要素库失败:', error);
      message.error('保存要素库失败');
    }
  };

  // 智能匹配要素名称和表单字段
  const matchElementToField = (elementName: string, fields: FlattenedField[]): FlattenedField | null => {
    // 清理要素名称（去除单位等）
    const cleanName = elementName
      .replace(/（[^）]*）/g, '') // 去除括号内容如（万人）、（元）
      .replace(/\([^)]*\)/g, '')  // 去除英文括号内容
      .trim();

    // 策略1: 精确匹配
    const exactMatch = fields.find(f => f.label === elementName || f.label === cleanName);
    if (exactMatch) return exactMatch;

    // 策略2: 字段标签包含要素名
    const fieldContainsElement = fields.find(f =>
      f.label.includes(cleanName) || cleanName.includes(f.label)
    );
    if (fieldContainsElement) return fieldContainsElement;

    // 策略3: 关键词匹配（至少3个字符的公共子串）
    for (const field of fields) {
      const fieldLabel = field.label;
      // 检查是否有足够长的公共子串
      for (let len = Math.min(cleanName.length, fieldLabel.length); len >= 3; len--) {
        for (let i = 0; i <= cleanName.length - len; i++) {
          const substr = cleanName.substring(i, i + len);
          if (fieldLabel.includes(substr)) {
            return field;
          }
        }
      }
    }

    return null;
  };

  // 打开自动关联弹窗
  const handleAutoLink = () => {
    setSelectedAutoLinkToolId(undefined);
    setAutoLinkModalVisible(true);
  };

  // 确认自动关联（选择工具后执行）
  const handleConfirmAutoLink = async () => {
    if (!library || !selectedAutoLinkToolId) {
      message.warning('请先选择采集工具');
      return;
    }

    setAutoLinking(true);

    // 预加载选中工具的schema（loadToolSchema 返回加载的 schema）
    let schema: FormField[] = [];
    try {
      schema = await loadToolSchema(selectedAutoLinkToolId);
    } catch (error) {
      console.error('加载schema失败:', error);
      message.error('加载表单字段失败');
      setAutoLinking(false);
      return;
    }

    if (!schema || schema.length === 0) {
      message.warning('该采集工具暂无表单字段');
      setAutoLinking(false);
      return;
    }

    // 使用返回的 schema 而不是从 state 读取（避免异步更新问题）
    const fields = flattenFormFields(schema);
    console.log('[自动关联] schema:', schema);
    console.log('[自动关联] 扁平化后的字段:', fields);
    if (fields.length === 0) {
      message.warning('该采集工具暂无可用的表单字段');
      setAutoLinking(false);
      return;
    }

    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let noMatchCount = 0;

    const updatedElements = library.elements.map(element => {
      // 只处理基础要素
      if (element.elementType !== '基础要素') {
        return element;
      }

      // 已经关联到其他工具的字段（有 toolId 且不是当前工具，且有 fieldId），跳过
      if (
        normalizeOptionalId(element.toolId) &&
        normalizeOptionalId(element.toolId) !== selectedAutoLinkToolId &&
        normalizeOptionalId(element.fieldId)
      ) {
        alreadyLinkedCount++;
        return element;
      }

      // 已关联到当前工具且有 fieldId，跳过
      if (normalizeOptionalId(element.toolId) === selectedAutoLinkToolId && normalizeOptionalId(element.fieldId)) {
        alreadyLinkedCount++;
        return element;
      }

      // 尝试匹配字段（没有 fieldId 的都尝试匹配）
      const matchedField = matchElementToField(element.name, fields);
      console.log(`[自动关联] 要素"${element.name}" 匹配结果:`, matchedField);

      if (matchedField) {
        linkedCount++;
        return {
          ...element,
          toolId: selectedAutoLinkToolId,
          fieldId: matchedField.id,
          fieldLabel: matchedField.path,
        };
      } else {
        noMatchCount++;
        return element;
      }
    });

    setLibrary({ ...library, elements: updatedElements });

    // 更新选中的要素（如果有的话）
    if (selectedElement) {
      const updated = updatedElements.find(el => el.id === selectedElement.id);
      if (updated) setSelectedElement(updated);
    }

    setAutoLinking(false);
    setAutoLinkModalVisible(false);

    const toolName = dataTools.find(t => t.id === selectedAutoLinkToolId)?.name || '采集工具';
    message.success(
      `自动关联完成：成功关联 ${linkedCount} 个要素到"${toolName}"，已关联 ${alreadyLinkedCount} 个，未匹配 ${noMatchCount} 个`
    );
  };

  // 打开导入弹窗
  const handleOpenImport = () => {
    setImportData(null);
    setImportMode('append');
    setImportModalVisible(true);
  };

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // 验证数据格式
        if (data.elements && Array.isArray(data.elements)) {
          setImportData(data);
          message.success(`已解析 ${data.elements.length} 个要素`);
        } else if (Array.isArray(data)) {
          setImportData({ elements: data });
          message.success(`已解析 ${data.length} 个要素`);
        } else {
          message.error('JSON格式不正确，需要包含 elements 数组');
        }
      } catch (error) {
        message.error('JSON解析失败，请检查文件格式');
        console.error('Parse error:', error);
      }
    };
    reader.readAsText(file);
    return false; // 阻止默认上传行为
  };

  // 执行导入
  const handleImport = async () => {
    if (!library || !id || !importData?.elements) return;

    setImporting(true);
    try {
      const result = await toolService.importElements(id, importData.elements, importMode);

      // 重新加载要素库数据
      const libraryData = await toolService.getElementLibrary(id);
      const mappedLibrary: ElementLibrary = {
        id: libraryData.id,
        name: libraryData.name,
        description: libraryData.description || '',
        status: libraryData.status === 'published' ? '已发布' : '未发布',
        elementCount: libraryData.elements?.length || 0,
        elements: (libraryData.elements || []).map(el => ({
          id: el.id,
          code: el.code,
          name: el.name,
          elementType: el.elementType,
          dataType: el.dataType,
          formula: el.formula,
          toolId: el.toolId,
          fieldId: el.fieldId,
          fieldLabel: el.fieldLabel,
        })),
      };
      setLibrary(mappedLibrary);
      setSelectedElement(null);

      setImportModalVisible(false);

      if (result.failed > 0 && result.errors) {
        Modal.warning({
          title: '部分导入失败',
          content: (
            <div>
              <p>成功导入 {result.imported} 个，失败 {result.failed} 个</p>
              <ul style={{ maxHeight: 200, overflow: 'auto' }}>
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e.code}: {e.error}</li>
                ))}
                {result.errors.length > 10 && <li>... 等共 {result.errors.length} 个错误</li>}
              </ul>
            </div>
          ),
        });
      } else {
        message.success(`成功导入 ${result.imported} 个要素`);
      }
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  if (!library) {
    return <div className={styles.elementEditPage}>加载中...</div>;
  }

  return (
    <div className={styles.elementEditPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>编辑评估要素</h1>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLibrary}>
          保存要素库
        </Button>
      </div>

      {/* 要素库信息卡片 */}
      <div className={styles.libraryInfoCard}>
        <div className={styles.libraryInfoHeader}>
          <div className={styles.libraryInfoLeft}>
            <span className={styles.libraryName}>{library.name}</span>
            <Tag className={styles.statusTag}>{library.status}</Tag>
          </div>
          <span className={styles.elementCount}>{library.elementCount}个要素</span>
        </div>
        <p className={styles.libraryDescription}>{library.description}</p>
      </div>

      {/* 主内容区域 */}
      <div className={styles.mainContent}>
        {/* 左侧要素列表 */}
        <div className={styles.elementListSection}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h3 style={{ margin: 0 }}>要素列表</h3>
              <Radio.Group
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="all">全部</Radio.Button>
                <Radio.Button value="unlinked">
                  未关联 <span style={{ color: unlinkedCount > 0 ? '#faad14' : '#999' }}>({unlinkedCount})</span>
                </Radio.Button>
                <Radio.Button value="linked">已关联</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button icon={<ImportOutlined />} onClick={handleOpenImport}>
                导入
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={handleAutoLink}>
                自动关联
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddElement}>
                添加要素
              </Button>
            </div>
          </div>

          <div className={styles.elementList}>
            {filteredElements.map(element => {
              // 判断是否为未关联的基础要素（没有 fieldId）
              const isUnlinked = element.elementType === '基础要素' && !normalizeOptionalId(element.fieldId);
              return (
              <div
                key={element.id}
                className={`${styles.elementItem} ${selectedElement?.id === element.id ? styles.selected : ''} ${isUnlinked ? styles.unlinkedElement : ''}`}
                onClick={() => handleSelectElement(element)}
              >
                <div className={styles.elementMain}>
                  <Tag className={styles.elementCode}>{element.code}</Tag>
                  <span className={styles.elementName}>{element.name}</span>
                  <Tag
                    className={`${styles.elementTypeTag} ${element.elementType === '派生要素' ? styles.derived : styles.base}`}
                  >
                    {element.elementType}
                  </Tag>
                  <span className={styles.elementDataType}># {element.dataType}</span>
                  {element.elementType === '基础要素' && (
                    <LinkOutlined
                      className={normalizeOptionalId(element.fieldId) ? styles.linkedIcon : styles.unlinkedIcon}
                      title={normalizeOptionalId(element.fieldId) ? `已关联: ${element.fieldLabel || element.fieldId}` : '未关联表单控件'}
                    />
                  )}
                </div>
                {normalizeOptionalText(element.fieldLabel) && (
                  <div className={styles.elementFieldLink}>
                    <FormOutlined />
                    <span>{element.fieldLabel}</span>
                  </div>
                )}
                {element.formula && (
                  <div className={styles.elementFormula}>
                    <FileTextOutlined />
                    <span>{element.formula}</span>
                  </div>
                )}
                <div className={styles.elementActions}>
                  <EditOutlined
                    className={styles.actionIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditElement(element);
                    }}
                  />
                  <DeleteOutlined
                    className={`${styles.actionIcon} ${styles.danger}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteElement(element.id);
                    }}
                  />
                </div>
              </div>
            );
            })}

            {filteredElements.length === 0 && (
              <div className={styles.emptyState}>
                {library.elements.length === 0
                  ? '暂无要素，请点击"添加要素"开始创建'
                  : filterType === 'unlinked'
                    ? '没有未关联的要素'
                    : filterType === 'linked'
                      ? '没有已关联的要素'
                      : '暂无要素'}
              </div>
            )}
          </div>
        </div>

        {/* 右侧要素属性面板 */}
        <div className={styles.elementPropertiesSection}>
          <h3>要素属性</h3>
          {selectedElement ? (
            <div className={styles.propertiesContent}>
              <div className={styles.propertyItem}>
                <label>要素编码</label>
                <span className={styles.propertyValue}>{selectedElement.code}</span>
              </div>
              <div className={styles.propertyItem}>
                <label>要素名称</label>
                <span className={styles.propertyValue}>{selectedElement.name}</span>
              </div>
              <div className={styles.propertyItem}>
                <label>要素类型</label>
                <Tag
                  className={`${styles.elementTypeTag} ${selectedElement.elementType === '派生要素' ? styles.derived : styles.base}`}
                >
                  {selectedElement.elementType}
                </Tag>
              </div>
              <div className={styles.propertyItem}>
                <label>数据类型</label>
                <span className={styles.propertyValue}>{selectedElement.dataType}</span>
              </div>
              {selectedElement.formula && (
                <div className={styles.propertyItem}>
                  <label>计算公式</label>
                  <div className={styles.formulaDisplay}>{selectedElement.formula}</div>
                </div>
              )}
              <div className={styles.propertyItem}>
                <label>关联采集工具</label>
                {normalizeOptionalId(selectedElement.toolId) ? (
                  <div className={styles.toolLinkDisplay}>
                    <LinkOutlined className={styles.toolLinkIcon} />
                    <span className={styles.toolLinkName}>
                      {dataTools.find(t => t.id === normalizeOptionalId(selectedElement.toolId))?.name || '未知工具'}
                    </span>
                  </div>
                ) : (
                  <span className={styles.noToolLink}>未关联</span>
                )}
              </div>
              {normalizeOptionalId(selectedElement.toolId) && (
                <div className={styles.propertyItem}>
                  <label>关联表单控件</label>
                  {normalizeOptionalId(selectedElement.fieldId) ? (
                    <div className={styles.fieldLinkDisplay}>
                      <FormOutlined className={styles.fieldLinkIcon} />
                      <span className={styles.fieldLinkName}>
                        {normalizeOptionalText(selectedElement.fieldLabel) || normalizeOptionalId(selectedElement.fieldId)}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.noToolLink}>未关联控件</span>
                  )}
                </div>
              )}
              {selectedElement.elementType === '基础要素' && (
                <div className={styles.propertyItem}>
                  <label>多填报汇总</label>
                  {selectedElement.aggregation?.enabled ? (
                    <div>
                      <Tag color="blue">
                        {AGGREGATION_METHOD_LABELS[selectedElement.aggregation.method] || selectedElement.aggregation.method}
                      </Tag>
                      <span style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>
                        {selectedElement.aggregation.scope?.level === 'custom'
                          ? `(${selectedElement.aggregation.scope.filter?.field} ${selectedElement.aggregation.scope.filter?.operator} ${selectedElement.aggregation.scope.filter?.value})`
                          : '(全部样本)'}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.noToolLink}>未启用</span>
                  )}
                </div>
              )}

              <div className={styles.propertiesActions}>
                <Button
                  block
                  icon={<EditOutlined />}
                  onClick={() => handleEditElement(selectedElement)}
                >
                  编辑要素
                </Button>
                <Button
                  block
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteElement(selectedElement.id)}
                >
                  删除要素
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyProperties}>
              <FileTextOutlined className={styles.emptyIcon} />
              <span>选择一个要素查看详情</span>
            </div>
          )}
        </div>
      </div>

      {/* 添加要素弹窗 */}
      <Modal
        title="添加要素"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={500}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>创建一个新的评估要素</p>
        <Form form={addForm} onFinish={handleSaveAdd} layout="vertical">
          <div className={styles.formRowInline}>
            <Form.Item
              label="要素编码"
              name="code"
              rules={[{ required: true, message: '请输入要素编码' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：E001" />
            </Form.Item>
            <Form.Item
              label="要素名称"
              name="name"
              rules={[{ required: true, message: '请输入要素名称' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：学生总数" />
            </Form.Item>
          </div>
          <div className={styles.formHint}>建议使用字母+数字组合</div>

          <div className={styles.formRowInline}>
            <Form.Item
              label="要素类型"
              name="elementType"
              rules={[{ required: true, message: '请选择要素类型' }]}
              initialValue="基础要素"
              className={styles.formItemHalf}
            >
              <Select onChange={(value) => setAddFormElementType(value as ElementType)}>
                <Select.Option value="基础要素">基础要素</Select.Option>
                <Select.Option value="派生要素">派生要素</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="数据类型"
              name="dataType"
              rules={[{ required: true, message: '请选择数据类型' }]}
              initialValue="文本"
              className={styles.formItemHalf}
            >
              <Select>
                <Select.Option value="文本">文本</Select.Option>
                <Select.Option value="数字">数字</Select.Option>
                <Select.Option value="日期">日期</Select.Option>
                <Select.Option value="时间">时间</Select.Option>
                <Select.Option value="逻辑">逻辑</Select.Option>
                <Select.Option value="数组">数组</Select.Option>
                <Select.Option value="文件">文件</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <div className={styles.formHint}>
            {addFormElementType === '基础要素' ? '直接采集的数据' : '通过计算得出的数据'}
          </div>

          {addFormElementType === '派生要素' && (
            <>
              <Form.Item
                label="计算公式"
                name="formula"
                rules={[{ required: true, message: '请输入计算公式' }]}
              >
                <Input placeholder="如：E003 / E004（使用要素编码进行计算）" />
              </Form.Item>
              <div className={styles.formHint}>使用要素编码和运算符（+ - * /）编写公式，支持括号</div>
            </>
          )}

          {addFormElementType === '基础要素' && (
            <>
              <Form.Item
                label="关联采集工具"
                name="toolId"
              >
                <Select
                  placeholder="请选择数据采集工具"
                  allowClear
                  onChange={handleAddToolChange}
                >
                  {dataTools.map(tool => (
                    <Select.Option key={tool.id} value={tool.id}>
                      {tool.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div className={styles.formHint}>选择用于采集此要素数据的工具</div>

              {addFormToolId && addFormFields.length > 0 && (
                <>
                  <Form.Item
                    label="关联表单控件"
                    name="fieldId"
                  >
                    <Select placeholder="请选择表单控件" allowClear showSearch optionFilterProp="children">
                      {addFormFields.map(field => (
                        <Select.Option key={field.id} value={field.id}>
                          {field.path}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div className={styles.formHint}>选择工具表单中要关联的具体控件</div>
                </>
              )}

              {/* 多填报汇总配置 */}
              <Divider style={{ margin: '16px 0 12px' }}>多填报汇总配置</Divider>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ marginRight: 8 }}>启用多填报汇总：</span>
                <Switch
                  checked={addFormAggregationEnabled}
                  onChange={setAddFormAggregationEnabled}
                />
                <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                  同一表单被多个学校填报后，自动汇总计算
                </span>
              </div>

              {addFormAggregationEnabled && (
                <>
                  <Form.Item
                    label="汇总方式"
                    name="aggregationMethod"
                    initialValue="sum"
                    rules={[{ required: true, message: '请选择汇总方式' }]}
                  >
                    <Select placeholder="请选择汇总方式">
                      {Object.entries(AGGREGATION_METHOD_LABELS).map(([value, label]) => (
                        <Select.Option key={value} value={value}>
                          {label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <div style={{ marginBottom: 8 }}>
                    <span style={{ marginRight: 8 }}>汇总范围：</span>
                    <Radio.Group
                      value={addFormAggregationScopeLevel}
                      onChange={(e) => setAddFormAggregationScopeLevel(e.target.value)}
                    >
                      <Radio value="all">全部样本</Radio>
                      <Radio value="custom">按条件筛选</Radio>
                    </Radio.Group>
                  </div>

                  {addFormAggregationScopeLevel === 'custom' && (
                    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Form.Item
                          name="filterField"
                          style={{ marginBottom: 0, flex: 1 }}
                        >
                          <Input placeholder="筛选字段（如：school_type）" />
                        </Form.Item>
                        <Form.Item
                          name="filterOperator"
                          initialValue="eq"
                          style={{ marginBottom: 0, width: 100 }}
                        >
                          <Select>
                            <Select.Option value="eq">等于</Select.Option>
                            <Select.Option value="ne">不等于</Select.Option>
                            <Select.Option value="gt">大于</Select.Option>
                            <Select.Option value="lt">小于</Select.Option>
                            <Select.Option value="gte">大于等于</Select.Option>
                            <Select.Option value="lte">小于等于</Select.Option>
                          </Select>
                        </Form.Item>
                        <Form.Item
                          name="filterValue"
                          style={{ marginBottom: 0, flex: 1 }}
                        >
                          <Input placeholder="筛选值（如：小学）" />
                        </Form.Item>
                      </div>
                      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                        只汇总满足条件的填报数据
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setAddModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑要素弹窗 */}
      <Modal
        title="编辑要素"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={500}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>修改评估要素的属性信息</p>
        <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
          <div className={styles.formRowInline}>
            <Form.Item
              label="要素编码"
              name="code"
              rules={[{ required: true, message: '请输入要素编码' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：E001" />
            </Form.Item>
            <Form.Item
              label="要素名称"
              name="name"
              rules={[{ required: true, message: '请输入要素名称' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：学生总数" />
            </Form.Item>
          </div>
          <div className={styles.formHint}>建议使用字母+数字组合</div>

          <div className={styles.formRowInline}>
            <Form.Item
              label="要素类型"
              name="elementType"
              rules={[{ required: true, message: '请选择要素类型' }]}
              className={styles.formItemHalf}
            >
              <Select onChange={(value) => setEditFormElementType(value as ElementType)}>
                <Select.Option value="基础要素">基础要素</Select.Option>
                <Select.Option value="派生要素">派生要素</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="数据类型"
              name="dataType"
              rules={[{ required: true, message: '请选择数据类型' }]}
              className={styles.formItemHalf}
            >
              <Select>
                <Select.Option value="文本">文本</Select.Option>
                <Select.Option value="数字">数字</Select.Option>
                <Select.Option value="日期">日期</Select.Option>
                <Select.Option value="时间">时间</Select.Option>
                <Select.Option value="逻辑">逻辑</Select.Option>
                <Select.Option value="数组">数组</Select.Option>
                <Select.Option value="文件">文件</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <div className={styles.formHint}>
            {editFormElementType === '基础要素' ? '直接采集的数据' : '通过计算得出的数据'}
          </div>

          {editFormElementType === '派生要素' && (
            <>
              <Form.Item
                label="计算公式"
                name="formula"
                rules={[{ required: true, message: '请输入计算公式' }]}
              >
                <Input placeholder="如：E003 / E004（使用要素编码进行计算）" />
              </Form.Item>
              <div className={styles.formHint}>使用要素编码和运算符（+ - * /）编写公式，支持括号</div>
            </>
          )}

          {editFormElementType === '基础要素' && (
            <>
              <Form.Item
                label="关联采集工具"
                name="toolId"
              >
                <Select
                  placeholder="请选择数据采集工具"
                  allowClear
                  onChange={handleEditToolChange}
                >
                  {dataTools.map(tool => (
                    <Select.Option key={tool.id} value={tool.id}>
                      {tool.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div className={styles.formHint}>选择用于采集此要素数据的工具</div>

              {editFormToolId && editFormFields.length > 0 && (
                <>
                  <Form.Item
                    label="关联表单控件"
                    name="fieldId"
                  >
                    <Select placeholder="请选择表单控件" allowClear showSearch optionFilterProp="children">
                      {editFormFields.map(field => (
                        <Select.Option key={field.id} value={field.id}>
                          {field.path}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div className={styles.formHint}>选择工具表单中要关联的具体控件</div>
                </>
              )}

              {/* 多填报汇总配置 */}
              <Divider style={{ margin: '16px 0 12px' }}>多填报汇总配置</Divider>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ marginRight: 8 }}>启用多填报汇总：</span>
                <Switch
                  checked={editFormAggregationEnabled}
                  onChange={setEditFormAggregationEnabled}
                />
                <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                  同一表单被多个学校填报后，自动汇总计算
                </span>
              </div>

              {editFormAggregationEnabled && (
                <>
                  <Form.Item
                    label="汇总方式"
                    name="aggregationMethod"
                    rules={[{ required: true, message: '请选择汇总方式' }]}
                  >
                    <Select placeholder="请选择汇总方式">
                      {Object.entries(AGGREGATION_METHOD_LABELS).map(([value, label]) => (
                        <Select.Option key={value} value={value}>
                          {label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <div style={{ marginBottom: 8 }}>
                    <span style={{ marginRight: 8 }}>汇总范围：</span>
                    <Radio.Group
                      value={editFormAggregationScopeLevel}
                      onChange={(e) => setEditFormAggregationScopeLevel(e.target.value)}
                    >
                      <Radio value="all">全部样本</Radio>
                      <Radio value="custom">按条件筛选</Radio>
                    </Radio.Group>
                  </div>

                  {editFormAggregationScopeLevel === 'custom' && (
                    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Form.Item
                          name="filterField"
                          style={{ marginBottom: 0, flex: 1 }}
                        >
                          <Input placeholder="筛选字段（如：school_type）" />
                        </Form.Item>
                        <Form.Item
                          name="filterOperator"
                          style={{ marginBottom: 0, width: 100 }}
                        >
                          <Select>
                            <Select.Option value="eq">等于</Select.Option>
                            <Select.Option value="ne">不等于</Select.Option>
                            <Select.Option value="gt">大于</Select.Option>
                            <Select.Option value="lt">小于</Select.Option>
                            <Select.Option value="gte">大于等于</Select.Option>
                            <Select.Option value="lte">小于等于</Select.Option>
                          </Select>
                        </Form.Item>
                        <Form.Item
                          name="filterValue"
                          style={{ marginBottom: 0, flex: 1 }}
                        >
                          <Input placeholder="筛选值（如：小学）" />
                        </Form.Item>
                      </div>
                      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                        只汇总满足条件的填报数据
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

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

      {/* 导入要素弹窗 */}
      <Modal
        title="导入要素"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={520}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>从JSON文件批量导入评估要素</p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>导入模式</div>
          <Radio.Group value={importMode} onChange={(e) => setImportMode(e.target.value)}>
            <Radio value="append">追加模式（保留现有要素）</Radio>
            <Radio value="replace">替换模式（清空后导入）</Radio>
          </Radio.Group>
          {importMode === 'replace' && (
            <div style={{ color: '#faad14', fontSize: 12, marginTop: 4 }}>
              注意：替换模式会删除现有所有要素
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>选择文件</div>
          <Upload.Dragger
            accept=".json"
            showUploadList={false}
            beforeUpload={handleFileSelect}
            style={{ padding: '20px 0' }}
          >
            <p className="ant-upload-drag-icon">
              <ImportOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽 JSON 文件到此区域</p>
            <p className="ant-upload-hint" style={{ fontSize: 12, color: '#999' }}>
              支持 .json 格式，文件需包含 elements 数组
            </p>
          </Upload.Dragger>
        </div>

        {importData && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
              {importData.name || '要素列表'}
            </div>
            <div style={{ color: '#666', fontSize: 13 }}>
              {importData.description && <div>{importData.description}</div>}
              <div>共 {importData.elements?.length || 0} 个要素待导入</div>
              {importData.elements?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ marginRight: 16 }}>
                    基础要素: {importData.elements.filter((e: any) => e.elementType === '基础要素').length}
                  </span>
                  <span>
                    派生要素: {importData.elements.filter((e: any) => e.elementType === '派生要素').length}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button style={{ marginRight: 8 }} onClick={() => setImportModalVisible(false)}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleImport}
            loading={importing}
            disabled={!importData?.elements?.length}
          >
            确认导入
          </Button>
        </div>
      </Modal>

      {/* 自动关联弹窗 */}
      <Modal
        title="自动关联"
        open={autoLinkModalVisible}
        onCancel={() => setAutoLinkModalVisible(false)}
        footer={null}
        width={480}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>选择采集工具后，将自动匹配要素名称与表单字段进行关联</p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>选择采集工具</div>
          <Select
            placeholder="请选择要关联的采集工具"
            value={selectedAutoLinkToolId}
            onChange={setSelectedAutoLinkToolId}
            style={{ width: '100%' }}
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {dataTools.map(tool => (
              <Select.Option key={tool.id} value={tool.id}>
                {tool.name}
              </Select.Option>
            ))}
          </Select>
        </div>

        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            <div style={{ marginBottom: 4 }}>
              <ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              自动关联将根据要素名称智能匹配表单字段
            </div>
            <div style={{ paddingLeft: 22, color: '#999', fontSize: 12 }}>
              • 支持精确匹配和模糊匹配<br />
              • 已关联的要素将被跳过<br />
              • 关联后请点击"保存要素库"保存更改
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button style={{ marginRight: 8 }} onClick={() => setAutoLinkModalVisible(false)}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleConfirmAutoLink}
            loading={autoLinking}
            disabled={!selectedAutoLinkToolId}
          >
            开始关联
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default IndicatorEdit;
