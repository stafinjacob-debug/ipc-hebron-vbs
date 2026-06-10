import Link from "next/link";

export function MessagesFolderNav({
  current,
  showCompose,
}: {
  current: "inbox" | "sent" | "compose" | "check-in-packet";
  showCompose: boolean;
}) {
  const tab =
    "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const active = "bg-brand text-white";
  const inactive =
    "border border-foreground/15 bg-background text-foreground hover:bg-foreground/[0.04]";
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Mailbox sections">
      <Link href="/messages" className={`${tab} ${current === "inbox" ? active : inactive}`}>
        Inbox
      </Link>
      <Link href="/messages?view=sent" className={`${tab} ${current === "sent" ? active : inactive}`}>
        Sent
      </Link>
      {showCompose ? (
        <>
          <Link
            href="/messages/compose"
            className={`${tab} ${current === "compose" ? active : inactive}`}
          >
            Compose
          </Link>
          <Link
            href="/messages/check-in-packet"
            className={`${tab} ${current === "check-in-packet" ? active : inactive}`}
          >
            Check-in packet
          </Link>
        </>
      ) : null}
    </nav>
  );
}
