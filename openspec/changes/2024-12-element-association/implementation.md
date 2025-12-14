# Data Indicator - Element Association Feature

## Implementation Date
2024-12

## Overview

Implemented the association functionality between Data Indicators (数据指标) and Assessment Elements (评估要素), enabling manual binding of evaluation elements to indicator metrics.

## Changes Summary

### Database Schema

Added new table `data_indicator_elements`:
- Many-to-many relationship between data indicators and elements
- Supports mapping types: primary (主要关联) / reference (参考关联)
- Cascading deletes for referential integrity

### Backend API

New endpoints in `/backend/routes/indicators.js`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/data-indicators/:id/elements` | List element associations |
| POST | `/data-indicators/:id/elements` | Add association |
| PUT | `/data-indicators/:id/elements/:assocId` | Update association |
| DELETE | `/data-indicators/:id/elements/:assocId` | Remove association |
| PUT | `/data-indicators/:id/elements` | Batch save associations |
| GET | `/indicator-systems/:id/data-indicator-elements` | List all associations for system |

### Frontend Components

1. **ElementAssociationDrawer** (`/frontend/src/pages/ProjectConfig/components/`)
   - Drawer component for editing data indicator element associations
   - Displays data indicator info and associated elements table
   - Supports add/remove associations with mapping type selection

2. **ElementSelector** (`/frontend/src/components/ElementSelector/`)
   - Reusable modal for selecting elements from libraries
   - Filters by library, element type, and keyword search
   - Single-select radio button interface

3. **IndicatorTab** (`/frontend/src/pages/ProjectConfig/components/`)
   - Updated to show element count badges on data indicator nodes
   - Integrated ElementAssociationDrawer for editing

### Frontend Services

Added to `/frontend/src/services/indicatorService.ts`:
- `ElementAssociation` interface
- `DataIndicatorWithElements` interface
- `getDataIndicatorElements()` - fetch associations
- `addDataIndicatorElement()` - add single association
- `updateDataIndicatorElement()` - update association
- `deleteDataIndicatorElement()` - remove association
- `saveDataIndicatorElements()` - batch save
- `getSystemDataIndicatorElements()` - fetch all for system

### Mock Data

Added to `/frontend/src/mock/data.ts`:
- `dataIndicatorElements` - comprehensive mock data for testing
- Covers resource configuration indicators (1.1-1.7)
- Links to "义务教育优质均衡发展评估要素库" elements

## Files Modified

### Backend
- `backend/database/schema.sql` - Added data_indicator_elements table
- `backend/routes/indicators.js` - Added association API endpoints

### Frontend
- `frontend/src/services/indicatorService.ts` - Added association types and methods
- `frontend/src/pages/ProjectConfig/components/IndicatorTab.tsx` - Element count display
- `frontend/src/pages/ProjectConfig/components/ElementAssociationDrawer.tsx` - New component
- `frontend/src/components/ElementSelector/index.tsx` - New component
- `frontend/src/mock/data.ts` - Added mock data
- `frontend/src/pages/ProjectConfig/index.module.css` - Indicator tab styles

## Testing

- TypeScript compilation: PASSED
- Mock data integration: VERIFIED
- Component rendering: VERIFIED

## Related Specs

- Updated `openspec/specs/indicator-library.md` with element association requirements
- Updated `openspec/specs/element-library.md` with selector requirements
- Updated `openspec/specs/project-management.md` with indicator tab features
