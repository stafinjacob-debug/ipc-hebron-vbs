import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildRegistrationExportFieldOptionsFromJson,
  resolveRegistrationExportFieldValue,
} from "@/lib/registration-export";
import { countDuplicateRegistrationGroups } from "@/lib/registration-duplicates";
import {
  RESERVED_CHILD_KEYS,
  RESERVED_GUARDIAN_KEYS,
  parseFormDefinitionJson,
} from "@/lib/registration-form-definition";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import type { Prisma } from "@/generated/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  hasActiveRegistrationListFilters,
  parseRegistrationStatusFilter,
  queryParamString,
} from "@/lib/registration-list-filters";
import {
  isCheckoutPendingRegistration,
  mergeRegistrationPaymentStatusFilter,
  registrationListPaymentBadge,
  registrationPaymentOutstandingWhere,
} from "@/lib/registration-list-payment";
import { ExportRegistrationsModal } from "./export-registrations-modal";
import { RegistrationListColumnsModal } from "./registration-list-columns-modal";
import { RegistrationsFiltersForm } from "./registrations-filters-form";
import { RegistrationsBulkTable, type RegistrationBulkTableRow } from "./registrations-bulk-table";

export const dynamic = "force-dynamic";

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
  col?: string | string[];
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

function buildRegistrationListQueryString(input: {
  season: string;
  q: string;
  status: string;
  classroom: string;
  payment: string;
  df1k: string;
  df1v: string;
  df2k: string;
  df2v: string;
  df3k: string;
  df3v: string;
  extraColumnKeys: string[];
  page?: number;
}): string {
  const qs = new URLSearchParams();
  if (input.season) qs.set("season", input.season);
  if (input.q) qs.set("q", input.q);
  if (input.status) qs.set("status", input.status);
  if (input.classroom) qs.set("classroom", input.classroom);
  if (input.payment) qs.set("payment", input.payment);
  for (const slot of ["df1k", "df1v", "df2k", "df2v", "df3k", "df3v"] as const) {
    if (input[slot]) qs.set(slot, input[slot]);
  }
  for (const key of input.extraColumnKeys) {
    qs.append("col", key);
  }
  if (input.page && input.page > 1) qs.set("page", String(input.page));
  return qs.toString();
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

  let seasons: Array<{
    id: string;
    name: string;
    year: number;
    classrooms: Array<{ id: string; name: string }>;
    registrationForm: { publishedDefinitionJson: string | null; draftDefinitionJson: string | null } | null;
  }> = [];
  try {
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

  const seasonParam = queryParamString(sp.season);
  const filterSeason = seasonParam ? (seasons.find((s) => s.id === seasonParam) ?? null) : null;
  const uiSeason = filterSeason ?? seasons[0] ?? null;
  const statsWhere: Prisma.RegistrationWhereInput = filterSeason?.id ? { seasonId: filterSeason.id } : {};

  let totalRegistrations = 0;
  let pendingRegistrations = 0;
  let confirmedRegistrations = 0;
  let waitlistRegistrations = 0;
  let unassignedActive = 0;
  let needsPaymentCount = 0;
  try {
    [
      totalRegistrations,
      pendingRegistrations,
      confirmedRegistrations,
      waitlistRegistrations,
      unassignedActive,
      needsPaymentCount,
    ] = await Promise.all([
      prisma.registration.count({ where: statsWhere }),
      prisma.registration.count({ where: { ...statsWhere, status: "PENDING" } }),
      prisma.registration.count({ where: { ...statsWhere, status: "CONFIRMED" } }),
      prisma.registration.count({ where: { ...statsWhere, status: "WAITLIST" } }),
      prisma.registration.count({
        where: {
          ...statsWhere,
          classroomId: null,
          status: { in: ["PENDING", "CONFIRMED", "WAITLIST"] },
        },
      }),
      prisma.registration.count({
        where: {
          ...statsWhere,
          ...registrationPaymentOutstandingWhere(),
        },
      }),
    ]);
  } catch (error) {
    console.error("[registrations/page] stats failed", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">All Registrations</h1>
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load registration stats. Please refresh in a moment.
        </div>
      </div>
    );
  }

  const dynamicFieldOptions = uiSeason
    ? buildDynamicFieldOptions(
        uiSeason.registrationForm?.publishedDefinitionJson ??
          uiSeason.registrationForm?.draftDefinitionJson,
      )
    : [];
  const dynMap = new Map(dynamicFieldOptions.map((d) => [d.key, d]));

  const q = queryParamString(sp.q);
  const statusFilter = parseRegistrationStatusFilter(queryParamString(sp.status));
  const classroom = queryParamString(sp.classroom);
  const payment = queryParamString(sp.payment);
  const pageRaw = queryParamString(sp.page);
  const pageParsed = parseInt(pageRaw, 10);
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
  const pageSize = 50;

  const rawDynamicFilters: Array<{ key: string; value: string }> = [
    { key: queryParamString(sp.df1k), value: queryParamString(sp.df1v) },
    { key: queryParamString(sp.df2k), value: queryParamString(sp.df2v) },
    { key: queryParamString(sp.df3k), value: queryParamString(sp.df3v) },
  ];
  const dynamicFilters = rawDynamicFilters.filter((f) => f.key && f.value && dynMap.has(f.key));

  const rawCols = sp.col;
  const colKeysRaw = Array.isArray(rawCols) ? rawCols : rawCols ? [rawCols] : [];
  const exportFieldOptions = uiSeason
    ? buildRegistrationExportFieldOptionsFromJson(
        uiSeason.registrationForm?.publishedDefinitionJson ??
          uiSeason.registrationForm?.draftDefinitionJson,
      )
    : [];
  const exportOptionMap = new Map(exportFieldOptions.map((o) => [o.key, o]));
  const extraColumnKeys = colKeysRaw
    .map((k) => k.trim())
    .filter((k, i, arr) => k && exportOptionMap.has(k) && arr.indexOf(k) === i);
  const extraColumns = extraColumnKeys.map((key) => ({
    key,
    label: exportOptionMap.get(key)?.label ?? key,
  }));

  const duplicateGroupCount = filterSeason?.id
    ? await countDuplicateRegistrationGroups(filterSeason.id)
    : 0;

  const listQueryInput = {
    season: seasonParam,
    q,
    status: statusFilter ?? "",
    classroom,
    payment,
    df1k: queryParamString(sp.df1k),
    df1v: queryParamString(sp.df1v),
    df2k: queryParamString(sp.df2k),
    df2v: queryParamString(sp.df2v),
    df3k: queryParamString(sp.df3k),
    df3v: queryParamString(sp.df3v),
    extraColumnKeys,
  };

  const where: Prisma.RegistrationWhereInput = {};
  if (filterSeason?.id) where.seasonId = filterSeason.id;
  if (statusFilter) where.status = statusFilter;
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
        stripeCheckoutReminderSentAt: true,
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
      const s = buildRegistrationListQueryString({ ...listQueryInput, page: totalPages });
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
      const s = buildRegistrationListQueryString({ ...listQueryInput, page: lastPage });
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

  const qsBase = buildRegistrationListQueryString(listQueryInput);
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
    const checkoutPending = isCheckoutPendingRegistration(r);
    const extraCells: Record<string, string> = {};
    for (const key of extraColumnKeys) {
      extraCells[key] = resolveRegistrationExportFieldValue(
        {
          id: r.id,
          registrationNumber: r.registrationNumber,
          status: r.status,
          registeredAt: r.registeredAt,
          notes: r.notes,
          customResponses: r.customResponses,
          child: r.child,
          classroom: r.classroom,
          formSubmission: r.formSubmission,
        },
        r.season.name,
        key,
      );
    }
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
      checkoutPending,
      checkoutReminderSentAtIso: r.formSubmission?.stripeCheckoutReminderSentAt?.toISOString() ?? null,
      extraCells,
    };
  });

  const selectionResetKey = [
    page,
    seasonParam,
    q,
    statusFilter ?? "",
    classroom,
    payment,
    dynamicFilters.map((f) => `${f.key}=${f.value}`).join("&"),
    bulkRows.map((r) => r.id).join(","),
  ].join("|");

  const classroomOptions = filterSeason
    ? filterSeason.classrooms
    : seasons.flatMap((s) => s.classrooms);

  const filtersActive = hasActiveRegistrationListFilters({
    q,
    seasonId: seasonParam,
    status: statusFilter,
    classroom,
    payment,
    dynamicFilters,
  });

  const filterFormKey = [
    seasonParam,
    q,
    statusFilter ?? "",
    classroom,
    payment,
    queryParamString(sp.df1k),
    queryParamString(sp.df1v),
    queryParamString(sp.df2k),
    queryParamString(sp.df2v),
    queryParamString(sp.df3k),
    queryParamString(sp.df3v),
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
        <div className="flex flex-wrap items-center gap-2">
          {uiSeason ? (
            <RegistrationListColumnsModal
              seasons={seasonExportConfigs}
              selectedSeasonId={uiSeason.id}
              activeColumnKeys={extraColumnKeys}
            />
          ) : null}
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

      {duplicateGroupCount > 0 && filterSeason ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <strong>{duplicateGroupCount}</strong> possible duplicate group
          {duplicateGroupCount === 1 ? "" : "s"} in {filterSeason.name} (same child name + guardian email).{" "}
          <Link href={`/registrations/duplicates?season=${filterSeason.id}`} className="font-medium underline">
            Review duplicates
          </Link>
        </div>
      ) : null}

      {filterSeason ? (
        <p className="text-xs text-foreground/60">
          Summary counts below are for <strong className="font-medium text-foreground/75">{filterSeason.name}</strong>.
          Choose <strong className="font-medium text-foreground/75">All seasons</strong> in filters for church-wide totals.
        </p>
      ) : null}

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
        <RegistrationsFiltersForm
          key={filterFormKey}
          initial={{
            q,
            season: seasonParam,
            status: statusFilter ?? "",
            classroom,
            payment,
            df1k: queryParamString(sp.df1k),
            df1v: queryParamString(sp.df1v),
            df2k: queryParamString(sp.df2k),
            df2v: queryParamString(sp.df2v),
            df3k: queryParamString(sp.df3k),
            df3v: queryParamString(sp.df3v),
          }}
          extraColumnKeys={extraColumnKeys}
          seasons={seasons.map((s) => ({ id: s.id, name: s.name, year: s.year }))}
          classrooms={classroomOptions}
          classAssignmentStatusOptions={CLASS_ASSIGNMENT_STATUS_OPTIONS}
          paymentStatusOptions={PAYMENT_STATUS_FILTER_OPTIONS}
          dynamicFieldOptions={dynamicFieldOptions}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          filtersActive={filtersActive}
        />
      </section>

      <RegistrationsBulkTable
        rows={bulkRows}
        extraColumns={extraColumns}
        canBulkAct={canAdd}
        baseQueryString={qsBase}
        page={page}
        totalPages={totalPages}
        hasNextPage={hasNextPage}
        selectionResetKey={selectionResetKey}
      />
    </div>
  );
}
