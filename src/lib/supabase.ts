import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
    console.warn("Missing Supabase environment variables. Running in demo mode.")
}

// Create a real Supabase client only if credentials are provided
// Otherwise, we'll handle this in the RestaurantContext with demo data
export const supabase: SupabaseClient = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as unknown as SupabaseClient) // This will be handled by the context
