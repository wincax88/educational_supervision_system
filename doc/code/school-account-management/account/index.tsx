import React, { useState, useEffect } from "react";
import { Button, Table, Space, message, Popconfirm } from "antd";
import { QueryFilter, ProFormText } from "@ant-design/pro-components";
import type { ColumnsType } from "antd/es/table";
import AddAccountModal from "./add-account";
import EditAccountModal from "./edit-account";
import BatchImportAccountModal from "./batch-import-account";
import { schoolReporterApi, GetSchoolReporterListParams, AccountData } from "@/service/com/schoolReporter";
import styles from "./index.module.less";

const AccountManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<AccountData[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [batchImportModalVisible, setBatchImportModalVisible] = useState(false);
  const [editingReporterPhone, setEditingReporterPhone] = useState<string>("");
  // const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useState<GetSchoolReporterListParams>({});
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [currentRecord, setCurrentRecord] = useState<AccountData | null>(null);

  useEffect(() => {
    loadData(searchParams);
  }, [pageNum, pageSize]);

  const loadData = async (params?: GetSchoolReporterListParams) => {
    setLoading(true);
    try {
      const requestParams = {
        ...params,
        pageNum: pageNum,
        pageSize: pageSize,
      };
      const response = await schoolReporterApi.getSchoolReporterList(requestParams);
      setDataSource(response.data?.rows || []);
      setTotal(response.data?.total || 0);
    } catch (error) {
      console.error('加载学校报告人数据失败:', error);
      message.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    console.log("搜索条件:", values);
    setPageNum(1);
    setSearchParams(values);
    loadData(values);
  };

  const handleReset = () => {
    setPageNum(1);
    setSearchParams({});
    loadData({});
  };

  const handleAddAccount = () => {
    setAddModalVisible(true);
  };

  const handleBatchImport = () => {
    setBatchImportModalVisible(true);
  };

  const handleExport = async () => {
    try {
      const response = await schoolReporterApi.exportSchoolReporter(searchParams);
      // 处理导出文件下载
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `用户数据_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (error) {
      console.error('导出失败:', error);
      message.error("导出失败");
    }
  };

  const handleEdit = async (record: AccountData) => {
    try {
      setEditingReporterPhone(record.reporterPhone);
      setCurrentRecord(record);
      setEditModalVisible(true);
    } catch (error) {
      console.error('打开编辑对话框失败:', error);
      message.error("打开编辑对话框失败");
    }
  };

  const handleDelete = async (record: AccountData) => {
    try {
      const response = await schoolReporterApi.deleteSchoolReporter(record.id);
      if (response.code === 200) {
        message.success("删除成功");
        // 更新本地数据
        loadData(searchParams);
      } else {
        message.error(response.data?.msg || "删除失败");
      }
    } catch (error) {
      console.error('删除学校报告人失败:', error);
      message.error("删除失败");
    }
  };

  const handleAddAccountSubmit = async (values: any) => {
    try {
      // 这里需要根据实际业务逻辑调用相应的API
      // 可能需要调用 updateSchoolReporterByPhone 或创建新的API
      console.log("添加账号:", values);
      setAddModalVisible(false);
      loadData(searchParams);
    } catch (error) {
      console.error('添加账号失败:', error);
      message.error("添加账号失败");
    }
  };

  const handleEditAccountSubmit = async (values: any) => {
    try {
      console.log("编辑账号:", values);
      message.success("编辑账号成功");
      setEditModalVisible(false);
      setEditingReporterPhone("");
      loadData(searchParams);
    } catch (error) {
      console.error('编辑账号失败:', error);
      message.error("编辑账号失败");
    }
  };

  const handleBatchImportSuccess = async (result: any) => {
    try {
      console.log("批量导入结果:", result);
      message.success(
        `批量导入完成！成功: ${result.successCount}，失败: ${result.failureCount}`
      );
      setBatchImportModalVisible(false);
      loadData(searchParams);
    } catch (error) {
      console.error('批量导入处理失败:', error);
      message.error("批量导入处理失败");
    }
  };

  const columns: ColumnsType<AccountData> = [
    {
      title: "姓名",
      dataIndex: "reporterName",
      key: "reporterName",
      width: 120,
    },
    {
      title: "手机号",
      dataIndex: "reporterPhone",
      key: "reporterPhone",
      width: 150,
    },
    {
      title: "负责的单位/学校",
      dataIndex: "schoolNm",
      key: "schoolNm",
      width: 300,
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, record: AccountData) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleEdit(record)}
            className={styles.editButton}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个账号吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              className={styles.deleteButton}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 行选择配置（如果需要批量操作可以启用）
  // const rowSelection = {
  //   selectedRowKeys,
  //   onChange: (newSelectedRowKeys: React.Key[]) => {
  //     setSelectedRowKeys(newSelectedRowKeys);
  //   },
  // };

  return (
    <div className={styles.accountManagement}>
      {/* 搜索筛选区域 */}
      <div className={styles.searchCard}>
        <QueryFilter
          collapsed={false}
          labelWidth="auto"
          className={styles.searchForm}
          onReset={handleReset}
          onFinish={handleSearch}
        >
          <ProFormText
            width="md"
            name="schoolNm"
            label="单位名称"
            placeholder="请输入单位名称"
          />
          <ProFormText
            width="md"
            name="reporterName"
            label="姓名"
            placeholder="请输入姓名"
          />
          <ProFormText
            width="md"
            name="reporterPhone"
            label="手机号"
            placeholder="请输入手机号"
          />
        </QueryFilter>
      </div>

      {/* 操作按钮区域 */}
      <div className={styles.actionCard}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              type="primary"
              onClick={handleAddAccount}
              className={styles.addButton}
            >
              添加账号
            </Button>
            <Button
              type="primary"
              onClick={handleBatchImport}
              className={styles.batchImportButton}
            >
              批量添加账号
            </Button>
          </Space>
          <div className={styles.rightActions}>
            <Button
              onClick={handleExport}
              className={styles.exportButton}
            >
              导出
            </Button>
          </div>
        </Space>
      </div>

      {/* 数据表格 */}
      <div className={styles.tableCard}>
        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{
            total: total,
            pageSize: pageSize,
            current: pageNum,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条数据`,
            onChange: (page, pageSize) => {
              setPageNum(page);
              setPageSize(pageSize || 10);
            },
          }}
          className={styles.dataTable}
        />
      </div>

      {/* 添加账号对话框 */}
      {addModalVisible && <AddAccountModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSubmit={handleAddAccountSubmit}
      />}

      {/* 编辑账号对话框 */}
      {editModalVisible && <EditAccountModal
        visible={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingReporterPhone("");
        }}
        onSubmit={handleEditAccountSubmit}
        reporterPhone={editingReporterPhone}
        editable={currentRecord?.editable || false}
      />}

      {/* 批量导入对话框 */}
      {batchImportModalVisible && <BatchImportAccountModal
        visible={batchImportModalVisible}
        onCancel={() => {
          setBatchImportModalVisible(false)
          loadData(searchParams)
        }}
        onSuccess={handleBatchImportSuccess}
      />}
    </div>
  );
};

export default AccountManagement;
