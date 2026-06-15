import type { BadgePrintPayload, BadgeTypographySettings } from "@/lib/badge-print";
import { badgeLabelPageCss } from "@/lib/badge-print";

type Props = {
  payload: BadgePrintPayload;
};

/** Approximate pt → px for the scaled-down admin preview card. */
function previewPt(pt: number): string {
  return `${(pt * 0.72).toFixed(1)}px`;
}

function typographyStyles(t: BadgeTypographySettings, horizontal: boolean) {
  if (!horizontal) return null;
  return {
    name: { fontSize: previewPt(t.namePt) },
    class: { fontSize: previewPt(t.classPt) },
    detail: { fontSize: previewPt(t.detailPt) },
    season: { fontSize: previewPt(t.seasonPt) },
    code: { fontSize: previewPt(t.codePt) },
    timestamp: { fontSize: previewPt(t.timestampPt) },
    gap: { marginBottom: `${(t.lineGapIn * 72).toFixed(1)}px` },
  } as const;
}

function lineTone(kind: BadgePrintPayload["lines"][number]["kind"], horizontal: boolean): string {
  switch (kind) {
    case "season":
      return "font-semibold uppercase tracking-wide text-slate-500";
    case "name":
      return horizontal
        ? "font-extrabold leading-tight text-slate-900"
        : "text-lg font-extrabold leading-tight text-slate-900";
    case "number":
      return "font-bold tabular-nums tracking-wide text-slate-800";
    case "allergy":
      return "font-bold uppercase tracking-wide text-amber-700";
    case "formField":
      return "font-semibold text-slate-700";
    default:
      return "font-semibold text-slate-700";
  }
}

function StandardBadgeLines({
  payload,
  horizontal,
  typeStyles,
}: {
  payload: BadgePrintPayload;
  horizontal: boolean;
  typeStyles: ReturnType<typeof typographyStyles>;
}) {
  return (
    <div className={`flex flex-col ${horizontal ? "items-start text-left" : "items-center text-center"}`}>
      {payload.lines.map((line, index) => {
        const style =
          horizontal && typeStyles
            ? line.kind === "name"
              ? typeStyles.name
              : line.kind === "season"
                ? typeStyles.season
                : line.kind === "number"
                  ? typeStyles.code
                  : line.kind === "formField"
                    ? { fontSize: previewPt(line.fontPt ?? payload.settings.typography.detailPt) }
                    : line.kind === "class" || line.kind === "badgeName" || line.kind === "checkInLabel"
                      ? typeStyles.detail
                      : line.kind === "allergy"
                        ? typeStyles.season
                        : typeStyles.detail
            : line.kind === "formField" && line.fontPt
              ? { fontSize: previewPt(line.fontPt) }
              : undefined;
        const gapStyle =
          horizontal && typeStyles && index < payload.lines.length - 1 ? typeStyles.gap : undefined;

        return (
          <div key={`${line.kind}-${line.label ?? ""}-${line.text}`} style={gapStyle}>
            {line.kind === "formField" ? (
              line.label ? (
                <div className="flex flex-col">
                  <span
                    className="font-semibold uppercase tracking-wide text-slate-400"
                    style={horizontal && typeStyles ? typeStyles.season : { fontSize: "9px" }}
                  >
                    {line.label}
                  </span>
                  <span className={lineTone(line.kind, horizontal)} style={style}>
                    {line.text}
                  </span>
                </div>
              ) : (
                <div className={lineTone(line.kind, horizontal)} style={style}>
                  {line.text}
                </div>
              )
            ) : (
              <div className={lineTone(line.kind, horizontal)} style={style}>
                {line.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VbsHorizontalPreview({
  payload,
  typeStyles,
}: {
  payload: BadgePrintPayload;
  typeStyles: ReturnType<typeof typographyStyles>;
}) {
  const s = payload.structured;
  const qrSizePx = typeStyles ? payload.settings.typography.qrSizeIn * 72 * 0.55 : undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-stretch justify-between gap-2 text-left">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {s.childNameLine ? (
          <div className="font-normal leading-tight text-slate-900" style={typeStyles?.name}>
            {s.childNameLine}
          </div>
        ) : null}
        {s.eventLine ? (
          <div className="font-normal text-slate-600" style={typeStyles?.season}>
            {s.eventLine}
          </div>
        ) : null}
        {s.classLine ? (
          <div className="mt-1 font-extrabold leading-tight text-slate-900" style={typeStyles?.class}>
            {s.classLine}
          </div>
        ) : null}
        {s.tShirtSizeLine ? (
          <div className="mt-0.5 font-extrabold text-slate-900" style={typeStyles?.detail}>
            {s.tShirtSizeLine}
          </div>
        ) : null}
        {s.guardianLine ? (
          <div className="mt-2 font-extrabold text-slate-900" style={typeStyles?.detail}>
            {s.guardianLine}
          </div>
        ) : null}
        {s.guardianPhone ? (
          <div className="font-extrabold text-slate-900" style={typeStyles?.detail}>
            {s.guardianPhone}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-end gap-1 self-stretch text-right">
        {s.securityCode ? (
          <div className="font-extrabold tabular-nums tracking-wide text-slate-900" style={typeStyles?.code}>
            {s.securityCode}
          </div>
        ) : null}
        {payload.qrDataUrl && payload.settings.showQrCode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.qrDataUrl}
            alt="QR preview"
            style={
              qrSizePx
                ? { width: `${qrSizePx}px`, height: `${qrSizePx}px` }
                : undefined
            }
            className={qrSizePx ? undefined : "size-10"}
          />
        ) : null}
        {s.printedAt ? (
          <div className="text-slate-400" style={typeStyles?.timestamp}>
            {s.printedAt}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NameCodeHeaderPreview({
  payload,
  typeStyles,
}: {
  payload: BadgePrintPayload;
  typeStyles: ReturnType<typeof typographyStyles>;
}) {
  const s = payload.structured;
  const { detailLabelBold, detailValueBold } = payload.settings.typography;
  const labelClass = detailLabelBold ? "font-bold" : "font-normal";
  const valueClass = detailValueBold ? "font-semibold" : "font-normal";
  const qrSizePx = typeStyles ? payload.settings.typography.qrSizeIn * 72 * 0.55 : undefined;
  const detailLine = (label: string, value: string, fontPt?: number) => (
    <div style={fontPt ? { fontSize: previewPt(fontPt) } : typeStyles?.detail}>
      <span className={labelClass}>{label}</span>{" "}
      <span className={valueClass}>{value}</span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {payload.settings.showChildName ? (
            <>
              <div className="font-extrabold leading-none" style={typeStyles?.name}>
                {s.firstName || payload.childName}
              </div>
              {s.lastName ? (
                <div className="font-bold text-slate-800" style={typeStyles?.detail}>
                  {s.lastName}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {s.securityCode ? (
            <div className="rounded bg-slate-900 px-2 py-1 text-center text-white">
              <div className="font-bold uppercase tracking-wider opacity-80" style={typeStyles?.season}>
                Registration code
              </div>
              <div className="font-extrabold tabular-nums" style={typeStyles?.code}>
                {s.securityCode}
              </div>
            </div>
          ) : null}
          {payload.qrDataUrl && payload.settings.showQrCode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.qrDataUrl}
              alt="QR preview"
              style={
                qrSizePx
                  ? { width: `${qrSizePx}px`, height: `${qrSizePx}px` }
                  : undefined
              }
              className={qrSizePx ? undefined : "size-10"}
            />
          ) : null}
        </div>
      </div>
      <hr className="border-slate-900" />
      {s.locationLine ? (
        <div className="font-extrabold leading-tight" style={typeStyles?.class}>
          {s.locationLine}
        </div>
      ) : null}
      {s.answerLines.map((l) => (
        <div key={`${l.label}-${l.text}`} style={typeStyles?.gap}>
          {detailLine(`${l.label ?? "Field"}:`, l.text, l.fontPt)}
        </div>
      ))}
      {s.medicalLine ? detailLine("Allergies:", s.medicalLine) : null}
    </div>
  );
}

function KidCheckPreview({
  payload,
  typeStyles,
}: {
  payload: BadgePrintPayload;
  typeStyles: ReturnType<typeof typographyStyles>;
}) {
  const s = payload.structured;
  const { detailLabelBold, detailValueBold } = payload.settings.typography;
  const labelClass = detailLabelBold ? "font-bold" : "font-normal";
  const valueClass = detailValueBold ? "font-semibold" : "font-normal";
  const detailBlock = (label: string, value: string) => (
    <div style={typeStyles?.gap}>
      <span className={labelClass}>{label}</span>{" "}
      <span className={valueClass}>{value}</span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 gap-1">
      <div className="flex min-w-0 flex-1 flex-col text-left leading-snug text-slate-800">
        <div className="flex items-start justify-between gap-2">
          {payload.settings.showChildName ? (
            <div className="font-extrabold" style={typeStyles?.name}>
              {`${s.firstName} ${s.lastName}`.trim() || payload.childName}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {s.securityCode ? (
            <div
              className="shrink-0 border border-slate-900 px-1.5 py-0.5 font-extrabold tabular-nums"
              style={typeStyles?.code}
            >
              {s.securityCode}
            </div>
          ) : null}
        </div>
        <hr className="my-0.5 border-slate-900" />
        {s.seasonLine ? (
          <div className="font-semibold uppercase tracking-wide text-slate-400" style={typeStyles?.season}>
            {s.seasonLine}
          </div>
        ) : null}
        {s.classLine ? (
          <div className="font-extrabold uppercase tracking-wide text-slate-900" style={typeStyles?.class}>
            {s.classLine}
          </div>
        ) : s.serviceLine ? (
          <div className="font-extrabold uppercase tracking-wide text-slate-900" style={typeStyles?.class}>
            {s.serviceLine}
          </div>
        ) : null}
        {s.answerLines.length ? (
          <div style={typeStyles?.gap}>
            {s.answerLines.map((l) => (
              <div
                key={`${l.label}-${l.text}`}
                style={{ fontSize: previewPt(l.fontPt ?? payload.settings.typography.detailPt) }}
              >
                <span className={labelClass}>{l.label ?? "Field"}:</span>{" "}
                <span className={valueClass}>{l.text}</span>
              </div>
            ))}
          </div>
        ) : null}
        {s.medicalLine ? detailBlock("Allergies:", s.medicalLine) : null}
        <div className="mt-auto flex flex-col items-center gap-0.5 pt-1">
          {s.printedAt ? (
            <div className="text-slate-400" style={typeStyles?.timestamp}>
              {s.printedAt}
            </div>
          ) : null}
          {payload.qrDataUrl && payload.settings.showQrCode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.qrDataUrl}
              alt="QR preview"
              style={{
                width: typeStyles ? `${payload.settings.typography.qrSizeIn * 72 * 0.55}px` : undefined,
                height: typeStyles ? `${payload.settings.typography.qrSizeIn * 72 * 0.55}px` : undefined,
              }}
              className={typeStyles ? undefined : "size-10"}
            />
          ) : payload.barcodeDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.barcodeDataUrl} alt="" className="h-4 w-full max-w-[140px] object-fill" />
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
  const typeStyles = typographyStyles(payload.settings.typography, horizontal);

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

  const layoutLabel = horizontal ? "Horizontal · VBS check-in" : "Vertical";

  const showStandardQr = !horizontal && payload.qrDataUrl && payload.settings.showQrCode;
  const qrPreviewSize = !horizontal ? payload.settings.typography.qrSizeIn * 72 * 0.72 : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`mx-auto flex w-full rounded-lg border border-dashed border-foreground/20 bg-white p-3 text-slate-900 shadow-inner ${aspect} flex-col items-stretch justify-center`}
        style={{ maxWidth }}
        aria-label="Badge preview"
      >
        {horizontal ? (
          <VbsHorizontalPreview payload={payload} typeStyles={typeStyles} />
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
              <StandardBadgeLines payload={payload} horizontal={horizontal} typeStyles={typeStyles} />
            </div>
            {showStandardQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={payload.qrDataUrl!}
                alt="QR preview"
                className={qrPreviewSize ? "shrink-0" : "size-14 shrink-0"}
                style={
                  qrPreviewSize
                    ? { width: `${qrPreviewSize}px`, height: `${qrPreviewSize}px` }
                    : undefined
                }
              />
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
