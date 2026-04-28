import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildRegistrationExportFieldOptionsFromJson } from "@/lib/registration-export";
import {
  RESERVED_CHILD_KEYS,
  RESERVED_GUARDIAN_KEYS,
  parseFormDefinitionJson,
} from "@/lib/registration-form-definition";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import type { Prisma, RegistrationStatus } from "@/generated/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  mergeRegistrationPaymentStatusFilter,
  registrationListPaymentBadge,
} from "@/lib/registration-list-payment";
import { ExportRegistrationsModal } from "./export-registrations-modal";
import { RegistrationsBulkTable, type RegistrationBulkTableRow } from "./registrations-bulk-table";

type QueryParams = {
  season?: string;
  q?: string;
  status?: string;
  classroom?: string;
  payment?: string;
  page?: string;
  df1k?: string;
  df1v?: string;
  df2k?: string;
  df2v?: string;
  df3k?: string;
  df3v?: string;
};

type DynamicFieldOption = {
  key: string;
  label: string;
  audience: "guardian" | "child";
  values: { value: string; label: string }[];
};

function normalizeScalar(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

function buildDynamicFieldOptions(defJson: string | null | undefined): DynamicFieldOption[] {
  const def = parseFormDefinitionJson(defJson);
  if (!def) return [];
  const sectionById = new Map(def.sections.map((s) => [s.id, s]));
  const out: DynamicFieldOption[] = [];
  for (const f of [...def.fields].sort((a, b) => a.order - b.order)) {
    const section = sectionById.get(f.sectionId);
    if (!section || (section.audience !== "guardian" && section.audience !== "eachChild")) continue;
    const audience = section.audience === "guardian" ? "guardian" : "child";
    if (audience === "guardian" && RESERVED_GUARDIAN_KEYS.has(f.key)) continue;
    if (audience === "child" && RESERVED_CHILD_KEYS.has(f.key)) continue;
    if (f.type === "select" || f.type === "radio") {
      const values = (f.options ?? [])
        .map((o) => ({ value: (o.value ?? "").trim(), label: o.label?.trim() || (o.value ?? "").trim() }))
        .filter((o) => o.value.length > 0);
      if (values.length === 0) continue;
      out.push({ key: `${audience}:${f.key}`, label: `${audience === "guardian" ? "Guardian" : "Child"}: ${f.label}`, audience, values });
      continue;
    }
    if (f.type === "boolean" || f.type === "checkbox") {
      out.push({
        key: `${audience}:${f.key}`,
        label: `${audience === "guardian" ? "Guardian" : "Child"}: ${f.label}`,
        audience,
        values: [
          { value: "true", label: "Yes / True" },
          { value: "false", label: "No / False" },
        ],
      });
    }
  }
  return out;
}

function mergeWhereAnd(where: Prisma.RegistrationWhereInput, clause: Prisma.RegistrationWhereInput) {
  const prev = where.AND;
  const arr = Array.isArray(prev) ? [...prev] : prev ? [prev] : [];
  arr.push(clause);
  where.AND = arr;
}

const CLASS_ASSIGNMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "WAITLIST", label: "Waitlist" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "CHECKED_OUT", label: "Checked out" },
  { value: "DRAFT", label: "Draft" },
];

const PAYMENT_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any" },
  { value: "paid", label: "Paid" },
  { value: "not_required", label: "Not required" },
  { value: "checkout_pending", label: "Checkout pending" },
  { value: "due_plain", label: "Due" },
  { value: "due_canceled", label: "Due (checkout canceled)" },
  { value: "due", label: "Outstanding (expects payment, not received)" },
];

function matchesDynamicFilters(
  r: {
    customResponses: unknown;
    formSubmission: { guardianResponses: unknown } | null;
  },
  dynamicFilters: Array<{ key: string; value: string }>,
  dynMap: Map<string, DynamicFieldOption>,
): boolean {
  for (const f of dynamicFilters) {
    const meta = dynMap.get(f.key);
    if (!meta) return false;
    const formKey = f.key.slice(meta.audience.length + 1);
    const source =
      meta.audience === "guardian"
        ? ((r.formSubmission?.guardianResponses ?? {}) as Record<string, unknown>)
        : ((r.customResponses ?? {}) as Record<string, unknown>);
    const actual = normalizeScalar(source[formKey]).toLowerCase();
    if (actual !== f.value.toLowerCase()) return false;
  }
  return true;
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  const sp = await searchParams;

  let totalRegistrations = 0;
  let pendingRegistrations = 0;
  let confirmedRegistrations = 0;
  let waitlistRegistrations = 0;
  let unassignedActive = 0;
  let needsPaymentCount = 0;
  let seasons: Array<{
    id: string;
    name: string;
    year: number;
    classrooms: Array<{ id: string; name: string }>;
    registrationForm: { publishedDefinitionJson: string | null; draftDefinitionJson: string | null } | null;
  }> = [];
  try {
    [
      totalRegistrations,
      pendingRegistrations,
      confirmedRegistrations,
      waitlistRegistrations,
      unassignedActive,
      needsPaymentCount,
    ] = await Promise.all([
      prisma.registration.count(),
      prisma.registration.count({ where: { status: "PENDING" } }),
      prisma.registration.count({ where: { status: "CONFIRMED" } }),
      prisma.registration.count({ where: { status: "WAITLIST" } }),
      prisma.registration.count({
        where: {
          classroomId: null,
          status: { in: ["PENDING", "CONFIRMED", "WAITLIST"] },
        },
      }),
      prisma.registration.count({
        where: {
          expectsPayment: true,
          paymentReceivedAt: null,
        },
      }),
    ]);

    seasons = await prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      select: {
        id: true,
        name: true,
        year: true,
        classrooms: {
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        registrationForm: { select: { publishedDefinitionJson: true, draftDefinitionJson: true } },
      },
    });
  } catch (error) {
    console.error("[registrations/page] load failed", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">All Registrations</h1>
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not reach the database right now. Please refresh in a moment. If this keeps happening, verify DB
          connectivity and connection limits.
        </div>
      </div>
    );
  }
  const selectedSeasonId = sp.season?.trim() || "";
  const selectedSeason =
    seasons.find((s) => s.id === selectedSeasonId) ??
    seasons[0] ??
    null;

  const dynamicFieldOptions = selectedSeason
    ? buildDynamicFieldOptions(
        selectedSeason.registrationForm?.publishedDefinitionJson ??
          selectedSeason.registrationForm?.draftDefinitionJson,
      )
    : [];
  const dynMap = new Map(dynamicFieldOptions.map((d) => [d.key, d]));

  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim().toUpperCase() ?? "";
  const classroom = sp.classroom?.trim() ?? "";
  const payment = sp.payment?.trim() ?? "";
  const pageRaw = sp.page?.trim() ?? "1";
  const pageParsed = parseInt(pageRaw, 10);
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
  const pageSize = 50;

  const rawDynamicFilters: Array<{ key: string; value: string }> = [
    { key: sp.df1k?.trim() ?? "", value: sp.df1v?.trim() ?? "" },
    { key: sp.df2k?.trim() ?? "", value: sp.df2v?.trim() ?? "" },
    { key: sp.df3k?.trim() ?? "", value: sp.df3v?.trim() ?? "" },
  ];
  const dynamicFilters = rawDynamicFilters.filter((f) => f.key && f.value && dynMap.has(f.key));

  const where: Prisma.RegistrationWhereInput = {};
  if (selectedSeason?.id) where.seasonId = selectedSeason.id;
  if (status) where.status = status as RegistrationStatus;
  if (classroom === "__unassigned") where.classroomId = null;
  else if (classroom) where.classroomId = classroom;
  mergeRegistrationPaymentStatusFilter(where, payment);
  if (q) {
    where.OR = [
      { registrationNumber: { contains: q, mode: "insensitive" } },
      { child: { firstName: { contains: q, mode: "insensitive" } } },
      { child: { lastName: { contains: q, mode: "insensitive" } } },
      { child: { guardian: { firstName: { contains: q, mode: "insensitive" } } } },
      { child: { guardian: { lastName: { contains: q, mode: "insensitive" } } } },
      { child: { guardian: { email: { contains: q, mode: "insensitive" } } } },
      { child: { guardian: { phone: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const include = {
    child: { include: { guardian: true } },
    season: true,
    classroom: true,
    formSubmission: {
      select: {
        registrationCode: true,
        guardianResponses: true,
        stripePaymentStatus: true,
        stripeCheckoutSessionId: true,
      },
    },
  } as const;

  type RegistrationListRow = Prisma.RegistrationGetPayload<{ include: typeof include }>;

  let rows: RegistrationListRow[];
  let totalCount: number;
  let hasNextPage: boolean;
  let totalPages: number;

  if (dynamicFilters.length === 0) {
    totalCount = await prisma.registration.count({ where });
    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(sp)) {
        if (v == null || v === "") continue;
        if (k === "page") continue;
        qs.set(k, String(v));
      }
      if (totalPages > 1) qs.set("page", String(totalPages));
      const s = qs.toString();
      redirect(s ? `/registrations?${s}` : "/registrations");
    }

    const skip = (page - 1) * pageSize;
    rows = await prisma.registration.findMany({
      where,
      orderBy: { registeredAt: "desc" },
      skip,
      take: pageSize,
      include,
    });
    hasNextPage = skip + rows.length < totalCount;
  } else {
    const chunkSize = 200;
    const scanInclude = {
      customResponses: true,
      formSubmission: { select: { guardianResponses: true } },
    } as const;

    const neededEnd = page * pageSize;
    const neededIds: string[] = [];
    let dbSkip = 0;
    let dbExhausted = false;
    let hasExtraMatch = false;

    while (neededIds.length < neededEnd || (!hasExtraMatch && !dbExhausted)) {
      const batch = await prisma.registration.findMany({
        where,
        orderBy: { registeredAt: "desc" },
        skip: dbSkip,
        take: chunkSize,
        select: { id: true, ...scanInclude },
      });
      if (batch.length === 0) {
        dbExhausted = true;
        break;
      }

      for (const r of batch) {
        if (!matchesDynamicFilters(r, dynamicFilters, dynMap)) continue;
        if (neededIds.length < neededEnd) {
          neededIds.push(r.id);
          continue;
        }
        hasExtraMatch = true;
        break;
      }

      dbSkip += batch.length;
      if (hasExtraMatch) break;
      if (batch.length < chunkSize) {
        dbExhausted = true;
        break;
      }
    }

    const startIdx = (page - 1) * pageSize;
    if (startIdx >= neededIds.length) {
      const lastPage = Math.max(1, Math.ceil(neededIds.length / pageSize));
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(sp)) {
        if (v == null || v === "") continue;
        if (k === "page") continue;
        qs.set(k, String(v));
      }
      if (lastPage > 1) qs.set("page", String(lastPage));
      const s = qs.toString();
      redirect(s ? `/registrations?${s}` : "/registrations");
    }

    const pageIds = neededIds.slice(startIdx, startIdx + pageSize);
    rows =
      pageIds.length === 0
        ? []
        : await prisma.registration.findMany({
            where: { id: { in: pageIds } },
            include,
          });
    // Preserve the scan order (registeredAt desc) even though `IN` is unordered.
    const orderIndex = new Map(pageIds.map((id, idx) => [id, idx]));
    rows.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    if (dbExhausted && !hasExtraMatch) {
      let matchCount = neededIds.length;
      while (true) {
        const batch = await prisma.registration.findMany({
          where,
          orderBy: { registeredAt: "desc" },
          skip: dbSkip,
          take: chunkSize,
          select: { id: true, ...scanInclude },
        });
        if (batch.length === 0) break;

        for (const r of batch) {
          if (!matchesDynamicFilters(r, dynamicFilters, dynMap)) continue;
          matchCount += 1;
        }

        dbSkip += batch.length;
        if (batch.length < chunkSize) break;
      }

      totalCount = matchCount;
      hasNextPage = page * pageSize < totalCount;
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    } else {
      hasNextPage = hasExtraMatch || !dbExhausted;
      totalPages = Math.max(page, hasNextPage ? page + 1 : page);
      totalCount = Math.min(neededIds.length, page * pageSize);
    }
  }

  const qsBase = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null || v === "") continue;
    if (k === "page") continue;
    qsBase.set(k, String(v));
  }
  const seasonExportConfigs = seasons.map((s) => ({
    id: s.id,
    name: s.name,
    year: s.year,
    fields: buildRegistrationExportFieldOptionsFromJson(
      s.registrationForm?.publishedDefinitionJson ?? s.registrationForm?.draftDefinitionJson,
    ),
  }));

  const canAdd = canManageDirectory(session.user.role);

  const bulkRows: RegistrationBulkTableRow[] = rows.map((r) => {
    const badge = registrationListPaymentBadge(r);
    return {
      id: r.id,
      status: r.status,
      registrationNumber: r.registrationNumber,
      childFirstName: r.child.firstName,
      childLastName: r.child.lastName,
      guardianEmail: r.child.guardian.email,
      seasonName: r.season.name,
      classroomName: r.classroom?.name ?? null,
      registeredAtIso: r.registeredAt.toISOString(),
      paymentBadgeLabel: badge.label,
      paymentBadgeClassName: badge.className,
    };
  });

  const selectionResetKey = [
    page,
    selectedSeason?.id ?? "",
    q,
    status,
    classroom,
    payment,
    dynamicFilters.map((f) => `${f.key}=${f.value}`).join("&"),
    bulkRows.map((r) => r.id).join(","),
  ].join("|");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Registrations</h1>
          <p className="mt-1 text-foreground/70">
            Recent child enrollments (50 per page). Use{" "}
            <strong className="font-medium text-foreground/80">Form builder</strong> for public signup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportRegistrationsModal seasons={seasonExportConfigs} />
          {canAdd && (
            <Link
              href="/registrations/new"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              New registration
            </Link>
          )}
        </div>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-lg border border-foreground/10 bg-surface-elevated px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">Total</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{totalRegistrations}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-surface-elevated px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">Pending</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{pendingRegistrations}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-surface-elevated px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">Confirmed</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{confirmedRegistrations}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-surface-elevated px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">Waitlist</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{waitlistRegistrations}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-surface-elevated px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">Unassigned</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{unassignedActive}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-surface-elevated px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">Payment Due</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{needsPaymentCount}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-foreground/10 bg-surface-elevated p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          <Link href="/registrations" className="text-xs font-medium text-brand underline">
            Clear all
          </Link>
        </div>
        <form method="get" className="space-y-3">
          <input type="hidden" name="page" value="1" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Name, email, phone, registration #"
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="season" className="block text-xs font-medium text-foreground/70">
                Season
              </label>
              <select
                id="season"
                name="season"
                defaultValue={selectedSeason?.id ?? ""}
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              >
                <option value="">All seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
                Class assignment status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              >
                {CLASS_ASSIGNMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "any"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="classroom" className="block text-xs font-medium text-foreground/70">
                Classroom
              </label>
              <select
                id="classroom"
                name="classroom"
                defaultValue={classroom}
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              >
                <option value="">Any</option>
                <option value="__unassigned">Unassigned</option>
                {selectedSeason?.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payment" className="block text-xs font-medium text-foreground/70">
                Payment status
              </label>
              <select
                id="payment"
                name="payment"
                defaultValue={payment}
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              >
                {PAYMENT_STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || "any-pay"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="rounded-lg border border-foreground/10 bg-background/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground/80">
              Form field filters (predefined options)
            </summary>
            <div className="mt-3 space-y-2">
              {dynamicFieldOptions.length === 0 ? (
                <p className="text-xs text-foreground/55">
                  Select a season with a configured form field options list (select/radio/boolean) to use dynamic
                  filters.
                </p>
              ) : (
                <div className="grid gap-2 lg:grid-cols-3">
                  {([
                    { keyName: "df1k", valName: "df1v" },
                    { keyName: "df2k", valName: "df2v" },
                    { keyName: "df3k", valName: "df3v" },
                  ] as const).map((slot, idx) => {
                    const { keyName, valName } = slot;
                    const selectedKey = (sp[keyName] ?? "").trim();
                    const values = dynMap.get(selectedKey)?.values ?? [];
                    return (
                      <div key={keyName} className="rounded-md border border-foreground/10 p-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
                          Dynamic filter {idx + 1}
                        </p>
                        <select
                          name={keyName}
                          defaultValue={selectedKey}
                          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
                        >
                          <option value="">None</option>
                          {dynamicFieldOptions.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <select
                          name={valName}
                          defaultValue={(sp[valName] ?? "").trim()}
                          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
                        >
                          <option value="">Any value</option>
                          {values.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Apply filters
            </button>
            <span className="text-xs text-foreground/60">
              Page {page} of {totalPages}
            </span>
          </div>
        </form>
      </section>

      <RegistrationsBulkTable
        rows={bulkRows}
        canBulkAct={canAdd}
        baseQueryString={qsBase.toString()}
        page={page}
        totalPages={totalPages}
        hasNextPage={hasNextPage}
        selectionResetKey={selectionResetKey}
      />
    </div>
  );
}
