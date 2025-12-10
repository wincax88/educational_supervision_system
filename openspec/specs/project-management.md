# Assessment Project Management Specification

## Overview

The Assessment Project Management module (评估项目) manages supervision and assessment projects throughout their lifecycle.

## Project Status Workflow

```
Configuring → Filling → Reviewing → Completed
                ↓
             Stopped
```

| Status | Code | Description |
|--------|------|-------------|
| Configuring (配置中) | configuring | Initial project setup phase |
| Filling (填报中) | filling | Data collection in progress |
| Reviewing (审核中) | reviewing | Data review and validation |
| Stopped (已终止) | stopped | Project terminated |
| Completed (已完成) | completed | Project finished |

## Requirements

### Requirement: Project Creation

The system SHALL support creating assessment projects.

#### Scenario: Create New Project

**Given** a user with project management permissions
**When** creating a new project with:
- Project name
- Assessment year
- Linked indicator system
- Start date
- End date
- Description (optional)
**Then** the system SHALL create a project in Configuring status

#### Scenario: Link Indicator System

**Given** a new project being created
**When** selecting an indicator system
**Then** the system SHALL only show Published indicator systems
**And** SHALL link the selected system to the project

### Requirement: Project Listing

The system SHALL provide project listing with filtering.

#### Scenario: List Projects

**Given** an authenticated user
**When** accessing the project management page
**Then** the system SHALL display:
- Project name
- Assessment year
- Linked indicator system
- Status
- Date range
- Action buttons

#### Scenario: Filter by Year

**Given** a user on the project management page
**When** selecting an assessment year
**Then** the system SHALL display only projects for that year

#### Scenario: Filter by Status

**Given** a user on the project management page
**When** selecting a status filter
**Then** the system SHALL display only projects with matching status

#### Scenario: Search Projects

**Given** a user on the project management page
**When** entering search keywords
**Then** the system SHALL filter projects by name

### Requirement: Project Status Management

The system SHALL manage project status transitions.

#### Scenario: Start Data Collection

**Given** a project in Configuring status
**When** the project configuration is complete
**Then** the user SHALL be able to transition to Filling status

#### Scenario: Submit for Review

**Given** a project in Filling status
**When** data collection is complete
**Then** the user SHALL be able to transition to Reviewing status

#### Scenario: Complete Project

**Given** a project in Reviewing status
**When** review is approved
**Then** the user SHALL be able to transition to Completed status

#### Scenario: Stop Project

**Given** a project not in Completed status
**When** the user decides to terminate
**Then** the user SHALL be able to transition to Stopped status

### Requirement: Project Configuration

The system SHALL support configuring project parameters.

#### Scenario: Configure Assessment Scope

**Given** a project in Configuring status
**When** configuring the project
**Then** the system SHALL allow specifying:
- Target institutions
- Assessment criteria
- Data collection tools
- Timeline and deadlines

## Statistics Dashboard

The project management page SHALL display:
- Total project count (项目总数)
- By status breakdown
- By year breakdown
