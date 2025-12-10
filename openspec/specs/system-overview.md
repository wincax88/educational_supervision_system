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
- **State Management**: React hooks
- **Routing**: React Router DOM 7
