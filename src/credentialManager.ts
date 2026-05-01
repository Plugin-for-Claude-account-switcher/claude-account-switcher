import * as vscode from 'vscode';

const KEYS = {
    API_KEY: 'claudeSwitcher.apiKey',
    SESSION_TOKEN: 'claudeSwitcher.sessionToken',
} as const;

export class CredentialManager {
    constructor(private readonly secrets: vscode.SecretStorage) {}

    getApiKey(): Promise<string | undefined> {
        return Promise.resolve(this.secrets.get(KEYS.API_KEY));
    }

    setApiKey(key: string): Promise<void> {
        return Promise.resolve(this.secrets.store(KEYS.API_KEY, key));
    }

    getSessionToken(): Promise<string | undefined> {
        return Promise.resolve(this.secrets.get(KEYS.SESSION_TOKEN));
    }

    setSessionToken(token: string): Promise<void> {
        return Promise.resolve(this.secrets.store(KEYS.SESSION_TOKEN, token));
    }

    async clearAll(): Promise<void> {
        await this.secrets.delete(KEYS.API_KEY);
        await this.secrets.delete(KEYS.SESSION_TOKEN);
    }
}
