import React, { useState, useEffect } from 'react';
import { Button, Input, Table, Tag, Modal, Form, Select, message, Space, Upload, InputNumber } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  importSchools,
  School,
  SchoolListResponse,
  SCHOOL_TYPES,
  URBAN_RURAL_TYPES,
  SCHOOL_CATEGORIES,
} from '../../services/schoolService';
import { getDistricts, District } from '../../services/districtService';
import styles from './index.module.css';

const { Search } = Input;

const SchoolManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const districtIdFromUrl = searchParams.get('districtId');

  const [schools, setSchools] = useState<School[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [filters, setFilters] = useState({
    districtId: districtIdFromUrl || '',
    schoolType: '',
    urbanRural: '',
    keyword: '',
    page: 1,
    pageSize: 10,
  });
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载区县列表
  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => message.error('加载区县列表失败'));
  }, []);

  // 加载学校列表
  const loadSchools = async () => {
    setLoading(true);
    try {
      const result: SchoolListResponse = await getSchools(filters);
      setSchools(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('加载学校列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, [filters]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters(prev => ({ ...prev, page, pageSize }));
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await createSchool(values as Parameters<typeof createSchool>[0]);
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadSchools();
    } catch (error: unknown) {
      message.error((error as Error).message || '创建失败');
    }
  };

  const handleEdit = (school: School) => {
    setCurrentSchool(school);
    editForm.setFieldsValue({
      code: school.code,
      name: school.name,
      districtId: school.districtId,
      schoolType: school.schoolType,
      schoolCategory: school.schoolCategory,
      urbanRural: school.urbanRural,
      address: school.address,
      principal: school.principal,
      contactPhone: school.contactPhone,
      studentCount: school.studentCount,
      teacherCount: school.teacherCount,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values: Record<string, unknown>) => {
    if (!currentSchool) return;
    try {
      await updateSchool(currentSchool.id, values as Parameters<typeof updateSchool>[1]);
      message.success('保存成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setCurrentSchool(null);
      loadSchools();
    } catch (error: unknown) {
      message.error((error as Error).message || '保存失败');
    }
  };

  const handleDelete = (school: School) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除学校"${school.name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteSchool(school.id);
          message.success('删除成功');
          loadSchools();
        } catch (error: unknown) {
          message.error((error as Error).message || '删除失败');
        }
      },
    });
  };

  const handleImport = async () => {
    // 这里展示一个简单的导入示例
    // 实际项目中可以使用 Excel 解析库处理上传的文件
    message.info('请上传Excel文件进行批量导入');
  };

  const handleDownloadTemplate = () => {
    // 生成下载模板的逻辑
    const template = `学校代码,学校名称,区县ID,学校类型,办学性质,城乡类型,地址,校长,联系电话,学生数,教师数
2101020001,示例小学,d-001,小学,公办,城区,和平区示例路1号,张三,024-12345678,1000,80`;

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '学校导入模板.csv';
    link.click();
  };

  const getSchoolTypeTag = (type: string) => {
    const colors: Record<string, string> = {
      '小学': 'blue',
      '初中': 'green',
      '九年一贯制': 'purple',
      '完全中学': 'orange',
    };
    return <Tag color={colors[type] || 'default'}>{type}</Tag>;
  };

  const getUrbanRuralTag = (type: string) => {
    const colors: Record<string, string> = {
      '城区': 'blue',
      '镇区': 'cyan',
      '乡村': 'green',
    };
    return <Tag color={colors[type] || 'default'}>{type}</Tag>;
  };

  const columns: ColumnsType<School> = [
    {
      title: '学校代码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '学校名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '所属区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 100,
    },
    {
      title: '学校类型',
      dataIndex: 'schoolType',
      key: 'schoolType',
      width: 100,
      render: (type: string) => getSchoolTypeTag(type),
    },
    {
      title: '城乡类型',
      dataIndex: 'urbanRural',
      key: 'urbanRural',
      width: 80,
      render: (type: string) => getUrbanRuralTag(type),
    },
    {
      title: '学生数',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 80,
      render: (count: number) => `${count} 人`,
    },
    {
      title: '教师数',
      dataIndex: 'teacherCount',
      key: 'teacherCount',
      width: 80,
      render: (count: number) => `${count} 人`,
    },
    {
      title: '生师比',
      key: 'ratio',
      width: 80,
      render: (_: unknown, record: School) => {
        if (record.teacherCount === 0) return '-';
        return (record.studentCount / record.teacherCount).toFixed(1) + ':1';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: School) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const formFields = (
    <>
      <Form.Item
        name="code"
        label="学校代码"
        rules={[{ required: true, message: '请输入学校代码' }]}
      >
        <Input placeholder="请输入学校代码" />
      </Form.Item>
      <Form.Item
        name="name"
        label="学校名称"
        rules={[{ required: true, message: '请输入学校名称' }]}
      >
        <Input placeholder="请输入学校名称" />
      </Form.Item>
      <Form.Item
        name="districtId"
        label="所属区县"
        rules={[{ required: true, message: '请选择所属区县' }]}
      >
        <Select placeholder="请选择所属区县">
          {districts.map(d => (
            <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="schoolType"
        label="学校类型"
        rules={[{ required: true, message: '请选择学校类型' }]}
      >
        <Select placeholder="请选择学校类型">
          {SCHOOL_TYPES.map(t => (
            <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="schoolCategory" label="办学性质" initialValue="公办">
        <Select>
          {SCHOOL_CATEGORIES.map(c => (
            <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="urbanRural" label="城乡类型" initialValue="城区">
        <Select>
          {URBAN_RURAL_TYPES.map(t => (
            <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="address" label="学校地址">
        <Input placeholder="请输入学校地址" />
      </Form.Item>
      <Form.Item name="principal" label="校长姓名">
        <Input placeholder="请输入校长姓名" />
      </Form.Item>
      <Form.Item name="contactPhone" label="联系电话">
        <Input placeholder="请输入联系电话" />
      </Form.Item>
      <Form.Item name="studentCount" label="学生数" initialValue={0}>
        <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入学生数" />
      </Form.Item>
      <Form.Item name="teacherCount" label="教师数" initialValue={0}>
        <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入教师数" />
      </Form.Item>
    </>
  );

  return (
    <div className={styles.schoolPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h2 className={styles.pageTitle}>学校管理</h2>
      </div>

      {/* 筛选区域 */}
      <div className={styles.filterSection}>
        <Space wrap>
          <Select
            style={{ width: 150 }}
            placeholder="选择区县"
            allowClear
            value={filters.districtId || undefined}
            onChange={value => handleFilterChange('districtId', value || '')}
          >
            {districts.map(d => (
              <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
            ))}
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="学校类型"
            allowClear
            value={filters.schoolType || undefined}
            onChange={value => handleFilterChange('schoolType', value || '')}
          >
            {SCHOOL_TYPES.map(t => (
              <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
            ))}
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="城乡类型"
            allowClear
            value={filters.urbanRural || undefined}
            onChange={value => handleFilterChange('urbanRural', value || '')}
          >
            {URBAN_RURAL_TYPES.map(t => (
              <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
            ))}
          </Select>
          <Search
            placeholder="搜索学校名称、代码或校长"
            allowClear
            onSearch={handleSearch}
            style={{ width: 280 }}
          />
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            批量导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新增学校
          </Button>
        </Space>
      </div>

      {/* 列表区域 */}
      <div className={styles.listSection}>
        <Table
          columns={columns}
          dataSource={schools}
          rowKey="id"
          loading={loading}
          pagination={{
            current: filters.page,
            pageSize: filters.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 所学校`,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 新增学校弹窗 */}
      <Modal
        title="新增学校"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {formFields}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑学校弹窗 */}
      <Modal
        title="编辑学校"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setCurrentSchool(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          {formFields}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
                setCurrentSchool(null);
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入学校"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <div className={styles.importContent}>
          <p>请按照模板格式准备Excel或CSV文件，然后上传导入。</p>
          <p style={{ color: '#999', fontSize: 12 }}>
            支持格式：.xlsx, .xls, .csv<br/>
            单次最多导入 500 条记录
          </p>
          <Upload.Dragger
            name="file"
            accept=".xlsx,.xls,.csv"
            maxCount={1}
            beforeUpload={(file) => {
              // 这里可以添加文件解析和导入逻辑
              message.info(`准备导入文件：${file.name}`);
              // 实际项目中需要解析文件并调用 importSchools API
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          </Upload.Dragger>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button onClick={() => setImportModalVisible(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SchoolManagement;
