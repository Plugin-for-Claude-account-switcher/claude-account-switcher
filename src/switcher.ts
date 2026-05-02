import * as vscode from 'vscode';
import type { EnvManager } from './envManager';
import type { TerminalManager } from './terminalManager';

export type Mode = 'pro' | 'api';

interface ModePickItem extends vscode.QuickPickItem {
    mode: Mode;
}

export class ModeSwitcher {
    private currentMode: Mode;
    private readonly statusBar: vscode.StatusBarItem;
    private readonly emitter = new vscode.EventEmitter<Mode>();

    readonly onModeChanged: vscode.Event<Mode> = this.emitter.event;

    constructor(
        context: vscode.ExtensionContext,
        private readonly envManager: EnvManager,
        private readonly terminalManager: TerminalManager,
        private readonly getApiKey: () => Promise<string | undefined>
    ) {
        const cfg = vscode.workspace.getConfiguration('claudeSwitcher');
        this.currentMode =
            cfg.get<Mode>('currentMode') ?? cfg.get<Mode>('defaultMode', 'api');

        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        this.statusBar.command = 'claudeSwitcher.switchMode';
        this.refresh();
        this.statusBar.show();

        context.subscriptions.push(this.statusBar, this.emitter);

        // Warn once per session if a system env var will shadow the extension
        if (this.envManager.hasSystemApiKey()) {
            vscode.window.showWarningMessage(
                'Claude Switcher: ANTHROPIC_API_KEY is set as a system environment variable. ' +
                'It will override the extension\'s API key. Remove it from your shell config ' +
                '(.bashrc / .zshrc / Windows Environment Variables) to let Claude Switcher manage switching.',
                'Got it'
            );
        }
    }

    getMode(): Mode {
        return this.currentMode;
    }

    async switchMode(): Promise<void> {
        const items: ModePickItem[] = [
            {
                label: '$(key) Anthropic API Key',
                description: 'API mode — uses your Anthropic API key',
                detail: this.currentMode === 'api' ? '$(check) Currently active' : undefined,
                mode: 'api',
            },
            {
                label: '$(account) Claude.ai Pro / Max',
                description: 'Pro mode — uses Claude.ai session token',
                detail: this.currentMode === 'pro' ? '$(check) Currently active' : undefined,
                mode: 'pro',
            },
        ];

        const picked = await vscode.window.showQuickPick<ModePickItem>(items, {
            title: 'Claude: Switch Auth Mode',
            placeHolder: 'Select the authentication mode for Claude Code',
        });

        if (!picked || picked.mode === this.currentMode) {
            return;
        }

        this.currentMode = picked.mode;
        this.refresh();
        this.emitter.fire(this.currentMode);

        // Persist across restarts
        vscode.workspace
            .getConfiguration('claudeSwitcher')
            .update('currentMode', this.currentMode, vscode.ConfigurationTarget.Global)
            .then(undefined, () => {});

        const cfg = vscode.workspace.getConfiguration('claudeSwitcher');

        // 1 — Sync ANTHROPIC_API_KEY into claude-code.environmentVariables
        if (cfg.get<boolean>('manageClaudeCodeEnv', true)) {
            const apiKey = this.currentMode === 'api' ? await this.getApiKey() : undefined;
            await this.envManager.applyMode(this.currentMode, apiKey);
        }

        // 2 — Send /logout to existing Claude Code terminals
        if (cfg.get<boolean>('autoLogout', true)) {
            await this.terminalManager.sendLogout();
        }

        // 3 — Remind the user to /login (with an "Open Terminal" shortcut)
        if (cfg.get<boolean>('showLoginReminder', true)) {
            await this.terminalManager.showLoginReminder(this.currentMode);
        } else {
            const label = this.currentMode === 'api' ? 'API Key' : 'Pro Plan';
            vscode.window.setStatusBarMessage(`Claude: switched to ${label} mode`, 3000);
        }

        // Surface a conflict warning at switch-time as well
        if (this.envManager.hasSystemApiKey()) {
            vscode.window.showWarningMessage(
                '⚠️ ANTHROPIC_API_KEY is still set as a system env var — it will take precedence ' +
                'over the key Claude Switcher just configured. Remove it from your shell config to ' +
                'let the extension control which key Claude Code uses.'
            );
        }
    }

    /** Show a detailed status panel (command: claudeSwitcher.showStatus) */
    showStatus(): void {
        const modeLabel = this.currentMode === 'api' ? 'API Key' : 'Pro Plan (Session Token)';
        const conflict  = this.envManager.hasSystemApiKey();
        const envKey    = this.envManager.getClaudeCodeApiKey();

        const lines: string[] = [
            `Active mode: ${modeLabel}`,
            '',
            `claude-code env var: ${envKey ? `set (…${envKey.slice(-4)})` : 'not set'}`,
            `System ANTHROPIC_API_KEY: ${conflict ? '⚠️  detected — will override extension' : 'not detected'}`,
        ];

        if (conflict) {
            lines.push('', 'To fix: remove ANTHROPIC_API_KEY from your shell config and restart VS Code.');
        }

        vscode.window.showInformationMessage(lines.join('\n'));
    }

    private refresh(): void {
        const conflict = this.envManager.hasSystemApiKey();

        if (this.currentMode === 'api') {
            this.statusBar.text = conflict ? '$(warning) Claude: API' : '$(key) Claude: API';
            this.statusBar.backgroundColor = undefined;
        } else {
            this.statusBar.text = conflict ? '$(warning) Claude: Pro' : '$(account) Claude: Pro';
            this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }

        this.statusBar.tooltip = conflict
            ? '⚠️ ANTHROPIC_API_KEY system env var detected — may override extension. Click to switch mode.'
            : 'Claude Account Switcher — click to change mode';
    }
}
