"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign(window.location.origin + "/login");
      }}
      className="text-sm text-zinc-500 hover:text-zinc-900"
    >
      Выйти
    </button>
  );
}
