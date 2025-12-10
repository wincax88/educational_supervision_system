# OpenSpec Agent Instructions

## Overview

This project uses OpenSpec for spec-driven development. Before implementing any feature, review the relevant specification in `openspec/specs/`.

## Directory Structure

```
openspec/
├── specs/              # Source of truth - current specifications
│   ├── system-overview.md
│   ├── element-library.md
│   ├── tool-library.md
│   ├── indicator-library.md
│   └── project-management.md
├── changes/            # Proposed changes (organized by feature)
└── AGENTS.md           # This file
```

## Specification Format

Each spec file follows this structure:

- **Overview**: Module description and purpose
- **Requirements**: Formal requirements using SHALL/MUST
- **Scenarios**: Given/When/Then behavior descriptions
- **Data Models**: Types, enums, and structures

## Workflow

### Before Implementation

1. Read the relevant spec in `openspec/specs/`
2. Ensure you understand all requirements and scenarios
3. If requirements are unclear, ask for clarification

### Proposing Changes

1. Create a folder in `openspec/changes/[feature-name]/`
2. Add `proposal.md` with rationale
3. Add `tasks.md` with implementation checklist
4. Add `specs/` folder with delta files showing changes

### Delta Format

When proposing spec changes, use:

```markdown
## ADDED Requirements
[New requirements with scenarios]

## MODIFIED Requirements
[Updated requirements with full text]

## REMOVED Requirements
[Deprecated requirements]
```

## Key Modules

| Module | Spec File | Description |
|--------|-----------|-------------|
| System | system-overview.md | Core architecture and roles |
| Element Library | element-library.md | Assessment data elements |
| Tool Library | tool-library.md | Data collection tools |
| Indicator Library | indicator-library.md | Evaluation indicator systems |
| Project Management | project-management.md | Assessment projects |

## Technology Context

- **Frontend**: React 19 + TypeScript + Ant Design 6
- **Backend**: Node.js + Express 5
- **Language**: Chinese UI (zh_CN locale)
- **Routing**: React Router DOM 7
