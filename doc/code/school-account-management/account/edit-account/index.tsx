import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, message, Select } from "antd";
import styles from "./index.module.less";
import { schoolReporterApi, SchoolReporterSchoolOptions } from "@/service/com/schoolReporter";
import { schoolApi } from "@/service/com/schools";

interface EditAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: EditAccountFormData) => void;
  reporterPhone: string;
  editable: boolean;
}

interface EditAccountFormData {
  reporterName: string;
  reporterPhone: string;
  schoolCodes: string[];
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  reporterPhone,
  editable,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<SchoolReporterSchoolOptions[]>([]);
  const [schoolOptionsLoading, setSchoolOptionsLoading] = useState(false);

  const getSchoolReporterDetailByPhone = async () => {
    try {
      const response: any = await schoolReporterApi.getSchoolReporterDetailByPhone(reporterPhone);
      if (response?.data) {
        form.setFieldsValue(response.data?.data || {});
        // schoolCodes
        form.setFieldsValue({
          schoolCodes: response.data?.data?.schools?.map((item: any) => item.schoolCode) || []
        });
      }
    } catch (error) {
      console.error("获取学校报告人详情失败:", error);
      message.error("获取用户详情失败");
    }
  };

  useEffect(() => {
    if (reporterPhone) {
      getSchoolReporterDetailByPhone();
    }
  }, [reporterPhone]);

  // 获取学校选项
  const fetchSchoolOptions = async () => {
    try {
      setSchoolOptionsLoading(true);
      const response: any = await schoolApi.getSchoolOptions();
      if (response?.data) {
        setSchoolOptions(response.data?.data?.filter((item: any) => !!item.schoolType) || []);
      }
    } catch (error) {
      console.error("获取学校选项失败:", error);
      message.error("获取学校选项失败");
    } finally {
      setSchoolOptionsLoading(false);
    }
  };

  // 当模态框打开时获取学校选项
  useEffect(() => {
    if (visible) {
      fetchSchoolOptions();
    }
  }, [visible]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 找到选中的学校信息
      const selectedSchools = schoolOptions.filter(school => 
        values.schoolCodes.includes(school.value)
      );
      
      if (selectedSchools.length === 0) {
        message.error("请选择有效的学校");
        return;
      }

      // 调用API更新学校报告人
      const response: any = await schoolReporterApi.updateSchoolReporterByPhone({
        key: reporterPhone,
        reporterName: values.reporterName,
        reporterPhone: values.reporterPhone,
        schools: selectedSchools.map(school => ({
          areaCode: school.areaCode,
          areaNm: school.areaNm,
          schoolCode: school.value,
          schoolNm: school.label,
          schoolType: school.schoolType
        }))
      });

      if (response.code === 200) {
        form.resetFields();
        onSubmit(values);
      } else {
        message.error(response.data?.msg || "更新账号失败");
      }
    } catch (error) {
      console.error("更新账号失败:", error);
      message.error("更新账号失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 手机号验证规则
  const phoneValidator = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error("请输入手机号"));
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return Promise.reject(new Error("请输入正确的手机号格式"));
    }
    return Promise.resolve();
  };

  return (
    <Modal
      title="编辑账号"
      open={visible}
      onCancel={handleCancel}
      width={500}
      maskClosable={false}
      className={styles.addAccountModal}
      footer={[
        <Button
          key="cancel"
          onClick={handleCancel}
          className={styles.cancelButton}
        >
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          className={styles.submitButton}
        >
          提交
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="horizontal"
        className={styles.accountForm}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
      >
        <Form.Item
          name="schoolCodes"
          label="单位/学校"
          labelCol={{ style: { width: "130px", flex: "0 0 130px" } }}
          wrapperCol={{ style: { flex: 1 } }}
          rules={[{ required: true, message: "请选择负责的单位/学校" }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择"
            className={styles.formInput}
            loading={schoolOptionsLoading}
            options={schoolOptions}
            maxTagCount="responsive"
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          name="reporterName"
          label="姓名"
          labelCol={{ style: { width: "130px", flex: "0 0 130px" } }}
          wrapperCol={{ style: { flex: 1 } }}
          rules={[
            { required: true, message: "请输入姓名" },
            { min: 2, max: 20, message: "姓名长度应在2-20个字符之间" },
          ]}
        >
          <Input placeholder="请输入" className={styles.formInput} disabled={!editable} />
        </Form.Item>

        <Form.Item
          name="reporterPhone"
          label="手机号"
          labelCol={{ style: { width: "130px", flex: "0 0 130px" } }}
          wrapperCol={{ style: { flex: 1 } }}
          rules={[
            { required: true, message: "请输入手机号" },
            { validator: phoneValidator },
          ]}
        >
          <Input
            placeholder="请输入"
            className={styles.formInput}
            maxLength={11}
            disabled={!editable}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAccountModal;
