# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0] - 2026-06-11

### 🚀 New Features

*   **Task Plans & Templates**:
    *   Introduced a comprehensive "Task Plans" system, including dedicated database tables, RESTful API endpoints, and a new UI for managing task templates.
    *   Integrated Task Plans into the Model Context Protocol (MCP) server, allowing AI agents to discover and apply predefined work structures.
*   **Changelog Generation**:
    *   Added a new AI agent tool and API for automatically generating Markdown changelogs from completed board tasks.
    *   Included a new modal component in the UI to facilitate changelog review and generation.
*   **Sequential Task IDs & Detail Pages**:
    *   Implemented a sequential `boardTaskId` for tasks to simplify human-agent communication.
    *   Created dedicated task detail pages with URL-friendly slugs (e.g., `/task/1-slug-title`), improving direct linking and readability.
*   **Account & Security Management**:
    *   Added an "Account Settings" page for managing global MCP tokens and viewing account information.
    *   Implemented `accountToken` functionality and new board-level settings (`allowAiReview`, `allowAccountToken`) for enhanced control over agent access.
*   **Enhanced Task Management UI**:
    *   Introduced "Correction Mode" in the task detail modal for streamlined feedback loops.
    *   Added "Select All" and "Deselect All" functionality within Kanban columns to facilitate bulk actions.

### 🛠️ Improvements & Refinements

*   **MCP Tooling Updates**:
    *   Enhanced the `list-tasks` tool with support for `limit` parameters and filtering by `review` status.
    *   Added a `reject-task` tool for AI agents to signal failed reviews with specific correction tags.
    *   Implemented global tools `create-board` and `get-installation-instructions`.
*   **UI/UX Refactoring**:
    *   Deconstructed the monolithic `TaskDetailModal.vue` into smaller, reusable sub-components for better maintainability.
    *   Refined the task list view with improved selection modes and drag-and-drop behavior.
*   **System Robustness**:
    *   Normalized email handling during login to ensure consistency across case-sensitive environments.
    *   Updated project dependencies to their latest versions for improved stability.
*   **Documentation**:
    *   Updated `AGENTS.md` with instructions for using the new `discover-gaps.mjs` script to automate project improvement.

### 🧪 Quality & Testing

*   **Test Suite Expansion**: Added comprehensive unit and integration tests for core utilities including `slugify`, `logBoardEvent`, `createBoardMcpServer`, and task reordering logic.
*   **Security Testing**: Introduced robust tests for password hashing, comparison, and authentication edge cases.
*   **Fuzz Testing**: Implemented fuzz tests for ID generation and slugification to ensure reliability against unexpected or malformed inputs.
*   **Infrastructure**: Added Vitest configurations and refined modal event handling (switching from `click` to `mousedown` for improved reliability).

---

*Generated based on recent commit history covering commits from `4656d7a` to `c9e7cbc`.*
