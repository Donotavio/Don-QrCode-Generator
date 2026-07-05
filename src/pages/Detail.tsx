import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, useParams } from "react-router-dom";

export function Detail() {
  const { id } = useParams();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Detalhes do QR code
        </h1>
        <p className="text-sm text-muted-foreground">ID: {id}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Em construção</CardTitle>
          </div>
          <CardDescription>
            Aqui será a tela de detalhe com preview, ativar/desativar,
            analytics de scans (para QRs dinâmicos), histórico de versões e
            exclusão.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Chega nas Fases 5, 6 e 7.
        </CardContent>
      </Card>
    </div>
  );
}
