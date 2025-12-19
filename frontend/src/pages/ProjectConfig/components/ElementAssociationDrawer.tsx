/**
 * 数据指标-评估要素关联编辑抽屉
 * 支持查看和编辑数据指标与评估要素的关联关系
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Button,
  Tag,
  Space,
  Popconfirm,
  message,
  Empty,
  Spin,
  Select,
  Input,
  Tooltip,
  Descriptions,
  Divider,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as indicatorService from '../../../services/indicatorService';
import * as toolService from '../../../services/toolService';
import type { ElementAssociation, DataIndicator } from '../../../services/indicatorService';
import ElementSelector from '../../../components/ElementSelector';
import styles from '../index.module.css';

interface ElementAssociationDrawerProps {
  visible: boolean;
  onClose: () => void;
  dataIndicator: DataIndicator | null;
  indicatorName?: string;
  onSaved?: () => void;
  readonly?: boolean; // 只读模式，隐藏编辑操作
  /** 允许选择的要素库ID列表 */
  allowedLibraryIds?: string[];
}

interface LocalAssociation {
  id?: string;
  elementId: string;
  mappingType: 'primary' | 'reference';
  description: string;
  // 要素信息
  elementCode: string;
  elementName: string;
  elementType: '基础要素' | '派生要素';
  dataType: string;
  formula?: string;
  libraryName: string;
  isNew?: boolean;
}

const ElementAssociationDrawer: React.FC<ElementAssociationDrawerProps> = ({
  visible,
  onClose,
  dataIndicator,
  indicatorName,
  onSaved,
  readonly = false,
  allowedLibraryIds,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [associations, setAssociations] = useState<LocalAssociation[]>([]);
  const [elementSelectorVisible, setElementSelectorVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // 加载关联数据
  const loadAssociations = useCallback(async () => {
    if (!dataIndicator?.id) return;

    setLoading(true);
    try {
      const data = await indicatorService.getDataIndicatorElements(dataIndicator.id);
      setAssociations(data.map(a => ({
        id: a.id,
        elementId: a.elementId,
        mappingType: a.mappingType,
        description: a.description || '',
        elementCode: a.elementCode,
        elementName: a.elementName,
        elementType: a.elementType,
        dataType: a.dataType,
        formula: a.formula,
        libraryName: a.libraryName,
      })));
    } catch (error) {
      console.error('加载关联数据失败:', error);
      message.error('加载关联数据失败');
    } finally {
      setLoading(false);
    }
  }, [dataIndicator?.id]);

  useEffect(() => {
    if (visible && dataIndicator?.id) {
      loadAssociations();
    }
  }, [visible, dataIndicator?.id, loadAssociations]);

  // 重置状态
  useEffect(() => {
    if (!visible) {
      setAssociations([]);
      setEditingKey(null);
    }
  }, [visible]);

  // 选择要素后添加关联
  const handleElementSelect = (element: toolService.ElementWithLibrary) => {
    // 检查是否已存在
    if (associations.some(a => a.elementId === element.id)) {
      message.warning('该要素已关联');
      return;
    }

    const newAssoc: LocalAssociation = {
      elementId: element.id,
      mappingType: 'primary',
      description: '',
      elementCode: element.code,
      elementName: element.name,
      elementType: element.elementType,
      dataType: element.dataType,
      formula: element.formula,
      libraryName: element.libraryName,
      isNew: true,
    };

    setAssociations(prev => [...prev, newAssoc]);
    setElementSelectorVisible(false);
    message.success('已添加要素关联');
  };

  // 删除关联
  const handleDelete = (elementId: string) => {
    setAssociations(prev => prev.filter(a => a.elementId !== elementId));
  };

  // 更新关联类型
  const handleMappingTypeChange = (elementId: string, mappingType: 'primary' | 'reference') => {
    setAssociations(prev => prev.map(a =>
      a.elementId === elementId ? { ...a, mappingType } : a
    ));
  };

  // 更新描述
  const handleDescriptionChange = (elementId: string, description: string) => {
    setAssociations(prev => prev.map(a =>
      a.elementId === elementId ? { ...a, description } : a
    ));
  };

  // 保存所有关联
  const handleSave = async () => {
    if (!dataIndicator?.id) return;

    setSaving(true);
    try {
      await indicatorService.saveDataIndicatorElements(
        dataIndicator.id,
        associations.map(a => ({
          elementId: a.elementId,
          mappingType: a.mappingType,
          description: a.description,
        }))
      );
      message.success('保存成功');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<LocalAssociation> = [
    {
      title: '要素编码',
      dataIndex: 'elementCode',
      key: 'elementCode',
      width: 100,
      render: (code: string) => (
        <code style={{ fontSize: 12, color: '#666' }}>{code}</code>
      ),
    },
    {
      title: '要素名称',
      dataIndex: 'elementName',
      key: 'elementName',
      width: 180,
      render: (name: string, record) => (
        <Space>
          {record.elementType === '基础要素' ? (
            <DatabaseOutlined style={{ color: '#1890ff' }} />
          ) : (
            <FunctionOutlined style={{ color: '#52c41a' }} />
          )}
          <span>{name}</span>
          {record.isNew && <Badge status="processing" text="新增" />}
        </Space>
      ),
    },
    {
      title: '要素类型',
      dataIndex: 'elementType',
      key: 'elementType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === '基础要素' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 80,
    },
    {
      title: '关联类型',
      dataIndex: 'mappingType',
      key: 'mappingType',
      width: 120,
      render: (type: string, record) =>
        readonly ? (
          <Tag color={type === 'primary' ? 'blue' : 'orange'}>
            {type === 'primary' ? '主要关联' : '参考关联'}
          </Tag>
        ) : (
          <Select
            value={type}
            size="small"
            style={{ width: 100 }}
            onChange={(value) => handleMappingTypeChange(record.elementId, value as 'primary' | 'reference')}
          >
            <Select.Option value="primary">
              <Tag color="blue">主要关联</Tag>
            </Select.Option>
            <Select.Option value="reference">
              <Tag color="orange">参考关联</Tag>
            </Select.Option>
          </Select>
        ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string, record) =>
        readonly ? (
          <span style={{ color: desc ? undefined : '#999' }}>{desc || '-'}</span>
        ) : editingKey === record.elementId ? (
          <Input
            size="small"
            value={desc}
            onChange={(e) => handleDescriptionChange(record.elementId, e.target.value)}
            onBlur={() => setEditingKey(null)}
            onPressEnter={() => setEditingKey(null)}
            autoFocus
          />
        ) : (
          <div
            style={{ cursor: 'pointer', minHeight: 22 }}
            onClick={() => setEditingKey(record.elementId)}
          >
            {desc || <span style={{ color: '#999' }}>点击添加说明</span>}
          </div>
        ),
    },
    // 只读模式下不显示操作列
    ...(!readonly ? [{
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: LocalAssociation) => (
        <Popconfirm
          title="确定删除该关联吗？"
          onConfirm={() => handleDelete(record.elementId)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <LinkOutlined />
            <span>{readonly ? '查看要素关联' : '编辑要素关联'}</span>
          </Space>
        }
        placement="right"
        width={800}
        open={visible}
        onClose={onClose}
        extra={
          readonly ? (
            <Button onClick={onClose}>关闭</Button>
          ) : (
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                保存
              </Button>
            </Space>
          )
        }
      >
        {/* 数据指标信息 */}
        {dataIndicator && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="数据指标编码">
                <code>{dataIndicator.code}</code>
              </Descriptions.Item>
              <Descriptions.Item label="数据指标名称">
                {dataIndicator.name}
              </Descriptions.Item>
              <Descriptions.Item label="达标阈值">
                {dataIndicator.threshold || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="所属指标">
                {indicatorName || '-'}
              </Descriptions.Item>
              {dataIndicator.description && (
                <Descriptions.Item label="描述" span={2}>
                  {dataIndicator.description}
                </Descriptions.Item>
              )}
            </Descriptions>
            <Divider />
          </>
        )}

        {/* 关联要素列表 */}
        <div style={{ marginBottom: 16 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500 }}>
              关联的评估要素 ({associations.length})
            </span>
            {!readonly && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setElementSelectorVisible(true)}
              >
                添加要素
              </Button>
            )}
          </Space>
        </div>

        <Spin spinning={loading}>
          {associations.length > 0 ? (
            <Table
              rowKey="elementId"
              columns={columns}
              dataSource={associations}
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={readonly ? '该数据指标暂未关联评估要素' : '暂无关联要素'}
            >
              {!readonly && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setElementSelectorVisible(true)}
                >
                  添加要素
                </Button>
              )}
            </Empty>
          )}
        </Spin>

        {/* 派生要素公式说明 */}
        {associations.some(a => a.formula) && (
          <>
            <Divider plain>
              <span style={{ fontSize: 13, color: '#666' }}>派生要素计算公式</span>
            </Divider>
            <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
              {associations
                .filter(a => a.formula)
                .map(a => (
                  <div key={a.elementId} style={{ marginBottom: 8 }}>
                    <Space>
                      <Tag color="green">{a.elementCode}</Tag>
                      <span>{a.elementName}</span>
                      <span>=</span>
                      <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                        {a.formula}
                      </code>
                    </Space>
                  </div>
                ))}
            </div>
          </>
        )}
      </Drawer>

      {/* 要素选择器 */}
      <ElementSelector
        visible={elementSelectorVisible}
        onCancel={() => setElementSelectorVisible(false)}
        onSelect={handleElementSelect}
        allowedLibraryIds={allowedLibraryIds}
      />
    </>
  );
};

export default ElementAssociationDrawer;
