import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
    console.warn("Missing Supabase environment variables. Running in demo mode.")
}

// Create a real Supabase client only if credentials are provided.
// IMPORTANT: All code that uses this client MUST check isSupabaseConfigured first
// to avoid runtime errors. The RestaurantContext handles this by returning early
// in demo mode before any supabase calls.
export const supabase: SupabaseClient = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as unknown as SupabaseClient)
