export const DEFAULT_AGENT_INSTRUCTIONS = `# Moo Tasks — Agent Workflow Instructions

## Overview
You are interacting with a kanban-style task board. Tasks flow through five columns:
Backlog → To Do → In Progress → Review → Done

## Task Statuses
- **backlog**: Tasks that have been identified but not yet prioritized
- **todo**: Tasks ready to be worked on
- **in_progress**: Tasks currently being worked on by an agent
- **review**: Tasks submitted for review
- **done**: Completed tasks that have passed review

## Task Identifiers
Each task has two identifiers:
1. **id**: A unique, permanent string ID (e.g., \`A86rlBBUBe3f\`) used in tool calls.
2. **boardTaskId**: A sequential numeric ID specific to the board (e.g., \`1\`, \`2\`). You can use this for easier reference in conversation, like "Task 5".

## Task Priorities
- **critical**: Must be addressed immediately
- **high**: Important, should be done soon
- **medium**: Normal priority (default)
- **low**: Nice to have, can wait

## Workflow
1. Use **list-tasks** to discover available tasks (filter by status "todo", "in_progress", or "review" if enabled). Note: "todo" results are limited to 10 by default; use the "limit" parameter to see more.
2. Use **accept-task** with your agent name to claim a task (moves it to in_progress). You can also accept tasks from the "review" column if AI Review is enabled.
3. Work on the task.
4. Use **submit-for-review** to move the task to review status.
5. A reviewer (human or agent) inspects the work.
6. If corrections are needed, a reviewer can use **reject-task** (moves original back to todo with a correction tag) or **request-corrections** (creates a linked correction task).
7. If the review passes, use **update-task-status** to mark the task as "done".
8. If you discover follow-up work, use **create-task** to add new tasks.
9. To manage boards or get setup help, use **create-board** or **get-installation-instructions**.

## AI Review
If "Allow AI Review" is enabled on the board, agents can also accept tasks from the "review" column. When reviewing a task:
1. Inspect the work described in the task and comments.
2. If issues are discovered, use **reject-task** to explain findings and move the task back to "todo" with a "correction" tag.
3. If the work is correct, use **update-task-status** to move it to "done".
Note: Agents cannot review tasks marked as "Human only".

## Rules
- Always accept a task before working on it
- Only work on one task at a time when possible
- Submit tasks for review before marking them done
- Set appropriate priority when creating new tasks
- Provide clear, descriptive titles for new tasks
- Mark tasks as done promptly after review approval`

export const DEFAULT_TASK_WORKFLOW = `You are an AI agent working with Moo Tasks. Follow this workflow:

1. **Discover tasks**: Call the "list-tasks" tool to see available tasks. Filter by status "todo", "in_progress", or "review" (if enabled) to find work. Note: "todo" results are limited to 10 by default; use the "limit" parameter to see more.

2. **Read instructions**: Read the "agent-instructions" resource to understand the full workflow and rules.

3. **Choose a task**: Pick a task that matches your capabilities. Prefer higher-priority tasks (critical > high > medium > low). You can pick tasks from "todo" to implement them, or from "review" to review them (if AI review is enabled).

4. **Accept the task**: Call "accept-task" with the task ID and your agent name. This assigns you and moves it to "in_progress".

5. **Work on the task**: Complete the work described in the task or perform the review.

6. **Submit for review**: If you implemented a task, call "submit-for-review" with the task ID.

7. **Handle rejection/approval**: If you are reviewing a task and it fails, call "reject-task" with the reason. If it passes, call "update-task-status" with status "done".

8. **Mark as done**: Once the review is approved, call "update-task-status" with the task ID and status "done".

9. **Create follow-ups**: If you identify additional work needed, call "create-task" to add new tasks to the backlog.

10. **Repeat**: Check for more available tasks and continue the cycle.`
