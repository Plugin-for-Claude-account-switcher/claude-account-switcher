import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import type { Mode } from './switcher';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface StreamChunk {
    type: 'delta' | 'done' | 'error';
    text?: string;
    error?: string;
}

type Credentials = { apiKey?: string; sessionToken?: string };

export class ApiClient {
    private anthropic: Anthropic | null = null;
    private cachedApiKey: string | null = null;

    constructor(
        private readonly getMode: () => Mode,
        private readonly getCredentials: () => Promise<Credentials>
    ) {}

    async sendMessage(
        messages: Message[],
        onChunk: (chunk: StreamChunk) => void
    ): Promise<void> {
        const mode = this.getMode();
        const creds = await this.getCredentials();

        if (mode === 'api') {
            if (!creds.apiKey) {
                throw new Error(
                    'No API key configured. Run "Claude: Configure" to add your Anthropic API key.'
                );
            }
            await this.sendViaApi(creds.apiKey, messages, onChunk);
        } else {
            if (!creds.sessionToken) {
                throw new Error(
                    'No session token configured. Run "Claude: Configure" to add your Claude.ai session token.'
                );
            }
            await this.sendViaPro(creds.sessionToken, messages, onChunk);
        }
    }

    // ── API key mode ──────────────────────────────────────────────────────────

    private async sendViaApi(
        apiKey: string,
        messages: Message[],
        onChunk: (chunk: StreamChunk) => void
    ): Promise<void> {
        if (this.cachedApiKey !== apiKey || !this.anthropic) {
            this.anthropic = new Anthropic({ apiKey });
            this.cachedApiKey = apiKey;
        }

        const cfg = vscode.workspace.getConfiguration('claudeSwitcher');
        const model = cfg.get<string>('model', 'claude-sonnet-4-6');
        const maxTokens = cfg.get<number>('maxTokens', 4096);

        const stream = this.anthropic.messages.stream({
            model,
            max_tokens: maxTokens,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        for await (const event of stream) {
            if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
            ) {
                onChunk({ type: 'delta', text: event.delta.text });
            }
        }

        onChunk({ type: 'done' });
    }

    // ── Pro (session token) mode ──────────────────────────────────────────────

    private async sendViaPro(
        sessionToken: string,
        messages: Message[],
        onChunk: (chunk: StreamChunk) => void
    ): Promise<void> {
        const headers = {
            Cookie: `sessionKey=${sessionToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        };

        // 1 — resolve organisation
        const orgRes = await fetch('https://claude.ai/api/organizations', { headers });
        if (!orgRes.ok) {
            throw new Error(
                `Claude.ai authentication failed (${orgRes.status}). ` +
                    'Check your session token is current — it expires when you log out.'
            );
        }
        const orgs = (await orgRes.json()) as Array<{ uuid: string }>;
        if (!orgs.length) {
            throw new Error('No Claude.ai organisation found for this account.');
        }
        const orgId = orgs[0].uuid;

        // 2 — create a new conversation
        const convId = randomUUID();
        const convRes = await fetch(
            `https://claude.ai/api/organizations/${orgId}/chat_conversations`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({ name: '', uuid: convId }),
            }
        );
        if (!convRes.ok) {
            throw new Error(`Failed to create Claude.ai conversation (${convRes.status}).`);
        }
        const conv = (await convRes.json()) as { uuid: string };

        // 3 — send the last user message and stream the response
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        if (!lastUser) {
            onChunk({ type: 'done' });
            return;
        }

        const completionRes = await fetch(
            `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conv.uuid}/completion`,
            {
                method: 'POST',
                headers: { ...headers, Accept: 'text/event-stream' },
                body: JSON.stringify({
                    prompt: lastUser.content,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    model: null,   // use account's Pro model
                    attachments: [],
                    files: [],
                }),
            }
        );

        if (!completionRes.ok) {
            throw new Error(
                `Claude.ai completion failed (${completionRes.status} ${completionRes.statusText}).`
            );
        }

        if (!completionRes.body) {
            throw new Error('Claude.ai returned an empty response body.');
        }

        // 4 — read SSE stream
        const reader = completionRes.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) {
                    continue;
                }
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') {
                    onChunk({ type: 'done' });
                    return;
                }
                try {
                    const parsed: { type?: string; completion?: string; error?: { message?: string } } =
                        JSON.parse(raw);
                    if (parsed.type === 'completion' && parsed.completion) {
                        onChunk({ type: 'delta', text: parsed.completion });
                    } else if (parsed.type === 'error') {
                        onChunk({ type: 'error', error: parsed.error?.message ?? 'Unknown error from Claude.ai' });
                        return;
                    }
                } catch {
                    // skip malformed lines
                }
            }
        }

        onChunk({ type: 'done' });
    }
}

// UUID helper — crypto.randomUUID is available in Node 14.17+ and browsers
function randomUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older Node versions
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
