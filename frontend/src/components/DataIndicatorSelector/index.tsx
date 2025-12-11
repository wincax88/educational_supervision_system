import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, Select, Tag, Space, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import * as toolService from '../../services/toolService';
import * as indicatorService from '../../services/indicatorService';

const { Search } = Input;

interface DataIndicatorSelectorProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (indicator: toolService.DataIndicator) => void;
  selectedId?: string;
}

const DataIndicatorSelector: React.FC<DataIndicatorSelectorProps> = ({
  visible,
  onCancel,
  onSelect,
  selectedId,
}) => {
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState<toolService.DataIndicator[]>([]);
  const [systems, setSystems] = useState<indicatorService.IndicatorSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 加载指标体系列表
  useEffect(() => {
    const loadSystems = async () => {
      try {
        const data = await indicatorService.getIndicatorSystems();
        setSystems(data);
      } catch (error) {
        console.error('加载指标体系失败:', error);
      }
    };
    if (visible) {
      loadSystems();
    }
  }, [visible]);

  // 加载数据指标列表
  useEffect(() => {
    const loadIndicators = async () => {
      setLoading(true);
      try {
        const params: { systemId?: string; keyword?: string } = {};
        if (selectedSystemId) params.systemId = selectedSystemId;
        if (keyword) params.keyword = keyword;
        const data = await toolService.getDataIndicators(params);
        setIndicators(data);
      } catch (error) {
        console.error('加载数据指标失败:', error);
        message.error('加载数据指标失败');
      } finally {
        setLoading(false);
      }
    };
    if (visible) {
      loadIndicators();
    }
  }, [visible, selectedSystemId, keyword]);

  // 初始化选中状态
  useEffect(() => {
    if (selectedId) {
      setSelectedRowKeys([selectedId]);
    } else {
      setSelectedRowKeys([]);
    }
  }, [selectedId, visible]);

  const handleSearch = (value: string) => {
    setKeyword(value);
  };

  const handleSystemChange = (value: string) => {
    setSelectedSystemId(value || undefined);
  };

  const handleRowSelect = (record: toolService.DataIndicator) => {
    onSelect(record);
  };

  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 120,
      render: (threshold: string) => (
        <Tag color="blue">{threshold || '-'}</Tag>
      ),
    },
    {
      title: '所属指标',
      key: 'indicator',
      width: 200,
      render: (_: unknown, record: toolService.DataIndicator) => (
        <span>
          {record.indicatorCode} {record.indicatorName}
        </span>
      ),
    },
    {
      title: '指标体系',
      dataIndex: 'systemName',
      key: 'systemName',
      width: 200,
      ellipsis: true,
    },
  ];

  return (
    <Modal
      title="选择数据指标"
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        <Select
          placeholder="选择指标体系"
          allowClear
          style={{ width: 280 }}
          onChange={handleSystemChange}
          value={selectedSystemId}
        >
          {systems.map(sys => (
            <Select.Option key={sys.id} value={sys.id}>
              {sys.name}
            </Select.Option>
          ))}
        </Select>
        <Search
          placeholder="搜索指标编码或名称"
          allowClear
          onSearch={handleSearch}
          style={{ width: 250 }}
          prefix={<SearchOutlined />}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={indicators}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ y: 400 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
        rowSelection={{
          type: 'radio',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        onRow={(record) => ({
          onClick: () => handleRowSelect(record),
          style: { cursor: 'pointer' },
        })}
      />
    </Modal>
  );
};

export default DataIndicatorSelector;
