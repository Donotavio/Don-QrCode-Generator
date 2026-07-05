import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { buildQrOptions, type QrStyleConfig } from "@/lib/qr-builder";

export interface QrPreviewHandle {
  download: (ext: "png" | "svg" | "jpeg") => void;
  getPngDataUrl: () => Promise<string | null>;
}

interface QrPreviewProps {
  data: string;
  style: QrStyleConfig;
  size?: number;
}

/** Renderiza o QR ao vivo (SVG) e expõe métodos de export. */
export const QrPreview = forwardRef<QrPreviewHandle, QrPreviewProps>(
  function QrPreview({ data, style, size = 256 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const qrRef = useRef<QRCodeStyling | null>(null);

    // Cria uma única vez.
    useEffect(() => {
      const qr = new QRCodeStyling(
        buildQrOptions(data || " ", style, size) as ConstructorParameters<
          typeof QRCodeStyling
        >[0],
      );
      qrRef.current = qr;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        qr.append(containerRef.current);
      }
      return () => {
        if (containerRef.current) containerRef.current.innerHTML = "";
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Atualiza quando payload/estilo mudam.
    useEffect(() => {
      qrRef.current?.update(
        buildQrOptions(data || " ", style, size) as ConstructorParameters<
          typeof QRCodeStyling
        >[0],
      );
    }, [data, style, size]);

    useImperativeHandle(ref, () => ({
      download: (ext) => {
        qrRef.current?.download({ extension: ext, name: "qr-code" });
      },
      getPngDataUrl: async () => {
        const qr = qrRef.current;
        if (!qr) return null;
        try {
          const blob = (await qr.getRawData("png")) as Blob | null;
          if (!blob) return null;
          return await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      },
    }));

    return (
      <div className="flex items-center justify-center">
        <div
          ref={containerRef}
          className="overflow-hidden rounded-lg"
          style={{ width: size, height: size }}
        />
      </div>
    );
  },
);
