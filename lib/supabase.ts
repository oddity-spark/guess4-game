import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("🟢 Supabase Client Initialization:", {
  url: supabaseUrl ? "✓ Present" : "✗ Missing",
  key: supabaseAnonKey ? "✓ Present" : "✗ Missing",
  urlValue: supabaseUrl,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "supabase-auth-token",
  },
});

console.log("🟢 Supabase client created:", supabase);
