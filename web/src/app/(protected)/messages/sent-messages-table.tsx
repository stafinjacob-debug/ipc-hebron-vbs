import Link from "next/link";

type Row = {
  id: string;
  toDisplay: string;
  toAddressesNormalized: string;
  subject: string;
  bodyPreview: string | null;
  sentAtLabel: string;
};

export function SentMessagesTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/60">
          <tr>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted">
                No sent messages synced yet. Use Sync mailbox to pull Sent Items from Microsoft 365.
              </td>
            </tr>
          ) : (
            rows.map((message) => (
              <tr key={message.id} className="border-t border-foreground/10 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{message.toDisplay}</p>
                  <p className="text-xs text-muted">{message.toAddressesNormalized.replace(/;/g, " · ")}</p>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/messages/sent/${message.id}`} className="font-medium text-brand hover:underline">
                    {message.subject}
                  </Link>
                  {message.bodyPreview ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{message.bodyPreview}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{message.sentAtLabel}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
