/**
 * Configuração central da aplicação.
 * Ajuste estes valores se mudar de username/repo/domínio.
 */
export const CONFIG = {
  /** Username GitHub autorizado a acessar o painel (allowlist). */
  ALLOWED_USERNAME: "Donotavio",
  /** Repo (apenas para referência; os dados vivem no D1, não no repo). */
  OWNER: "Donotavio",
  REPO: "Don-QrCode-Generator",
  /**
   * URL base do Cloudflare Worker.
   * Responsável por: proxy OAuth, CRUD /api/qrcodes, /api/meta, /r/:id, /stats.
   */
  WORKER_URL: "https://don-qr.ribeitemp.workers.dev",
  /** App client ID da OAuth App (público). */
  OAUTH_CLIENT_ID: "Ov23liMqjy2lkoF4XF4a",
  /** Scopes solicitados: public_repo (write em repo público) + read:user. */
  OAUTH_SCOPES: "public_repo read:user",
} as const;

/** URL base do site no GitHub Pages. */
export const SITE_URL = `https://${CONFIG.OWNER.toLowerCase()}.github.io/${CONFIG.REPO}/`;
/** Redirect URI registrada na OAuth App (raiz do site). */
export const OAUTH_REDIRECT_URI = SITE_URL;
