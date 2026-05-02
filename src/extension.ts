import * as vscode from 'vscode';
import { ModeSwitcher } from './switcher';
import { ApiClient } from './apiClient';
import { ChatPanel } from './chatPanel';
import { CredentialManager } from './credentialManager';
import { EnvManager } from './envManager';
import { TerminalManager } from './terminalManager';

export function activate(context: vscode.ExtensionContext): void {
    const credentials      = new CredentialManager(context.secrets);
    const envManager       = new EnvManager();
    const terminalManager  = new TerminalManager();

    const switcher = new ModeSwitcher(
        context,
        envManager,
        terminalManager,
        () => credentials.getApiKey()
    );

    const apiClient = new ApiClient(
        () => switcher.getMode(),
        async () => ({
            apiKey: await credentials.getApiKey(),
            sessionToken: await credentials.getSessionToken(),
        })
    );

    const chatProvider = new ChatPanel(
        context.extensionUri,
        apiClient,
        () => switcher.getMode(),
        switcher.onModeChanged
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatPanel.viewType, chatProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),

        vscode.commands.registerCommand('claudeSwitcher.switchMode', () =>
            switcher.switchMode()
        ),

        vscode.commands.registerCommand('claudeSwitcher.configure', () =>
            configure(credentials)
        ),

        vscode.commands.registerCommand('claudeSwitcher.openChat', () =>
            chatProvider.openChat()
        ),

        vscode.commands.registerCommand('claudeSwitcher.showStatus', () =>
            switcher.showStatus()
        ),

        vscode.commands.registerCommand('claudeSwitcher.openTerminal', () =>
            terminalManager.openClaudeTerminal()
        ),

        vscode.commands.registerCommand('claudeSwitcher.clearCredentials', async () => {
            const answer = await vscode.window.showWarningMessage(
                'Clear all stored Claude credentials? This cannot be undone.',
                { modal: true },
                'Clear'
            );
            if (answer === 'Clear') {
                await credentials.clearAll();
                vscode.window.showInformationMessage('Claude credentials cleared.');
            }
        })
    );
}

// ── Configure command ──────────────────────────────────────────────────────

interface CredentialPickItem extends vscode.QuickPickItem {
    value: 'api' | 'pro';
}

async function configure(credentials: CredentialManager): Promise<void> {
    const pick = await vscode.window.showQuickPick<CredentialPickItem>(
        [
            {
                label: '$(key) Anthropic API Key',
                description: 'Used in API mode',
                value: 'api',
            },
            {
                label: '$(account) Claude.ai Session Token',
                description: 'Used in Pro mode',
                value: 'pro',
            },
        ],
        { title: 'Claude: Configure', placeHolder: 'Select which credential to set' }
    );

    if (!pick) {
        return;
    }

    if (pick.value === 'api') {
        await configureApiKey(credentials);
    } else {
        await configureSessionToken(credentials);
    }
}

async function configureApiKey(credentials: CredentialManager): Promise<void> {
    const existing = await credentials.getApiKey();

    const input = await vscode.window.showInputBox({
        title: 'Anthropic API Key',
        prompt: 'Enter your Anthropic API key from console.anthropic.com',
        placeHolder: 'sk-ant-api03-...',
        password: true,
        ignoreFocusOut: true,
        value: existing ? `${'•'.repeat(12)}${existing.slice(-4)}` : undefined,
        validateInput: v =>
            v.startsWith('sk-ant-') || v.startsWith('•') ? null : 'Key must start with sk-ant-',
    });

    if (!input || input.startsWith('•')) {
        return;
    }

    await credentials.setApiKey(input);
    vscode.window.showInformationMessage('✓ Anthropic API key saved securely.');
}

async function configureSessionToken(credentials: CredentialManager): Promise<void> {
    const steps = [
        '1. Open https://claude.ai in Chrome/Edge',
        '2. Press F12 → Application tab → Cookies → https://claude.ai',
        '3. Find the "sessionKey" cookie and copy its Value',
    ].join('\n');

    const input = await vscode.window.showInputBox({
        title: 'Claude.ai Session Token',
        prompt: steps,
        placeHolder: 'Paste your sessionKey cookie value here',
        password: true,
        ignoreFocusOut: true,
    });

    if (!input) {
        return;
    }

    await credentials.setSessionToken(input);
    vscode.window.showInformationMessage('✓ Claude.ai session token saved securely.');
}

export function deactivate(): void {}
