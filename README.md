# Don QR Code

Gerador pessoal de QR codes, hospedado no GitHub Pages.

## Stack

- **Frontend:** Vite + React + TypeScript
- **UI:** Tailwind CSS v4 + shadcn-style components + lucide-react
- **QR engine:** `qr-code-styling` (Fase 4)
- **Auth:** GitHub OAuth + PKCE via Cloudflare Worker proxy (Fase 2)
- **Dados:** `data/qrcodes.json` no próprio repo (GitHub Contents API), criptografado com AES-GCM
- **Backend:** 1 Cloudflare Worker (OAuth proxy + redirect `/r/:id` + analytics)
- **Deploy:** GitHub Actions → GitHub Pages

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Segurança

- Acesso restrito a um único usuário GitHub (allowlist em `src/lib/config.ts`).
- Dados sensíveis cifrados (AES-GCM) com passphrase mestra.
- OAuth com PKCE; `client_secret` somente no Worker.
- CSP via `<meta>` (GitHub Pages não permite headers customizados).

## Estrutura

```
src/
  pages/        # Login, Dashboard, Generator, Detail, Callback
  components/ui # Primitivas (Button, Card, ...)
  lib/          # config, types, theme, utils
data/           # qrcodes.json (fonte da verdade, via Contents API)
worker/         # Cloudflare Worker (Fase 2)
.github/workflows/deploy.yml
```

## Status

- [x] Fase 1 — Scaffold + deploy
- [ ] Fase 2 — Login GitHub + allowlist
- [ ] Fase 3 — Camada de dados + criptografia
- [ ] Fase 4 — Gerador
- [ ] Fase 5 — Painel
- [ ] Fase 6 — QR dinâmico (Worker)
- [ ] Fase 7 — Analytics + expiração + senha
- [ ] Fase 8 — PWA + dark mode + polish
