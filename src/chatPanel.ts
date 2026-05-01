import * as vscode from 'vscode';
import * as fs from 'fs';
import type { Mode } from './switcher';
import type { ApiClient, Message } from './apiClient';

export class ChatPanel implements vscode.WebviewViewProvider {
    static readonly viewType = 'claudeSwitcher.chatView';

    private view?: vscode.WebviewView;
    private history: Message[] = [];
    private currentMode: Mode;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly apiClient: ApiClient,
        getMode: () => Mode,
        onModeChanged: vscode.Event<Mode>
    ) {
        this.currentMode = getMode();
        onModeChanged(mode => {
            this.currentMode = mode;
            this.post({ type: 'modeChanged', mode });
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.buildHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
            switch (msg.type) {
                case 'send':
                    await this.handleSend(msg.text ?? '');
                    break;
                case 'clear':
                    this.history = [];
                    this.post({ type: 'cleared' });
                    break;
                case 'ready':
                    this.post({ type: 'modeChanged', mode: this.currentMode });
                    break;
            }
        });
    }

    openChat(): void {
        vscode.commands.executeCommand('claudeSwitcher.chatView.focus');
    }

    private async handleSend(text: string): Promise<void> {
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }

        this.history.push({ role: 'user', content: trimmed });
        this.post({ type: 'userMessage', text: trimmed });
        this.post({ type: 'assistantStart' });

        let accumulated = '';

        try {
            await this.apiClient.sendMessage(this.history, chunk => {
                if (chunk.type === 'delta' && chunk.text) {
                    accumulated += chunk.text;
                    this.post({ type: 'assistantDelta', text: chunk.text });
                } else if (chunk.type === 'done') {
                    this.history.push({ role: 'assistant', content: accumulated });
                    this.post({ type: 'assistantDone' });
                } else if (chunk.type === 'error') {
                    this.post({ type: 'error', text: chunk.error ?? 'Unknown error' });
                }
            });
        } catch (err: unknown) {
            // Remove the user message that failed
            this.history.pop();
            const message = err instanceof Error ? err.message : String(err);
            this.post({ type: 'error', text: message });
        }
    }

    private post(msg: ExtensionMessage): void {
        this.view?.webview.postMessage(msg);
    }

    private buildHtml(webview: vscode.Webview): string {
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.html');
        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

        const nonce = createNonce();
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
        html = html.replace(/\{\{initialMode\}\}/g, this.currentMode);

        return html;
    }
}

function createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars[Math.floor(Math.random() * chars.length)];
    }
    return nonce;
}

// ── Message type contracts ─────────────────────────────────────────────────

interface WebviewMessage {
    type: 'send' | 'clear' | 'ready';
    text?: string;
}

interface ExtensionMessage {
    type:
        | 'modeChanged'
        | 'userMessage'
        | 'assistantStart'
        | 'assistantDelta'
        | 'assistantDone'
        | 'error'
        | 'cleared';
    mode?: Mode;
    text?: string;
}
