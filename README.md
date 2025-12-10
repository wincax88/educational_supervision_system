# 沈阳市教育督导系统

Educational Supervision System - 教育督导管理平台

## 项目结构

```
├── frontend/          # React 前端项目
│   ├── src/
│   │   ├── pages/     # 页面组件
│   │   ├── layouts/   # 布局组件
│   │   ├── components/# 通用组件
│   │   ├── mock/      # Mock数据
│   │   └── styles/    # 全局样式
│   └── package.json
├── backend/           # Node.js 后端项目
│   ├── index.js       # 服务入口
│   └── package.json
└── figma/            # 设计稿图片
```

## 功能模块

1. **登录页面** - 支持多角色快速登录
   - 系统管理员
   - 项目管理员
   - 数据采集员
   - 项目评估专家
   - 报告决策者

2. **首页** - 督导模块入口
   - 义务教育优质均衡督导
   - 幼儿园普惠督导
   - 教育专项督导（开发中）
   - 挂牌督导（开发中）

3. **评估要素库** - 管理评估数据要素

4. **数据采集工具库** - 管理表单和问卷工具

5. **评估指标体系库** - 管理评估指标体系

6. **评估项目** - 项目创建与管理

## 快速开始

### 启动前端

```bash
cd frontend
npm install
npm start
```

前端将在 http://localhost:3000 启动

### 启动后端（可选）

```bash
cd backend
npm install
npm start
```

后端将在 http://localhost:3001 启动

## 技术栈

- **前端**: React + TypeScript + Ant Design + React Router
- **后端**: Node.js + Express

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | AAA | BBB |
| 项目管理员 | 111 | 222 |
| 数据采集员 | 333 | 444 |
| 项目评估专家 | 555 | 666 |
| 报告决策者 | 777 | 888 |
