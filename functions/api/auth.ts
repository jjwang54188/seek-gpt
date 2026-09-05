interface Env {
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
}

const encoder = new TextEncoder();
const trustedSiteHosts = new Set(['785000.xyz', 'seek-gpt.pages.dev']);

function toBase64Url(bytes: Uint8Array) {
	let value = '';
	for (const byte of bytes) value += String.fromCharCode(byte);
	return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function createState(backendOrigin: string, siteOrigin: string, secret: string) {
	const payload = JSON.stringify({ backendOrigin, siteOrigin, issuedAt: Date.now() });
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(new Uint8Array(signature))}`;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		return new Response('博客后台尚未完成登录配置。', { status: 503 });
	}

	const url = new URL(request.url);
	const siteHost = url.searchParams.get('site_id');
	const siteOrigin = siteHost && trustedSiteHosts.has(siteHost) ? `https://${siteHost}` : url.origin;
	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
	authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
	authorizeUrl.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
	authorizeUrl.searchParams.set('scope', 'public_repo');
	authorizeUrl.searchParams.set('state', await createState(url.origin, siteOrigin, env.GITHUB_CLIENT_SECRET));

	return Response.redirect(authorizeUrl, 302);
};
