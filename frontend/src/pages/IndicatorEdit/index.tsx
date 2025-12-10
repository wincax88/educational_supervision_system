import React, { useState, useEffect } from 'react';
import { Button, Tag, Modal, Form, Input, Switch, Checkbox, message } from 'antd';
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
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  indicatorSystems,
  indicatorTrees,
  Indicator,
  IndicatorSystem,
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
            <UpOutlined className="action-icon" title="上移" />
            <DownOutlined className="action-icon" title="下移" />
            <LeftOutlined className="action-icon" title="上一个" />
            <RightOutlined className="action-icon" title="下一个" />
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
              <span onClick={expandAll}>全部收缩</span>
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
        width={600}
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
                  <Form.Item label="评价依据" name="evaluationBasis">
                    <Checkbox.Group>
                      <Checkbox value="dataIndicator">数据指标</Checkbox>
                      <Checkbox value="supportingMaterial">佐证资料</Checkbox>
                    </Checkbox.Group>
                  </Form.Item>
                  <div className="evaluation-section">
                    <div className="section-header">
                      <span className="section-title" style={{ color: '#fa8c16' }}>数据指标</span>
                      <Button type="link" icon={<PlusOutlined />}>添加</Button>
                    </div>
                    {currentIndicator?.dataIndicators?.map(d => (
                      <div key={d.id} className="evaluation-item">
                        <Tag color="orange">{d.code}</Tag>
                        <span className="item-name">{d.name} <Tag>{d.threshold}</Tag></span>
                        <div className="item-actions">
                          <EditOutlined />
                          <DeleteOutlined />
                        </div>
                        <div className="item-desc">{d.description}</div>
                      </div>
                    ))}
                  </div>
                  <div className="evaluation-section">
                    <div className="section-header">
                      <span className="section-title" style={{ color: '#13c2c2' }}>佐证资料</span>
                      <Button type="link" icon={<PlusOutlined />}>添加</Button>
                    </div>
                    {currentIndicator?.supportingMaterials?.map(m => (
                      <div key={m.id} className="evaluation-item">
                        <Tag color="cyan">{m.code}</Tag>
                        <span className="item-name">{m.name} ({m.fileTypes}) <Tag>{m.maxSize}</Tag></span>
                        <div className="item-actions">
                          <EditOutlined />
                          <DeleteOutlined />
                        </div>
                        <div className="item-desc">{m.description}</div>
                      </div>
                    ))}
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
