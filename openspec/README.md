# OpenSpec - Educational Supervision System

本项目使用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 进行规范驱动开发。

## 目录结构

```
openspec/
├── specs/                    # 规范源文件（当前状态）
│   ├── system-overview.md    # 系统概述
│   ├── element-library.md    # 要素库规范
│   ├── tool-library.md       # 采集工具库规范
│   ├── indicator-library.md  # 指标体系库规范
│   └── project-management.md # 评估项目管理规范
├── changes/                  # 变更记录（按功能组织）
│   └── 2024-12-element-association/  # 数据指标-要素关联
├── AGENTS.md                 # AI 助手指南
└── README.md                 # 本文件
```

## 规范文件说明

| 文件 | 模块 | 描述 |
|------|------|------|
| system-overview.md | 系统概述 | 核心架构、用户角色、技术栈 |
| element-library.md | 要素库 | 基础要素和派生要素管理 |
| tool-library.md | 采集工具库 | 表格、问卷、访谈等工具管理 |
| indicator-library.md | 指标体系库 | 达标类和评分类指标体系 |
| project-management.md | 项目管理 | 评估项目生命周期管理 |

## 使用方式

### 查看规范

在开发新功能前，请先阅读 `specs/` 目录下的相关规范文件。

### 提出变更

1. 在 `changes/` 目录下创建功能文件夹
2. 添加 `proposal.md` 说明变更理由
3. 添加 `tasks.md` 列出实现步骤
4. 在 `specs/` 子目录添加增量规范文件

### 规范格式

每个规范文件包含：

- **Overview**: 模块概述
- **Requirements**: 使用 SHALL/MUST 的正式需求
- **Scenarios**: Given/When/Then 格式的行为描述

## 快速开始

```bash
# 查看所有规范
ls openspec/specs/

# 查看特定模块规范
cat openspec/specs/element-library.md
```
