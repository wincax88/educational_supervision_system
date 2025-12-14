# Educational Supervision System Specification

## Overview

The Educational Supervision System (沈阳市教育督导系统) is a comprehensive management platform for educational supervision and assessment. It enables supervision institutions to manage assessment projects, collect data, and evaluate educational institutions.

## System Architecture

### Requirement: Multi-Role Authentication

The system SHALL support multiple user roles with distinct permissions.

#### Scenario: User Login

**Given** a user with valid credentials
**When** the user submits login credentials
**Then** the system SHALL authenticate the user and redirect to the home dashboard

#### Scenario: Role-Based Access

**Given** an authenticated user
**When** accessing system features
**Then** the system SHALL display features based on the user's role permissions

### Requirement: Modular Supervision Framework

The system SHALL provide modular supervision capabilities for different education types.

#### Scenario: Supervision Module Selection

**Given** an authenticated user on the home page
**When** viewing supervision modules
**Then** the system SHALL display available supervision modules:
- Balanced Education Development Supervision (义务教育优质均衡发展督导)
- Kindergarten Inclusive Supervision (学前教育普及普惠督导)
- Special Education Supervision (特殊教育督导) [Under Development]
- Registered Supervision (责任督学挂牌督导) [Under Development]

## User Roles

| Role | Code | Description |
|------|------|-------------|
| System Administrator | admin | Full system configuration and user management |
| Project Manager | project_manager | Create and manage assessment projects |
| Data Collector | data_collector | Collect assessment data from institutions |
| Evaluation Expert | expert | Review and evaluate collected data |
| Report Decision Maker | decision_maker | Generate reports and make decisions |

## Technology Stack

- **Frontend**: React 19, TypeScript, Ant Design 6
- **Backend**: Node.js, Express 5
- **Database**: SQLite (better-sqlite3)
- **State Management**: Zustand + React hooks
- **Routing**: React Router DOM 7
- **Build Tools**: Vite, ESLint, Prettier

## Core Data Model

The system uses a hierarchical data model:

```
Element Library (要素库)
  └── Elements (要素)
        ├── Basic Elements (基础要素) - direct data collection
        └── Derived Elements (派生要素) - calculated from basic elements

Tool Library (采集工具库)
  └── Tools (采集工具)
        └── Fields (字段) - linked to elements

Indicator Library (指标体系库)
  └── Indicator Systems (指标体系)
        └── Indicators (指标) - hierarchical structure
              ├── Data Indicators (数据指标) - linked to elements
              └── Supporting Materials (佐证资料)

Project (评估项目)
  ├── Linked Indicator System
  ├── Configured Tools
  └── Assigned Institutions
```
