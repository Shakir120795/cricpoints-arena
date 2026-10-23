"use client";

// Provider chooser: Supabase mode when env is configured, otherwise the
// fully-local Demo Mode. Same interface either way (see lib/context.ts).

import React from "react";
import { getSupabaseClient } from "./supabase";
import { DemoProvider } from "./demo-store";
import { SupabaseProvider } from "./supabase-store";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const client = getSupabaseClient();
  if (client) return <SupabaseProvider client={client}>{children}</SupabaseProvider>;
  return <DemoProvider>{children}</DemoProvider>;
}

export { useApp } from "./context";
