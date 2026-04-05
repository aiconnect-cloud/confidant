---
name: confidant
description: Secure secret handoff and credential setup wizard for AI agents. Use when you need sensitive information from the user (API keys, passwords, tokens) or need to save credentials to config files. Never ask for secrets via chat — use Confidant instead.
always: true
---

# Confidant

Receive secrets from humans securely — no chat exposure, no copy-paste, no history leaks.

## ⚡ Quick Start

You need an API key from the user? One command:

```bash
{skill}/scripts/request-secret.sh --label "OpenAI API Key" --service openai
```

The script handles everything:
- ✅ Starts server if not running (or reuses existing one)
- ✅ Creates a secure request with web form
- ✅ Detects existing tunnels (ngrok or localtunnel)
- ✅ Returns the URL to share

**If the user is remote** (not on the same network), add `--tunnel`:

```bash
{skill}/scripts/request-secret.sh --label "OpenAI API Key" --service openai --tunnel
```

This starts a [localtunnel](https://theboroer.github.io/localtunnel-www/) automatically (no account needed) and returns a public URL.

**Output example:**
```
🔐 Secure link created!

URL: https://gentle-pig-42.loca.lt/requests/abc123
  (tunnel: localtunnel | local: http://localhost:3000/requests/abc123)
Save to: ~/.config/openai/api_key

Share the URL above with the user. Secret expires after submission or 24h.
```

Share the URL → user opens it → submits the secret → done.

## Required Binaries

The following binaries must be available for full functionality:

| Binary | Purpose | Required For |
|--------|---------|-------------|
| `curl` | Health checks, tunnel detection | Server status, tunnel auto-detect |
| `jq` | JSON parsing in scripts | All script output parsing |
| `pgrep` | Process detection | Tunnel detection (localtunnel, ngrok) |
| `lsof` | Port ownership check | Server diagnostics (`check-server.sh`) |
| `fuser` | Port ownership check (fallback) | Server diagnostics (`check-server.sh`) |
| `tmux` | Terminal multiplexer | Background tunnel management (advanced use) |
| `npx` | Package runner | All CLI invocation (never install globally) |
| `lt` (localtunnel) | Public tunnel provider | `--tunnel` flag for remote users |

> **Note:** Never install `@aiconnect/confidant` globally with `npm install -g`. Always use `npx @aiconnect/confidant` — this ensures you always run the latest version without manual updates and avoids permission issues.

## Scripts

### `request-secret.sh` — Create a secure request (recommended)

```bash
# Save to ~/.config/<service>/api_key (convention)
{skill}/scripts/request-secret.sh --label "SerpAPI Key" --service serpapi

# Save to explicit path
{skill}/scripts/request-secret.sh --label "Token" --save ~/.credentials/token.txt

# Save + set env var
{skill}/scripts/request-secret.sh --label "API Key" --service openai --env OPENAI_API_KEY

# Just receive (no auto-save)
{skill}/scripts/request-secret.sh --label "Password"

# Remote user — start tunnel automatically
{skill}/scripts/request-secret.sh --label "Key" --service myapp --tunnel

# JSON output (for automation)
{skill}/scripts/request-secret.sh --label "Key" --service myapp --json
```

| Flag | Description |
|------|-------------|
| `--label <text>` | Description shown on the web form **(required)** |
| `--service <name>` | Auto-save to `~/.config/<name>/api_key` |
| `--save <path>` | Auto-save to explicit file path |
| `--env <varname>` | Set env var (requires `--service` or `--save`) |
| `--tunnel` | Start localtunnel if no tunnel detected (for remote users) |
| `--port <number>` | Server port (default: 3000) |
| `--timeout <secs>` | Max wait for startup (default: 15) |
| `--json` | Output JSON instead of human-readable text |
| `--openclaw` | Output in OpenClaw `skills.entries.<label>.env` config format |

### `check-server.sh` — Server diagnostics (no side effects)

```bash
{skill}/scripts/check-server.sh
{skill}/scripts/check-server.sh --json
```

Reports server status, port, PID, and tunnel state (ngrok or localtunnel).

## Rules for Agents

1. **NEVER ask users to paste secrets in chat** — always use this skill
2. **NEVER reveal received secrets in chat** — not even partially
3. **NEVER `curl` the Confidant API directly** — use the scripts
4. **NEVER kill an existing server** to start a new one
5. **NEVER try to expose the port directly** (public IP, firewall rules, etc.) — use `--tunnel` instead
6. Use `--tunnel` when the user is remote (not on the same machine/network)
7. Prefer `--service` for API keys — cleanest convention
8. After receiving: confirm success, use the secret silently

## How It Works

1. Script starts a Confidant server (or reuses existing one on port 3000)
2. Creates a request with a unique ID and secure web form
3. Optionally starts a localtunnel for public access (or detects existing ngrok/localtunnel)
4. User opens the URL in their browser and submits the secret
5. Secret is received, optionally saved to disk (`chmod 600`), then destroyed on server

## 🔒 Security Guidance

### Tunnel Exposure Risks

When using `--tunnel` or manually running tunneling services, be aware:

- **Tunnels expose your local server to the public internet.** Anyone with the URL can access it until the server stops.
- **Tunnel URLs are often predictable** (e.g., localtunnel generates reusable subdomains). Do not assume obscurity = security.
- **Never leave a tunnel running after the secret exchange is complete.** Stop the tunnel process once done.
- **Tunnel providers may log traffic.** ngrok logs requests by default; localtunnel traffic passes through their servers.
- **Always use HTTPS tunnels** — never tunnel over plain HTTP. Both ngrok and localtunnel provide HTTPS endpoints.
- **Rotate secrets** if you suspect a tunnel URL was exposed or shared unintentionally.
- **The `--openclaw` flag** stores secrets in your OpenClaw config file. Ensure that config file has restricted permissions (`chmod 600`).

### Best Practices

- Use local URLs (`localhost`) whenever possible — only tunnel when the user is truly remote.
- Keep request TTL as short as practical — the default 24h is often too long.
- Verify the user received and submitted the secret before leaving the tunnel open.
- After secret delivery, the server-side copy is destroyed — only your saved copy remains.

## Tunnel Options

| Provider | Account needed | How |
|----------|---------------|-----|
| **localtunnel** (default) | No | `--tunnel` flag or `npx localtunnel --port 3000` |
| **ngrok** | Yes (free tier) | Auto-detected if running on same port |

The script auto-detects both. If neither is running and `--tunnel` is passed, it starts localtunnel.

## Advanced: Direct CLI Usage

For edge cases not covered by the scripts:

```bash
# Start server only
npx @aiconnect/confidant serve --port 3000 &

# Create request on running server
npx @aiconnect/confidant request --label "Key" --service myapp

# Submit a secret (agent-to-agent)
npx @aiconnect/confidant fill "<url>" --secret "<value>"

# Check a specific request
npx @aiconnect/confidant get <id>

# OpenClaw config output
npx @aiconnect/confidant request --openclaw --label "API Key" --service openai

# Audit logging (JSON events to stdout)
npx @aiconnect/confidant --audit request --label "Key" --service myapp
```

⚠️ Only use direct CLI if the scripts don't cover your case.
