import React, { useState, useEffect, useMemo } from 'react';
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
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import * as toolService from '../../services/toolService';
import type { FormField } from '../../services/toolService';
import * as submissionService from '../../services/submissionService';
import type { Submission } from '../../services/submissionService';
import { parseThreshold, validateThreshold, calculate, parseVariables } from '../../utils/formulaCalculator';
import styles from './index.module.css';

// 映射目标信息
interface MappingTargetInfo {
  code: string;
  name: string;
  threshold?: string;
  elementType?: string;
  formula?: string;
}

// 扩展 FormField 类型以包含更多属性
interface ExtendedFormField extends FormField {
  minValue?: string;
  maxValue?: string;
  unit?: string;
  decimalPlaces?: '整数' | '1位小数' | '2位小数';
  optionLayout?: 'horizontal' | 'vertical';
  children?: ExtendedFormField[];
  mapping?: {
    mappingType: 'data_indicator' | 'element';
    targetId: string;
    targetInfo?: MappingTargetInfo;
  } | null;
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

const DataEntryForm: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, formId } = useParams<{ projectId: string; formId: string }>();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);
  const [formFields, setFormFields] = useState<ExtendedFormField[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!formId || !projectId) return;

      setLoading(true);
      try {
        // 获取完整的工具信息和schema（含字段映射）
        const fullSchemaData = await toolService.getFullSchema(formId);
        if (fullSchemaData) {
          setToolInfo({
            id: fullSchemaData.id,
            name: fullSchemaData.name,
            description: fullSchemaData.description || '',
            type: fullSchemaData.type,
            target: fullSchemaData.target || '',
            status: fullSchemaData.status,
          });

          if (fullSchemaData.schema) {
            setFormFields(fullSchemaData.schema as ExtendedFormField[]);
          }
        }

        // 尝试获取已有的填报记录
        const submissions = await submissionService.getByProject(projectId);
        const existingSubmission = submissions.find(
          (s: Submission) => s.formId === formId && s.status !== 'approved'
        );

        if (existingSubmission) {
          setSubmission(existingSubmission);
          if (existingSubmission.data) {
            const parsedData = typeof existingSubmission.data === 'string'
              ? JSON.parse(existingSubmission.data)
              : existingSubmission.data;
            setFormData(parsedData);
            form.setFieldsValue(parsedData);
          }
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
      const values = form.getFieldsValue();

      if (submission) {
        // 更新已有记录
        await submissionService.update(submission.id, {
          data: values,
        });
        message.success('草稿保存成功');
      } else {
        // 创建新记录
        const newSubmission = await submissionService.create({
          projectId,
          formId,
          submitterName: '当前用户', // 实际应从用户会话获取
          submitterOrg: '当前单位',
          data: values,
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
        await submissionService.update(submission.id, { data: values });
        await submissionService.submit(submission.id);
      } else {
        // 创建并提交
        const newSubmission = await submissionService.create({
          projectId,
          formId,
          submitterName: '当前用户',
          submitterOrg: '当前单位',
          data: values,
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

  // 根据表单值计算派生字段
  const computeDerivedValues = (values: Record<string, any>): Record<string, number> => {
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
  };


  // 渲染表单字段
  const renderFormField = (field: ExtendedFormField) => {
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
        const threshold = field.mapping?.targetInfo?.threshold;
        const formula = field.mapping?.targetInfo?.formula;
        const mappingCode = field.mapping?.targetInfo?.code;

        return (
          <Form.Item
            key={field.id}
            name={field.id}
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
                {mappingCode && !isDerived && (
                  <Tooltip title={`关联: ${field.mapping?.targetInfo?.name || mappingCode}`}>
                    <span className={styles.mappingBadge}>
                      {mappingCode}
                    </span>
                  </Tooltip>
                )}
              </span>
            }
            rules={[
              ...commonRules,
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
              </>
            }
            style={{ width: field.width }}
            className={isDerived ? styles.derivedField : undefined}
          >
            <InputNumber
              placeholder={isDerived ? '自动计算' : (field.placeholder || '请输入数字')}
              style={{ width: '100%' }}
              disabled={isDerived}
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
              {field.children?.map((childField) => renderFormField(childField))}
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
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} className={styles.dynamicListItem}>
                    <div className={styles.dynamicListFields}>
                      {field.children?.map((childField) => (
                        <Form.Item
                          {...restField}
                          key={childField.id}
                          name={[name, childField.id]}
                          label={childField.label}
                          rules={
                            childField.required
                              ? [{ required: true, message: `请填写${childField.label}` }]
                              : []
                          }
                        >
                          <Input placeholder={childField.placeholder || '请输入'} />
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
              </Card>
            )}
          </Form.List>
        );

      default:
        return null;
    }
  };

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
            onValuesChange={(_, allValues) => {
              // 当有派生字段时，计算并更新派生字段值
              if (calculateDerivedFields.length > 0) {
                const derivedValues = computeDerivedValues(allValues);
                if (Object.keys(derivedValues).length > 0) {
                  // 使用 setTimeout 避免循环更新
                  setTimeout(() => {
                    form.setFieldsValue(derivedValues);
                  }, 0);
                }
              }
            }}
          >
            <div className={styles.formFieldsContainer}>
              {formFields.map((field) => renderFormField(field))}
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
    </div>
  );
};

export default DataEntryForm;
