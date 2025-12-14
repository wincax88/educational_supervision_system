# Assessment Element Library Specification

## Overview

The Assessment Element Library (要素库) manages reusable assessment data elements that can be referenced in assessment projects and indicator systems.

## Element Types

- **Basic Element (基础要素)**: Fundamental data points collected directly
- **Derived Element (派生要素)**: Calculated elements based on basic elements with formulas

## Element Data Model

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| code | string | Element code (e.g., E001) |
| name | string | Element name |
| elementType | enum | 基础要素 / 派生要素 |
| dataType | string | Data type (number, text, date, etc.) |
| formula | string | Calculation formula (derived only) |
| libraryId | string | Parent library reference |
| description | string | Detailed description |

## Requirements

### Requirement: Element Library Management

The system SHALL provide CRUD operations for element libraries.

#### Scenario: Create Element Library

**Given** a user with library management permissions
**When** the user creates a new element library with:
- Library name
- Description (optional)
**Then** the system SHALL create a new library in draft status

#### Scenario: List Element Libraries

**Given** an authenticated user
**When** accessing the element library page
**Then** the system SHALL display:
- Library name
- Element count
- Status (Published/Draft)
- Creation time
- Action buttons

#### Scenario: Search Element Libraries

**Given** a user on the element library page
**When** entering search keywords
**Then** the system SHALL filter libraries by name matching the search term

### Requirement: Element Library Publishing

The system SHALL support publishing workflow for element libraries.

#### Scenario: Publish Element Library

**Given** an element library in draft status
**When** the user clicks the publish button
**Then** the system SHALL change the library status to Published
**And** the elements SHALL become available for reference in other modules

#### Scenario: Unpublish Element Library

**Given** a published element library not in use
**When** the user clicks the unpublish button
**Then** the system SHALL change the library status to Draft

### Requirement: Element Management

The system SHALL support managing elements within a library.

#### Scenario: View Library Elements

**Given** an element library
**When** the user clicks "View Basic Info"
**Then** the system SHALL display all elements in the library

#### Scenario: Add Element to Library

**Given** an element library in draft status
**When** adding a new element with:
- Element name
- Element type (Basic/Derived)
- Data type
- Description
**Then** the system SHALL add the element to the library

### Requirement: Element Selector

The system SHALL provide a reusable element selector component for associating elements.

#### Scenario: Open Element Selector

**Given** a context requiring element selection (e.g., data indicator association)
**When** the element selector modal opens
**Then** the system SHALL display:
- Library filter dropdown (all libraries)
- Element type filter (Basic/Derived)
- Search input for code/name
- Elements table with selection

#### Scenario: Filter Elements by Library

**Given** the element selector is open
**When** selecting a library from the dropdown
**Then** the system SHALL display only elements from that library

#### Scenario: Filter Elements by Type

**Given** the element selector is open
**When** selecting an element type
**Then** the system SHALL display only elements of that type

#### Scenario: Search Elements

**Given** the element selector is open
**When** entering a search keyword
**Then** the system SHALL filter elements by code or name

#### Scenario: Select Element

**Given** the element selector displays elements
**When** the user clicks on an element row
**Then** the system SHALL return the selected element with:
- Element ID, code, name
- Element type and data type
- Formula (if derived)
- Library name

## Statistics Dashboard

The element library page SHALL display:
- Total library count (库总数)
- Published count (已发布)
- Draft count (待发布)
- Total element count (要素总数)
