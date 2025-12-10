import React, { useState, useEffect } from 'react';
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
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { toolService, FormField } from '../../services/toolService';
import { submissionService, Submission } from '../../services/submissionService';
import './index.css';

// 扩展 FormField 类型以包含更多属性
interface ExtendedFormField extends FormField {
  minValue?: string;
  maxValue?: string;
  unit?: string;
  decimalPlaces?: '整数' | '1位小数' | '2位小数';
  optionLayout?: 'horizontal' | 'vertical';
  children?: ExtendedFormField[];
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

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!formId || !projectId) return;

      setLoading(true);
      try {
        // 获取工具信息和schema
        const toolData = await toolService.getById(formId);
        if (toolData) {
          setToolInfo({
            id: toolData.id,
            name: toolData.name,
            description: toolData.description || '',
            type: toolData.type,
            target: toolData.target || '',
            status: toolData.status,
          });
        }

        // 获取表单schema
        const schemaData = await toolService.getSchema(formId);
        if (schemaData?.schema) {
          setFormFields(schemaData.schema);
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

      setSubmitting(true);
      const values = form.getFieldsValue();

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

      case 'number':
        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={
              <span>
                {field.label}
                {field.unit && <span className="field-unit">({field.unit})</span>}
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
            extra={field.helpText}
            style={{ width: field.width }}
          >
            <InputNumber
              placeholder={field.placeholder || '请输入数字'}
              style={{ width: '100%' }}
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
              <div className={`checkbox-group ${field.optionLayout || 'vertical'}`}>
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
              <div className={`radio-group ${field.optionLayout || 'vertical'}`}>
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
            className="form-group-card"
            style={{ width: field.width }}
          >
            <div className="form-fields-container">
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
                className="dynamic-list-card"
                style={{ width: field.width }}
                extra={
                  <Button type="link" onClick={() => add()}>
                    添加
                  </Button>
                }
              >
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} className="dynamic-list-item">
                    <div className="dynamic-list-fields">
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
                  <div className="empty-dynamic-list">
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
      <div className="data-entry-form-page">
        <div className="loading-container">
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  return (
    <div className="data-entry-form-page">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="header-left">
          <span className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className="page-title">数据填报</h1>
        </div>
        <div className="header-actions">
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
        <div className="form-info-card">
          <div className="form-info-header">
            <div className="form-info-left">
              <span className="form-name">{toolInfo.name}</span>
              <Tag>{toolInfo.type}</Tag>
              {toolInfo.target && <Tag color="blue">{toolInfo.target}</Tag>}
            </div>
            {getStatusTag(submission?.status)}
          </div>
          <p className="form-description">{toolInfo.description}</p>
        </div>
      )}

      {/* 状态提示 */}
      {submission?.status === 'submitted' && (
        <Alert
          message="表单已提交"
          description="您的填报已提交，正在等待审核。如需修改，请联系管理员退回后再编辑。"
          type="info"
          showIcon
          className="status-alert"
        />
      )}

      {submission?.status === 'rejected' && (
        <Alert
          message="表单已退回"
          description="您的填报已被退回，请根据反馈修改后重新提交。"
          type="warning"
          showIcon
          className="status-alert"
        />
      )}

      {/* 表单内容 */}
      <div className="form-content-card">
        {formFields.length === 0 ? (
          <div className="empty-form">
            <FileOutlined className="empty-icon" />
            <p>此表单暂无字段配置</p>
            <p className="empty-hint">请联系管理员配置表单字段</p>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            initialValues={formData}
            disabled={submission?.status === 'submitted'}
          >
            <div className="form-fields-container">
              {formFields.map((field) => renderFormField(field))}
            </div>
          </Form>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="form-footer">
        <div className="footer-left">
          {submission && (
            <span className="last-saved">
              上次保存: {submission.updatedAt || submission.createdAt}
            </span>
          )}
        </div>
        <div className="footer-actions">
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
