// Google OAuth2 Proxy Worker — 為 dress-up-doll PWA 提供 OAuth2 code exchange 與 token refresh
// Secret (via wrangler secret put): GOOGLE_CLIENT_SECRET

const CLIENT_ID = '1072091993433-7j096q60fvp6o68micf5hupocvtat2g6.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file email';
const ALLOWED_ORIGINS = ['https://misikyg.github.io', 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'];

interface WorkerEnv {
	GOOGLE_CLIENT_SECRET: string;
}

// ── helpers ──

function isAllowedOrigin(origin: string): boolean {
	return ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + '/'));
}

function corsHeaders(origin: string): Record<string, string> {
	if (!isAllowedOrigin(origin)) return {};
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
	});
}

// 安全嵌入 JSON 至 HTML <script>
function safeJsonForHtml(data: unknown): string {
	return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

// ── route handlers ──

function handleLogin(url: URL): Response {
	const pwaOrigin = url.searchParams.get('pwa_origin') || '';
	const redirectUri = `${url.origin}/auth/callback`;

	const state = JSON.stringify({ pwa_origin: pwaOrigin });

	const params = new URLSearchParams({
		client_id: CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: SCOPE,
		access_type: 'offline',
		prompt: 'consent',
		state,
	});

	return Response.redirect(
		`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
		302,
	);
}

async function handleCallback(url: URL, env: WorkerEnv): Promise<Response> {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const stateStr = url.searchParams.get('state') || '{}';

	let stateObj: Record<string, string> = {};
	try {
		stateObj = JSON.parse(stateStr);
	} catch {
		/* ignore */
	}
	const pwaOrigin = stateObj.pwa_origin || '*';

	if (error || !code) {
		return callbackHtml(
			{ error: error || 'no_code', error_description: 'google_callback_error' },
			pwaOrigin,
		);
	}

	if (!env.GOOGLE_CLIENT_SECRET) {
		return callbackHtml(
			{ error: 'server_config_error', error_description: 'GOOGLE_CLIENT_SECRET 未設定，請執行 wrangler secret put GOOGLE_CLIENT_SECRET' },
			pwaOrigin,
		);
	}

	const redirectUri = `${url.origin}/auth/callback`;

	const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code',
		}),
	});

	const tokenData: any = await tokenResp.json();

	if (!tokenResp.ok || !tokenData.access_token) {
		return callbackHtml(
			{
				error: tokenData.error || 'token_exchange_failed',
				error_description: tokenData.error_description || `HTTP ${tokenResp.status}`,
				debug_redirect_uri: redirectUri,
			},
			pwaOrigin,
		);
	}

	let email = '';
	try {
		const userResp = await fetch(
			'https://www.googleapis.com/oauth2/v3/userinfo',
			{ headers: { Authorization: `Bearer ${tokenData.access_token}` } },
		);
		if (userResp.ok) {
			const userData: any = await userResp.json();
			email = userData.email || '';
		}
	} catch {
		/* ignore */
	}

	return callbackHtml(
		{
			access_token: tokenData.access_token,
			refresh_token: tokenData.refresh_token,
			expires_in: tokenData.expires_in,
			email,
		},
		pwaOrigin,
	);
}

function callbackHtml(payload: Record<string, unknown>, targetOrigin: string): Response {
	const safePayload = safeJsonForHtml(payload);
	const safeOrigin = safeJsonForHtml(targetOrigin);

	const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>登入中…</title></head>
<body>
<p>處理中，視窗即將關閉…</p>
<script>
(function(){
  var msg = { type: "GOOGLE_AUTH_CALLBACK", payload: ${safePayload} };
  var origin = ${safeOrigin};
  if (window.opener) {
		try {
			window.opener.postMessage(msg, origin);
		} catch (e) {
			window.opener.postMessage(msg, "*");
		}
    window.close();
  } else {
    document.body.innerText = "登入完成，請回到應用程式。";
  }
})();
</script>
</body></html>`;

	return new Response(html, {
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

async function handleRefresh(
	request: Request,
	env: WorkerEnv,
	origin: string,
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: 'invalid_json' }, 400, origin);
	}

	const { refresh_token } = body;
	if (!refresh_token) {
		return jsonResponse({ error: 'missing_refresh_token' }, 400, origin);
	}

	const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			refresh_token,
			grant_type: 'refresh_token',
		}),
	});

	const tokenData = await tokenResp.json();
	return jsonResponse(tokenData, tokenResp.status, origin);
}

async function handleRevoke(
	request: Request,
	env: WorkerEnv,
	origin: string,
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: 'invalid_json' }, 400, origin);
	}

	const { token } = body;
	if (!token) {
		return jsonResponse({ error: 'missing_token' }, 400, origin);
	}

	const revokeResp = await fetch(
		`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		},
	);

	return jsonResponse({ ok: revokeResp.ok }, revokeResp.ok ? 200 : 502, origin);
}

// ── main handler ──

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin') || '';

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders(origin) });
		}

		switch (url.pathname) {
			case '/auth/login':
				return handleLogin(url);
			case '/auth/callback':
				return handleCallback(url, env as unknown as WorkerEnv);
			case '/auth/refresh':
				return handleRefresh(request, env as unknown as WorkerEnv, origin);
			case '/auth/revoke':
				return handleRevoke(request, env as unknown as WorkerEnv, origin);
			case '/auth/debug':
				return jsonResponse({
					client_id: CLIENT_ID,
					secret_set: !!(env as unknown as WorkerEnv).GOOGLE_CLIENT_SECRET,
					secret_length: ((env as unknown as WorkerEnv).GOOGLE_CLIENT_SECRET || '').length,
					redirect_uri: `${url.origin}/auth/callback`,
				}, 200, origin || '*');
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
