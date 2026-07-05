import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { CONFIG, OAUTH_REDIRECT_URI, SITE_URL } from "@/lib/config";
import { computeCodeChallenge, generateCodeVerifier, generateState } from "@/lib/pkce";

const TOKEN_KEY = "don-qr-token";

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: GitHubUser | null;
  token: string | null;
  error: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Busca o usuário GitHub e valida contra o allowlist. */
async function fetchAndValidateUser(
  token: string,
): Promise<{ user: GitHubUser } | { error: string }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { error: "token_invalid" };
    }
    if (!res.ok) return { error: "github_error" };
    const u = (await res.json()) as GitHubUser;
    if (u.login.toLowerCase() !== CONFIG.ALLOWED_USERNAME.toLowerCase()) {
      return { error: "unauthorized_user" };
    }
    return { user: u };
  } catch {
    return { error: "network_error" };
  }
}

/** Troca o code OAuth pelo token via Worker (proxy seguro com client_secret). */
async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<{ token: string } | { error: string }> {
  try {
    const res = await fetch(`${CONFIG.WORKER_URL}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: OAUTH_REDIRECT_URI,
      }),
    });
    const body = (await res.json()) as { access_token?: string; error?: string };
    if (!res.ok || !body.access_token) {
      return { error: body.error || "exchange_failed" };
    }
    return { token: body.access_token };
  } catch {
    return { error: "worker_unreachable" };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  token_invalid: "Token expirado. Faça login novamente.",
  unauthorized_user: "Este usuário não tem acesso a este painel.",
  exchange_failed: "Falha ao concluir login com GitHub.",
  worker_unreachable: "Serviço de autenticação indisponível.",
  github_error: "Erro ao validar usuário no GitHub.",
  network_error: "Falha de rede.",
  state_mismatch: "Sessão inválida (state). Tente novamente.",
  missing_verifier: "Sessão expirou. Tente novamente.",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (ok: boolean, u: GitHubUser | null, t: string | null, err: string | null) => {
      setUser(u);
      setToken(t);
      setError(err);
      setStatus(ok ? "authenticated" : "unauthenticated");
      if (ok && t) storeToken(t);
      if (!ok) clearStoredToken();
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // 1) Fluxo de callback OAuth: code + state na query string da raiz.
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (code && state) {
        const savedState = sessionStorage.getItem("don-qr-state");
        const verifier = sessionStorage.getItem("don-qr-verifier");
        // Limpa imediatamente (single-use).
        sessionStorage.removeItem("don-qr-state");
        sessionStorage.removeItem("don-qr-verifier");
        // Remove os query params da URL sem recarregar.
        cleanUrl();

        if (!savedState || savedState !== state) {
          if (!cancelled) await resolve(false, null, null, "state_mismatch");
          return;
        }
        if (!verifier) {
          if (!cancelled) await resolve(false, null, null, "missing_verifier");
          return;
        }
        const ex = await exchangeCode(code, verifier);
        if ("error" in ex) {
          if (!cancelled) await resolve(false, null, null, ex.error);
          return;
        }
        const u = await fetchAndValidateUser(ex.token);
        if ("error" in u) {
          if (!cancelled) await resolve(false, null, null, u.error);
          return;
        }
        if (!cancelled) await resolve(true, u.user, ex.token, null);
        return;
      }

      // 2) Sessão existente: valida token armazenado.
      const stored = readStoredToken();
      if (!stored) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      const u = await fetchAndValidateUser(stored);
      if (cancelled) return;
      if ("error" in u) {
        await resolve(false, null, null, u.error);
        return;
      }
      await resolve(true, u.user, stored, null);
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(() => {
    const verifier = generateCodeVerifier();
    const state = generateState();
    sessionStorage.setItem("don-qr-verifier", verifier);
    sessionStorage.setItem("don-qr-state", state);

    // Monta a URL de autorização e redireciona.
    computeCodeChallenge(verifier).then((challenge) => {
      const params = new URLSearchParams({
        client_id: CONFIG.OAUTH_CLIENT_ID,
        redirect_uri: OAUTH_REDIRECT_URI,
        scope: CONFIG.OAUTH_SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      window.location.assign(
        `https://github.com/login/oauth/authorize?${params}`,
      );
    });
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setToken(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, error, login, logout }),
    [status, user, token, error, login, logout],
  );

  // Enquanto resolve (callback ou validação inicial), mostra loader.
  if (status === "loading") {
    return <AuthLoading />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function cleanUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

export function authErrorMessage(code: string | null): string {
  if (!code) return "";
  return ERROR_MESSAGES[code] ?? "Erro ao autenticar.";
}

/** URL canônica do site (para logs/redirecionamentos internos). */
export { SITE_URL };

function AuthLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  );
}
