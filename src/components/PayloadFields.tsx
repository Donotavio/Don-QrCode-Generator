import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type {
  EmailData,
  EventData,
  PayloadData,
  SmsData,
  VCardData,
  WifiData,
} from "@/lib/qr-builder";
import type { QRKind } from "@/lib/qr-builder";

interface PayloadFieldsProps {
  kind: QRKind;
  data: PayloadData;
  onChange: (next: PayloadData) => void;
}

export function PayloadFields({ kind, data, onChange }: PayloadFieldsProps) {
  switch (kind) {
    case "url":
      return (
        <Field label="URL" hint="Ex.: https://exemplo.com/pagina">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={(data as { url: string }).url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </Field>
      );

    case "text":
      return (
        <Field label="Texto livre">
          <Textarea
            placeholder="Qualquer texto que será codificado no QR..."
            value={(data as { text: string }).text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </Field>
      );

    case "vcard": {
      const d = data as VCardData;
      const set = (patch: Partial<VCardData>) =>
        onChange({ ...d, ...patch });
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              placeholder="Nome"
              value={d.firstName}
              onChange={(e) => set({ firstName: e.target.value })}
            />
          </Field>
          <Field label="Sobrenome">
            <Input
              placeholder="Sobrenome"
              value={d.lastName}
              onChange={(e) => set({ lastName: e.target.value })}
            />
          </Field>
          <Field label="Organização" className="sm:col-span-2">
            <Input
              placeholder="Empresa / organização"
              value={d.org ?? ""}
              onChange={(e) => set({ org: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <Input
              inputMode="tel"
              placeholder="+55 11 99999-9999"
              value={d.phone ?? ""}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              placeholder="contato@exemplo.com"
              value={d.email ?? ""}
              onChange={(e) => set({ email: e.target.value })}
            />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <Input
              type="url"
              placeholder="https://"
              value={d.url ?? ""}
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
          <Field label="Nota" className="sm:col-span-2">
            <Input
              placeholder="Observação"
              value={d.note ?? ""}
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>
        </div>
      );
    }

    case "wifi": {
      const d = data as WifiData;
      const set = (patch: Partial<WifiData>) => onChange({ ...d, ...patch });
      return (
        <div className="grid gap-3">
          <Field label="Nome da rede (SSID)">
            <Input
              placeholder="MinhaRede"
              value={d.ssid}
              onChange={(e) => set({ ssid: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Criptografia">
              <Select
                value={d.encryption}
                onChange={(e) =>
                  set({ encryption: e.target.value as WifiData["encryption"] })
                }
              >
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Sem senha</option>
              </Select>
            </Field>
            <Field label="Senha">
              <Input
                type="text"
                placeholder="senha da rede"
                value={d.password}
                onChange={(e) => set({ password: e.target.value })}
                disabled={d.encryption === "nopass"}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={d.hidden}
              onChange={(e) => set({ hidden: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Rede oculta
          </label>
        </div>
      );
    }

    case "email": {
      const d = data as EmailData;
      const set = (patch: Partial<EmailData>) => onChange({ ...d, ...patch });
      return (
        <div className="grid gap-3">
          <Field label="Para">
            <Input
              type="email"
              placeholder="destino@exemplo.com"
              value={d.to}
              onChange={(e) => set({ to: e.target.value })}
            />
          </Field>
          <Field label="Assunto">
            <Input
              placeholder="Assunto do e-mail"
              value={d.subject ?? ""}
              onChange={(e) => set({ subject: e.target.value })}
            />
          </Field>
          <Field label="Mensagem">
            <Textarea
              placeholder="Corpo do e-mail"
              value={d.body ?? ""}
              onChange={(e) => set({ body: e.target.value })}
            />
          </Field>
        </div>
      );
    }

    case "sms": {
      const d = data as SmsData;
      const set = (patch: Partial<SmsData>) => onChange({ ...d, ...patch });
      return (
        <div className="grid gap-3">
          <Field label="Número" hint="Com DDI e DDD. Ex.: +5511999999999">
            <Input
              inputMode="tel"
              placeholder="+5511999999999"
              value={d.number}
              onChange={(e) => set({ number: e.target.value })}
            />
          </Field>
          <Field label="Mensagem (opcional)">
            <Textarea
              placeholder="Texto da mensagem"
              value={d.message ?? ""}
              onChange={(e) => set({ message: e.target.value })}
            />
          </Field>
        </div>
      );
    }

    case "event": {
      const d = data as EventData;
      const set = (patch: Partial<EventData>) => onChange({ ...d, ...patch });
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título do evento" className="sm:col-span-2">
            <Input
              placeholder="Reunião, show, consulta..."
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field label="Início">
            <Input
              type="datetime-local"
              value={d.start}
              onChange={(e) => set({ start: e.target.value })}
            />
          </Field>
          <Field label="Fim">
            <Input
              type="datetime-local"
              value={d.end}
              onChange={(e) => set({ end: e.target.value })}
            />
          </Field>
          <Field label="Local" className="sm:col-span-2">
            <Input
              placeholder="Endereço ou link"
              value={d.location ?? ""}
              onChange={(e) => set({ location: e.target.value })}
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea
              placeholder="Detalhes do evento"
              value={d.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
        </div>
      );
    }
  }
}

/** Estado inicial dos dados para cada tipo. */
export function initialData(kind: QRKind): PayloadData {
  switch (kind) {
    case "url":
      return { url: "" };
    case "text":
      return { text: "" };
    case "vcard":
      return { firstName: "", lastName: "" };
    case "wifi":
      return { ssid: "", password: "", encryption: "WPA", hidden: false };
    case "email":
      return { to: "" };
    case "sms":
      return { number: "" };
    case "event":
      return { title: "", start: "", end: "" };
  }
}
