import type { BadgePrintPayload } from "@/lib/badge-print";
import { badgeLabelPageCss } from "@/lib/badge-print";

type Props = {
  payload: BadgePrintPayload;
};

function lineTone(kind: BadgePrintPayload["lines"][number]["kind"]): string {
  switch (kind) {
    case "season":
      return "text-[10px] font-semibold uppercase tracking-wide text-slate-500";
    case "name":
      return "text-lg font-extrabold leading-tight text-slate-900";
    case "number":
      return "text-sm font-bold tabular-nums tracking-wide text-slate-800";
    case "allergy":
      return "text-[10px] font-bold uppercase tracking-wide text-amber-700";
    default:
      return "text-sm font-semibold text-slate-700";
  }
}

export function BadgePreviewCard({ payload }: Props) {
  const dims = badgeLabelPageCss(payload.settings.labelSize);
  const aspect =
    payload.settings.labelSize === "LABEL_4X6"
      ? "aspect-[2/3]"
      : payload.settings.labelSize === "LABEL_62MM"
        ? "aspect-[62/100]"
        : "aspect-[2/3]";

  return (
    <div
      className={`mx-auto flex w-full max-w-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-foreground/20 bg-white p-3 text-center text-slate-900 shadow-inner ${aspect}`}
      style={{ maxWidth: payload.settings.labelSize === "LABEL_4X6" ? "280px" : "220px" }}
      aria-label="Badge preview"
    >
      {payload.settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={payload.settings.logoUrl}
          alt=""
          className="mb-2 max-h-10 max-w-[90px] object-contain"
        />
      ) : null}
      <div className="flex flex-col items-center gap-1">
        {payload.lines.map((line) => (
          <div key={`${line.kind}-${line.text}`} className={lineTone(line.kind)}>
            {line.text}
          </div>
        ))}
      </div>
      {payload.qrDataUrl && payload.settings.showQrCode ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={payload.qrDataUrl} alt="QR preview" className="mt-2 size-16" />
      ) : null}
      <p className="mt-2 text-[10px] text-slate-400">
        {dims.width} × {dims.height}
      </p>
    </div>
  );
}
