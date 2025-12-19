import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, Select, Tag, Space, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import * as toolService from '../../services/toolService';

const { Search } = Input;

interface ElementSelectorProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (element: toolService.ElementWithLibrary) => void;
  selectedId?: string;
  /** 允许选择的要素库ID列表，不传则显示所有要素库 */
  allowedLibraryIds?: string[];
}

const ElementSelector: React.FC<ElementSelectorProps> = ({
  visible,
  onCancel,
  onSelect,
  selectedId,
  allowedLibraryIds,
}) => {
  const [loading, setLoading] = useState(false);
  const [elements, setElements] = useState<toolService.ElementWithLibrary[]>([]);
  const [libraries, setLibraries] = useState<toolService.ElementLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>();
  const [selectedElementType, setSelectedElementType] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 加载要素库列表
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const data = await toolService.getElementLibraries();
        // 如果指定了允许的要素库ID列表，则过滤
        const filteredLibraries = allowedLibraryIds && allowedLibraryIds.length > 0
          ? data.filter(lib => allowedLibraryIds.includes(lib.id))
          : data;
        setLibraries(filteredLibraries);
        // 如果只有一个要素库，自动选中
        if (filteredLibraries.length === 1) {
          setSelectedLibraryId(filteredLibraries[0].id);
        }
      } catch (error) {
        console.error('加载要素库失败:', error);
      }
    };
    if (visible) {
      loadLibraries();
    }
  }, [visible, allowedLibraryIds]);

  // 加载要素列表
  useEffect(() => {
    const loadElements = async () => {
      setLoading(true);
      try {
        const params: { libraryId?: string; elementType?: string; keyword?: string } = {};
        if (selectedLibraryId) params.libraryId = selectedLibraryId;
        if (selectedElementType) params.elementType = selectedElementType;
        if (keyword) params.keyword = keyword;
        const data = await toolService.getElements(params);
        setElements(data);
      } catch (error) {
        console.error('加载要素失败:', error);
        message.error('加载要素失败');
      } finally {
        setLoading(false);
      }
    };
    if (visible) {
      loadElements();
    }
  }, [visible, selectedLibraryId, selectedElementType, keyword]);

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

  const handleLibraryChange = (value: string) => {
    setSelectedLibraryId(value || undefined);
  };

  const handleElementTypeChange = (value: string) => {
    setSelectedElementType(value || undefined);
  };

  const handleRowSelect = (record: toolService.ElementWithLibrary) => {
    onSelect(record);
  };

  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '类型',
      dataIndex: 'elementType',
      key: 'elementType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === '基础要素' ? 'blue' : 'green'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 80,
    },
    {
      title: '计算公式',
      dataIndex: 'formula',
      key: 'formula',
      width: 150,
      render: (formula: string) => (
        formula ? <code style={{ fontSize: 12 }}>{formula}</code> : '-'
      ),
    },
    {
      title: '所属要素库',
      dataIndex: 'libraryName',
      key: 'libraryName',
      width: 180,
      ellipsis: true,
    },
  ];

  return (
    <Modal
      title="选择要素"
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        <Select
          placeholder="选择要素库"
          allowClear
          style={{ width: 220 }}
          onChange={handleLibraryChange}
          value={selectedLibraryId}
        >
          {libraries.map(lib => (
            <Select.Option key={lib.id} value={lib.id}>
              {lib.name}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="要素类型"
          allowClear
          style={{ width: 120 }}
          onChange={handleElementTypeChange}
          value={selectedElementType}
        >
          <Select.Option value="基础要素">基础要素</Select.Option>
          <Select.Option value="派生要素">派生要素</Select.Option>
        </Select>
        <Search
          placeholder="搜索要素编码或名称"
          allowClear
          onSearch={handleSearch}
          style={{ width: 220 }}
          prefix={<SearchOutlined />}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={elements}
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

export default ElementSelector;
