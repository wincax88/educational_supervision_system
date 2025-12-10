# Assessment Indicator System Library Specification

## Overview

The Assessment Indicator System Library (指标体系库) manages indicator systems that define evaluation criteria for educational assessments.

## Indicator Types

| Type | Code | Description |
|------|------|-------------|
| Standard (达标类) | standard | Pass/fail criteria indicators |
| Scoring (评分类) | scoring | Numerical scoring indicators |

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

## Statistics Dashboard

The indicator library page SHALL display:
- Total system count (体系总数)
- Published count (已发布)
- Editing count (编辑中)
- Standard type count (达标类)
- Scoring type count (评分类)
