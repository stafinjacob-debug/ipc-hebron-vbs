import { redirect } from "next/navigation";

/** Avoid shadowing `/messages/[messageId]` when the dynamic id is literally `sent`. */
export default function SentFolderRedirectPage() {
  redirect("/messages?view=sent");
}
