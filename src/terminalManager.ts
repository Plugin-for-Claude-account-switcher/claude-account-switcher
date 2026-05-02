import * as vscode from 'vscode';
import type { Mode } from './switcher';

export class TerminalManager {
    /**
     * Returns terminals whose name contains "claude" (case-insensitive).
     * Falls back to the active terminal when none are found so the user
     * doesn't have to manually open one first.
     */
    findClaudeTerminals(): vscode.Terminal[] {
        const named = vscode.window.terminals.filter(t =>
            t.name.toLowerCase().includes('claude')
        );
        if (named.length > 0) {
            return named;
        }
        const active = vscode.window.activeTerminal;
        return active ? [active] : [];
    }

    /**
     * Sends `/logout` to every Claude Code terminal so the in-flight session
     * is cleared before the new credentials are picked up on `/login`.
     */
    async sendLogout(): Promise<void> {
        const targets = this.findClaudeTerminals();
        for (const terminal of targets) {
            terminal.show(false); // reveal without stealing focus
            terminal.sendText('/logout');
        }
    }

    /**
     * Shows a notification telling the user to run `/login`.
     * Provides an "Open Terminal" button that opens a ready-to-use terminal
     * named "Claude Code" so they can run /login immediately.
     */
    async showLoginReminder(mode: Mode): Promise<void> {
        const label = mode === 'api' ? 'API Key' : 'Pro Plan';
        const choice = await vscode.window.showInformationMessage(
            `Claude Switcher: switched to ${label} mode. Run /login in your Claude Code terminal to complete authentication.`,
            'Open Terminal',
            'Dismiss'
        );
        if (choice === 'Open Terminal') {
            this.openClaudeTerminal();
        }
    }

    /** Opens a new terminal named "Claude Code" and brings it to focus. */
    openClaudeTerminal(): vscode.Terminal {
        const terminal = vscode.window.createTerminal({ name: 'Claude Code' });
        terminal.show();
        return terminal;
    }
}
