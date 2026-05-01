import * as vscode from 'vscode';

export type Mode = 'pro' | 'api';

interface ModePickItem extends vscode.QuickPickItem {
    mode: Mode;
}

export class ModeSwitcher {
    private currentMode: Mode;
    private readonly statusBar: vscode.StatusBarItem;
    private readonly emitter = new vscode.EventEmitter<Mode>();

    readonly onModeChanged: vscode.Event<Mode> = this.emitter.event;

    constructor(context: vscode.ExtensionContext) {
        const cfg = vscode.workspace.getConfiguration('claudeSwitcher');
        this.currentMode = cfg.get<Mode>('defaultMode', 'api');

        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        this.statusBar.command = 'claudeSwitcher.switchMode';
        this.statusBar.tooltip = 'Claude Account Switcher — click to change mode';
        this.refresh();
        this.statusBar.show();

        context.subscriptions.push(this.statusBar, this.emitter);
    }

    getMode(): Mode {
        return this.currentMode;
    }

    async switchMode(): Promise<void> {
        const items: ModePickItem[] = [
            {
                label: '$(key) Anthropic API Key',
                description: 'API mode',
                detail: this.currentMode === 'api' ? '$(check) Active' : undefined,
                mode: 'api',
            },
            {
                label: '$(account) Claude.ai Pro',
                description: 'Session token mode',
                detail: this.currentMode === 'pro' ? '$(check) Active' : undefined,
                mode: 'pro',
            },
        ];

        const picked = await vscode.window.showQuickPick<ModePickItem>(items, {
            title: 'Claude: Switch Mode',
            placeHolder: 'Select authentication mode',
        });

        if (!picked || picked.mode === this.currentMode) {
            return;
        }

        this.currentMode = picked.mode;
        this.refresh();
        this.emitter.fire(this.currentMode);

        vscode.window.setStatusBarMessage(
            `Claude switched to ${this.currentMode === 'api' ? 'API Key' : 'Pro (Session Token)'} mode`,
            3000
        );
    }

    private refresh(): void {
        if (this.currentMode === 'api') {
            this.statusBar.text = '$(key) Claude: API';
            this.statusBar.backgroundColor = undefined;
        } else {
            this.statusBar.text = '$(account) Claude: Pro';
            this.statusBar.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground'
            );
        }
    }
}
