/**
 * Network translation loader tests.
 *
 * Coverage:
 *   - URL pattern substitutes `{lang}` correctly (with encoding for unusual tags).
 *   - JSON parsing returns the bundle on 200.
 *   - 404 / network failure resolves to undefined (NEVER throws — i18n
 *     missing must not break playback).
 *   - Custom parser hook works.
 *   - End-to-end: wires into `DefaultTranslator.setLanguage` so the
 *     full BCP-47 chain comes back over the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNetworkTranslationLoader } from '../translation-loader';
import { DefaultTranslator } from '../translator';

describe('createNetworkTranslationLoader', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = vi.fn() as any;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const mockResponse = (status: number, body: unknown): Response => ({
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? 'OK' : 'Not Found',
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
		headers: new Headers(),
		url: '',
		redirected: false,
		type: 'basic',
		clone() { return this as Response; },
		body: null,
		bodyUsed: false,
		arrayBuffer: async () => new ArrayBuffer(0),
		blob: async () => new Blob(),
		formData: async () => new FormData(),
		json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
		bytes: async () => new Uint8Array(),
	} as unknown as Response);

	const fetchedUrl = (mock: any): string => {
		const req = mock.mock.calls[0]?.[0];
		return typeof req === 'string' ? req : (req as Request).url;
	};

	it('substitutes {lang} into the URL pattern', async () => {
		(globalThis.fetch as any).mockResolvedValue(mockResponse(200, { hello: 'world' }));
		const load = createNetworkTranslationLoader({ url: 'https://cdn.example/i18n/{lang}.json' });
		const result = await load('pt-BR');
		expect(fetchedUrl(globalThis.fetch)).toBe('https://cdn.example/i18n/pt-BR.json');
		expect(result).toEqual({ hello: 'world' });
	});

	it('encodes unusual language tags safely', async () => {
		(globalThis.fetch as any).mockResolvedValue(mockResponse(200, {}));
		const load = createNetworkTranslationLoader({ url: 'https://cdn.example/i18n/{lang}.json' });
		await load('zh-Hant-TW');
		expect(fetchedUrl(globalThis.fetch)).toBe('https://cdn.example/i18n/zh-Hant-TW.json');
	});

	it('returns undefined on a 404 (regional variant the CDN does not ship)', async () => {
		(globalThis.fetch as any).mockResolvedValue(mockResponse(404, 'Not Found'));
		const load = createNetworkTranslationLoader({ url: 'https://cdn.example/i18n/{lang}.json' });
		const result = await load('xx-YY');
		expect(result).toBeUndefined();
	});

	it('returns undefined on a network error (never throws)', async () => {
		(globalThis.fetch as any).mockRejectedValue(new Error('socket hangup'));
		const load = createNetworkTranslationLoader({ url: 'https://cdn.example/i18n/{lang}.json' });
		const result = await load('pt-BR');
		expect(result).toBeUndefined();
	});

	it('returns undefined when the response is not an object (defensive)', async () => {
		(globalThis.fetch as any).mockResolvedValue(mockResponse(200, ['a', 'b']));
		const load = createNetworkTranslationLoader({ url: 'https://cdn.example/i18n/{lang}.json' });
		const result = await load('en');
		expect(result).toBeUndefined();
	});

	it('uses the custom parser when supplied', async () => {
		(globalThis.fetch as any).mockResolvedValue(mockResponse(200, { wrapped: { hello: 'world' } }));
		const load = createNetworkTranslationLoader({
			url: 'https://cdn.example/i18n/{lang}.json',
			parser: raw => (JSON.parse(raw) as { wrapped: Record<string, string> }).wrapped,
		});
		const result = await load('en');
		expect(result).toEqual({ hello: 'world' });
	});

	it('integrates with DefaultTranslator.setLanguage walking the BCP-47 chain', async () => {
		const responses: Record<string, Record<string, string>> = {
			'pt-BR': { regional: 'br' },
			'pt': { greeting: 'Olá' },
		};
		(globalThis.fetch as any).mockImplementation(async (req: Request | string) => {
			const url = typeof req === 'string' ? req : req.url;
			const tag = url.match(/i18n\/(.+)\.json/u)?.[1];
			if (tag && responses[tag])
				return mockResponse(200, responses[tag]);
			return mockResponse(404, 'Not Found');
		});

		const t = new DefaultTranslator({
			language: 'en',
			translations: { en: {} },
			loadTranslations: createNetworkTranslationLoader({ url: 'https://cdn.example/i18n/{lang}.json' }),
		});
		await t.language('pt-BR');

		expect(t.t('regional')).toBe('br');
		expect(t.t('greeting')).toBe('Olá');
	});
});
