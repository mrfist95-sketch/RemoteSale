"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <button
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign(window.location.origin + "/login");
      }}
      className={
        variant === "dark"
          ? "w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/8 hover:text-white"
          : "text-sm text-slate-500 hover:text-brand-900"
      }
    >
      Выйти
    </button>
  );
}
