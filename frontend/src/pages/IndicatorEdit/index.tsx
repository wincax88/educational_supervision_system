import React, { useState, useEffect } from 'react';
import { Button, Tag, Modal, Form, Input, Select, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './index.module.css';

// 要素类型
type ElementType = '基础要素' | '派生要素';

// 数据类型
type DataType = '文本' | '数字' | '日期' | '时间' | '逻辑' | '数组' | '文件';

// 要素接口
interface Element {
  id: string;
  code: string;
  name: string;
  elementType: ElementType;
  dataType: DataType;
  formula?: string; // 派生要素的计算公式
}

// 要素库接口
interface ElementLibrary {
  id: string;
  name: string;
  description: string;
  status: '未发布' | '已发布';
  elementCount: number;
  elements: Element[];
}

// 模拟数据
const mockElementLibrary: ElementLibrary = {
  id: '1',
  name: '教育经费统计要素库',
  description: '用于教育经费投入与使用情况统计分析的数据要素，包含预算、支出、专项经费等财务数据。',
  status: '未发布',
  elementCount: 8,
  elements: [
    { id: '1', code: 'F001', name: '年度教育经费预算', elementType: '基础要素', dataType: '数字' },
    { id: '2', code: 'F002', name: '实际支出总额', elementType: '基础要素', dataType: '数字' },
    { id: '3', code: 'F003', name: '预算执行率', elementType: '派生要素', dataType: '数字', formula: '(F002 / F001) * 100' },
    { id: '4', code: 'F004', name: '人员经费支出', elementType: '基础要素', dataType: '数字' },
    { id: '5', code: 'F005', name: '公用经费支出', elementType: '基础要素', dataType: '数字' },
    { id: '6', code: 'F006', name: '项目经费支出', elementType: '基础要素', dataType: '数字' },
    { id: '7', code: 'F007', name: '人员经费占比', elementType: '派生要素', dataType: '数字', formula: '(F004 / F002) * 100' },
    { id: '8', code: 'F008', name: '生均公用经费', elementType: '派生要素', dataType: '数字', formula: 'F005 / E003' },
  ],
};

const IndicatorEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [library, setLibrary] = useState<ElementLibrary | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 监听要素类型变化
  const [addFormElementType, setAddFormElementType] = useState<ElementType>('基础要素');
  const [editFormElementType, setEditFormElementType] = useState<ElementType>('基础要素');

  useEffect(() => {
    // 加载要素库数据
    if (id) {
      setLibrary(mockElementLibrary);
    }
  }, [id]);

  const handleSelectElement = (element: Element) => {
    setSelectedElement(element);
  };

  const handleAddElement = () => {
    addForm.resetFields();
    setAddFormElementType('基础要素');
    setAddModalVisible(true);
  };

  const handleSaveAdd = (values: any) => {
    if (!library) return;

    const newElement: Element = {
      id: `${Date.now()}`,
      code: values.code,
      name: values.name,
      elementType: values.elementType,
      dataType: values.dataType,
      formula: values.elementType === '派生要素' ? values.formula : undefined,
    };

    const updatedLibrary = {
      ...library,
      elements: [...library.elements, newElement],
      elementCount: library.elementCount + 1,
    };

    setLibrary(updatedLibrary);
    setAddModalVisible(false);
    message.success('添加成功');
  };

  const handleEditElement = (element: Element) => {
    setSelectedElement(element);
    setEditFormElementType(element.elementType);
    editForm.setFieldsValue({
      code: element.code,
      name: element.name,
      elementType: element.elementType,
      dataType: element.dataType,
      formula: element.formula,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = (values: any) => {
    if (!library || !selectedElement) return;

    const updatedElements = library.elements.map(el => {
      if (el.id === selectedElement.id) {
        return {
          ...el,
          code: values.code,
          name: values.name,
          elementType: values.elementType,
          dataType: values.dataType,
          formula: values.elementType === '派生要素' ? values.formula : undefined,
        };
      }
      return el;
    });

    const updatedElement = updatedElements.find(el => el.id === selectedElement.id);
    setLibrary({ ...library, elements: updatedElements });
    setSelectedElement(updatedElement || null);
    setEditModalVisible(false);
    message.success('保存成功');
  };

  const handleDeleteElement = (elementId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该要素吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        if (!library) return;

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
      },
    });
  };

  const handleSaveLibrary = () => {
    message.success('要素库保存成功');
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
            <h3>要素列表</h3>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddElement}>
              添加要素
            </Button>
          </div>

          <div className={styles.elementList}>
            {library.elements.map(element => (
              <div
                key={element.id}
                className={`${styles.elementItem} ${selectedElement?.id === element.id ? styles.selected : ''}`}
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
                </div>
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
            ))}

            {library.elements.length === 0 && (
              <div className={styles.emptyState}>
                暂无要素，请点击"添加要素"开始创建
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
    </div>
  );
};

export default IndicatorEdit;
