import type { BadgePrintPayload } from "@/lib/badge-print";
import { badgeLabelPageCss } from "@/lib/badge-print";

type Props = {
  payload: BadgePrintPayload;
};

function lineTone(kind: BadgePrintPayload["lines"][number]["kind"], horizontal: boolean): string {
  switch (kind) {
    case "season":
      return "text-[10px] font-semibold uppercase tracking-wide text-slate-500";
    case "name":
      return horizontal
        ? "text-base font-extrabold leading-tight text-slate-900"
        : "text-lg font-extrabold leading-tight text-slate-900";
    case "number":
      return "text-xs font-bold tabular-nums tracking-wide text-slate-800";
    case "allergy":
      return "text-[10px] font-bold uppercase tracking-wide text-amber-700";
    case "custom":
      return "text-xs font-semibold text-slate-700";
    default:
      return "text-sm font-semibold text-slate-700";
  }
}

function BadgeLines({ payload, horizontal }: { payload: BadgePrintPayload; horizontal: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${horizontal ? "items-start text-left" : "items-center text-center"}`}>
      {payload.lines.map((line) => (
        <div key={`${line.kind}-${line.label ?? ""}-${line.text}`}>
          {line.kind === "custom" && line.label ? (
            <div className="flex flex-col">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {line.label}
              </span>
              <span className={lineTone(line.kind, horizontal)}>{line.text}</span>
            </div>
          ) : (
            <div className={lineTone(line.kind, horizontal)}>{line.text}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BadgePreviewCard({ payload }: Props) {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const horizontal = dims.isHorizontal;

  const aspect = horizontal
    ? payload.settings.labelSize === "LABEL_62MM"
      ? "aspect-[100/62]"
      : "aspect-[3/2]"
    : payload.settings.labelSize === "LABEL_4X6"
      ? "aspect-[2/3]"
      : payload.settings.labelSize === "LABEL_62MM"
        ? "aspect-[62/100]"
        : "aspect-[2/3]";

  const maxWidth = horizontal
    ? payload.settings.labelSize === "LABEL_4X6"
      ? "320px"
      : "280px"
    : payload.settings.labelSize === "LABEL_4X6"
      ? "280px"
      : "220px";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`mx-auto flex w-full rounded-lg border border-dashed border-foreground/20 bg-white p-3 text-slate-900 shadow-inner ${aspect} ${
          horizontal ? "flex-row items-center justify-between gap-3" : "flex-col items-center justify-center"
        }`}
        style={{ maxWidth }}
        aria-label="Badge preview"
      >
        <div className={`flex min-w-0 flex-col ${horizontal ? "flex-1 items-start" : "items-center"}`}>
          {payload.settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.settings.logoUrl}
              alt=""
              className={`object-contain ${horizontal ? "mb-1 max-h-8 max-w-[72px]" : "mb-2 max-h-10 max-w-[90px]"}`}
            />
          ) : null}
          <BadgeLines payload={payload} horizontal={horizontal} />
        </div>
        {payload.qrDataUrl && payload.settings.showQrCode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={payload.qrDataUrl} alt="QR preview" className="size-14 shrink-0" />
        ) : null}
      </div>
      <p className="text-[10px] text-slate-400">
        {dims.width} × {dims.height} · {horizontal ? "Horizontal" : "Vertical"}
      </p>
    </div>
  );
}
