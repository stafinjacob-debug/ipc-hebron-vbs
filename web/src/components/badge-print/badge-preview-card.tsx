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
    case "formField":
      return "text-xs font-semibold text-slate-700";
    default:
      return "text-sm font-semibold text-slate-700";
  }
}

function StandardBadgeLines({ payload, horizontal }: { payload: BadgePrintPayload; horizontal: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${horizontal ? "items-start text-left" : "items-center text-center"}`}>
      {payload.lines.map((line) => (
        <div key={`${line.kind}-${line.label ?? ""}-${line.text}`}>
          {line.kind === "formField" ? (
            line.label ? (
              <div className="flex flex-col">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{line.label}</span>
                <span className={lineTone(line.kind, horizontal)}>{line.text}</span>
              </div>
            ) : (
              <div className={lineTone(line.kind, horizontal)}>{line.text}</div>
            )
          ) : (
            <div className={lineTone(line.kind, horizontal)}>{line.text}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function NameCodeHeaderPreview({ payload }: { payload: BadgePrintPayload }) {
  const s = payload.structured;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {payload.settings.showChildName ? (
            <>
              <div className="text-lg font-extrabold leading-none">
                {s.firstName || payload.childName}
              </div>
              {s.lastName ? <div className="text-sm font-bold text-slate-800">{s.lastName}</div> : null}
            </>
          ) : null}
        </div>
        {s.securityCode ? (
          <div className="shrink-0 rounded bg-slate-900 px-2 py-1 text-center text-white">
            <div className="text-[8px] font-bold uppercase tracking-wider opacity-80">Code</div>
            <div className="text-[10px] font-extrabold tabular-nums">{s.securityCode}</div>
          </div>
        ) : null}
      </div>
      {s.guardianLine || s.guardianPhone ? (
        <div className="text-right text-[9px] text-slate-500">
          {s.guardianLine ? <div>Guardian {s.guardianLine}</div> : null}
          {s.guardianPhone ? <div>{s.guardianPhone}</div> : null}
        </div>
      ) : null}
      <hr className="border-slate-900" />
      {s.locationLine ? <div className="text-sm font-extrabold leading-tight">{s.locationLine}</div> : null}
      {s.answerLines.length ? (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Answers</div>
          <div className="text-[10px] font-semibold text-slate-700">
            {s.answerLines.map((l) => (
              <div key={`${l.label}-${l.text}`}>
                {l.label ? `${l.label}: ` : ""}
                {l.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {s.medicalLine ? (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Medical notes</div>
          <div className="text-[10px] font-semibold text-slate-700">{s.medicalLine}</div>
        </div>
      ) : null}
    </div>
  );
}

function KidCheckPreview({ payload }: { payload: BadgePrintPayload }) {
  const s = payload.structured;
  return (
    <div className="flex min-w-0 flex-1 gap-1">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left text-[10px] leading-snug text-slate-800">
        <div className="flex items-start justify-between gap-2">
          {payload.settings.showChildName ? (
            <div className="text-sm font-extrabold">
              {`${s.firstName} ${s.lastName}`.trim() || payload.childName}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {s.securityCode ? (
            <div className="shrink-0 border border-slate-900 px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums">
              {s.securityCode}
            </div>
          ) : null}
        </div>
        <hr className="border-slate-900" />
        {s.serviceLine ? <div>{s.serviceLine}</div> : null}
        {s.guardianLine ? (
          <div>
            <strong>Primary guardian:</strong> {s.guardianLine}
          </div>
        ) : null}
        {s.birthdate ? (
          <div>
            <strong>Birthdate:</strong> {s.birthdate}
          </div>
        ) : null}
        {s.medicalLine ? (
          <div>
            <strong>Medical / allergy info:</strong> {s.medicalLine}
          </div>
        ) : null}
        {s.notesLine ? (
          <div>
            <strong>Note:</strong> {s.notesLine}
          </div>
        ) : null}
        {s.answerLines.length ? (
          <div>
            {s.answerLines.map((l) => (
              <div key={`${l.label}-${l.text}`}>
                <strong>{l.label ?? "Answer"}:</strong> {l.text}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex flex-col items-center gap-0.5 pt-1">
          {s.printedAt ? <div className="text-[8px] text-slate-400">{s.printedAt}</div> : null}
          {payload.barcodeDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.barcodeDataUrl} alt="" className="h-4 w-full max-w-[140px] object-fill" />
          ) : payload.qrDataUrl && payload.settings.showQrCode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.qrDataUrl} alt="QR preview" className="size-10" />
          ) : null}
        </div>
      </div>
      {payload.settings.logoUrl ? (
        <div className="flex w-7 shrink-0 items-center justify-center self-stretch border-l border-slate-200 pl-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payload.settings.logoUrl}
            alt=""
            className="max-h-[85%] w-6 rotate-[-90deg] object-contain opacity-90"
          />
        </div>
      ) : null}
    </div>
  );
}

export function BadgePreviewCard({ payload }: Props) {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const horizontal = dims.isHorizontal;
  const layout = horizontal ? payload.settings.horizontalLayout : "STANDARD";

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

  const layoutLabel =
    !horizontal || layout === "STANDARD"
      ? horizontal
        ? "Horizontal · Standard"
        : "Vertical"
      : layout === "NAME_CODE_HEADER"
        ? "Horizontal · Name + code"
        : "Horizontal · KidCheck";

  const showStandardQr =
    layout === "STANDARD" && payload.qrDataUrl && payload.settings.showQrCode;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`mx-auto flex w-full rounded-lg border border-dashed border-foreground/20 bg-white p-3 text-slate-900 shadow-inner ${aspect} ${
          horizontal && layout === "STANDARD"
            ? "flex-row items-center justify-between gap-3"
            : "flex-col items-stretch justify-center"
        }`}
        style={{ maxWidth }}
        aria-label="Badge preview"
      >
        {layout === "NAME_CODE_HEADER" ? (
          <NameCodeHeaderPreview payload={payload} />
        ) : layout === "KIDCHECK" ? (
          <KidCheckPreview payload={payload} />
        ) : (
          <>
            <div className={`flex min-w-0 flex-col ${horizontal ? "flex-1 items-start" : "items-center"}`}>
              {payload.settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={payload.settings.logoUrl}
                  alt=""
                  className={`object-contain ${horizontal ? "mb-1 max-h-8 max-w-[72px]" : "mb-2 max-h-10 max-w-[90px]"}`}
                />
              ) : null}
              <StandardBadgeLines payload={payload} horizontal={horizontal} />
            </div>
            {showStandardQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payload.qrDataUrl!} alt="QR preview" className="size-14 shrink-0" />
            ) : null}
          </>
        )}
      </div>
      <p className="text-[10px] text-slate-400">
        {dims.width} × {dims.height} · {layoutLabel}
      </p>
    </div>
  );
}
