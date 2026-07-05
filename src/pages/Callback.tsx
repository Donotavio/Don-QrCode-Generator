import { Loader2 } from "lucide-react";

export function Callback() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Concluindo login com GitHub...
      </p>
    </div>
  );
}
