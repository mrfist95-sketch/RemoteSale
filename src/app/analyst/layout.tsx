import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/rbac";

export default async function AnalystLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ANALYST");
  return <AppShell user={user}>{children}</AppShell>;
}
