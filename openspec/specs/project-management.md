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

The system SHALL support configuring project parameters through a multi-tab interface.

#### Scenario: Access Project Configuration

**Given** a project in Configuring status
**When** the user clicks "Configure" button
**Then** the system SHALL display the configuration page with tabs:
- Basic Information (基本信息)
- Indicator System (指标体系)
- Data Entry (数据填报)
- Expert Review (专家评审)

### Requirement: Basic Information Tab

The system SHALL display and allow editing project basic information.

#### Scenario: View Basic Information

**Given** a user on the project configuration page
**When** viewing the Basic Information tab
**Then** the system SHALL display:
- Project name
- Assessment year
- Project status
- Linked indicator system name
- Date range (start/end)
- Description

### Requirement: Indicator System Tab

The system SHALL display the linked indicator system with element association capabilities.

#### Scenario: View Indicator Tree

**Given** a project with a linked indicator system
**When** viewing the Indicator System tab
**Then** the system SHALL display:
- Indicator system name
- Hierarchical indicator tree (1-3 levels)
- Data indicators attached to leaf indicators
- Supporting materials attached to indicators
- Mapping statistics card (total/mapped/unmapped)

#### Scenario: View Data Indicator Mapping Status

**Given** an indicator tree is displayed
**When** viewing a data indicator node
**Then** the system SHALL display:
- Data indicator code and name
- Threshold value (if defined)
- Mapping status tag (已映射/未映射)
- Element association count
- Edit button for element association

#### Scenario: Edit Element Association

**Given** a data indicator in the tree
**When** the user clicks the element association edit button
**Then** the system SHALL open a drawer with:
- Data indicator information (code, name, threshold)
- Associated elements table
- Add element button
- Delete element button per row
- Mapping type selector (primary/reference)
- Description field

#### Scenario: Add Element Association

**Given** the element association drawer is open
**When** the user clicks "Add Element"
**Then** the system SHALL open the Element Selector modal
**And** allow selecting an element from available libraries
**And** add the selected element to the association list

### Requirement: Data Entry Tab

The system SHALL manage data collection tools for the project.

#### Scenario: View Configured Tools

**Given** a user on the Data Entry tab
**When** viewing the tools list
**Then** the system SHALL display:
- Tool order (drag-sortable)
- Tool name
- Tool type (form/survey/interview/field)
- Target type
- Field count
- Mapping count
- Configured status
- Action buttons (configure/delete)

#### Scenario: Add Collection Tool

**Given** a user on the Data Entry tab
**When** clicking "Add Tool"
**Then** the system SHALL display available tools from the Tool Library
**And** allow selecting and adding tools to the project

#### Scenario: Reorder Tools

**Given** multiple tools configured in the project
**When** the user drags a tool row
**Then** the system SHALL reorder the tools and save the new order

### Requirement: Expert Review Tab

The system SHALL manage expert review submissions.

#### Scenario: View Submissions

**Given** a user on the Expert Review tab
**When** viewing the submissions list
**Then** the system SHALL display:
- Review statistics (total/pending/approved/rejected)
- Filter by status
- Submission table with:
  - Institution name
  - Submission time
  - Review status
  - Reviewer name
  - Review time
  - Action buttons

## Mapping Mode

The system SHALL support different indicator-to-element mapping modes.

| Mode | Code | Description |
|------|------|-------------|
| Auto Detect (自动识别) | auto | System auto-matches based on names |
| Element Based (基于要素) | element | Manual association via element selection |

## Statistics Dashboard

The project management page SHALL display:
- Total project count (项目总数)
- By status breakdown
- By year breakdown
