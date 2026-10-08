"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-brand-700 px-3 py-1.5 text-sm text-white print:hidden"
    >
      Печать
    </button>
  );
}
