// src/lib/notifications/email.ts
// Resend delivery shared by every email sender: rate limiting, one retry on 429/5xx,
// idempotency keys and one-click unsubscribe headers. Never throws.
import { Resend } from 'resend';
import { sleep } from './runtime';

const FROM = 'Pick 5 <noreply@sportspick5.com>';

// Resend's default limit is 2 requests/second per team. Override with RESEND_MAX_PER_SECOND
// if the account has a higher limit.
const maxPerSecond = Math.max(1, Number(process.env.RESEND_MAX_PER_SECOND) || 2);
const MIN_INTERVAL_MS = Math.ceil(1000 / maxPerSecond) + 50;

// Created lazily: the Resend constructor throws without an API key, which would
// break `next build` page-data collection when secrets only exist at runtime.
let resendClient: Resend | null = null;
const getResend = () => (resendClient ??= new Resend(process.env.RESEND_API_KEY));

let lastSendAt = 0;

async function throttle(): Promise<void> {
	const wait = lastSendAt + MIN_INTERVAL_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastSendAt = Date.now();
}

function emailBaseUrl(): string {
	// Same base the templates use for their links.
	return (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.sportspick5.com').replace(/\/$/, '');
}

export interface SendEmailInput {
	to: string;
	subject: string;
	html: string;
	/** Resend dedupes sends with the same key for 24 hours. Use the dedupe marker key. */
	idempotencyKey?: string;
	/** Adds List-Unsubscribe headers (RFC 8058 one-click) pointing at /api/unsubscribe/<token>. */
	unsubscribeToken?: string;
}

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string; retryable: boolean };

export function isEmailConfigured(): boolean {
	return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
	if (!isEmailConfigured()) return { ok: false, error: 'RESEND_API_KEY is not set', retryable: false };

	const headers: Record<string, string> = {};
	if (input.unsubscribeToken) {
		headers['List-Unsubscribe'] = `<${emailBaseUrl()}/api/unsubscribe/${input.unsubscribeToken}>`;
		headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
	}

	for (let attempt = 1; attempt <= 2; attempt++) {
		await throttle();
		try {
			const { data, error } = await getResend().emails.send(
				{ from: FROM, to: input.to, subject: input.subject, html: input.html, headers },
				input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
			);
			if (!error) return { ok: true, id: data?.id };

			const status = error.statusCode ?? 0;
			const retryable = status === 429 || status >= 500 || status === 0;
			if (retryable && attempt === 1) {
				await sleep(status === 429 ? 1500 : 500);
				continue;
			}
			return { ok: false, error: `${error.name}: ${error.message}`, retryable };
		} catch (err) {
			if (attempt === 1) {
				await sleep(500);
				continue;
			}
			return { ok: false, error: err instanceof Error ? err.message : String(err), retryable: true };
		}
	}
	return { ok: false, error: 'unreachable', retryable: true };
}
