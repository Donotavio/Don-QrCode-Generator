/**
 * Don QR Code — Cloudflare Worker
 *
 * Endpoints:
 *  POST /api/token              proxy OAuth (client_secret seguro)
 *  GET  /api/health             healthcheck
 *  GET  /api/meta               lê meta (kdf_salt, kdf_verifier, ...)
 *  PUT  /api/meta               upsert de meta (body: {key, value})
 *  GET  /api/qrcodes            lista QR codes (não deletados)
 *  GET  /api/qrcodes/:id        QR code único
 *  POST /api/qrcodes            cria QR code
 *  PUT  /api/qrcodes/:id        atualiza QR code
 *  DELETE /api/qrcodes/:id      soft delete
 *
 * Secrets: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ALLOWED_USERNAME
 * Bindings: DB (D1), QR_ANALYTICS (KV — cache de auth + analytics futuras)
 */

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_USERNAME: string;
  ALLOWED_ORIGINS: string;
  DB: D1Database;
  QR_ANALYTICS: KVNamespace;
}

// ---------- helpers ----------

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  body: unknown,
  init: ResponseInit & { cors?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...init.cors,
  };
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
    status: init.status ?? 200,
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ID_RE = /^[a-z0-9]{4,16}$/i;

/** Valida o Bearer token no GitHub (com cache KV de 5 min) e checa allowlist. */
async function authenticate(
  request: Request,
  env: Env,
): Promise<string | null> {
  const auth = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return null;
  const token = m[1];

  const cacheKey = `auth:${await sha256Hex(token)}`;
  const cached = await env.QR_ANALYTICS.get(cacheKey);
  if (cached !== null) {
    return cached.toLowerCase() === env.ALLOWED_USERNAME.toLowerCase()
      ? cached
      : null;
  }

  try {
    const r = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "don-qr-worker",
      },
    });
    if (!r.ok) return null;
    const u = (await r.json()) as { login?: string };
    const login = u.login || "";
    // cacheia resultado (válido ou não) por 5 min
    await env.QR_ANALYTICS.put(cacheKey, login, { expirationTtl: 300 });
    return login.toLowerCase() === env.ALLOWED_USERNAME.toLowerCase()
      ? login
      : null;
  } catch {
    return null;
  }
}

// ---------- QR row mapping ----------

interface QRRow {
  id: string;
  type: string;
  kind: string;
  title: string;
  tags: string;
  payload: string;
  styling: string;
  password_hash: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface QRDTO {
  id: string;
  type: "static" | "dynamic";
  kind: string;
  title: string;
  tags: string[];
  payload: string; // ciphertext iv:ct
  styling: Record<string, unknown>;
  passwordHash: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function rowToDTO(r: QRRow): QRDTO {
  return {
    id: r.id,
    type: r.type as "static" | "dynamic",
    kind: r.kind,
    title: r.title,
    tags: safeParse(r.tags, []),
    payload: r.payload,
    styling: safeParse(r.styling, {}),
    passwordHash: r.password_hash,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ---------- router ----------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(
        { error: "internal", message: msg },
        { status: 500 },
      );
    }
  },
};

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  const cors = corsHeaders(origin, allowed);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const path = url.pathname;

  // Públicos
  if (path === "/api/health") return json({ ok: true, name: "don-qr" }, { cors });
  if (path === "/api/token" && request.method === "POST") {
    return handleTokenExchange(request, env, cors);
  }

  // Redirect público: /r/:id (quem escaneia o QR dinâmico cai aqui)
  const redirectMatch = /^\/r\/([a-z0-9]{4,16})$/i.exec(path);
  if (redirectMatch && request.method === "GET") {
    return handleRedirect(redirectMatch[1], env, request);
  }

  // Autenticados
  const user = await authenticate(request, env);
  if (!user) {
    return json(
      { error: "unauthorized", message: "Token ausente, inválido ou usuário não autorizado." },
      { status: 401, cors },
    );
  }

  // Meta
  if (path === "/api/meta" && request.method === "GET") {
    return handleGetMeta(env, cors);
  }
  if (path === "/api/meta" && request.method === "PUT") {
    return handlePutMeta(request, env, cors);
  }

    // QR codes
    const qrMatch = /^\/api\/qrcodes\/([^/]+)$/.exec(path);
    if (path === "/api/qrcodes" && request.method === "GET") {
      return handleListQRCodes(env, cors);
    }
    if (path === "/api/qrcodes" && request.method === "POST") {
      return handleCreateQRCode(request, env, cors);
    }
    if (qrMatch && request.method === "GET") {
      return handleGetQRCode(qrMatch[1], env, cors);
    }
    if (qrMatch && request.method === "PUT") {
      return handleUpdateQRCode(qrMatch[1], request, env, cors);
    }
    if (qrMatch && request.method === "DELETE") {
      return handleDeleteQRCode(qrMatch[1], env, cors);
    }

    // Analytics de scans (autenticado)
    const statsMatch = /^\/api\/stats\/([a-z0-9]{4,16})$/i.exec(path);
    if (statsMatch && request.method === "GET") {
      return handleStats(statsMatch[1], env, cors);
    }

  return json({ error: "not_found", message: "Rota inexistente." }, { status: 404, cors });
}

// ---------- redirect público (/r/:id) ----------

async function handleRedirect(
  id: string,
  env: Env,
  request: Request,
): Promise<Response> {
  if (!ID_RE.test(id)) return htmlStatus(404, "QR code não encontrado");

  const row = await env.DB.prepare("SELECT * FROM qrcodes WHERE id = ?")
    .bind(id)
    .first<QRRow>();

  if (!row || row.type !== "dynamic") {
    return htmlStatus(404, "QR code não encontrado");
  }
  if (row.deleted_at) {
    return htmlStatus(410, "Este QR code foi excluído", "O dono desativou este link.");
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return htmlStatus(410, "Este QR code expirou", "O prazo de validade acabou.");
  }

  // Registra o scan (best-effort; falha não quebram o redirect).
  await logScan(env, id, request).catch(() => {});

  const target = row.payload;
  if (/^https?:\/\//i.test(target)) {
    return new Response(null, {
      status: 302,
      headers: { Location: target, "Cache-Control": "no-store" },
    });
  }
  // destino não-URL (raros em dinâmico): mostra landing com o conteúdo
  return htmlLanding(target);
}

interface ScanEvent {
  ts: string;
  ua: string;
  country: string | null;
}

async function logScan(env: Env, id: string, request: Request): Promise<void> {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  // total
  const totalKey = `scans:${id}:total`;
  const prevTotal = parseInt((await env.QR_ANALYTICS.get(totalKey)) || "0", 10);
  await env.QR_ANALYTICS.put(totalKey, String(prevTotal + 1));

  // diário (expira em 90 dias)
  const dayKey = `scans:${id}:day:${day}`;
  const prevDay = parseInt((await env.QR_ANALYTICS.get(dayKey)) || "0", 10);
  await env.QR_ANALYTICS.put(dayKey, String(prevDay + 1), {
    expirationTtl: 60 * 60 * 24 * 90,
  });

  // últimos 100 eventos
  const recentKey = `scans:${id}:recent`;
  const recentRaw = await env.QR_ANALYTICS.get(recentKey);
  let recent: ScanEvent[] = [];
  try {
    recent = recentRaw ? (JSON.parse(recentRaw) as ScanEvent[]) : [];
  } catch {
    recent = [];
  }
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  recent.unshift({
    ts: now.toISOString(),
    ua: (request.headers.get("user-agent") || "").slice(0, 200),
    country: cf?.country ?? null,
  });
  await env.QR_ANALYTICS.put(recentKey, JSON.stringify(recent.slice(0, 100)));
}

async function handleStats(
  id: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!ID_RE.test(id)) return json({ error: "invalid_id" }, { status: 400, cors });
  const [totalRaw, recentRaw] = await Promise.all([
    env.QR_ANALYTICS.get(`scans:${id}:total`),
    env.QR_ANALYTICS.get(`scans:${id}:recent`),
  ]);
  const recent: ScanEvent[] = recentRaw ? safeParse(recentRaw, []) : [];
  return json(
    {
      total: parseInt(totalRaw || "0", 10),
      recent,
      lastScan: recent[0]?.ts ?? null,
    },
    { cors },
  );
}

// ---------- páginas HTML (redirect inativo/não encontrado) ----------

function htmlStatus(
  status: number,
  title: string,
  subtitle?: string,
): Response {
  return new Response(renderHtml(title, subtitle ?? ""), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function htmlLanding(content: string): Response {
  return new Response(renderLanding(content), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderHtml(title: string, subtitle: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,sans-serif;padding:1.5rem;text-align:center;
       background:#0f172a;color:#e2e8f0}
  .card{max-width:420px}
  .icon{width:64px;height:64px;margin:0 auto 1rem;border-radius:16px;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:32px}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  p{color:#94a3b8;margin:0}
</style></head>
<body><div class="card">
  <div class="icon">⚠️</div>
  <h1>${title}</h1>
  ${subtitle ? `<p>${subtitle}</p>` : ""}
</div></body></html>`;
}

function renderLanding(content: string): string {
  const safe = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conteúdo do QR</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,sans-serif;padding:1.5rem;text-align:center;
       background:#0f172a;color:#e2e8f0}
  pre{white-space:pre-wrap;word-break:break-all;background:#1e293b;padding:1rem;border-radius:8px}
</style></head><body><main style="max-width:480px">
  <h1>Conteúdo</h1>
  <pre>${safe}</pre>
</main></body></html>`;
}

// ---------- token exchange ----------

async function handleTokenExchange(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
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

  const ghRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
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
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!ghRes.ok || !ghBody.access_token) {
    return json(
      { error: ghBody.error || "exchange_failed", message: ghBody.error_description || "Falha na troca do token." },
      { status: 400, cors },
    );
  }

  // Defense in depth: valida username no exchange.
  let allowedUser = false;
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
      allowedUser =
        !!ud.login &&
        ud.login.toLowerCase() === env.ALLOWED_USERNAME.toLowerCase();
    }
  } catch {
    /* ignore */
  }

  if (!allowedUser) {
    return json(
      { error: "unauthorized_user", message: "Este usuário não tem acesso." },
      { status: 403, cors },
    );
  }

  return json({ access_token: ghBody.access_token, scope: ghBody.scope }, { cors });
}

// ---------- meta ----------

async function handleGetMeta(env: Env, cors: Record<string, string>): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT key, value FROM meta").all<{ key: string; value: string }>();
  const meta: Record<string, string> = {};
  for (const r of results || []) meta[r.key] = r.value;
  return json({ meta }, { cors });
}

async function handlePutMeta(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  let body: { key?: string; value?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, { status: 400, cors });
  }
  const { key, value } = body;
  if (!key || typeof value !== "string" || key.length > 64) {
    return json({ error: "invalid_params" }, { status: 400, cors });
  }
  await env.DB.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(key, value)
    .run();
  return json({ ok: true }, { cors });
}

// ---------- QR codes ----------

async function handleListQRCodes(env: Env, cors: Record<string, string>): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM qrcodes WHERE deleted_at IS NULL ORDER BY created_at DESC",
  ).all<QRRow>();
  const qrcodes = (results || []).map(rowToDTO);
  return json({ qrcodes }, { cors });
}

async function handleGetQRCode(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!ID_RE.test(id)) return json({ error: "invalid_id" }, { status: 400, cors });
  const row = await env.DB.prepare("SELECT * FROM qrcodes WHERE id = ?").bind(id).first<QRRow>();
  if (!row || row.deleted_at) return json({ error: "not_found" }, { status: 404, cors });
  return json({ qrcode: rowToDTO(row) }, { cors });
}

async function handleCreateQRCode(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const body = await readQRBody(request);
  if ("error" in body) return json({ error: body.error }, { status: 400, cors });

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO qrcodes (id, type, kind, title, tags, payload, styling, password_hash, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        body.data.id,
        body.data.type,
        body.data.kind,
        body.data.title,
        JSON.stringify(body.data.tags),
        body.data.payload,
        JSON.stringify(body.data.styling),
        body.data.passwordHash ?? null,
        body.data.expiresAt ?? null,
        now,
        now,
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "db_error";
    if (/UNIQUE constraint/i.test(msg)) {
      return json({ error: "id_conflict", message: "Já existe um QR com este id." }, { status: 409, cors });
    }
    if (/too big|TOOBIG/i.test(msg)) {
      return json(
        { error: "payload_too_large", message: "Conteúdo ou logo grandes demais. Reduza o logo (máx ~200px)." },
        { status: 413, cors },
      );
    }
    return json({ error: "db_error", message: msg }, { status: 500, cors });
  }

  const row = await env.DB.prepare("SELECT * FROM qrcodes WHERE id = ?").bind(body.data.id).first<QRRow>();
  return json({ qrcode: rowToDTO(row!) }, { status: 201, cors });
}

async function handleUpdateQRCode(
  id: string,
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!ID_RE.test(id)) return json({ error: "invalid_id" }, { status: 400, cors });
  const body = await readQRBody(request);
  if ("error" in body) return json({ error: body.error }, { status: 400, cors });

  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    `UPDATE qrcodes SET type=?, kind=?, title=?, tags=?, payload=?, styling=?, password_hash=?, expires_at=?, updated_at=?
     WHERE id=? AND deleted_at IS NULL`,
  )
    .bind(
      body.data.type,
      body.data.kind,
      body.data.title,
      JSON.stringify(body.data.tags),
      body.data.payload,
      JSON.stringify(body.data.styling),
      body.data.passwordHash ?? null,
      body.data.expiresAt ?? null,
      now,
      id,
    )
    .run();

  if (!res.meta.changes) return json({ error: "not_found" }, { status: 404, cors });
  const row = await env.DB.prepare("SELECT * FROM qrcodes WHERE id = ?").bind(id).first<QRRow>();
  return json({ qrcode: rowToDTO(row!) }, { cors });
}

async function handleDeleteQRCode(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!ID_RE.test(id)) return json({ error: "invalid_id" }, { status: 400, cors });
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    "UPDATE qrcodes SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL",
  )
    .bind(now, now, id)
    .run();
  if (!res.meta.changes) return json({ error: "not_found" }, { status: 404, cors });
  return json({ ok: true }, { cors });
}

// ---------- body parsing ----------

interface QRInput {
  id: string;
  type: "static" | "dynamic";
  kind: string;
  title: string;
  tags: string[];
  payload: string;
  styling: Record<string, unknown>;
  passwordHash?: string | null;
  expiresAt?: string | null;
}

async function readQRBody(
  request: Request,
): Promise<{ data: QRInput } | { error: string }> {
  let body: Partial<QRInput> & { id?: string };
  try {
    body = (await request.json()) as Partial<QRInput> & { id?: string };
  } catch {
    return { error: "invalid_body" };
  }
  const id = (body.id || "").toString();
  if (!ID_RE.test(id)) return { error: "invalid_id" };
  if (!body.type || !["static", "dynamic"].includes(body.type)) return { error: "invalid_type" };
  if (!body.kind || typeof body.kind !== "string") return { error: "invalid_kind" };
  if (typeof body.title !== "string" || body.title.length > 200) return { error: "invalid_title" };
  if (typeof body.payload !== "string" || body.payload.length === 0) return { error: "invalid_payload" };
  if (body.payload.length > 500_000) return { error: "payload_too_large" };
  if (!Array.isArray(body.tags)) return { error: "invalid_tags" };
  if (typeof body.styling !== "object" || body.styling === null) return { error: "invalid_styling" };
  try {
    if (JSON.stringify(body.styling).length > 500_000) return { error: "payload_too_large" };
  } catch {
    return { error: "invalid_styling" };
  }

  return {
    data: {
      id,
      type: body.type,
      kind: body.kind,
      title: body.title,
      tags: body.tags,
      payload: body.payload,
      styling: body.styling,
      passwordHash: body.passwordHash ?? null,
      expiresAt: body.expiresAt ?? null,
    },
  };
}
