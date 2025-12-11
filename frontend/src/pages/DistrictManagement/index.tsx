import React, { useState, useEffect } from 'react';
import { Button, Input, Table, Tag, Modal, Form, Select, message, Space, Statistic, Card, Row, Col } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  BankOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  getDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  getDistrictsSummary,
  District,
  DistrictSummary,
} from '../../services/districtService';
import styles from './index.module.css';

const { Search } = Input;

const DistrictManagement: React.FC = () => {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<District[]>([]);
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentDistrict, setCurrentDistrict] = useState<District | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [districtList, summaryData] = await Promise.all([
        getDistricts({ keyword: searchKeyword }),
        getDistrictsSummary(),
      ]);
      setDistricts(districtList);
      setSummary(summaryData);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    loadData();
  };

  const handleCreate = async (values: { code: string; name: string; type: string }) => {
    try {
      await createDistrict(values);
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error((error as Error).message || '创建失败');
    }
  };

  const handleEdit = (district: District) => {
    setCurrentDistrict(district);
    editForm.setFieldsValue({
      code: district.code,
      name: district.name,
      type: district.type,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values: { code: string; name: string; type: string }) => {
    if (!currentDistrict) return;
    try {
      await updateDistrict(currentDistrict.id, values);
      message.success('保存成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setCurrentDistrict(null);
      loadData();
    } catch (error: unknown) {
      message.error((error as Error).message || '保存失败');
    }
  };

  const handleDelete = (district: District) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除区县"${district.name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteDistrict(district.id);
          message.success('删除成功');
          loadData();
        } catch (error: unknown) {
          message.error((error as Error).message || '删除失败');
        }
      },
    });
  };

  const handleViewSchools = (district: District) => {
    navigate(`/home/system/schools?districtId=${district.id}`);
  };

  const getTypeTag = (type: string) => {
    const colors: Record<string, string> = {
      '市辖区': 'blue',
      '县': 'green',
      '县级市': 'orange',
    };
    return <Tag color={colors[type] || 'default'}>{type}</Tag>;
  };

  const columns: ColumnsType<District> = [
    {
      title: '区县代码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '区县名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '学校数量',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 100,
      render: (count: number) => <span style={{ color: '#1677ff' }}>{count || 0} 所</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: District) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewSchools(record)}>
            查看学校
          </Button>
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

  return (
    <div className={styles.districtPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h2 className={styles.pageTitle}>区县管理</h2>
      </div>

      {/* 统计卡片 */}
      {summary && (
        <Row gutter={16} className={styles.statsRow}>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="区县总数"
                value={summary.cityTotal.districtCount}
                prefix={<EnvironmentOutlined />}
                suffix="个"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="学校总数"
                value={summary.cityTotal.schoolCount}
                prefix={<BankOutlined />}
                suffix="所"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="学生总数"
                value={summary.cityTotal.studentCount}
                prefix={<TeamOutlined />}
                suffix="人"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="教师总数"
                value={summary.cityTotal.teacherCount}
                prefix={<TeamOutlined />}
                suffix="人"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 列表区域 */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h3>区县列表</h3>
          <div className={styles.listActions}>
            <Search
              placeholder="搜索区县名称或代码"
              allowClear
              onSearch={handleSearch}
              style={{ width: 240 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新增区县
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={districts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      {/* 新增区县弹窗 */}
      <Modal
        title="新增区县"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="code"
            label="区县代码"
            rules={[{ required: true, message: '请输入区县代码' }]}
          >
            <Input placeholder="请输入区县代码，如 210102" />
          </Form.Item>
          <Form.Item
            name="name"
            label="区县名称"
            rules={[{ required: true, message: '请输入区县名称' }]}
          >
            <Input placeholder="请输入区县名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="区县类型"
            rules={[{ required: true, message: '请选择区县类型' }]}
          >
            <Select placeholder="请选择区县类型">
              <Select.Option value="市辖区">市辖区</Select.Option>
              <Select.Option value="县">县</Select.Option>
              <Select.Option value="县级市">县级市</Select.Option>
            </Select>
          </Form.Item>
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

      {/* 编辑区县弹窗 */}
      <Modal
        title="编辑区县"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setCurrentDistrict(null);
        }}
        footer={null}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item
            name="code"
            label="区县代码"
            rules={[{ required: true, message: '请输入区县代码' }]}
          >
            <Input placeholder="请输入区县代码" />
          </Form.Item>
          <Form.Item
            name="name"
            label="区县名称"
            rules={[{ required: true, message: '请输入区县名称' }]}
          >
            <Input placeholder="请输入区县名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="区县类型"
            rules={[{ required: true, message: '请选择区县类型' }]}
          >
            <Select placeholder="请选择区县类型">
              <Select.Option value="市辖区">市辖区</Select.Option>
              <Select.Option value="县">县</Select.Option>
              <Select.Option value="县级市">县级市</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
                setCurrentDistrict(null);
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
    </div>
  );
};

export default DistrictManagement;
