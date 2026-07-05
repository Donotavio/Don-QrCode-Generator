# Don QR Code — Cloudflare Worker

Worker único que suporta o site no GitHub Pages. Gratuito (100k req/dia).

## Funções

- `POST /api/token` — proxy de troca do code OAuth pelo access_token (necessário porque o endpoint do GitHub não suporta CORS e exige `client_secret`).
- `GET /api/health` — healthcheck.
- _Fase 6:_ `GET /r/:id` (redirect/410) e `GET /stats`.

## Setup (uma vez)

```bash
cd worker
npm install
npx wrangler login   # autentica no Cloudflare

# 1. Criar namespace KV para analytics
npx wrangler kv:namespace create QR_ANALYTICS
# -> copie o "id" retornado e cole em wrangler.toml (kv_namespaces.id)

# 2. Definir secrets (NUNCA commitar):
npx wrangler secret put GITHUB_CLIENT_ID          # Ov23liMqjy2lkoF4XF4a
npx wrangler secret put GITHUB_CLIENT_SECRET       # cole o secret da OAuth App
npx wrangler secret put ALLOWED_USERNAME           # Donotavio

# 3. Deploy
npm run deploy
```

URL final: `https://don-qr.ribeitemp.workers.dev`

## Desenvolvimento local

```bash
npm run dev   # wrangler dev em http://localhost:8787
```

Crie um arquivo `.dev.vars` (gitignored) com os secrets para teste local:
```
GITHUB_CLIENT_ID=Ov23liMqjy2lkoF4XF4a
GITHUB_CLIENT_SECRET=...
ALLOWED_USERNAME=Donotavio
```
