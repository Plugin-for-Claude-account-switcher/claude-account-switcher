import * as vscode from 'vscode';
import type { Mode } from './switcher';

export class EnvManager {
    /** True if ANTHROPIC_API_KEY is set in the shell environment that launched VS Code */
    hasSystemApiKey(): boolean {
        return !!process.env.ANTHROPIC_API_KEY;
    }

    /**
     * Sync ANTHROPIC_API_KEY into claude-code.environmentVariables so every new
     * integrated terminal inherits the right value automatically.
     *
     * - API mode  → writes the key (requires apiKey to be provided)
     * - Pro mode  → removes the key so Claude Code falls back to /login OAuth
     */
    async applyMode(mode: Mode, apiKey?: string): Promise<void> {
        const cfg = vscode.workspace.getConfiguration('claude-code');
        const vars: Record<string, string> = { ...(cfg.get('environmentVariables') ?? {}) };

        if (mode === 'api' && apiKey) {
            vars['ANTHROPIC_API_KEY'] = apiKey;
        } else {
            delete vars['ANTHROPIC_API_KEY'];
        }

        try {
            await cfg.update('environmentVariables', vars, vscode.ConfigurationTarget.Global);
        } catch {
            // claude-code extension may not be installed — silently ignore
        }
    }

    /** Returns the ANTHROPIC_API_KEY currently stored in claude-code.environmentVariables */
    getClaudeCodeApiKey(): string | undefined {
        const cfg = vscode.workspace.getConfiguration('claude-code');
        const vars = cfg.get<Record<string, string>>('environmentVariables') ?? {};
        return vars['ANTHROPIC_API_KEY'];
    }
}
