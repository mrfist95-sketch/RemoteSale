import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";

const HOME: Record<string, string> = {
  BUYER: "/buyer",
  AGENT: "/agent",
  SELLER: "/seller",
  COURIER: "/courier",
  ANALYST: "/analyst",
  ADMIN: "/admin",
};

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(HOME[user.role] ?? "/login");
}
