import React, { useState, useEffect } from "react";
import { Button, Table, Space, message, Popconfirm, Tag } from "antd";
import {
  QueryFilter,
  ProFormText,
  ProFormSelect,
} from "@ant-design/pro-components";
import type { ColumnsType } from "antd/es/table";
import AddSchoolModal from "./add-school";
import { schoolApi, GetAllSchoolParams, GetSchoolListParams, SchoolData } from "@/service/com/schools";
import styles from "./index.module.less";
import { downBlobFile } from "@/util/download";

const SchoolManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<SchoolData[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchParams, setSearchParams] = useState<GetSchoolListParams>({});
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadData(searchParams);
  }, [ pageNum, pageSize ]);

  const loadData = async (params?: GetSchoolListParams) => {
    setLoading(true);
    try {
      const requestParams = {
        ...params,
        pageNum: pageNum,
        pageSize: pageSize,
      };
      const response: any = await schoolApi.getSchoolList(requestParams);
      // 将API返回的数据转换为组件需要的格式
      setTotal(response.data?.total || 0);
      setDataSource(response.data?.rows || []);
    } catch (error) {
      console.error('加载学校数据失败:', error);
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

  const handleAddSchool = () => {
    setAddModalVisible(true);
  };

  const handleAddSchoolSubmit = async (selectedSchools: string[]) => {
    try {
      if (selectedSchools.length === 0) {
        message.warning("请至少选择一个学校");
        return;
      }

      console.log("选中的学校:", selectedSchools);
      
      // 这里可以根据业务需求调用相应的API
      // 例如：批量添加学校到某个组织或进行其他操作
      // await schoolApi.batchAddSchool({ schools: selectedSchoolData });
      setAddModalVisible(false);
      
      // 刷新数据列表
      loadData(searchParams);
    } catch (error) {
      console.error('添加学校失败:', error);
      message.error("添加学校失败");
    }
  };

  const handleExport = async () => {
    try {
      const response: any = await schoolApi.exportSchoolList(searchParams);
      downBlobFile(response, `学校列表.xlsx`);
    } catch (error) {
      console.error('导出学校列表失败:', error);
      message.error("导出失败");
    }
  };

  const handleStatusChange = async (
    record: SchoolData,
    newStatus: number
  ) => {
    try {
     const response = await schoolApi.updateSchoolStatus( record.id, newStatus);
      if (response.code === 200) {
        message.success(newStatus === 0 ? "启用成功" : "停用成功");
        // 更新本地数据
        loadData(searchParams);
      } else {
        message.error(response.data?.msg || "更新状态失败");
      }
      } catch (error) {
      console.error('更新学校状态失败:', error);
    }
  };

  const handleDelete = async (record: SchoolData) => {
    try {
      const response = await schoolApi.deleteSchool(record.id);
      if (response.code === 200) {
        message.success("删除成功");
        // 更新本地数据
        loadData(searchParams);
      } else {
        message.error(response.data?.msg || "删除失败");
      }
    } catch (error) {
      console.error('删除学校失败:', error);
    }
  };
//   {
//     "id": 1983086979263803400,
//     "districtAreaCode": "220302",
//     "districtAreaName": "铁西区",
//     "schoolNo": "21010634100301",
//     "schoolName": "沈阳市奉天高级中学",
//     "operatorName": null,
//     "createTime": "2025-10-28 16:22:34",
//     "enabledStatus": 0,
//     "parentSchoolCode": "210106341003",
//     "parentSchoolNm": "沈阳市奉天高级中学",
//     "schoolType": "分校"
// }
  const columns: ColumnsType<SchoolData> = [
    {
      title: "学校类型",
      dataIndex: "schoolType",
      key: "schoolType",
      width: 100,
      render: (val: string) => {
        // 学校类型：规划校，分校，校址 规划校 -> 学校
        return <div>{val === "规划校" ? "学校" : val}</div>
      }
    },
    {
      title: "学校名称",
      dataIndex: "schoolName",
      key: "schoolName",
      width: 200,
    },
    {
      title: "学校编码",
      dataIndex: "schoolNo",
      key: "schoolNo",
      width: 150,
      render: (text: string, record: SchoolData) => (
        <span className={record.schoolType === "校址" ? styles.campusCode : ""}>
          {text}
        </span>
      ),
    },
    {
      title: "上级学校名称",
      dataIndex: "parentSchoolNm",
      key: "parentSchoolNm",
      width: 200,
    },
    {
      title: "上级学校编码",
      dataIndex: "parentSchoolCode",
      key: "parentSchoolCode",
      width: 150,
    },
    {
      title: "状态",
      dataIndex: "enabledStatus",
      key: "enabledStatus",
      width: 100,
      render: (status: number) => (
        // 启用状态（0：启用，1：禁用）
        <Tag color={status === 0 ? "green" : "red"}>
          {status === 0 ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "操作时间",
      dataIndex: "createTime",
      key: "createTime",
      width: 150,
    },
    {
      title: "操作人",
      dataIndex: "operatorName",
      key: "operatorName",
      width: 100,
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, record: SchoolData) => (
        <Space size="small">
          {record.enabledStatus === 0 ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleStatusChange(record, 1)}
            >
              停用
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => handleStatusChange(record, 0)}
            >
              启用
            </Button>
          )}
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.schoolManagement}>
      {/* 搜索筛选区域 */}
      <div className={styles.searchCard}>
        <QueryFilter
          collapsed={false}
          labelWidth="auto"
          className={styles.searchForm}
          defaultColsNumber={4}
          onReset={handleReset}
          onFinish={handleSearch}
        >
          <ProFormText
            width="md"
            name="schoolNm"
            label="学校名称"
            placeholder="请输入学校名称"
          />
          <ProFormSelect
            width="md"
            name="schoolType"
            label="学校类型"
            placeholder="请选择"
            options={[
              { label: "学校", value: "规划校" },
              { label: "分校", value: "分校" },
              { label: "校址", value: "校址" },
            ]}
          />
          <ProFormSelect
            width="md"
            name="enabledStatus"
            label="状态"
            placeholder="请选择"
            options={[
              { label: "启用", value: 0 },
              { label: "停用", value: 1 },
            ]}
          />
          <ProFormText
            width="md"
            name="parentSchoolNm"
            label="上级学校名称"
            placeholder="请输入上级学校名称"
          />
        </QueryFilter>
      </div>

      {/* 操作按钮区域 */}
      <div className={styles.actionCard}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button
            type="primary"
            onClick={handleAddSchool}
            className={styles.addButton}
          >
            添加单位
          </Button>
          <Button onClick={handleExport} className={styles.exportButton}>
            导出
          </Button>
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
            onChange: (page, pageSize) => {
              setPageNum(page);
              setPageSize(pageSize);
            },
          }}
        />
      </div>

      {/* 添加学校模态框 */}
      {addModalVisible && <AddSchoolModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSubmit={handleAddSchoolSubmit}
      />}
    </div>
  );
};

export default SchoolManagement;
