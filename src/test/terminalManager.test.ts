import { TerminalManager } from '../terminalManager';
import {
    window,
    addTerminal,
    setActiveTerminal,
    resetVscode,
} from './vscode.mock';

beforeEach(() => {
    resetVscode();
});

// ── findClaudeTerminals ───────────────────────────────────────────────────────

describe('findClaudeTerminals', () => {
    it('returns terminals whose name contains "claude" (case-insensitive)', () => {
        addTerminal('Claude Code');
        addTerminal('bash');
        addTerminal('CLAUDE-dev');

        const results = new TerminalManager().findClaudeTerminals();

        expect(results).toHaveLength(2);
        expect(results.map(t => t.name)).toEqual(['Claude Code', 'CLAUDE-dev']);
    });

    it('returns empty array when no terminals exist at all', () => {
        expect(new TerminalManager().findClaudeTerminals()).toEqual([]);
    });

    it('falls back to the active terminal when no claude-named terminal exists', () => {
        const active = addTerminal('zsh');
        setActiveTerminal(active);

        const results = new TerminalManager().findClaudeTerminals();

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('zsh');
    });

    it('does not include the active terminal when claude-named terminals are found', () => {
        const claude = addTerminal('Claude Code');
        const other = addTerminal('bash');
        setActiveTerminal(other); // active is NOT the claude one

        const results = new TerminalManager().findClaudeTerminals();

        expect(results).toEqual([claude]);
    });

    it('returns empty array when no terminals and no active terminal', () => {
        expect(new TerminalManager().findClaudeTerminals()).toHaveLength(0);
    });
});

// ── sendLogout ────────────────────────────────────────────────────────────────

describe('sendLogout', () => {
    it('sends /logout to every Claude Code terminal', async () => {
        const t1 = addTerminal('Claude Code');
        const t2 = addTerminal('Claude Code 2');
        addTerminal('bash'); // should be ignored

        await new TerminalManager().sendLogout();

        expect(t1.sendText).toHaveBeenCalledWith('/logout');
        expect(t2.sendText).toHaveBeenCalledWith('/logout');
    });

    it('reveals terminals without stealing editor focus', async () => {
        const t = addTerminal('Claude Code');
        await new TerminalManager().sendLogout();
        expect(t.show).toHaveBeenCalledWith(false);
    });

    it('sends /logout to the active terminal when no claude-named terminal exists', async () => {
        const active = addTerminal('bash');
        setActiveTerminal(active);

        await new TerminalManager().sendLogout();

        expect(active.sendText).toHaveBeenCalledWith('/logout');
    });

    it('does nothing when there are no terminals at all', async () => {
        await expect(new TerminalManager().sendLogout()).resolves.toBeUndefined();
    });
});

// ── showLoginReminder ─────────────────────────────────────────────────────────

describe('showLoginReminder', () => {
    it('shows a message containing "API Key" when switching to API mode', async () => {
        await new TerminalManager().showLoginReminder('api');

        expect(window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringContaining('API Key'),
            'Open Terminal',
            'Dismiss'
        );
    });

    it('shows a message containing "Pro Plan" when switching to Pro mode', async () => {
        await new TerminalManager().showLoginReminder('pro');

        expect(window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringContaining('Pro Plan'),
            'Open Terminal',
            'Dismiss'
        );
    });

    it('opens a Claude Code terminal when the user clicks "Open Terminal"', async () => {
        (window.showInformationMessage as jest.Mock).mockResolvedValueOnce('Open Terminal');

        await new TerminalManager().showLoginReminder('api');

        expect(window.createTerminal).toHaveBeenCalledWith({ name: 'Claude Code' });
    });

    it('does not open a terminal when the user clicks Dismiss', async () => {
        (window.showInformationMessage as jest.Mock).mockResolvedValueOnce('Dismiss');

        await new TerminalManager().showLoginReminder('api');

        expect(window.createTerminal).not.toHaveBeenCalled();
    });

    it('does not open a terminal when the notification is closed without a choice', async () => {
        (window.showInformationMessage as jest.Mock).mockResolvedValueOnce(undefined);

        await new TerminalManager().showLoginReminder('pro');

        expect(window.createTerminal).not.toHaveBeenCalled();
    });
});

// ── openClaudeTerminal ────────────────────────────────────────────────────────

describe('openClaudeTerminal', () => {
    it('creates a terminal named "Claude Code"', () => {
        new TerminalManager().openClaudeTerminal();

        expect(window.createTerminal).toHaveBeenCalledWith({ name: 'Claude Code' });
    });

    it('shows the new terminal', () => {
        const terminal = new TerminalManager().openClaudeTerminal();
        expect(terminal.show).toHaveBeenCalled();
    });

    it('returns the created terminal', () => {
        const terminal = new TerminalManager().openClaudeTerminal();
        expect(terminal).toBeDefined();
        expect(terminal.name).toBe('Claude Code');
    });
});
