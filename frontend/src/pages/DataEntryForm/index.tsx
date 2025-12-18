import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  Button,
  Tag,
  Input,
  Select,
  Checkbox,
  Radio,
  DatePicker,
  TimePicker,
  Upload,
  Switch,
  Divider,
  message,
  Spin,
  Card,
  Alert,
  Form,
  InputNumber,
  Tooltip,
  Modal,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  CloudUploadOutlined,
  FileOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  WarningOutlined,
  InfoCircleOutlined,
  ImportOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import * as toolService from '../../services/toolService';
import type { FormField } from '../../services/toolService';
import * as submissionService from '../../services/submissionService';
import type { Submission } from '../../services/submissionService';
import { useAuthStore } from '../../stores/authStore';
import { parseThreshold, validateThreshold, calculate, parseVariables } from '../../utils/formulaCalculator';
import { sampleDataList } from '../../mock/sample-data-index';
import styles from './index.module.css';

dayjs.extend(customParseFormat);

// 映射目标信息
interface MappingTargetInfo {
  code: string;
  name: string;
  threshold?: string;
  elementType?: string;
  formula?: string;
}

// 条件显示配置
interface ShowWhenCondition {
  field: string;
  value?: string | string[];
  condition?: 'filled' | 'empty';
}

// 拆分配置类型
interface SplitConfig {
  id: string;
  type: 'config';
  label: string;
  description?: string;
  splitRules: {
    [key: string]: {
      label: string;
      description: string;
      weights: {
        primary?: number;
        junior?: number;
        senior?: number;
      };
      formula?: string;
      isDirectFill?: boolean; // 是否为直接填充（1:1）
    };
  };
  splitFields: string[];
  studentCountFields: {
    primary?: string;
    junior?: string;
    senior?: string;
  };
}

// 扩展 FormField 类型以包含更多属性
interface ExtendedFormField extends FormField {
  minValue?: string;
  maxValue?: string;
  unit?: string;
  decimalPlaces?: '整数' | '1位小数' | '2位小数';
  optionLayout?: 'horizontal' | 'vertical';
  children?: ExtendedFormField[];
  showWhen?: ShowWhenCondition;
  mapping?: {
    mappingType: 'data_indicator' | 'element';
    targetId: string;
    targetInfo?: MappingTargetInfo;
  } | null;
  // 拆分相关属性
  autoSplit?: {
    enabled: boolean;
    targetFields: {
      primary?: string;
      junior?: string;
      senior?: string;
    };
    description?: string;
  };
  computed?: boolean;
  readonly?: boolean;
  sourceField?: string;
}

// 校验警告类型
interface ValidationWarning {
  fieldId: string;
  fieldLabel: string;
  value: number;
  threshold: string;
  message: string;
}

// 工具信息
interface ToolInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  target: string;
  status: string;
}

type PickerFieldType = 'date' | 'time';

const buildPickerFieldTypeMap = (fields: ExtendedFormField[]): Record<string, PickerFieldType> => {
  const map: Record<string, PickerFieldType> = {};

  const walk = (fs: ExtendedFormField[]) => {
    fs.forEach((f) => {
      if (f.type === 'date' || f.type === 'time') {
        map[f.id] = f.type;
      }
      if (f.children?.length) {
        walk(f.children);
      }
    });
  };

  walk(fields);
  return map;
};

const normalizeValuesForPickers = (
  fields: ExtendedFormField[],
  values: Record<string, any>,
): Record<string, any> => {
  const pickerMap = buildPickerFieldTypeMap(fields);
  const next: Record<string, any> = { ...(values || {}) };

  Object.entries(pickerMap).forEach(([fieldId, type]) => {
    const v = next[fieldId];
    if (v === undefined || v === null || v === '') return;
    if (dayjs.isDayjs(v)) return;

    const parsed =
      type === 'time' && typeof v === 'string'
        ? dayjs(v, ['HH:mm:ss', 'HH:mm'], true)
        : dayjs(v);

    next[fieldId] = parsed.isValid() ? parsed : undefined;
  });

  return next;
};

const serializeValuesForSubmit = (
  fields: ExtendedFormField[],
  values: Record<string, any>,
): Record<string, any> => {
  const pickerMap = buildPickerFieldTypeMap(fields);
  const next: Record<string, any> = { ...(values || {}) };

  Object.entries(pickerMap).forEach(([fieldId, type]) => {
    const v = next[fieldId];
    if (!dayjs.isDayjs(v)) return;
    next[fieldId] = type === 'date' ? v.format('YYYY-MM-DD') : v.format('HH:mm:ss');
  });

  return next;
};

const DataEntryForm: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, formId } = useParams<{ projectId: string; formId: string }>();
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);
  const [formFields, setFormFields] = useState<ExtendedFormField[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentFormValues, setCurrentFormValues] = useState<Record<string, any>>({});
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(null);
  
  // 防抖定时器引用
  const computeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 导入示例数据相关状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedSampleType, setSelectedSampleType] = useState<string | undefined>();
  const [importFileData, setImportFileData] = useState<Record<string, any> | null>(null);

  // 解析当前范围（支持学校和区县）
  const resolvedSchoolScope = useMemo(() => {
    if (!user) return null;
    // 优先使用当前 scope（从右上角"角色/学校范围"菜单选择）
    if (user.currentScope?.type === 'school') return user.currentScope;
    // 如果只有一个学校 scope，允许自动选中
    const schoolScopes = Array.isArray(user.scopes) ? user.scopes.filter((s) => s.type === 'school') : [];
    if (schoolScopes.length === 1) return schoolScopes[0];
    return null;
  }, [user]);

  const resolvedDistrictScope = useMemo(() => {
    if (!user) return null;
    // 优先使用当前 scope（从右上角"角色/区县范围"菜单选择）
    if (user.currentScope?.type === 'district') return user.currentScope;
    // 如果只有一个区县 scope，允许自动选中
    const districtScopes = Array.isArray(user.scopes) ? user.scopes.filter((s) => s.type === 'district') : [];
    if (districtScopes.length === 1) return districtScopes[0];
    return null;
  }, [user]);

  // 根据工具目标类型获取对应的范围
  const resolvedScope = useMemo(() => {
    if (!toolInfo) return resolvedSchoolScope || resolvedDistrictScope;
    // 如果工具目标是区县，使用区县范围
    if (toolInfo.target === '区县') return resolvedDistrictScope;
    // 否则默认使用学校范围
    return resolvedSchoolScope;
  }, [toolInfo, resolvedSchoolScope, resolvedDistrictScope]);

  // 判断是否为区县级表单
  const isDistrictForm = toolInfo?.target === '区县';

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!formId || !projectId) return;

      setLoading(true);
      try {
        // 获取完整的工具信息和schema（含字段映射）
        const fullSchemaData = await toolService.getFullSchema(formId);
        const rawSchema = (fullSchemaData?.schema as any[] | undefined) || [];
        
        // 分离 config 和字段
        const configItem = rawSchema.find((item: any) => item.type === 'config' && item.id === '_split_config');
        const schemaFields = rawSchema.filter((item: any) => item.type !== 'config') as ExtendedFormField[];
        
        // 设置拆分配置（在设置字段之前，以便后续使用）
        const currentSplitConfig = configItem ? (configItem as SplitConfig) : null;
        if (currentSplitConfig) {
          setSplitConfig(currentSplitConfig);
        }
        
        if (fullSchemaData) {
          setToolInfo({
            id: fullSchemaData.id,
            name: fullSchemaData.name,
            description: fullSchemaData.description || '',
            type: fullSchemaData.type,
            target: fullSchemaData.target || '',
            status: fullSchemaData.status,
          });

          setFormFields(schemaFields);
        }

        // 尝试获取已有的填报记录
        const submissions = await submissionService.getByProject(projectId);
        // 使用当前选择的范围（学校或区县）来匹配
        const scopeIdForMatch = user?.currentScope?.id || resolvedSchoolScope?.id || resolvedDistrictScope?.id;
        const existingSubmission = submissions.find((s: Submission) =>
          s.formId === formId
          && s.status !== 'approved'
          && (scopeIdForMatch ? s.schoolId === scopeIdForMatch : true)
        );

        if (existingSubmission) {
          // 列表接口不包含 data，需再拉取详情以便回显
          const full = await submissionService.getSubmission(existingSubmission.id);
          setSubmission(full);
          const parsedData = (full && full.data) ? full.data : {};
          const normalized = normalizeValuesForPickers(schemaFields, parsedData as Record<string, any>);
          setFormData(normalized);
          setCurrentFormValues(normalized);
          form.setFieldsValue(normalized);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [formId, projectId, form]);

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!formId || !projectId) return;

    setSaving(true);
    try {
      if (!submission && !resolvedScope) {
        message.error(isDistrictForm
          ? '缺少区县信息：请先在右上角选择区县范围后再保存'
          : '缺少学校信息：请先在右上角选择学校范围后再保存');
        return;
      }
      const values = form.getFieldsValue();
      const payloadValues = serializeValuesForSubmit(formFields, values);

      if (submission) {
        // 更新已有记录
        await submissionService.update(submission.id, {
          data: payloadValues,
        });
        message.success('草稿保存成功');
      } else {
        // 创建新记录
        const newSubmission = await submissionService.create({
          projectId,
          formId,
          schoolId: resolvedScope?.id,
          submitterName: user?.username || '当前用户',
          submitterOrg: resolvedScope?.name || '当前单位',
          data: payloadValues,
        });
        setSubmission(newSubmission);
        message.success('草稿保存成功');
      }

      setFormData(values);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!formId || !projectId) return;

    try {
      // 验证表单
      await form.validateFields();

      const values = form.getFieldsValue();
      const payloadValues = serializeValuesForSubmit(formFields, values);

      // 执行阈值校验
      const warnings = performThresholdValidation(values);
      setValidationWarnings(warnings);

      // 如果有警告，显示确认框
      if (warnings.length > 0) {
        const confirmed = await new Promise<boolean>((resolve) => {
          import('antd').then(({ Modal }) => {
            Modal.confirm({
              title: '数据校验警告',
              content: (
                <div>
                  <p>以下字段的值未满足阈值要求，是否仍要提交？</p>
                  <ul style={{ marginTop: 12, paddingLeft: 20 }}>
                    {warnings.map((w, idx) => (
                      <li key={idx} style={{ marginBottom: 8 }}>
                        <strong>{w.fieldLabel}</strong>: {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
              okText: '仍然提交',
              cancelText: '返回修改',
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            });
          });
        });

        if (!confirmed) {
          return;
        }
      }

      setSubmitting(true);

      if (submission) {
        // 更新并提交
        await submissionService.update(submission.id, { data: payloadValues });
        await submissionService.submit(submission.id);
      } else {
        if (!resolvedScope) {
          message.error(isDistrictForm
            ? '缺少区县信息：请先在右上角选择区县范围后再提交'
            : '缺少学校信息：请先在右上角选择学校范围后再提交');
          return;
        }
        // 创建并提交
        const newSubmission = await submissionService.create({
          projectId,
          formId,
          schoolId: resolvedScope.id,
          submitterName: user?.username || '当前用户',
          submitterOrg: resolvedScope.name,
          data: payloadValues,
        });
        await submissionService.submit(newSubmission.id);
      }

      message.success('提交成功');
      navigate(-1);
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写所有必填项');
      } else {
        console.error('提交失败:', error);
        message.error('提交失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 打开导入弹窗
  const handleOpenImport = () => {
    setSelectedSampleType(undefined);
    setImportFileData(null);
    setImportModalVisible(true);
  };

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        setImportFileData(data);
        setSelectedSampleType(undefined); // 清除预设选择
        message.success('文件解析成功');
      } catch {
        message.error('JSON 文件解析失败，请检查格式');
      }
    };
    reader.readAsText(file);
    return false; // 阻止默认上传
  };

  // 确认导入
  const handleConfirmImport = () => {
    let dataToImport: Record<string, any> | null = null;

    if (importFileData) {
      // 优先使用上传的文件
      dataToImport = importFileData;
    } else if (selectedSampleType) {
      // 使用预设的示例数据
      const sample = sampleDataList.find(s => s.type === selectedSampleType);
      if (sample) {
        dataToImport = sample.data as Record<string, any>;
      }
    }

    if (!dataToImport) {
      message.warning('请选择示例数据或上传 JSON 文件');
      return;
    }

    // 移除描述字段
    const { _description, ...formValues } = dataToImport;

    // 设置表单值
    const normalized = normalizeValuesForPickers(formFields, formValues);
    form.setFieldsValue(normalized);
    setCurrentFormValues(normalized);
    setFormData(normalized);

    message.success('数据导入成功');
    setImportModalVisible(false);
  };

  // 获取状态标签
  const getStatusTag = (status?: string) => {
    switch (status) {
      case 'submitted':
        return (
          <Tag icon={<ClockCircleFilled />} color="processing">
            待审核
          </Tag>
        );
      case 'approved':
        return (
          <Tag icon={<CheckCircleFilled />} color="success">
            已通过
          </Tag>
        );
      case 'rejected':
        return (
          <Tag icon={<ExclamationCircleFilled />} color="error">
            已退回
          </Tag>
        );
      default:
        return (
          <Tag icon={<FileOutlined />} color="default">
            草稿
          </Tag>
        );
    }
  };

  // 执行阈值校验
  const performThresholdValidation = (values: Record<string, any>): ValidationWarning[] => {
    const warnings: ValidationWarning[] = [];

    const checkField = (field: ExtendedFormField) => {
      // 只对有映射且有阈值的数值字段进行校验
      if (field.type === 'number' && field.mapping?.targetInfo?.threshold) {
        const value = values[field.id];
        if (typeof value === 'number') {
          const thresholdConfig = parseThreshold(field.mapping.targetInfo.threshold);
          const result = validateThreshold(value, thresholdConfig);
          if (!result.valid && result.message) {
            warnings.push({
              fieldId: field.id,
              fieldLabel: field.label,
              value,
              threshold: field.mapping.targetInfo.threshold,
              message: result.message,
            });
          }
        }
      }

      // 递归检查子字段
      if (field.children) {
        field.children.forEach(checkField);
      }
    };

    formFields.forEach(checkField);
    return warnings;
  };

  // 计算派生要素值
  const calculateDerivedFields = useMemo(() => {
    // 找出所有派生要素字段
    const derivedFields: Array<{
      field: ExtendedFormField;
      formula: string;
      variables: string[];
    }> = [];

    const findDerivedFields = (fields: ExtendedFormField[]) => {
      fields.forEach((field) => {
        if (
          field.mapping?.targetInfo?.elementType === '派生要素' &&
          field.mapping.targetInfo.formula
        ) {
          const variables = parseVariables(field.mapping.targetInfo.formula);
          derivedFields.push({
            field,
            formula: field.mapping.targetInfo.formula,
            variables,
          });
        }
        if (field.children) {
          findDerivedFields(field.children);
        }
      });
    };

    findDerivedFields(formFields);
    return derivedFields;
  }, [formFields]);

  // 根据表单值计算派生字段（使用 useCallback 优化）
  const computeDerivedValues = useCallback((values: Record<string, any>): Record<string, number> => {
    if (calculateDerivedFields.length === 0) return {};

    const results: Record<string, number> = {};

    // 构建变量值映射（fieldId 或 code -> value）
    const valueMap: Record<string, number> = {};

    const extractValues = (fields: ExtendedFormField[]) => {
      fields.forEach((field) => {
        const value = values[field.id];
        if (typeof value === 'number') {
          valueMap[field.id] = value;
          // 如果有映射，也用 code 作为键
          if (field.mapping?.targetInfo?.code) {
            valueMap[field.mapping.targetInfo.code] = value;
          }
        }
        if (field.children) {
          extractValues(field.children);
        }
      });
    };

    extractValues(formFields);

    // 计算每个派生字段
    calculateDerivedFields.forEach(({ field, formula }) => {
      try {
        const result = calculate(formula, valueMap);
        results[field.id] = result;
      } catch (error) {
        // 计算失败时不填充值
        console.warn(`计算派生字段 ${field.label} 失败:`, error);
      }
    });

    return results;
  }, [calculateDerivedFields, formFields]);

  // 缓存字段查找结果
  const fieldCacheRef = useRef<Map<string, ExtendedFormField>>(new Map());

  // 构建字段查找缓存
  const buildFieldCache = useCallback((fields: ExtendedFormField[]) => {
    const cache = new Map<string, ExtendedFormField>();
    const walk = (fs: ExtendedFormField[]) => {
      fs.forEach((field) => {
        cache.set(field.id, field);
        if (field.children) {
          walk(field.children);
        }
      });
    };
    walk(fields);
    return cache;
  }, []);

  // 当 formFields 变化时更新缓存
  useEffect(() => {
    if (formFields.length > 0) {
      fieldCacheRef.current = buildFieldCache(formFields);
    }
  }, [formFields, buildFieldCache]);

  // 计算拆分字段值（带配置参数版本，用于初始化）
  const computeSplitValuesWithConfig = useCallback((
    values: Record<string, any>,
    config: SplitConfig,
    fields: ExtendedFormField[]
  ): Record<string, number> => {
    const results: Record<string, number> = {};

    const schoolType = values.school_type;
    if (!schoolType) return results;

    // 对每个需要拆分的字段进行计算
    config.splitFields.forEach((sourceFieldId) => {
      const sourceValue = values[sourceFieldId];
      if (typeof sourceValue !== 'number' || sourceValue <= 0) return;

      // 使用缓存查找字段
      const sourceField = fieldCacheRef.current.get(sourceFieldId);
      if (!sourceField) {
        console.warn(`未找到源字段: ${sourceFieldId}`);
        return;
      }
      if (!sourceField.autoSplit?.enabled) {
        console.warn(`源字段 ${sourceFieldId} 未启用 autoSplit`);
        return;
      }
      if (!sourceField.autoSplit?.targetFields) {
        console.warn(`源字段 ${sourceFieldId} 没有 targetFields 配置`);
        return;
      }

      // 获取对应的拆分规则
      const splitRule = config.splitRules[schoolType];
      if (!splitRule) return;

      // 根据字段的 decimalPlaces 设置精度
      const precision = sourceField.decimalPlaces === '2位小数' ? 2 : sourceField.decimalPlaces === '1位小数' ? 1 : 0;
      const formatValue = (val: number) => precision > 0 ? parseFloat(val.toFixed(precision)) : Math.round(val);

      // 如果是直接填充类型（1:1），直接填充到对应字段
      if (splitRule.isDirectFill) {
        if (schoolType === 'primary' && sourceField.autoSplit.targetFields.primary) {
          results[sourceField.autoSplit.targetFields.primary] = formatValue(sourceValue);
          return;
        }
        if (schoolType === 'junior' && sourceField.autoSplit.targetFields.junior) {
          results[sourceField.autoSplit.targetFields.junior] = formatValue(sourceValue);
          return;
        }
        return;
      }

      // 对于需要拆分的学校类型（九年一贯制、完全中学、十二年一贯制），使用加权计算

      // 获取学生人数
      const studentCounts: Record<string, number> = {};
      if (config.studentCountFields.primary) {
        const primaryCount = values[config.studentCountFields.primary];
        if (typeof primaryCount === 'number' && primaryCount > 0) {
          studentCounts.primary = primaryCount;
        }
      }
      if (config.studentCountFields.junior) {
        const juniorCount = values[config.studentCountFields.junior];
        if (typeof juniorCount === 'number' && juniorCount > 0) {
          studentCounts.junior = juniorCount;
        }
      }
      if (config.studentCountFields.senior) {
        const seniorCount = values[config.studentCountFields.senior];
        if (typeof seniorCount === 'number' && seniorCount > 0) {
          studentCounts.senior = seniorCount;
        }
      }

      // 计算加权总数
      let totalWeighted = 0;
      if (studentCounts.primary !== undefined && splitRule.weights.primary !== undefined) {
        totalWeighted += studentCounts.primary * splitRule.weights.primary;
      }
      if (studentCounts.junior !== undefined && splitRule.weights.junior !== undefined) {
        totalWeighted += studentCounts.junior * splitRule.weights.junior;
      }
      if (studentCounts.senior !== undefined && splitRule.weights.senior !== undefined) {
        totalWeighted += studentCounts.senior * splitRule.weights.senior;
      }

      if (totalWeighted === 0) return;

      // 计算各部分的占比和值
      if (studentCounts.primary !== undefined && splitRule.weights.primary !== undefined && sourceField.autoSplit.targetFields.primary) {
        const primaryWeighted = studentCounts.primary * splitRule.weights.primary;
        const primaryRatio = primaryWeighted / totalWeighted;
        const primaryValue = sourceValue * primaryRatio;
        results[sourceField.autoSplit.targetFields.primary] = formatValue(primaryValue);
      }

      if (studentCounts.junior !== undefined && splitRule.weights.junior !== undefined && sourceField.autoSplit.targetFields.junior) {
        const juniorWeighted = studentCounts.junior * splitRule.weights.junior;
        const juniorRatio = juniorWeighted / totalWeighted;
        const juniorValue = sourceValue * juniorRatio;
        results[sourceField.autoSplit.targetFields.junior] = formatValue(juniorValue);
      }

      if (studentCounts.senior !== undefined && splitRule.weights.senior !== undefined && sourceField.autoSplit.targetFields.senior) {
        const seniorWeighted = studentCounts.senior * splitRule.weights.senior;
        const seniorRatio = seniorWeighted / totalWeighted;
        const seniorValue = sourceValue * seniorRatio;
        results[sourceField.autoSplit.targetFields.senior] = formatValue(seniorValue);
      }
    });

    return results;
  }, [fieldCacheRef]);

  // 计算拆分字段值（使用组件状态中的配置）
  const computeSplitValues = useCallback((values: Record<string, any>): Record<string, number> => {
    if (!splitConfig) return {};
    return computeSplitValuesWithConfig(values, splitConfig, formFields);
  }, [splitConfig, formFields, computeSplitValuesWithConfig]);

  // 评估 showWhen 条件（使用 useCallback 优化）
  const evaluateShowWhen = useCallback((showWhen: ShowWhenCondition | undefined, currentValues: Record<string, any>): boolean => {
    if (!showWhen) return true;

    const { field: fieldName, value, condition } = showWhen;
    const fieldValue = currentValues[fieldName];

    // 条件模式: 'filled' 或 'empty'
    if (condition === 'filled') {
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    }
    if (condition === 'empty') {
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    }

    // 值匹配模式
    if (value !== undefined) {
      if (Array.isArray(value)) {
        return value.includes(fieldValue);
      }
      return fieldValue === value;
    }

    return true;
  }, []);

  // 手动触发计算所有计算字段
  const handleManualCalculate = useCallback(() => {
    const allValues = form.getFieldsValue();
    const computedValues: Record<string, number> = {};
    
    // 计算派生字段
    if (calculateDerivedFields.length > 0) {
      const derivedValues = computeDerivedValues(allValues);
      Object.assign(computedValues, derivedValues);
    }
    
    // 计算拆分字段
    if (splitConfig) {
      const splitValues = computeSplitValues(allValues);
      Object.assign(computedValues, splitValues);
      
      // 如果拆分计算没有结果，检查原因
      if (Object.keys(splitValues).length === 0) {
        const schoolType = allValues.school_type;
        if (!schoolType) {
          message.warning('请先选择学校类型');
          return;
        }
        
        // 对于 primary 和 junior 类型，按1:1填充，不需要检查拆分类型
        const needSplitTypes = ['nine_year', 'twelve_year', 'complete_secondary'];
        if (!needSplitTypes.includes(schoolType) && schoolType !== 'primary' && schoolType !== 'junior') {
          message.info('当前学校类型不需要计算');
          return;
        }
        
        // 检查学生人数是否填写
        const primaryCount = splitConfig.studentCountFields?.primary ? allValues[splitConfig.studentCountFields.primary] : undefined;
        const juniorCount = splitConfig.studentCountFields?.junior ? allValues[splitConfig.studentCountFields.junior] : undefined;
        const seniorCount = splitConfig.studentCountFields?.senior ? allValues[splitConfig.studentCountFields.senior] : undefined;
        
        if (!primaryCount && !juniorCount && !seniorCount) {
          message.warning('请先填写学生人数');
          return;
        }
        
        // 检查源字段是否有值
        const hasSourceValue = splitConfig.splitFields?.some((fieldId: string) => {
          const value = allValues[fieldId];
          return typeof value === 'number' && value > 0;
        });
        
        if (!hasSourceValue) {
          message.warning('请先填写需要拆分的源字段值（如教学及辅助用房面积等）');
          return;
        }
      }
    }
    
    if (Object.keys(computedValues).length > 0) {
      form.setFieldsValue(computedValues);
      message.success(`计算完成，已更新 ${Object.keys(computedValues).length} 个字段`);
    } else {
      // 如果没有计算结果，检查是否有配置
      if (!splitConfig && calculateDerivedFields.length === 0) {
        message.info('当前表单没有配置自动计算字段');
      }
    }
  }, [form, calculateDerivedFields, computeDerivedValues, splitConfig, computeSplitValues]);

  // 渲染表单字段（使用 useCallback 优化）
  const renderFormField = useCallback((field: ExtendedFormField, currentValues?: Record<string, any>) => {
    // 检查 showWhen 条件
    const values = currentValues || form.getFieldsValue();
    if (!evaluateShowWhen(field.showWhen, values)) {
      return null;
    }
    const commonRules = field.required
      ? [{ required: true, message: `请填写${field.label}` }]
      : [];

    switch (field.type) {
      case 'text':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <Input placeholder={field.placeholder || '请输入'} />
          </Form.Item>
        );

      case 'textarea':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <Input.TextArea
              placeholder={field.placeholder || '请输入'}
              rows={4}
              showCount
              maxLength={500}
            />
          </Form.Item>
        );

      case 'number': {
        const isDerived = field.mapping?.targetInfo?.elementType === '派生要素';
        const isComputed = field.computed === true;
        const isReadonly = field.readonly === true || isComputed;
        const threshold = field.mapping?.targetInfo?.threshold;
        const formula = field.mapping?.targetInfo?.formula;
        const mappingCode = field.mapping?.targetInfo?.code;

        return (
          <Form.Item
            key={field.id}
            name={field.id}
            required={field.required}
            label={
              <span>
                {field.label}
                {field.unit && <span className={styles.fieldUnit}>({field.unit})</span>}
                {threshold && (
                  <Tooltip title={`阈值要求: ${threshold}`}>
                    <span className={styles.thresholdHint}>
                      <InfoCircleOutlined />
                      {threshold}
                    </span>
                  </Tooltip>
                )}
                {isDerived && (
                  <Tooltip title={`自动计算: ${formula}`}>
                    <span className={styles.derivedBadge}>
                      派生
                    </span>
                  </Tooltip>
                )}
                {isComputed && !isDerived && (
                  <Button
                    type="link"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleManualCalculate();
                    }}
                    style={{
                      padding: 0,
                      height: 'auto',
                      fontSize: '12px',
                      color: '#1890ff',
                      marginLeft: 4
                    }}
                  >
                    自动计算
                  </Button>
                )}
                {mappingCode && !isDerived && !isComputed && (
                  <Tooltip title={`关联: ${field.mapping?.targetInfo?.name || mappingCode}`}>
                    <span className={styles.mappingBadge}>
                      {mappingCode}
                    </span>
                  </Tooltip>
                )}
              </span>
            }
            rules={[
              ...(isReadonly ? [] : commonRules),
              {
                type: 'number',
                min: field.minValue ? parseFloat(field.minValue) : undefined,
                max: field.maxValue ? parseFloat(field.maxValue) : undefined,
                message: `请输入${field.minValue || ''}${field.minValue && field.maxValue ? '-' : ''}${field.maxValue || ''}之间的数值`,
              },
            ]}
            extra={
              <>
                {field.helpText}
                {isDerived && formula && (
                  <div className={styles.formulaHint}>计算公式: {formula}</div>
                )}
                {isComputed && field.sourceField && (
                  <div className={styles.formulaHint}>根据 {field.sourceField} 自动拆分计算</div>
                )}
              </>
            }
            style={{ width: field.width }}
            className={isDerived || isComputed ? styles.derivedField : undefined}
          >
            <InputNumber
              placeholder={isReadonly ? '系统自动计算' : (field.placeholder || '请输入数字')}
              style={{ width: '100%' }}
              disabled={isReadonly}
              precision={
                field.decimalPlaces === '1位小数'
                  ? 1
                  : field.decimalPlaces === '2位小数'
                  ? 2
                  : 0
              }
            />
          </Form.Item>
        );
      }

      case 'select':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <Select placeholder={field.placeholder || '请选择'}>
              {field.options?.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        );

      case 'checkbox':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <Checkbox.Group>
              <div className={`${styles.checkboxGroup} ${styles[field.optionLayout || 'vertical']}`}>
                {field.options?.map((opt) => (
                  <Checkbox key={opt.value} value={opt.value}>
                    {opt.label}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        );

      case 'radio':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <Radio.Group>
              <div className={`${styles.radioGroup} ${styles[field.optionLayout || 'vertical']}`}>
                {field.options?.map((opt) => (
                  <Radio key={opt.value} value={opt.value}>
                    {opt.label}
                  </Radio>
                ))}
              </div>
            </Radio.Group>
          </Form.Item>
        );

      case 'date':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <DatePicker
              placeholder={field.placeholder || '选择日期'}
              style={{ width: '100%' }}
            />
          </Form.Item>
        );

      case 'time':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <TimePicker
              placeholder={field.placeholder || '选择时间'}
              style={{ width: '100%' }}
            />
          </Form.Item>
        );

      case 'file':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) return e;
              return e?.fileList;
            }}
          >
            <Upload>
              <Button icon={<CloudUploadOutlined />}>上传文件</Button>
            </Upload>
          </Form.Item>
        );

      case 'switch':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={commonRules}
            extra={field.helpText}
            style={{ width: field.width }}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        );

      case 'divider':
        return (
          <div key={field.id} style={{ width: '100%' }}>
            <Divider>{field.label !== '分割线' ? field.label : ''}</Divider>
          </div>
        );

      case 'group':
        return (
          <Card
            key={field.id}
            title={field.label}
            size="small"
            className={styles.formGroupCard}
            style={{ width: field.width }}
          >
            <div className={styles.formFieldsContainer}>
              {field.children?.map((childField) => renderFormField(childField, values))}
            </div>
          </Card>
        );

      case 'dynamicList':
        return (
          <Form.List key={field.id} name={field.id}>
            {(fields, { add, remove }) => (
              <Card
                title={field.label}
                size="small"
                className={styles.dynamicListCard}
                style={{ width: field.width }}
                extra={
                  <Button type="link" onClick={() => add()}>
                    添加
                  </Button>
                }
              >
                {(() => {
                  // 兼容 dynamicList 的子字段结构：children / dynamicListFields / fields
                  const listFields: ExtendedFormField[] =
                    ((field as any).dynamicListFields as ExtendedFormField[] | undefined) ||
                    ((field as any).fields as ExtendedFormField[] | undefined) ||
                    (field.children as ExtendedFormField[] | undefined) ||
                    [];

                  if (listFields.length === 0) {
                    return (
                      <div className={styles.emptyDynamicList}>
                        该动态列表未配置子字段，请在“工具表单设计”中为「{field.label}」添加子字段后再填报
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* 表头（列名） */}
                      <div className={styles.dynamicListHeaderRow}>
                        <div className={styles.dynamicListHeaderCells}>
                          {listFields.map((cf) => (
                            <div key={cf.id} className={styles.dynamicListHeaderCell}>
                              {cf.label}
                            </div>
                          ))}
                        </div>
                        <div className={styles.dynamicListHeaderAction}>操作</div>
                      </div>

                      {fields.map(({ key, name, ...restField }) => (
                        <div key={key} className={styles.dynamicListItem}>
                          <div className={styles.dynamicListFields}>
                            {listFields.map((childField) => (
                              <Form.Item
                                {...restField}
                                key={childField.id}
                                name={[name, childField.id]}
                                // 表格样式：列名由表头统一渲染，这里不重复显示 label
                                label={null}
                                rules={
                                  childField.required
                                    ? [{ required: true, message: `请填写${childField.label}` }]
                                    : []
                                }
                              >
                                {/* 先按输入框渲染：后续如需可按 childField.type 细分控件 */}
                                <Input placeholder={childField.placeholder || childField.label || '请输入'} />
                              </Form.Item>
                            ))}
                          </div>
                          <Button type="link" danger onClick={() => remove(name)}>
                            删除
                          </Button>
                        </div>
                      ))}

                      {fields.length === 0 && (
                        <div className={styles.emptyDynamicList}>
                          点击上方"添加"按钮添加数据
                        </div>
                      )}
                    </>
                  );
                })()}
              </Card>
            )}
          </Form.List>
        );

      default:
        return null;
    }
  }, [evaluateShowWhen, form, handleManualCalculate, calculateDerivedFields, computeDerivedValues, splitConfig, computeSplitValues]);

  if (loading) {
    return (
      <div className={styles.dataEntryFormPage}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dataEntryFormPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>数据填报</h1>
        </div>
        <div className={styles.headerActions}>
          <Button
            icon={<ImportOutlined />}
            onClick={handleOpenImport}
            disabled={submission?.status === 'submitted'}
          >
            导入数据
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveDraft}
            loading={saving}
            disabled={submission?.status === 'submitted'}
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmit}
            loading={submitting}
            disabled={submission?.status === 'submitted'}
          >
            提交
          </Button>
        </div>
      </div>

      {/* 表单信息卡片 */}
      {toolInfo && (
        <div className={styles.formInfoCard}>
          <div className={styles.formInfoHeader}>
            <div className={styles.formInfoLeft}>
              <span className={styles.formName}>{toolInfo.name}</span>
              <Tag>{toolInfo.type}</Tag>
              {toolInfo.target && <Tag color="blue">{toolInfo.target}</Tag>}
            </div>
            {getStatusTag(submission?.status)}
          </div>
          <p className={styles.formDescription}>{toolInfo.description}</p>
        </div>
      )}

      {/* 状态提示 */}
      {submission?.status === 'submitted' && (
        <Alert
          message="表单已提交"
          description="您的填报已提交，正在等待审核。如需修改，请联系管理员退回后再编辑。"
          type="info"
          showIcon
          className={styles.statusAlert}
        />
      )}

      {submission?.status === 'rejected' && (
        <Alert
          message="表单已退回"
          description="您的填报已被退回，请根据反馈修改后重新提交。"
          type="warning"
          showIcon
          className={styles.statusAlert}
        />
      )}

      {/* 校验警告提示 */}
      {validationWarnings.length > 0 && (
        <div className={styles.validationWarnings}>
          <Alert
            message="数据校验提示"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>以下字段的值未满足阈值要求：</p>
                {validationWarnings.map((warning, idx) => (
                  <div key={idx} className={styles.warningItem}>
                    <WarningOutlined />
                    <div className={styles.warningContent}>
                      <span className={styles.warningField}>{warning.fieldLabel}</span>
                      <span className={styles.warningMessage}> - {warning.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            }
            type="warning"
            showIcon
            closable
            onClose={() => setValidationWarnings([])}
          />
        </div>
      )}

      {/* 表单内容 */}
      <div className={styles.formContentCard}>
        {formFields.length === 0 ? (
          <div className={styles.emptyForm}>
            <FileOutlined className={styles.emptyIcon} />
            <p>此表单暂无字段配置</p>
            <p className={styles.emptyHint}>请联系管理员配置表单字段</p>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            initialValues={formData}
            disabled={submission?.status === 'submitted'}
            onValuesChange={(changedValues, allValues) => {
              // 更新当前表单值状态（用于 showWhen 条件评估）
              setCurrentFormValues(allValues);

              // 清除之前的定时器
              if (computeTimerRef.current) {
                clearTimeout(computeTimerRef.current);
              }

              // 防抖处理：延迟计算，避免频繁更新
              computeTimerRef.current = setTimeout(() => {
                // 检查是否有相关字段变化（只在这些字段变化时才计算）
                const relevantFields = new Set<string>();
                if (calculateDerivedFields.length > 0) {
                  calculateDerivedFields.forEach(({ variables }) => {
                    variables.forEach(v => relevantFields.add(v));
                  });
                }
                if (splitConfig) {
                  relevantFields.add('school_type');
                  if (splitConfig.studentCountFields.primary) {
                    relevantFields.add(splitConfig.studentCountFields.primary);
                  }
                  if (splitConfig.studentCountFields.junior) {
                    relevantFields.add(splitConfig.studentCountFields.junior);
                  }
                  if (splitConfig.studentCountFields.senior) {
                    relevantFields.add(splitConfig.studentCountFields.senior);
                  }
                  splitConfig.splitFields.forEach(f => relevantFields.add(f));
                }

                // 检查是否有相关字段变化
                const hasRelevantChange = Object.keys(changedValues).some(key => relevantFields.has(key));
                if (!hasRelevantChange && calculateDerivedFields.length === 0 && !splitConfig) {
                  return;
                }

                // 合并所有计算值
                const computedValues: Record<string, number> = {};

                // 当有派生字段时，计算并更新派生字段值
                if (calculateDerivedFields.length > 0) {
                  const derivedValues = computeDerivedValues(allValues);
                  Object.assign(computedValues, derivedValues);
                }

                // 当有拆分配置时，计算并更新拆分字段值
                if (splitConfig) {
                  const splitValues = computeSplitValues(allValues);
                  Object.assign(computedValues, splitValues);
                }

                // 更新所有计算字段
                if (Object.keys(computedValues).length > 0) {
                  form.setFieldsValue(computedValues);
                }
              }, 150); // 150ms 防抖延迟
            }}
          >
            <div className={styles.formFieldsContainer}>
              {formFields.map((field) => renderFormField(field, currentFormValues))}
            </div>
          </Form>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className={styles.formFooter}>
        <div className={styles.footerLeft}>
          {submission && (
            <span className={styles.lastSaved}>
              上次保存: {submission.updatedAt || submission.createdAt}
            </span>
          )}
        </div>
        <div className={styles.footerActions}>
          <Button onClick={() => navigate(-1)}>取消</Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveDraft}
            loading={saving}
            disabled={submission?.status === 'submitted'}
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmit}
            loading={submitting}
            disabled={submission?.status === 'submitted'}
          >
            提交
          </Button>
        </div>
      </div>

      {/* 导入数据弹窗 */}
      <Modal
        title="导入填报数据"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={handleConfirmImport}
        okText="确认导入"
        cancelText="取消"
        width={560}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>选择预设示例数据：</div>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择学校类型的示例数据"
            value={selectedSampleType}
            onChange={(value) => {
              setSelectedSampleType(value);
              setImportFileData(null); // 清除上传的文件
            }}
            options={sampleDataList.map(s => ({
              value: s.type,
              label: `${s.label} - ${s.description}`,
            }))}
            allowClear
          />
        </div>

        <Divider>或</Divider>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>上传 JSON 文件：</div>
          <Upload.Dragger
            accept=".json"
            showUploadList={false}
            beforeUpload={handleFileUpload}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 JSON 文件到此区域</p>
            <p className="ant-upload-hint">支持 .json 格式的填报数据文件</p>
          </Upload.Dragger>
          {importFileData && (
            <div style={{ marginTop: 8, color: '#52c41a' }}>
              ✓ 已加载文件数据
              {importFileData._description && ` (${importFileData._description})`}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default DataEntryForm;
