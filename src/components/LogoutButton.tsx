"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign(window.location.origin + "/login");
      }}
      className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-300"
    >
      Выйти
    </button>
  );
}
