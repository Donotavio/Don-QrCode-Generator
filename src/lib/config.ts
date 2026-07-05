/**
 * Configuração central da aplicação.
 * Ajuste estes valores se mudar de username/repo/domínio.
 */
export const CONFIG = {
  /** Username GitHub autorizado a acessar o painel (allowlist). */
  ALLOWED_USERNAME: "Donotavio",
  /** Repo onde os dados são persistidos (Contents API). */
  OWNER: "Donotavio",
  REPO: "don_qr_code_gen",
  DATA_BRANCH: "main",
  DATA_PATH: "data/qrcodes.json",
  /**
   * URL base do Cloudflare Worker (definida na Fase 2).
   * Responsável por: proxy OAuth, /r/:id redirect, /stats.
   */
  WORKER_URL: "https://don-qr.donotavio.workers.dev",
  /** App client ID da OAuth App (público, criado na Fase 2). */
  OAUTH_CLIENT_ID: "",
} as const;

/** URL base do site no GitHub Pages. */
export const SITE_URL = `https://${CONFIG.OWNER}.github.io/${CONFIG.REPO}/`;
