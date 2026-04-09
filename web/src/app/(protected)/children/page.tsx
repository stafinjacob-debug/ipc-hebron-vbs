import { redirect } from "next/navigation";

export default function ChildrenRedirectPage() {
  redirect("/students");
}
