interface Env {
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const maxStateAgeMs = 10 * 60 * 1000;

function fromBase64Url(value: string) {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyState(state: string | null, origin: string, secret: string) {
	if (!state) return false;
	const [encodedPayload, encodedSignature, extra] = state.split('.');
	if (!encodedPayload || !encodedSignature || extra) return false;

	try {
		const payload = fromBase64Url(encodedPayload);
		const signature = fromBase64Url(encodedSignature);
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify'],
		);
		const valid = await crypto.subtle.verify('HMAC', key, signature, payload);
		if (!valid) return false;
		const parsed = JSON.parse(decoder.decode(payload)) as { origin?: string; issuedAt?: number };
		return parsed.origin === origin && typeof parsed.issuedAt === 'number' && Date.now() - parsed.issuedAt < maxStateAgeMs;
	} catch {
		return false;
	}
}

function callbackPage(status: 'success' | 'error', payload: Record<string, string>) {
	const message = `authorization:github:${status}:${JSON.stringify(payload)}`.replaceAll('<', '\\u003c');
	return new Response(
		`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>正在登录</title></head><body><p>正在返回博客后台...</p><script>window.addEventListener('message', function receiveMessage() { window.opener.postMessage(${JSON.stringify(message)}, window.location.origin); window.removeEventListener('message', receiveMessage); }); window.opener.postMessage('authorizing:github', window.location.origin);</script></body></html>`,
		{ headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } },
	);
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const stateValid = await verifyState(url.searchParams.get('state'), url.origin, env.GITHUB_CLIENT_SECRET);
	if (!code || !stateValid) return callbackPage('error', { error: '登录请求已失效，请关闭窗口后重新登录。' });

	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: `${url.origin}/api/callback`,
		}),
	});
	const result = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
	if (!tokenResponse.ok || !result.access_token) {
		return callbackPage('error', { error: result.error_description || 'GitHub 没有返回登录凭据。' });
	}

	return callbackPage('success', { token: result.access_token });
};
