/**
 * Don QR Code — Cloudflare Worker
 *
 * Responsabilidades:
 *  - POST /api/token : proxy de troca do code OAuth pelo access_token.
 *                      Necessário porque github.com/login/oauth/access_token
 *                      não suporta CORS e exige client_secret.
 *  - GET  /api/health: checagem simples.
 *
 * Secrets (definidos via `wrangler secret put`):
 *  - GITHUB_CLIENT_ID     (público, mas prático ter aqui)
 *  - GITHUB_CLIENT_SECRET (sigiloso — nunca no código/git)
 *  - ALLOWED_USERNAME     (allowlist server-side, defense in depth)
 *
 * Fase 6 adicionará: GET /r/:id (redirect/410) e GET /stats.
 */

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_USERNAME: string;
  ALLOWED_ORIGINS: string;
  QR_ANALYTICS: KVNamespace;
}

const ALLOWED_METHODS = "POST, GET, OPTIONS";

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, init: ResponseInit & { cors?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...init.cors,
  };
  return new Response(JSON.stringify(body), { ...init, headers, status: init.status ?? 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    const cors = corsHeaders(origin, allowed);

    // Rota: health
    if (url.pathname === "/api/health") {
      return json({ ok: true, name: "don-qr" }, { cors });
    }

    // Rota: troca de code OAuth por token
    if (url.pathname === "/api/token" && request.method === "POST") {
      return handleTokenExchange(request, env, cors);
    }

    return json({ error: "not_found", message: "Rota inexistente." }, { status: 404, cors });
  },
};

async function handleTokenExchange(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  // Rejeita origem não permitida (CSRF / abuso).
  const ao = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  if (!allowed.includes(ao)) {
    return json({ error: "forbidden_origin" }, { status: 403, cors });
  }

  let body: { code?: string; code_verifier?: string; redirect_uri?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, { status: 400, cors });
  }

  const { code, code_verifier, redirect_uri } = body;
  if (!code || !code_verifier || !redirect_uri) {
    return json(
      { error: "missing_params", message: "code, code_verifier e redirect_uri são obrigatórios." },
      { status: 400, cors },
    );
  }

  // Troca o code pelo token no GitHub, incluindo o client_secret (sigiloso).
  const ghRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier,
      redirect_uri,
    }),
  });

  const ghBody = (await ghRes.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!ghRes.ok || !ghBody.access_token) {
    return json(
      {
        error: ghBody.error || "exchange_failed",
        message: ghBody.error_description || "Falha na troca do token.",
      },
      { status: 400, cors },
    );
  }

  // Defense in depth: busca o /user e restringe ao username allowlist.
  let allowedUsername = false;
  try {
    const u = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${ghBody.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "don-qr-worker",
      },
    });
    if (u.ok) {
      const ud = (await u.json()) as { login?: string };
      allowedUsername =
        !!ud.login &&
        ud.login.toLowerCase() === String(env.ALLOWED_USERNAME).toLowerCase();
    }
  } catch {
    // ignora; o cliente fará a checagem novamente.
  }

  if (!allowedUsername) {
    return json(
      { error: "unauthorized_user", message: "Este usuário não tem acesso." },
      { status: 403, cors },
    );
  }

  return json({ access_token: ghBody.access_token, scope: ghBody.scope }, { cors });
}
