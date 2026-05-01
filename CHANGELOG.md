# Changelog

All notable changes to **Claude Account Switcher** are documented here.

## [0.1.0] — 2026-05-01

### Added
- Status bar button showing the active mode (`Claude: API` or `Claude: Pro`)
- Quick Pick to switch between Anthropic API key mode and Claude.ai Pro (session token) mode
- Sidebar WebView chat panel with streaming responses and mode badge
- Secure credential storage via `vscode.SecretStorage` for both the API key and the session token
- Commands: `Claude: Switch Mode`, `Claude: Configure`, `Claude: Open Chat`, `Claude: Clear Credentials`
- Settings: `claudeSwitcher.defaultMode`, `claudeSwitcher.model`, `claudeSwitcher.maxTokens`
- Minimal Markdown rendering in the chat panel (bold, italic, inline code, code blocks)
- `retainContextWhenHidden` so the conversation survives panel collapse/expand
