import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";

export function Generator() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Novo QR code</h1>
        <p className="text-sm text-muted-foreground">
          O gerador completo (payload, estilos, logo, export) chegará na Fase 4.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Aqui será o formulário com tipos de payload (URL, texto, vCard,
            WiFi, email, SMS, evento), opções de estilo, correção de erro e
            preview ao vivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Próximos passos: login, camada de dados, criptografia e então este
          gerador.
        </CardContent>
      </Card>
    </div>
  );
}
