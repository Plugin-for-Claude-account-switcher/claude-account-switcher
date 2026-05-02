/**
 * Minimal VS Code API mock.
 *
 * Every test file imports { resetVscode } from this module and calls it in
 * beforeEach() to wipe accumulated state between tests.  The mock is wired
 * up automatically via jest.config.js → moduleNameMapper.
 */

// ── Config state ─────────────────────────────────────────────────────────────

type Bag = Record<string, unknown>;
const bags: Record<string, Bag> = {};
// Cache one config instance per namespace so callers always get the same stubs.
let cfgInstances: Record<string, { get: jest.Mock; update: jest.Mock }> = {};

function makeCfgInstance(ns: string) {
    return {
        get: jest.fn((key: string, def?: unknown) => bags[ns]?.[key] ?? def),
        update: jest.fn((key: string, val: unknown) => {
            if (!bags[ns]) bags[ns] = {};
            bags[ns][key] = val;
            return Promise.resolve();
        }),
    };
}

/** Seed a config value before the code under test runs. */
export function setConfig(ns: string, key: string, val: unknown): void {
    if (!bags[ns]) bags[ns] = {};
    bags[ns][key] = val;
}

/** Read what ended up in the bag after update() was called. */
export function readConfig(ns: string, key: string): unknown {
    return bags[ns]?.[key];
}

// ── Terminal state ────────────────────────────────────────────────────────────

export type MockTerminal = {
    name: string;
    sendText: jest.Mock;
    show: jest.Mock;
    dispose: jest.Mock;
};

let terminalList: MockTerminal[] = [];
let activeTerminalVal: MockTerminal | undefined;

/** Add a terminal to the simulated terminal list and return it. */
export function addTerminal(name: string): MockTerminal {
    const t: MockTerminal = {
        name,
        sendText: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    };
    terminalList.push(t);
    return t;
}

export function setActiveTerminal(t: MockTerminal | undefined): void {
    activeTerminalVal = t;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export function resetVscode(): void {
    Object.keys(bags).forEach(k => delete bags[k]);
    cfgInstances = {};
    terminalList = [];
    activeTerminalVal = undefined;
}

// ── VS Code API ───────────────────────────────────────────────────────────────

export const workspace = {
    getConfiguration: jest.fn((ns: string) => {
        if (!cfgInstances[ns]) {
            cfgInstances[ns] = makeCfgInstance(ns);
        }
        return cfgInstances[ns];
    }),
};

export const window = {
    get terminals(): MockTerminal[] { return terminalList; },
    get activeTerminal(): MockTerminal | undefined { return activeTerminalVal; },
    createTerminal: jest.fn((opts: { name?: string }) => {
        const t: MockTerminal = {
            name: opts?.name ?? 'terminal',
            sendText: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn(),
        };
        terminalList.push(t);
        return t;
    }),
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    setStatusBarMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    createStatusBarItem: jest.fn().mockReturnValue({
        text: '',
        tooltip: '',
        backgroundColor: undefined,
        command: '',
        show: jest.fn(),
        dispose: jest.fn(),
    }),
};

export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };

export class ThemeColor {
    constructor(public readonly id: string) {}
}

export class EventEmitter<T> {
    private _listeners: ((e: T) => unknown)[] = [];
    readonly event = (l: (e: T) => unknown) => {
        this._listeners.push(l);
        return { dispose: () => { this._listeners = this._listeners.filter(x => x !== l); } };
    };
    fire(e: T): void { this._listeners.forEach(l => l(e)); }
    dispose(): void { this._listeners = []; }
}

export const StatusBarAlignment = { Left: 1, Right: 2 };

export const Uri = { joinPath: jest.fn() };
