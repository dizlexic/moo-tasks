<p align="center">
  <img src="https://raw.githubusercontent.com/dizlexic/moo-tasks/refs/heads/main/app/assets/logo.svg" alt="Moo Tasks Logo" width="160" />
</p>

<h1 align="center">Moo Tasks</h1>

<p align="center">
  <a href="https://mootasks.dev">mootasks.dev</a>
</p>

<p align="center">
  <strong>A kanban-style task management dashboard with an integrated MCP server.</strong><br/>
  Human users manage tasks via a drag-and-drop web UI, while AI agents connect via the MCP server to discover, accept, update, and create tasks programmatically.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/dizlexic/moo-tasks/refs/heads/main/public/MooTasksFlow.gif" alt="Moo Tasks Workflow" width="700" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt.js&logoColor=white" alt="Nuxt 4" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/MySQL-Drizzle_ORM-4479A1?logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/MCP-Toolkit-8B5CF6?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==&logoColor=white" alt="MCP" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 👤 | **User Accounts** | Email/password registration and login with sealed cookie sessions |
| ⚙️ | **Account Settings** | Manage global MCP tokens and user account information |
| 📋 | **Multiple Boards** | Create and manage multiple project boards with custom descriptions |
| 📋 | **Task Plans** | Create, manage, and apply task templates/plans to project boards |
| 💾 | **Import/Export** | Import and export boards as JSON |
| 👥 | **Board Collaboration** | Invite users by email, manage member roles (Owner/Member) |
| 🔄 | **5-Column Kanban** | Workflow stages: Backlog → To Do → In Progress → Review → Done |
| 🔢 | **Sequential Task IDs** | Tasks have human-readable sequential IDs (e.g., #1, #2) per board |
| 🔀 | **Dual View Modes** | Toggle between visual **Kanban Board** and condensed **Task List** |
| 🖱️ | **Drag & Drop** | Intuitive task movement between columns using `vuedraggable` |
| 🔧 | **Correction Tasks** | Request specific fixes with linked child tasks for task refinement |
| 🤖 | **MCP Server** | Per-board MCP endpoints with bearer token auth & Public/Private toggles |
| 📝 | **Configurable Instructions** | Global and per-board MCP instructions with "Reset to Default" support |
| 📝 | **Changelog Generation** | AI-powered generation of markdown changelogs from completed tasks |
| 🔗 | **Task Deep-Linking** | Copy unique task URLs for direct navigation and easy sharing |
| ⚡ | **Real-time Polling** | Automatic board sync to keep human and AI agent actions in sync |
| 🗄️ | **MySQL Persistence** | Reliable data storage with Drizzle ORM |

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/dizlexic/moo-tasks/refs/heads/main/public/Task Board.png" alt="Moo Tasks Workflow" width="700" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/dizlexic/moo-tasks/refs/heads/main/public/MCP Server Guide.png" alt="Moo Tasks Workflow" width="700" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/dizlexic/moo-tasks/refs/heads/main/public/Comments.png" alt="Moo Tasks Workflow" width="700" />
</p>


---

## 💾 Board Management

- **Import Board**: Available on the **Dashboard** page.
- **Export Board**: Available in the **Board Settings** panel.

---

## 🚀 Quick Start

The fastest way to get started with Moo Tasks is using Docker.

### 🐳 Running with Docker (Recommended)

If you have Docker installed, you can start the entire stack (including the database, Adminer, and Mailpit) with one command. First create a `.env` file from `.env.example` and set `NUXT_SESSION_PASSWORD` (at least 32 characters long). Then run:

```bash
docker-compose up -d
```
or
```bash
docker compose up -d
```
The application will be available at `http://localhost:3000`.


### 🛠️ Manual Development Setup

If you prefer to run locally without Docker:

1.  **Prerequisites**: Ensure you have [Mysql 8](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/), [Node.js](https://nodejs.org/) (v22+) and [npm](https://www.npmjs.com/) installed.
2.  **Install dependencies**: `npm install`
3.  **Environment Variables**: Create a `.env` file from `.env.example` and set `NUXT_SESSION_PASSWORD` (at least 32 characters long).
4.  **Start development server**: `npm run dev`

## 📖 Usage Guide

Get up and running in just a few minutes:

1.  **Launch**: Once the server is running, navigate to `http://localhost:3000` (or the live site at [mootasks.dev](https://mootasks.dev)).
2.  **Account**: **Register** your account at `/register` or login.
3.  **Create Board**: Head to the **Dashboard** to create your first project board.
4.  **Manage Tasks**: Add, move, and update tasks on your new board using the drag-and-drop Kanban view or the list view.
5.  **Connect AI**: Go to **Board Settings** to view your MCP configuration and connect your favorite AI agent (e.g., Claude Code, Cursor, VS Code).
6.  **Seed Data**: Need test data? Run `npx tsx server/db/seed.ts` to populate the database with sample tasks.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3000` | Server port |
| `DB_USER` | `mootasks` | MySQL user |
| `DB_PASSWORD` | `mootasks` | MySQL password |
| `DB_NAME` | `mootasks` | MySQL database name |
| `DB_PORT` | `3307` | MySQL local port mapping |
| `DATABASE_URL` | *(required if not using Docker)* | MySQL connection string |
| `NUXT_SESSION_PASSWORD` | *(required)* | 32+ char secret for sealed cookie sessions |

---

## 🤖 MCP Server

**Moo Tasks is primarily an MCP server and Agent API.** While it provides a web interface for humans, its core purpose is to enable AI agents to manage tasks programmatically.

### 🎯 Board-Scoped Architecture

**Everything in Moo Tasks is scoped to a board.** There are no global queries for tasks. This ensures that agents only work within the context they are assigned to, improving focus and security.

- Each board has its own unique MCP endpoint.
- AI agents connect to a specific board to work on its tasks.
- Resources, prompts, and tools are all scoped to the active board.

### 📋 Working with Tasks via MCP

The board acts as the primary task list for this application. To programmatically work on tasks:

1. **Get the MCP Token**: In the Board Settings, generate an MCP token if the board is private.
2. **Configure Your Agent**: Add the MCP server configuration for your specific board.
3. **Use Tools**: Use the available tools (`list-tasks`, `accept-task`, `update-task-status`, etc.) to interact with the tasks.

### 🔐 Security & Privacy

| Mode | Description |
|------|-------------|
| 🔒 **Private** (Default) | Requires a Bearer Token via the `token` query parameter |
| 🌐 **Public** | Allows access without a token (for local development) |

Tokens can be **generated**, **rotated**, or **revoked** at any time from Board Settings.

### 🛠️ Tools

| Tool | Description |
|------|-------------|
| `list-tasks` | List tasks with optional status/priority/limit filters |
| `get-task` | Get full details of a task by ID |
| `create-task` | Create a new task |
| `update-task-status` | Update a task's status |
| `accept-task` | Assign yourself to a task and move it to `in_progress` |
| `reject-task` | Reject a task review and move it back to `todo` |
| `add-comment` | Post progress notes or questions on a task |
| `submit-for-review` | Mark a task ready for human review |
| `request-corrections` | Create a linked correction task |
| `generate-changelog` | Generate a markdown changelog from completed tasks |
| `list-plans` | Discover available task plans/templates |
| `apply-plan` | Apply a task plan to the board |
| `create-board` | Create a new board (requires account token) |
| `get-installation-instructions` | Get setup instructions |

### 📚 Resources

| URI | Description |
|-----|-------------|
| `moo-tasks://<boardId>/board-state` | Full board snapshot grouped by status |
| `moo-tasks://<boardId>/agent-instructions` | Workflow instructions for agents |

### 💬 Prompts

| Prompt | Description |
|--------|-------------|
| `task-workflow` | Guided workflow for discovering and completing tasks |

---

## 🔄 Task Hierarchy & Corrections

Moo Tasks supports a refined workflow for task completion:

- **Review Status** — Move tasks to "Review" when ready for human verification
- **Request Corrections** — From "Review" or "Done", create linked "Correction Tasks"
- **Linked Navigation** — Correction tasks link to their parent for easy navigation

### Configurable Instructions

| Level | Description |
|-------|-------------|
| 🌍 **Global** | Edit at `/settings/instructions`, applies to all boards by default |
| 📋 **Per-Board** | Override in board settings, falls back to global when reset |

Both support **reset to default** to restore the original built-in instructions.

---

## 🔌 MCP Client Configuration

<details>
<summary><strong>Claude Code</strong></summary>

```json
{
  "mcpServers": {
    "moo-tasks": {
      "type": "streamable-http",
      "url": "http://localhost:3000/api/boards/<boardId>/mcp",
      "headers": {
        "Authorization": "Bearer <your-bearer-token>"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "moo-tasks": {
      "type": "streamable-http",
      "url": "http://localhost:3000/api/boards/<boardId>/mcp",
      "headers": {
        "Authorization": "Bearer <your-bearer-token>"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code / JetBrains / generic MCP client</strong></summary>

Add to your client's MCP config (e.g. `.vscode/mcp.json` or JetBrains MCP settings):

```json
{
  "mcpServers": {
    "moo-tasks": {
      "type": "streamable-http",
      "url": "http://localhost:3000/api/boards/<boardId>/mcp",
      "headers": {
        "Authorization": "Bearer <your-bearer-token>"
      }
    }
  }
}
```

> 💡 The board page has a **📋 Copy JSON** button that emits this exact snippet pre-filled with your board ID and token.

### 🔐 Security & Scoping

- Each MCP endpoint is **scoped to a single board** (`/api/boards/<boardId>/mcp`). The server only ever sees tasks, comments, and instructions belonging to that one board.
- Tokens are sent via the standard `Authorization: Bearer <token>` HTTP header per the [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic). Query-string tokens are no longer accepted.
- Generate or revoke a board's token from the board settings drawer at any time. Revoking immediately invalidates all existing agent connections.
- Boards may also be marked `mcpPublic` in settings for read-friendly demos; in that mode no token is required, but it is **not recommended** for real work.

</details>

---

## 📡 API Routes

<details>
<summary><strong>Authentication</strong></summary>

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |

</details>

<details>
<summary><strong>Boards</strong></summary>

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boards` | List boards for current user |
| POST | `/api/boards` | Create a new board |
| GET | `/api/boards/:id` | Get board details |
| PATCH | `/api/boards/:id` | Update board (owner only) |
| DELETE | `/api/boards/:id` | Delete board (owner only) |

</details>

<details>
<summary><strong>Board Members</strong></summary>

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boards/:id/members` | List board members |
| POST | `/api/boards/:id/members` | Invite user by email |
| DELETE | `/api/boards/:id/members/:userId` | Remove member |

</details>

<details>
<summary><strong>Tasks</strong></summary>

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boards/:id/tasks` | List tasks for a board |
| POST | `/api/boards/:id/tasks` | Create a task in a board |
| GET | `/api/tasks/:id` | Get a single task |
| PATCH | `/api/tasks/:id` | Update task fields |
| DELETE | `/api/tasks/:id` | Delete a task |

</details>

<details>
<summary><strong>Instructions</strong></summary>

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/instructions` | Get global instructions |
| PUT | `/api/instructions/:id` | Update global instruction |
| POST | `/api/instructions/:id/reset` | Reset to default |
| GET | `/api/boards/:id/instructions` | Get board instructions |
| PUT | `/api/boards/:id/instructions/:instructionId` | Update board instruction |
| POST | `/api/boards/:id/instructions/:instructionId/reset` | Reset board instruction |

</details>

---

## 🐳 Docker

### Build & Run

```bash
# Build
docker build -t moo-tasks .

# Run
docker run -p 3000:3000 \
  -e NUXT_SESSION_PASSWORD="your-secret" \
  -e DATABASE_URL="mysql://user:pass@host:3306/db" \
  moo-tasks
```

---

## ☁️ Deploy to DigitalOcean App Platform

<details>
<summary><strong>Prerequisites</strong></summary>

- A [DigitalOcean](https://www.digitalocean.com/) account
- Your repo pushed to GitHub
- A [DigitalOcean API token](https://cloud.digitalocean.com/account/api/tokens)

</details>

<details>
<summary><strong>Option 1: One-Click via App Spec</strong></summary>

1. Fork/push this repo to GitHub
2. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps) → **Create App**
3. Connect your GitHub repo and select the `main` branch
4. DigitalOcean will auto-detect the `Dockerfile` — confirm the settings
5. Under **Environment Variables**, add these secrets:
   - `NUXT_SESSION_PASSWORD` — 32+ character secret for session encryption
   - `DATABASE_URL` — Your MySQL connection string
6. Deploy!

> **Note:** MySQL is recommended for production as it allows you to increase `instance_count` to handle more traffic.

</details>

<details>
<summary><strong>Option 2: Deploy with doctl</strong></summary>

```bash
# Install doctl and authenticate
doctl auth init

# Create the app from the spec (update repo in .do/app.yaml first)
doctl apps create --spec .do/app.yaml

# Set secrets
doctl apps update <app-id> --spec .do/app.yaml
```

</details>

<details>
<summary><strong>Option 3: CI/CD with GitHub Actions</strong></summary>

The included workflow at `.github/workflows/deploy.yml` automatically:
- **On pull requests** — builds and validates the project
- **On push to main** — builds, then deploys to DigitalOcean App Platform

**Setup:**

1. Create the app on DigitalOcean first (Option 1 or 2)
2. Generate a [DigitalOcean API token](https://cloud.digitalocean.com/account/api/tokens)
3. Add it as a GitHub repository secret:
   - Go to **Settings → Secrets and variables → Actions**
   - Add `DIGITALOCEAN_ACCESS_TOKEN` with your DO API token
4. Push to `main` — the workflow will deploy automatically

</details>

<details>
<summary><strong>App Spec Reference</strong></summary>

The `.do/app.yaml` file defines the full app configuration:

```yaml
name: moo-tasks

services:
  - name: web
    dockerfile_path: Dockerfile
    github:
      branch: main
      deploy_on_push: true
    http_port: 3000
    instance_count: 1
    instance_size_slug: apps-s-1vcpu-1gb
    envs:
      - key: NUXT_SESSION_PASSWORD
        type: SECRET
      - key: DATABASE_URL
        type: SECRET
```

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

- **"Only board owners can invite users" or missing boards after creation:** Ensure `DATABASE_URL` is correctly configured and the MySQL server is accessible from the app.
- **Scalability:** Unlike SQLite, you can increase `instance_count` to handle more traffic, as all instances share the same MySQL database.
- **Session Reset:** If the database is reset but your browser still has a session cookie, the app will automatically log you out. Simply register again to start fresh.

</details>

---

## 🧱 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Nuxt 4** (Nitro + Vue 3) | Framework |
| **Tailwind CSS v4** | Styling |
| **MySQL** + Drizzle ORM | Database |
| **nuxt-auth-utils** | Auth (sealed cookie sessions, scrypt hashing) |
| **@nuxtjs/mcp-toolkit** | MCP server integration |
| **vuedraggable** | Drag & drop |
| **nanoid** | ID generation |

---

<p align="center">
  <img src="https://raw.githubusercontent.com/dizlexic/moo-tasks/refs/heads/main/app/assets/logo.svg" alt="Moo Tasks" width="48" />
  <br/>
  <sub>Built with 🐄 by <a href="https://buymeacoffee.com/dizlexic">dizlexic</a></sub>
</p>
