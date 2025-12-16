import React, { useState, useEffect, useRef } from "react";
import { Modal, Form, Input, Button, message, Select, AutoComplete } from "antd";
import styles from "./index.module.less";
import { schoolReporterApi, SchoolReporterSchoolOptions } from "@/service/com/schoolReporter";
import { schoolApi } from "@/service/com/schools";

interface AddAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: AccountFormData) => void;
}

interface AccountFormData {
  reporterName: string;
  reporterPhone: string;
  schoolCode: string;
}

interface OrgUser {
  userName?: string;
  phoneNumber?: string;
  [key: string]: any;
}

const AddAccountModal: React.FC<AddAccountModalProps> = ({
  visible,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<SchoolReporterSchoolOptions[]>([]);
  const [schoolOptionsLoading, setSchoolOptionsLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<{ label: string; value: string; phone: string }[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // 搜索组织中心用户
  const searchOrgUsers = async (userName: string) => {
    if (!userName || userName.trim().length < 1) {
      setUserOptions([]);
      return;
    }

    try {
      setUserSearchLoading(true);
      const response: any = await schoolReporterApi.getOrgUserList({
        realName: userName.trim(),
      });

      if (response?.code === 200 && response?.data) {
        const users = response.data?.data || response.data || [];
        const options = users.map((user: OrgUser) => ({
          label: `${user.realName || ''}${user.phoneNumber ? ` (${user.phoneNumber})` : ''}`,
          value: user.realName || '',
          phone: user.phoneNumber || '',
        }));
        setUserOptions(options);
      } else {
        setUserOptions([]);
      }
    } catch (error) {
      console.error("搜索用户失败:", error);
      setUserOptions([]);
    } finally {
      setUserSearchLoading(false);
    }
  };

  // 处理姓名输入变化
  const handleNameChange = (value: string) => {
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // 如果输入为空，重置状态
    if (!value || !value.trim()) {
      setUserOptions([]);
      setIsManualInput(false);
      setSelectedUser(null);
      form.setFieldsValue({ reporterPhone: '' });
      return;
    }

    // 检查当前输入是否匹配已选中的用户
    if (selectedUser && selectedUser.userName !== value) {
      // 如果输入的值与已选中的用户不匹配，清空选中状态，允许手动输入
      setIsManualInput(true);
      setSelectedUser(null);
      form.setFieldsValue({ reporterPhone: '' });
    } else if (!selectedUser) {
      // 如果没有选中的用户，检查是否匹配选项
      const matchedOption = userOptions.find(opt => opt.value === value);
      if (!matchedOption) {
        // 如果输入的值不在选项中，标记为手动输入
        setIsManualInput(true);
      }
    }

    // 防抖搜索
    searchTimerRef.current = setTimeout(() => {
      if (value && value.trim().length >= 1) {
        searchOrgUsers(value);
      } else {
        setUserOptions([]);
      }
    }, 300);
  };

  // 处理用户选择
  const handleUserSelect = (value: string) => {
    const selected = userOptions.find(opt => opt.value === value);
    if (selected) {
      setSelectedUser({ userName: selected.value, phoneNumber: selected.phone });
      setIsManualInput(false);
      form.setFieldsValue({ 
        reporterName: selected.value,
        reporterPhone: selected.phone 
      });
    }
  };

  // 当模态框打开时获取学校选项并重置状态
  useEffect(() => {
    if (visible) {
      fetchSchoolOptions();
      setUserOptions([]);
      setSelectedUser(null);
      setIsManualInput(false);
      form.resetFields();
    }
  }, [visible]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 找到选中的学校信息
      const selectedSchool = schoolOptions.find(school => school.value === values.schoolCode);
      if (!selectedSchool) {
        message.error("请选择有效的学校");
        return;
      }

      // 调用API添加学校报告人
      const response: any = await schoolReporterApi.addSchoolReporter({
        reporterName: values.reporterName,
        reporterPhone: values.reporterPhone,
        schoolCode: selectedSchool.value,
        schoolNm: selectedSchool.label,
        schoolType: selectedSchool.schoolType,
        areaCode: selectedSchool.areaCode,
        areaNm: selectedSchool.areaNm,
      });

      if (response.code === 200) {
        message.success("添加账号成功");
        form.resetFields();
        onSubmit(values);
      } else {
        message.error(response.data?.msg || "添加账号失败");
      }
    } catch (error) {
      console.error("添加账号失败:", error);
      message.error("添加账号失败，请重试");
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
      title="添加账号"
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
          name="schoolCode"
          label="单位/学校"
          labelCol={{ style: { width: "130px", flex: "0 0 130px" } }}
          wrapperCol={{ style: { flex: 1 } }}
          rules={[{ required: true, message: "请选择负责的单位/学校" }]}
        >
          <Select
            placeholder="请选择或搜索"
            className={styles.formInput}
            loading={schoolOptionsLoading}
            options={schoolOptions}
            showSearch
            allowClear
            filterOption={(input, option) => {
              const label = option?.label?.toString() || '';
              return label.toLowerCase().includes(input.toLowerCase());
            }}
            optionFilterProp="label"
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
          <AutoComplete
            placeholder="请输入姓名，将自动匹配组织中心用户"
            className={styles.formInput}
            options={userOptions}
            onSearch={handleNameChange}
            onSelect={handleUserSelect}
            allowClear
            filterOption={false}
            notFoundContent={userSearchLoading ? "搜索中..." : userOptions.length === 0 ? "未找到匹配用户，可手动输入" : null}
          />
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
            disabled={!!selectedUser && !isManualInput}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddAccountModal;
