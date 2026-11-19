# Donee MCP server

Lets Claude (Desktop / Code) read and manage Donee tasks by chat. It signs in as you, so
Supabase RLS gives Claude exactly your permissions — nothing more.

Tools: `whoami`, `list_projects`, `list_members`, `list_tasks`, `get_task` (with comments),
`recent_comments`, `list_notifications`, `mark_notifications_read`, `create_task`, `update_task`, `add_comment`.

## Setup

```bash
cd mcp && npm install
```

### Claude Code

```bash
claude mcp add donee \
  -e SUPABASE_URL=https://xxxxx.supabase.co \
  -e SUPABASE_ANON_KEY=eyJ... \
  -e DONEE_EMAIL=you@example.com \
  -e DONEE_PASSWORD='...' \
  -- node "/absolute/path/to/task tracker/mcp/server.js"
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "donee": {
      "command": "node",
      "args": ["/absolute/path/to/task tracker/mcp/server.js"],
      "env": {
        "SUPABASE_URL": "https://xxxxx.supabase.co",
        "SUPABASE_ANON_KEY": "eyJ...",
        "DONEE_EMAIL": "you@example.com",
        "DONEE_PASSWORD": "..."
      }
    }
  }
}
```

Optional `DONEE_WORKSPACE_ID` picks the workspace (default: your first one; see `whoami`).

Note: `add_comment` / `create_task` with an assignee trigger real notification emails, same as the app.
