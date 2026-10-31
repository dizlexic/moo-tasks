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

The quickest way to run a local instance is Docker Compose. This starts the app, MySQL, and development-only Adminer and Mailpit services.

### 🐳 Run locally with Docker Compose

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with the Compose v2 plugin.

```bash
git clone https://github.com/dizlexic/moo-agent-board.git
cd moo-agent-board
cp .env.example .env
```

Before starting, edit `.env` and replace `NUXT_SESSION_PASSWORD`, `DB_ROOT_PASSWORD`, and `DB_PASSWORD` with unique secrets. Generate a secret with `openssl rand -hex 32`; use a different value for each password. The session password must be at least 32 characters. The example database credentials are for local development only—never expose them to the internet.

Start the stack:

```bash
docker compose up --build -d
docker compose logs -f app
```

The app is at `http://localhost:3000`. Register an account to create your first board. The container waits for MySQL and runs database migrations on startup; the first start can take a few minutes. Adminer (`http://localhost:8080`) and the Mailpit inbox (`http://localhost:8025`) are for local development only. To log into Adminer, select MySQL, use `db` as the server, and enter `DB_USER` and `DB_PASSWORD` from `.env`. Mailpit captures outgoing messages so you can inspect them without sending real email.

MySQL data is stored in the `db-data` Docker volume. `docker compose down` stops the services without removing data; **`docker compose down -v` deletes the database volume and all its data.**

### 🛠️ Run the app from source

For development, install Node.js `v26.13.0` (see `.nvmrc`), npm, and MySQL 8. Copy `.env.example` to `.env`, configure the database connection and a 32-character-or-longer `NUXT_SESSION_PASSWORD`, then install dependencies with `npm ci`. Set `DATABASE_URL` to your MySQL connection string; `npm run db:migrate` applies migrations, and `npm run dev` starts the app. If using the Compose Mailpit service from your host, set `SMTP_HOST=localhost` and `SMTP_PORT` to `MAILPIT_SMTP_PORT` (default `1025`).

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

Copy `.env.example` to `.env` and adjust for your environment. Compose supplies its own internal database URL and uses the `db` service name; when running the app directly on your host, use `localhost` and the published database port instead.

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Public app URL used in verification, password-reset, and invitation emails |
| `HOST` | `localhost` in the example; Compose uses `0.0.0.0` | Server bind address |
| `PORT` | `3000` | Server port |
| `DB_ROOT_PASSWORD` | `password` | MySQL root password for the Compose database; replace before deployment |
| `DB_USER` | `mootasks` | MySQL application user |
| `DB_PASSWORD` | `password` | MySQL application password; replace before deployment |
| `DB_NAME` | `mootasks` | MySQL database name |
| `DB_HOST` | `localhost` | MySQL host for local development; Compose connects to `db` internally |
| `DB_PORT` | `3306` | MySQL connection port for local development; Compose uses internal port `3306` |
| `DB_LOCAL_PORT` | `3307` | Host port published by Compose for MySQL |
| `DATABASE_URL` | *(unset)* | MySQL connection string; required for migrations and takes precedence over individual database settings |
| `DB_SSL` | *(unset)* | Set to `REQUIRED` to enable TLS when connecting with individual database settings |
| `NUXT_SESSION_PASSWORD` | *(required)* | Unique secret of at least 32 characters for session cookies |
| `SMTP_HOST` | `mailpit` | SMTP server; use `localhost` when running the app directly on the host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_USER` / `SMTP_PASSWORD` | *(empty)* | SMTP credentials; not needed for Mailpit |
| `SMTP_FROM` | `noreply@localhost` | Sender address for outgoing email |
| `ADMINER_PORT` | `8080` | Host port published for Adminer |
| `MAILPIT_UI_PORT` | `8025` | Host port published for the Mailpit inbox |
| `MAILPIT_SMTP_PORT` | `1025` | Host port published for Mailpit SMTP |

When running the app on the host against the Compose database, use `DB_HOST=localhost` and set `DB_PORT` to `DB_LOCAL_PORT` (default `3307`). Set `BASE_URL` to the public origin and configure a real SMTP provider before sending email from a deployed instance. See [Self-hosting and production setup](docs/self-hosting.md) before exposing an instance to the internet.

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
| 🔒 **Private** (Default) | Requires a token in the `Authorization: Bearer <token>` HTTP header |
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

## ☁️ Deploy your own instance

The Compose stack above is for local use, not production: it publishes development tools and uses a local database volume. For a production checklist covering hosting, secrets, database, email, and migrations, see [Self-hosting and production setup](docs/self-hosting.md). A DigitalOcean App Platform example is available in [`.do/app.yaml`](.do/app.yaml); the GitHub Actions workflow only builds the project and does not deploy it.

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
