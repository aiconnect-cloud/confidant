# Confidant

**The secure secret handoff tool and credential setup wizard for AI agents.**

When your AI assistant needs a password, API key, or any sensitive credential, where does it go? Through chat history. Logged. Stored. Exposed.

Confidant solves this. It creates a secure, time-limited channel where humans can submit secrets directly to AI assistants — without the secret ever touching chat logs.

## The Problem

AI assistants like [OpenClaw](https://github.com/openclaw/openclaw), Nanobot, Picoclaw, Zeroclaw, Claude Code, and others are becoming trusted collaborators. They need credentials to help you:

- Deploy to your servers
- Access your APIs
- Configure your services
- Manage your accounts

But every time you paste a password in chat, it's logged somewhere. Chat history, model training data, audit logs. That's not secure.

## The Solution

Confidant provides a **pull-based secret handoff**:

1. **AI requests a secret** → Creates a secure request with a unique URL
2. **Human receives the URL** → Opens it in their browser
3. **Human submits the secret** → Direct browser-to-server, bypassing chat
4. **AI retrieves the secret** → Auto-polls until the secret arrives
5. **Secret self-destructs** → Deleted immediately after retrieval

```text
┌─────────────┐     1. Request      ┌─────────────┐
│             │ ─────────────────▶  │             │
│     AI      │                     │  Confidant  │
│  Assistant  │  ◀─────────────────  │   Server    │
│             │     4. Secret       │             │
└─────────────┘                     └─────────────┘
                                          ▲
                                          │ 3. Submit
                                          │    (HTTPS)
                                    ┌─────────────┐
        2. URL via chat             │             │
    ─────────────────────────────▶  │    Human    │
                                    │   Browser   │
                                    └─────────────┘
```

The secret never passes through chat. It's a direct handshake between human and AI.

## Quick Start

No installation required:

```bash
npx @aiconnect/confidant serve-request --label "API Key"
```

A secure URL is generated. Open it in your browser, submit the secret, and it's delivered directly to the terminal.

## Installation

For frequent use, install globally:

```bash
npm install -g @aiconnect/confidant
```

Or run any command with `npx @aiconnect/confidant <command>` without installing.

## For AI Agents (ClawHub Skill)

If you're running an AI agent like [OpenClaw](https://github.com/openclaw/openclaw), install the Confidant skill from [ClawHub](https://www.clawhub.ai):

```bash
clawdhub install confidant
```

Once installed, your agent learns how to:

- Request secrets from users without exposing them in chat
- Deliver secrets to users securely
- Exchange credentials with other agents

👉 **[View on ClawHub](https://www.clawhub.ai/skills/confidant)**

## Usage

### Request a Secret (Human → AI)

The primary flow — an AI assistant needs a credential from a human:

```bash
# Start server + create request in one command
confidant serve-request --label "API Key"

# Or, if the server is already running:
confidant request --label "API Key"
```

The AI shares the URL in chat, the human opens it in their browser and submits the secret. The secret is delivered directly to the AI — never logged in chat.

### Auto-save Secrets to Config Files

Confidant can save received secrets directly to your filesystem with secure permissions (`chmod 600`), making it a one-command setup wizard:

**Convention mode** — saves to `~/.config/<service>/api_key`:

```bash
confidant request --service serpapi
confidant request --service openai --env OPENAI_API_KEY
```

**Explicit path mode** — full control over file location:

```bash
confidant request --save ~/.credentials/my-secret.txt
confidant request --save ~/.config/aws/credentials --env AWS_ACCESS_KEY_ID
```

Auto-save also works with the `get` command:

```bash
confidant get <secret-id> --service myservice
```

### Deliver a Secret (AI → Human)

When the AI needs to securely deliver a secret to a user (generated password, API key):

```bash
# User runs this (they will receive the secret)
confidant serve-request --label "Generated Password"
# → http://localhost:3000/requests/abc123...

# AI executes this to send the secret
confidant fill "http://localhost:3000/requests/abc123..." --secret "my-secure-password-123"
```

The secret travels from AI → server → user terminal, never appearing in chat.

### Agent-to-Agent Communication

Confidant supports direct secret submission between automated agents without requiring a browser:

```bash
# Agent A - Creates a request
confidant request --label "API Key"
# → http://192.168.1.100:3000/requests/abc123...

# Agent B - Submits the secret programmatically
confidant fill "http://192.168.1.100:3000/requests/abc123..." --secret "sk-xxxx"
```

For production, avoid passing secrets on the command line:

```bash
# Read from stdin (safer - avoids shell history)
echo "$SECRET" | confidant fill <url> --secret -

# From password managers
op read "op://Vault/Item/password" | confidant fill <url> --secret -
```

JSON output for scripting:

```bash
result=$(confidant fill "$URL" --secret "$SECRET" --json)
if echo "$result" | jq -e '.success' > /dev/null; then
  echo "Secret delivered"
fi
```

**Orchestrator pattern** — distributing secrets to multiple agents:

```bash
#!/bin/bash
for agent in "http://agent1:3000" "http://agent2:3000"; do
  request=$(curl -s "$agent/requests" -X POST -H "Content-Type: application/json" \
    -d '{"expiresIn": 300, "label": "DB Credentials"}')

  hash=$(echo "$request" | jq -r '.hash')

  confidant fill "$agent/requests/$hash" --secret "$DB_PASSWORD"
done
```

## Use Cases

### For AI Assistants

```bash
confidant request --quiet
# Outputs just the URL to share with the human
```

### For DevOps / CI/CD

```bash
confidant create --secret "$DEPLOY_KEY" --max-access-count 1
# Share the ID with your pipeline
```

### For Team Collaboration

```bash
confidant create --secret "temp-password" --ttl 300000
# Secret expires in 5 minutes
```

## CLI Reference

### `confidant serve`

Start the Confidant server.

### `confidant serve-request`

Start the server and immediately create a secret request.

### `confidant request`

Create a secret request and wait for submission.

Options:

- `--expires-in <seconds>` - Request expiration (default: 86400)
- `--poll-interval <seconds>` - Polling interval (default: 2)
- `--poll <id>` - Manually poll for an existing request by ID
- `--label <text>` - Label describing the requested secret (max 200 characters)
- `--save <path>` - Save received secret to file path (with chmod 600)
- `--service <name>` - Save to ~/.config/\<service\>/api_key (convention mode)
- `--env <varname>` - Set environment variable after saving (requires --save or --service)
- `--quiet` - Minimal output (just URLs and secret)
- `--json` - JSON output format
- `--verbose` - Show detailed info including network detection

### `confidant create`

Create a secret directly.

Options:

- `--secret <value>` - The secret to store
- `--ttl <ms>` - Time-to-live in milliseconds
- `--max-access-count <n>` - Maximum access count

### `confidant get <id>`

Retrieve a secret by ID.

Options:

- `--save <path>` - Save to file path (with chmod 600)
- `--service <name>` - Save to ~/.config/\<service\>/api_key (convention mode)
- `--env <varname>` - Set environment variable after saving (requires --save or --service)

### `confidant fill <url-or-hash>`

Submit a secret to an existing request.

Options:

- `--secret <value>` - Secret value to submit (use `-` for stdin)
- `--json` - JSON output format

Examples:

```bash
confidant fill "http://localhost:3000/requests/abc123..." --secret "sk-xxxx"
confidant fill abc123... --secret "sk-xxxx" --api-url "http://192.168.1.100:3000"
echo "my-secret" | confidant fill <url> --secret -
```

### `confidant delete <id>`

Delete a secret.

### `confidant status <id>`

Check secret status.

## API Endpoints

| Method | Endpoint              | Description                             |
| ------ | --------------------- | --------------------------------------- |
| POST   | `/requests`           | Create a secret request                 |
| GET    | `/requests/:hash`     | Secret submission form (HTML)           |
| POST   | `/requests/:hash`     | Submit a secret                         |
| GET    | `/requests/:id/poll`  | Poll for secret availability            |
| POST   | `/secrets`            | Create a secret directly                |
| GET    | `/secrets/:id`        | Retrieve a secret                       |
| GET    | `/secrets/:id/status` | Check secret status                     |
| DELETE | `/secrets/:id`        | Delete a secret                         |
| GET    | `/api/urls`           | Get server URLs (localhost and network) |
| GET    | `/health`             | Health check                            |

## Deployment & Network Access

### Local Development

```bash
npm run dev
```

### Docker

```bash
docker build -t confidant .
docker run -p 3000:3000 confidant
```

### Production

Deploy behind a reverse proxy (nginx, Caddy) with proper TLS.

### Network URL Detection

When creating a request, Confidant automatically detects and displays URLs for different scenarios:

- **Localhost** — for same-machine access (`http://localhost:3000/requests/...`)
- **Local Network IP** — auto-detected for cross-device access on the same network (`http://192.168.1.100:3000/requests/...`)

Use `--verbose` to see network detection details.

### External Access (Tunneling)

For containers, VMs, or remote access, expose Confidant with a tunneling service:

| Service               | Setup                                            | Notes                            |
| --------------------- | ------------------------------------------------ | -------------------------------- |
| **ngrok**             | `ngrok http 3000`                                | Quick setup, free tier available |
| **localtunnel**       | `npx localtunnel --port 3000`                    | No signup required               |
| **Cloudflare Tunnel** | `cloudflared tunnel --url http://localhost:3000` | Zero trust                       |
| **Tailscale**         | `tailscale ip -4` (use the IP)                   | Mesh VPN                         |

Then point the CLI to the public URL:

```bash
export CONFIDANT_API_URL=https://abc123.ngrok.io
confidant request
```

## Security Notes

- **No persistence by default**: Secrets live in memory only
- **Auto-expiration**: Secrets self-destruct after TTL or access limit
- **No chat logging**: Secrets bypass chat history entirely
- **Secure file permissions**: Auto-saved files use chmod 600 (owner read/write only)
- **HTTPS required**: Always use TLS in production (ngrok provides this automatically)

## Troubleshooting

**Localhost URL not working?**

- Ensure the server is running: `confidant serve`
- Check if port 3000 is available: `lsof -i :3000`

**Local Network IP not accessible?**

- Verify both devices are on the same network
- Check firewall settings on the host machine
- Use `--verbose` to see the detected IP

**Cross-device not working?**

- Mac Mini + iPhone: ensure both are on the same Wi-Fi
- Docker + Host: use `--network host` or port mapping
- VM + Host: use bridged or host-only network adapter

**Tunneling issues?**

- Verify the tunnel is forwarding to port 3000
- Check the tunnel service status page
- Some tunnels require authentication — check service docs

## Environment Variables

| Variable            | Default                 | Description               |
| ------------------- | ----------------------- | ------------------------- |
| `PORT`              | 3000                    | Server port               |
| `CONFIDANT_PORT`    | 3000                    | Server port (alternative) |
| `CONFIDANT_API_URL` | `http://localhost:3000` | API URL for CLI           |

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Hono
- **Validation**: Zod

## Architecture

For internal documentation on the modular registry system, see [docs/registry.md](docs/registry.md).

## License

MIT. See [LICENSE](LICENSE).

## Trademarks

AI Connect is a registered trademark under the control of ERIC SANTOS LLC.

See [TRADEMARKS.md](TRADEMARKS.md).

---

**Confidant**: Because your AI assistant shouldn't have to ask for passwords in public.
