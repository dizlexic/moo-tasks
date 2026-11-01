export const MCP_INSTALLATION_INSTRUCTIONS = `
# Moo Tasks Installation & Setup

Moo Tasks can be run locally via Docker or used as a hosted service at https://mootasks.dev.

## 1. Cloud Version (mootasks.dev)
1. Go to https://mootasks.dev and sign up/login.
2. Create a new board on the dashboard.
3. In Board Settings, generate an MCP Token.
4. Use the provided MCP URL and Token in your AI agent's configuration.

## 2. Local Installation (Docker)
1. Clone the repository: \`git clone https://github.com/dizlexic/moo-agent-board.git\`
2. Create a \`.env\` file from \`.env.example\`.
3. Set \`NUXT_SESSION_PASSWORD\` (min 32 chars).
4. Run \`docker-compose up -d\`.
5. Access the UI at \`http://localhost:3000\`.
6. Follow the same steps as the Cloud version to create a board and connect an agent.

## 3. Local Installation (Manual)
1. Ensure you have Node.js 22+ and MySQL 8+ installed.
2. Run \`npm install\`.
3. Configure \`.env\`.
4. Run migrations: \`npm run db:migrate\`.
5. Start the server: \`npm run dev\`.

## 4. Connecting an Agent
Each board provides its own MCP endpoint. Copy the configuration snippet from Board Settings into your agent's config (e.g., \`~/.claude.json\` for Claude Code, or \`.cursor/mcp.json\` for Cursor).
`