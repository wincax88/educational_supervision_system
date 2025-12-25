import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Radio, message, Spin } from 'antd';
import { PhoneOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores';
import styles from './index.module.css';

interface RoleOption {
  key: string;
  name: string;
  description: string;
  phone: string;
  password: string;
}

// 快速登录测试账号
const roles: RoleOption[] = [
  { key: 'admin', name: '系统管理员', description: '系统全局配置、用户管理', phone: '13800000000', password: '000000' },
  { key: 'project_admin', name: '项目管理员', description: '项目配置和管理', phone: '13800000001', password: '000001' },
  { key: 'data_collector', name: '数据采集员', description: '数据填报和采集', phone: '13800000002', password: '000002' },
  { key: 'project_expert', name: '项目评估专家', description: '数据审核和评估', phone: '13800000003', password: '000003' },
  { key: 'decision_maker', name: '报告决策者', description: '查看评估报告和决策', phone: '13800000004', password: '000004' },
];

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedRole, setSelectedRole] = useState<string>('');

  // 使用 Zustand auth store
  const { login, isAuthenticated, isLoading, error, clearError, user } = useAuthStore();

  const getDefaultRouteByRole = (role?: string) => {
    if (role === 'admin' || role === 'project_admin') return '/home';
    if (role === 'data_collector') return '/collector';
    if (role === 'project_expert') return '/expert';
    if (role === 'decision_maker') return '/reports';
    return '/home';
  };

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRouteByRole(user?.role), { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  // 显示错误信息
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role.key);
    form.setFieldsValue({
      phone: role.phone,
      password: role.password,
    });
  };

  const handleLogin = async (values: { phone: string; password: string }) => {
    const success = await login(values);
    if (success) {
      message.success('登录成功');
      // 按当前角色跳转到默认入口
      navigate(getDefaultRouteByRole(useAuthStore.getState().user?.role), { replace: true });
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginHeader}>
        <div className={styles.loginLogo}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#1890ff">
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
          </svg>
        </div>
        <h1 className={styles.loginTitle}>沈阳市教育督导系统</h1>
        <p className={styles.loginSubtitle}>Educational Supervision System</p>
      </div>

      <div className={styles.loginContent}>
        <Spin spinning={isLoading} tip="登录中...">
          <div className={styles.loginFormCard}>
            <h2 className={styles.formTitle}>用户登录</h2>
            <p className={styles.formDesc}>请输入手机号和密码登录系统</p>

            <Form
              form={form}
              onFinish={handleLogin}
              layout="vertical"
            >
              <Form.Item
                label="手机号"
                name="phone"
                rules={[
                  { required: true, message: '请输入手机号' },
                  { pattern: /^1\d{10}$/, message: '请输入正确的手机号' }
                ]}
              >
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="请输入手机号"
                  size="large"
                  disabled={isLoading}
                  maxLength={11}
                />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入密码"
                  size="large"
                  disabled={isLoading}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                  登录
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Spin>

        <div className={styles.quickLoginCard}>
          <h2 className={styles.formTitle}>快速登录</h2>
          <p className={styles.formDesc}>点击测试账号直接填充登录信息</p>

          <Radio.Group
            value={selectedRole}
            onChange={e => {
              const role = roles.find(r => r.key === e.target.value);
              if (role) handleRoleSelect(role);
            }}
            className={styles.roleList}
            disabled={isLoading}
          >
            {roles.map(role => (
              <div
                key={role.key}
                className={`${styles.roleItem} ${selectedRole === role.key ? styles.roleItemSelected : ''}`}
                onClick={() => !isLoading && handleRoleSelect(role)}
              >
                <Radio value={role.key}>
                  <div className={styles.roleInfo}>
                    <span className={styles.roleName}>{role.name}</span>
                    <span className={styles.roleDesc}>{role.description}</span>
                  </div>
                </Radio>
                <div className={styles.roleCredentials}>
                  <span className={styles.credentialTag}>{role.phone}</span>
                </div>
              </div>
            ))}
          </Radio.Group>

          <p className={styles.passwordTip}>
            默认密码为手机号后6位
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
