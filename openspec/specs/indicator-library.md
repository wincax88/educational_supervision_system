# Assessment Indicator System Library Specification

## Overview

The Assessment Indicator System Library (指标体系库) manages indicator systems that define evaluation criteria for educational assessments.

## Indicator Types

| Type | Code | Description |
|------|------|-------------|
| Standard (达标类) | standard | Pass/fail criteria indicators |
| Scoring (评分类) | scoring | Numerical scoring indicators |

## Indicator Hierarchy

Indicator systems use a hierarchical structure:

```
Indicator System (指标体系)
└── Level 1 Indicator (一级指标)
    └── Level 2 Indicator (二级指标)
        └── Level 3 Indicator (三级指标) [Leaf]
            ├── Data Indicators (数据指标)
            │   └── Element Associations (要素关联)
            └── Supporting Materials (佐证资料)
```

### Data Indicator (数据指标)

Data indicators are measurable metrics attached to leaf-level indicators.

| Field | Type | Description |
|-------|------|-------------|
| code | string | Unique code (e.g., DI001) |
| name | string | Indicator name |
| threshold | string | Passing criteria (e.g., "≥85%") |
| thresholdType | enum | single (单值) / range (区间) |
| precision | number | Decimal precision |
| description | string | Detailed description |

### Supporting Material (佐证资料)

Supporting materials are document requirements attached to indicators.

| Field | Type | Description |
|-------|------|-------------|
| code | string | Unique code |
| name | string | Material name |
| fileTypes | string | Allowed file types |
| maxSize | string | Maximum file size |
| required | boolean | Whether mandatory |

## Requirements

### Requirement: Indicator System Management

The system SHALL provide CRUD operations for indicator systems.

#### Scenario: Create Indicator System

**Given** a user with indicator management permissions
**When** creating a new indicator system with:
- System name
- Indicator type (Standard/Scoring)
- Keywords/Tags
- Description (optional)
**Then** the system SHALL create a new indicator system in draft status

#### Scenario: List Indicator Systems

**Given** an authenticated user
**When** accessing the indicator library page
**Then** the system SHALL display:
- System name
- Indicator type
- Status (Draft/Editing/Published)
- Keywords/Tags
- Creation time
- Action buttons

#### Scenario: Filter by Status

**Given** a user on the indicator library page
**When** selecting a status filter
**Then** the system SHALL display only systems matching the selected status

#### Scenario: Search Indicator Systems

**Given** a user on the indicator library page
**When** entering search keywords
**Then** the system SHALL filter systems by name or keywords

### Requirement: Indicator System Publishing Workflow

The system SHALL support publishing workflow for indicator systems.

#### Scenario: Publish Indicator System

**Given** an indicator system in editing status
**When** the user publishes the system
**Then** the system SHALL change status to Published
**And** the indicators SHALL become available for use in projects

### Requirement: File Attachments

The system SHALL support file attachments for indicator systems.

#### Scenario: Attach Documents

**Given** an indicator system
**When** uploading attachments
**Then** the system SHALL accept:
- PDF documents
- Word documents (DOC, DOCX)
- Excel spreadsheets (XLS, XLSX)

#### Scenario: View Attachments

**Given** an indicator system with attachments
**When** viewing system details
**Then** the system SHALL display attached files with download links

### Requirement: Keyword Tagging

The system SHALL support keyword tagging for organization.

#### Scenario: Add Keywords

**Given** an indicator system
**When** adding keywords
**Then** the system SHALL:
- Store multiple keywords per system
- Display keywords as tags
- Enable filtering by keywords

### Requirement: Data Indicator Element Association

The system SHALL support associating data indicators with assessment elements.

#### Scenario: View Element Associations

**Given** a data indicator
**When** viewing its element associations
**Then** the system SHALL display:
- Associated element code and name
- Element type (Basic/Derived)
- Data type
- Mapping type (Primary/Reference)
- Description
- Formula (for derived elements)

#### Scenario: Add Element Association

**Given** a data indicator
**When** adding an element association
**Then** the system SHALL:
- Open element selector modal
- Allow filtering by library and element type
- Allow searching by code or name
- Prevent duplicate associations
- Set default mapping type to "primary"

#### Scenario: Update Association Mapping Type

**Given** an existing element association
**When** changing the mapping type
**Then** the system SHALL update between:
- Primary (主要关联) - main data source
- Reference (参考关联) - supplementary data

#### Scenario: Remove Element Association

**Given** an existing element association
**When** the user removes the association
**Then** the system SHALL delete the association
**And** refresh the association list

#### Scenario: Batch Save Associations

**Given** modified element associations
**When** the user saves changes
**Then** the system SHALL:
- Delete removed associations
- Add new associations
- Update modified associations
- Preserve association order

## Element Association Data Model

```
data_indicator_elements
├── id (primary key)
├── data_indicator_id (foreign key)
├── element_id (foreign key)
├── mapping_type (primary/reference)
├── description
├── created_by
├── created_at
└── updated_at

Constraints:
- UNIQUE (data_indicator_id, element_id)
- CASCADE delete on data_indicator/element deletion
```

## Statistics Dashboard

The indicator library page SHALL display:
- Total system count (体系总数)
- Published count (已发布)
- Editing count (编辑中)
- Standard type count (达标类)
- Scoring type count (评分类)
