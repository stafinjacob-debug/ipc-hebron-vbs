/**
 * Read-only: inspect Graph Sent Items for check-in packet bulk sends.
 * Does not send anything.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function getToken() {
  const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET?.trim();
  if (!tenantId || !clientId || !clientSecret) throw new Error("Graph env missing");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description || `token ${res.status}`);
  return json.access_token;
}

type Row = {
  subject: string;
  sentAt: string;
  to: string;
  hasAttachments: boolean;
  preview: string;
};

async function main() {
  const mailbox = process.env.MICROSOFT_GRAPH_MAILBOX?.trim();
  if (!mailbox) throw new Error("MICROSOFT_GRAPH_MAILBOX missing");
  console.log("mailbox", mailbox);

  const token = await getToken();
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}`;
  let url =
    `${base}/mailFolders/sentitems/messages?$top=50&$orderby=sentDateTime desc` +
    `&$select=id,subject,sentDateTime,toRecipients,hasAttachments,bodyPreview`;

  const all: Row[] = [];
  while (url && all.length < 300) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as {
      value?: Array<Record<string, unknown>>;
      "@odata.nextLink"?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      console.log("list failed", res.status, json.error?.message || json);
      process.exit(1);
    }
    for (const m of json.value ?? []) {
      const toRecipients = m.toRecipients as
        | Array<{ emailAddress?: { address?: string; name?: string } }>
        | undefined;
      all.push({
        subject: String(m.subject ?? "(no subject)"),
        sentAt: String(m.sentDateTime ?? ""),
        to: (toRecipients ?? [])
          .map((r) => r.emailAddress?.address || r.emailAddress?.name || "")
          .filter(Boolean)
          .join(", "),
        hasAttachments: Boolean(m.hasAttachments),
        preview: String(m.bodyPreview ?? "")
          .replace(/\s+/g, " ")
          .slice(0, 120),
      });
    }
    url = typeof json["@odata.nextLink"] === "string" ? json["@odata.nextLink"] : "";
  }

  console.log("sentItemsListed", all.length);

  const packetish = all.filter(
    (m) =>
      /packet|check-?in|welcome|retreat/i.test(m.subject) ||
      /check-?in|digital card|registration #/i.test(m.preview),
  );
  console.log("packetRelated", packetish.length);

  const bySubject = new Map<string, { count: number; withAttach: number; first: string; last: string }>();
  for (const m of packetish) {
    const cur = bySubject.get(m.subject) ?? {
      count: 0,
      withAttach: 0,
      first: m.sentAt,
      last: m.sentAt,
    };
    cur.count += 1;
    if (m.hasAttachments) cur.withAttach += 1;
    if (m.sentAt < cur.first) cur.first = m.sentAt;
    if (m.sentAt > cur.last) cur.last = m.sentAt;
    bySubject.set(m.subject, cur);
  }

  console.log(
    "packetBySubject",
    JSON.stringify(
      [...bySubject.entries()].map(([subject, s]) => ({ subject, ...s })),
      null,
      2,
    ),
  );
  console.log("recentAll", JSON.stringify(all.slice(0, 25), null, 2));
  console.log("recentPacket", JSON.stringify(packetish.slice(0, 25), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
