# Data Collection Tool Library Specification

## Overview

The Data Collection Tool Library (采集工具库) manages various tools used for collecting assessment data from educational institutions.

## Tool Types

| Type | Code | Description |
|------|------|-------------|
| Form (表格) | form | Structured data entry forms |
| Survey (问卷) | survey | Questionnaire-based data collection |
| Interview (访谈) | interview | Interview guides and templates |
| Field Verification (实地核查) | field | On-site verification checklists |

## Target Types

| Target | Description |
|--------|-------------|
| School (学校) | Educational institutions |
| Teacher (教师) | Teaching staff |
| Student (学生) | Students |
| Parent (家长) | Parents/Guardians |
| Other (其他) | Other stakeholders |

## Requirements

### Requirement: Tool Library Management

The system SHALL provide CRUD operations for data collection tools.

#### Scenario: Create Collection Tool

**Given** a user with tool management permissions
**When** creating a new tool with:
- Tool name
- Tool type
- Target type
- Description (optional)
**Then** the system SHALL create a new tool in draft status

#### Scenario: List Collection Tools

**Given** an authenticated user
**When** accessing the tool library page
**Then** the system SHALL display:
- Tool name
- Tool type
- Target type
- Status (Draft/Editing/Published)
- Creation time
- Action buttons

#### Scenario: Filter Tools by Type

**Given** a user on the tool library page
**When** selecting a tool type filter
**Then** the system SHALL display only tools matching the selected type

#### Scenario: Search Tools

**Given** a user on the tool library page
**When** entering search keywords
**Then** the system SHALL filter tools by name matching the search term

### Requirement: Tool Status Workflow

The system SHALL support status workflow for collection tools.

#### Scenario: Tool Status Transitions

**Given** a collection tool
**When** managing the tool lifecycle
**Then** the system SHALL support these status transitions:
- Draft → Editing
- Editing → Published
- Published → Editing (for updates)

### Requirement: Tool Information Display

The system SHALL display comprehensive tool information.

#### Scenario: View Tool Information

**Given** a user viewing a tool's detail
**When** the tool information modal opens
**Then** the system SHALL display:
- Tool name
- Tool type
- Target type
- Status
- Description
- Creation and update timestamps

## Statistics Dashboard

The tool library page SHALL display:
- Total tool count (工具总数)
- Published count (已发布)
- Draft count (草稿)
- By type breakdown
