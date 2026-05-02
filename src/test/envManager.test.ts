import { EnvManager } from '../envManager';
import { workspace, setConfig, readConfig, resetVscode } from './vscode.mock';

beforeEach(() => {
    resetVscode();
    delete process.env.ANTHROPIC_API_KEY;
});

afterAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
});

// ── hasSystemApiKey ───────────────────────────────────────────────────────────

describe('hasSystemApiKey', () => {
    it('returns false when env var is absent', () => {
        expect(new EnvManager().hasSystemApiKey()).toBe(false);
    });

    it('returns true when ANTHROPIC_API_KEY is set in the environment', () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-system';
        expect(new EnvManager().hasSystemApiKey()).toBe(true);
    });
});

// ── applyMode ─────────────────────────────────────────────────────────────────

describe('applyMode', () => {
    it('writes ANTHROPIC_API_KEY to claude-code.environmentVariables in API mode', async () => {
        await new EnvManager().applyMode('api', 'sk-ant-test-key');

        const cfg = workspace.getConfiguration('claude-code');
        expect(cfg.update).toHaveBeenCalledWith(
            'environmentVariables',
            { ANTHROPIC_API_KEY: 'sk-ant-test-key' },
            1 // ConfigurationTarget.Global
        );
    });

    it('merges with existing env vars instead of overwriting them', async () => {
        setConfig('claude-code', 'environmentVariables', { KEEP_ME: 'yes' });

        await new EnvManager().applyMode('api', 'sk-ant-new-key');

        const stored = readConfig('claude-code', 'environmentVariables') as Record<string, string>;
        expect(stored.KEEP_ME).toBe('yes');
        expect(stored.ANTHROPIC_API_KEY).toBe('sk-ant-new-key');
    });

    it('removes ANTHROPIC_API_KEY in Pro mode while keeping other vars', async () => {
        setConfig('claude-code', 'environmentVariables', {
            ANTHROPIC_API_KEY: 'old-key',
            OTHER_VAR: 'keep',
        });

        await new EnvManager().applyMode('pro');

        const stored = readConfig('claude-code', 'environmentVariables') as Record<string, string>;
        expect(stored.ANTHROPIC_API_KEY).toBeUndefined();
        expect(stored.OTHER_VAR).toBe('keep');
    });

    it('does not set the key in API mode when no key is provided', async () => {
        await new EnvManager().applyMode('api', undefined);

        const stored = readConfig('claude-code', 'environmentVariables') as Record<string, string>;
        expect(stored?.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('does not throw when the claude-code extension is not installed', async () => {
        workspace.getConfiguration('claude-code').update.mockRejectedValueOnce(
            new Error('Cannot update setting: extension not installed')
        );
        await expect(new EnvManager().applyMode('api', 'sk-ant-test')).resolves.toBeUndefined();
    });
});

// ── getClaudeCodeApiKey ───────────────────────────────────────────────────────

describe('getClaudeCodeApiKey', () => {
    it('returns the key from claude-code.environmentVariables', () => {
        setConfig('claude-code', 'environmentVariables', { ANTHROPIC_API_KEY: 'sk-ant-stored' });
        expect(new EnvManager().getClaudeCodeApiKey()).toBe('sk-ant-stored');
    });

    it('returns undefined when no key is stored', () => {
        expect(new EnvManager().getClaudeCodeApiKey()).toBeUndefined();
    });

    it('returns undefined when environmentVariables is empty', () => {
        setConfig('claude-code', 'environmentVariables', {});
        expect(new EnvManager().getClaudeCodeApiKey()).toBeUndefined();
    });
});
