import { createClient } from "@/lib/supabase/server";
import { devMode, DEV_USER } from "@/lib/dev";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email = "guest";
  if (devMode()) {
    email = DEV_USER.email;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) email = user.email;
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <Sidebar dev={devMode()} email={email} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
