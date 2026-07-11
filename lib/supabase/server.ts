import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";
import { Database } from "@/types/database";

export async function createClient() {
    const cookieStore = await cookies();
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Server Components cannot mutate cookies; middleware refreshes sessions.
                }
            },
        },
    });
}

