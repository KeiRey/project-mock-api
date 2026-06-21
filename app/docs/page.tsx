"use client";

import { Suspense } from "react";
import DocsContent from "./docs-content";

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-mono">
          <svg className="w-8 h-8 animate-spin text-violet-500 mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs text-zinc-500 tracking-wider uppercase animate-pulse">Loading API Documentation...</span>
        </div>
      }
    >
      <DocsContent />
    </Suspense>
  );
}
