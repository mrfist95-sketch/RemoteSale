import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/rbac";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("AGENT");
  return <AppShell user={user}>{children}</AppShell>;
}
