import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { devMode, DEV_USER } from "@/lib/dev";
import { ChatUI } from "./chat-ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let email: string;

  if (devMode()) {
    email = DEV_USER.email;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    email = user.email ?? "there";
  }

  const name = email.split("@")[0] ?? "there";
  const greetingName = name.charAt(0).toUpperCase() + name.slice(1);

  return <ChatUI greetingName={greetingName} />;
}
