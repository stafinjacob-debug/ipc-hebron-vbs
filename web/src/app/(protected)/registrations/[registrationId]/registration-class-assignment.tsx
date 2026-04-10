"use client";

import type { ClassAssignmentMethod } from "@/generated/prisma";
import { ageForClassroomRule } from "@/lib/class-assignment-shared";
import { reassignRegistrationClassroomAction } from "@/app/(protected)/classes/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RegistrationClassAssignment({
  registrationId,
  currentClassroomId,
  currentClassroomName,
  method,
  matchedAtAge,
  overrideReason,
  childDobIso,
  registeredAtIso,
  seasonStartIso,
  classrooms,
  canEdit,
}: {
  registrationId: string;
  currentClassroomId: string | null;
  currentClassroomName: string | null;
  method: ClassAssignmentMethod | null;
  matchedAtAge: number | null;
  overrideReason: string | null;
  childDobIso: string;
  registeredAtIso: string;
  seasonStartIso: string;
  classrooms: { id: string; name: string; ageMin: number; ageMax: number; ageRule: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [hints, setHints] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string>(currentClassroomId ?? "");
  const [reason, setReason] = useState("");

  const childDob = new Date(childDobIso);
  const registeredAt = new Date(registeredAtIso);
  const seasonStart = new Date(seasonStartIso);

  const methodLabel =
    method === "MANUAL"
      ? "Manual (staff moved)"
      : method === "AUTO"
        ? "Automatic (age + optional form field rules)"
        : "Not recorded (legacy)";

  return (
    <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
      <h2 className="text-sm font-semibold text-foreground">Class assignment</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Assigned class</dt>
          <dd className="font-medium text-foreground">{currentClassroomName ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-muted">How assigned</dt>
          <dd>{methodLabel}</dd>
        </div>
        {matchedAtAge != null ? (
          <div>
            <dt className="text-muted">Age used when auto-placed</dt>
            <dd className="tabular-nums">{matchedAtAge} years</dd>
          </div>
        ) : null}
        {overrideReason ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">Override reason</dt>
            <dd className="whitespace-pre-wrap">{overrideReason}</dd>
          </div>
        ) : null}
      </dl>

      {canEdit ? (
        <div className="mt-5 border-t border-foreground/10 pt-5">
          <p className="text-sm font-medium text-foreground">Reassign</p>
          <p className="mt-1 text-xs text-muted">
            You may move a student for sibling grouping, accommodations, or leader decisions. Warnings
            appear if the age band does not match or the room is full.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="text-xs font-medium text-muted" htmlFor="reclass">
                Class
              </label>
              <select
                id="reclass"
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {classrooms.map((c) => {
                  const age = ageForClassroomRule(
                    childDob,
                    c.ageRule as "REGISTRATION_DATE" | "EVENT_START_DATE",
                    registeredAt,
                    seasonStart,
                  );
                  const match = age >= c.ageMin && age <= c.ageMax;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.ageMin}–{c.ageMax})
                      {match ? "" : " · outside age band"}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label className="text-xs font-medium text-muted" htmlFor="reReason">
                Reason (optional)
              </label>
              <input
                id="reReason"
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Sibling grouping"
              />
            </div>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
              onClick={() => {
                setMsg(null);
                setHints(null);
                startTransition(async () => {
                  const r = await reassignRegistrationClassroomAction(
                    registrationId,
                    selected.trim() || null,
                    reason.trim() || null,
                  );
                  setMsg(r.message);
                  setHints(r.hints ?? null);
                  if (r.ok) router.refresh();
                });
              }}
            >
              {pending ? "Saving…" : "Apply"}
            </button>
          </div>
          {msg ? (
            <p className="mt-3 text-sm text-foreground/80">{msg}</p>
          ) : null}
          {hints?.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-900 dark:text-amber-200">
              {hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
