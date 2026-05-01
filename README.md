# Claude Account Switcher

Switch between **Claude.ai Pro** (session token) and **Anthropic API key** mode instantly from the VS Code status bar — no logout/login required.

---

## Features

| Feature | Detail |
|---|---|
| **Status bar button** | Shows `$(key) Claude: API` or `$(account) Claude: Pro` — click to switch |
| **Secure storage** | Both credentials are stored in VS Code's encrypted `SecretStorage` |
| **Sidebar chat panel** | Full streaming chat with a live mode badge |
| **Mode switching** | Zero-restart, instant switch at any time |
| **Model selector** | Choose Opus / Sonnet / Haiku in Settings |

---

## Getting Started

### 1 — Install the extension
Install from the VS Code Marketplace or via `.vsix`.

### 2 — Configure your credentials

Open the Command Palette (`Ctrl+Shift+P`) and run **Claude: Configure**.

**API mode** — enter your Anthropic API key (`sk-ant-...`) from [console.anthropic.com](https://console.anthropic.com).

**Pro mode** — paste your Claude.ai `sessionKey` cookie:
1. Open [claude.ai](https://claude.ai) in Chrome or Edge
2. Press **F12** → **Application** tab → **Cookies** → `https://claude.ai`
3. Find the `sessionKey` cookie and copy its **Value**

### 3 — Switch modes
Click the status bar button (`Claude: API` / `Claude: Pro`) or run **Claude: Switch Mode**.

### 4 — Open the chat
Click the Claude icon in the Activity Bar, or run **Claude: Open Chat**.

---

## Commands

| Command | Description |
|---|---|
| `Claude: Switch Mode` | Toggle between API and Pro mode |
| `Claude: Configure` | Set / update API key or session token |
| `Claude: Open Chat` | Focus the sidebar chat panel |
| `Claude: Clear Credentials` | Delete all stored credentials |

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `claudeSwitcher.defaultMode` | `api` | Mode used on startup (`api` or `pro`) |
| `claudeSwitcher.model` | `claude-sonnet-4-6` | Model for API mode |
| `claudeSwitcher.maxTokens` | `4096` | Max response tokens (API mode only) |

---

## Notes on Pro Mode

The Claude.ai Pro mode uses Claude's **unofficial internal web API** via your browser session cookie. This is not a supported integration — it may break if Anthropic changes their web app. The session token expires when you log out of Claude.ai.

---

## License

MIT
