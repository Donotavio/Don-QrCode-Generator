import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import {
  checkVerifier,
  deriveKey,
  encryptText,
  decryptText,
  generateSalt,
  makeVerifier,
} from "@/lib/crypto";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CryptoStatus = "loading" | "needs-setup" | "locked" | "unlocked";

interface CryptoContextValue {
  status: CryptoStatus;
  error: string | null;
  encrypt: (plaintext: string) => Promise<string>;
  decrypt: (stored: string) => Promise<string>;
  lock: () => void;
}

const CryptoContext = createContext<CryptoContextValue | null>(null);

const META_SALT = "kdf_salt";
const META_VERIFIER = "kdf_verifier";

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, token } = useAuth();
  const [status, setStatus] = useState<CryptoStatus>("loading");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [salt, setSalt] = useState<string | null>(null);
  const [verifier, setVerifier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quando autentica, busca meta e decide se precisa setup ou unlock.
  useEffect(() => {
    if (authStatus !== "authenticated" || !token) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        const { meta } = await api.getMeta(token);
        if (cancelled) return;
        const s = meta[META_SALT];
        const v = meta[META_VERIFIER];
        setSalt(s ?? null);
        setVerifier(v ?? null);
        setStatus(s && v ? "locked" : "needs-setup");
      } catch {
        if (!cancelled) setError("Não foi possível carregar dados de segurança.");
        // Permite tentar novamente — fica em "locked" como fallback seguro.
        setStatus("locked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, token]);

  const setup = useCallback(
    async (passphrase: string) => {
      if (!token) return;
      setError(null);
      try {
        const newSalt = generateSalt();
        const newKey = await deriveKey(passphrase, newSalt);
        const newVerifier = await makeVerifier(newKey);
        await api.putMeta(token, META_SALT, newSalt);
        await api.putMeta(token, META_VERIFIER, newVerifier);
        setSalt(newSalt);
        setVerifier(newVerifier);
        setKey(newKey);
        setStatus("unlocked");
      } catch {
        setError("Falha ao configurar a passphrase. Tente novamente.");
      }
    },
    [token],
  );

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!token || !salt || !verifier) return;
      setError(null);
      try {
        const candidate = await deriveKey(passphrase, salt);
        const ok = await checkVerifier(candidate, verifier);
        if (!ok) {
          setError("Passphrase incorreta.");
          return;
        }
        setKey(candidate);
        setStatus("unlocked");
      } catch {
        setError("Falha ao destravar. Tente novamente.");
      }
    },
    [token, salt, verifier],
  );

  const lock = useCallback(() => {
    setKey(null);
    setStatus(verifier && salt ? "locked" : "needs-setup");
  }, [salt, verifier]);

  const encrypt = useCallback(
    async (plaintext: string) => {
      if (!key) throw new Error("not_unlocked");
      return encryptText(key, plaintext);
    },
    [key],
  );

  const decrypt = useCallback(
    async (stored: string) => {
      if (!key) throw new Error("not_unlocked");
      return decryptText(key, stored);
    },
    [key],
  );

  const value = useMemo<CryptoContextValue>(
    () => ({ status, error, encrypt, decrypt, lock }),
    [status, error, encrypt, decrypt, lock],
  );

  // Pass-through quando não autenticado (o AuthProvider/App cuida do login).
  if (authStatus !== "authenticated") {
    return <>{children}</>;
  }

  // Gate de criptografia.
  if (status === "loading") {
    return <CenteredSpinner label="Carregando cofre..." />;
  }
  if (status === "needs-setup") {
    return <SetupGate error={error} onSubmit={setup} />;
  }
  if (status === "locked") {
    return <UnlockGate error={error} onSubmit={unlock} onRetry={() => window.location.reload()} />;
  }

  return (
    <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) {
    throw new Error("useCrypto deve ser usado dentro de <CryptoProvider>");
  }
  return ctx;
}

// ---------- gates UI ----------

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function GateShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-background via-background to-accent/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">{children}</CardContent>
      </Card>
    </div>
  );
}

function usePasswordField() {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  return {
    value,
    setValue,
    type: show ? "text" : "password",
    toggle: () => setShow((s) => !s),
    show,
  };
}

function SetupGate({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (p: string) => Promise<void>;
}) {
  const p1 = usePasswordField();
  const p2 = usePasswordField();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);
    if (p1.value.length < 8) {
      setLocalError("Use ao menos 8 caracteres.");
      return;
    }
    if (p1.value !== p2.value) {
      setLocalError("As passphrases não coincidem.");
      return;
    }
    setBusy(true);
    await onSubmit(p1.value);
    setBusy(false);
    p1.setValue("");
    p2.setValue("");
  };

  return (
    <GateShell
      icon={<KeyRound className="h-7 w-7" />}
      title="Criar passphrase mestra"
      description="Ela cifra o conteúdo dos seus QR codes antes de enviar ao servidor. Nunca sai do seu navegador."
    >
      <PasswordInput
        label="Passphrase"
        field={p1}
        disabled={busy}
        autoFocus
      />
      <PasswordInput
        label="Confirmar passphrase"
        field={p2}
        disabled={busy}
        onEnter={submit}
      />
      {(localError || error) && <ErrorText text={(localError || error)!} />}
      <Button className="w-full" onClick={submit} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Configurando...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" /> Criar e ativar
          </>
        )}
      </Button>
      <WarningNote />
    </GateShell>
  );
}

function UnlockGate({
  error,
  onSubmit,
  onRetry,
}: {
  error: string | null;
  onSubmit: (p: string) => Promise<void>;
  onRetry: () => void;
}) {
  const field = usePasswordField();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await onSubmit(field.value);
    setBusy(false);
    field.setValue("");
  };

  return (
    <GateShell
      icon={<Lock className="h-7 w-7" />}
      title="Desbloquear cofre"
      description="Digite sua passphrase mestra para acessar seus QR codes."
    >
      <PasswordInput label="Passphrase" field={field} disabled={busy} autoFocus onEnter={submit} />
      {error && <ErrorText text={error} />}
      <Button className="w-full" onClick={submit} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
          </>
        ) : (
          "Desbloquear"
        )}
      </Button>
      <button
        type="button"
        onClick={onRetry}
        className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Recarregar
      </button>
    </GateShell>
  );
}

function PasswordInput({
  label,
  field,
  disabled,
  autoFocus,
  onEnter,
}: {
  label: string;
  field: ReturnType<typeof usePasswordField>;
  disabled?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="relative">
        <input
          type={field.type}
          value={field.value}
          onChange={(e) => field.setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter?.();
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={field.toggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
          aria-label={field.show ? "Ocultar" : "Mostrar"}
        >
          {field.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
      {text}
    </p>
  );
}

function WarningNote() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      ⚠️ Não há recuperação. Se esquecer a passphrase, seus dados cifrados
      ficam irrecuperáveis.
    </p>
  );
}
