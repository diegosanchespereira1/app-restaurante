import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile } from '../context/AuthContext'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)
export const isServiceRoleConfigured = !!(supabaseUrl && supabaseServiceRoleKey)

if (!isSupabaseConfigured) {
    console.warn("Missing Supabase environment variables. Running in demo mode.")
}

if (!isServiceRoleConfigured) {
    console.warn("Service Role Key not configured. Admin features will be limited.")
}

// Create a real Supabase client only if credentials are provided.
// IMPORTANT: All code that uses this client MUST check isSupabaseConfigured first
// to avoid runtime errors. The RestaurantContext handles this by returning early
// in demo mode before any supabase calls.
export const supabase: SupabaseClient = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as unknown as SupabaseClient)

// Create admin Supabase client with Service Role Key for privileged operations
export const supabaseAdmin: SupabaseClient = isServiceRoleConfigured
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : (null as unknown as SupabaseClient)

/**
 * Helper function to get email by username
 * @param username - The username
 * @returns Email or null if not found
 */
export async function getEmailByUsername(username: string): Promise<string | null> {
    if (!isSupabaseConfigured) {
        return null
    }

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('username', username)
            .single()

        if (error || !data) {
            return null
        }

        return data.email
    } catch (err) {
        console.error('Error fetching email by username:', err)
        return null
    }
}

/**
 * Helper function to get user profile from database
 * @param userId - The user ID from auth.users
 * @returns UserProfile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) {
        return null
    }

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('Error fetching user profile:', error)
            return null
        }

        return data as UserProfile
    } catch (err) {
        console.error('Error fetching user profile:', err)
        return null
    }
}

/**
 * Helper function to update user profile
 * @param userId - The user ID
 * @param updates - Partial profile updates (role can only be updated by admin)
 * @returns Success status and error if any
 */
export async function updateUserProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase not configured' }
    }

    try {
        const { error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', userId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Unknown error' }
    }
}

/**
 * Helper function to change user password (requires Service Role Key)
 * @param userId - The user ID
 * @param newPassword - The new password
 * @returns Success status and error if any
 */
export async function changeUserPassword(
    userId: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    if (!isServiceRoleConfigured) {
        return { 
            success: false, 
            error: 'Service Role Key não configurada. Adicione VITE_SUPABASE_SERVICE_ROLE_KEY ao arquivo .env' 
        }
    }

    if (!supabaseAdmin) {
        return { 
            success: false, 
            error: 'Cliente admin não inicializado. Verifique se VITE_SUPABASE_SERVICE_ROLE_KEY está configurado corretamente.' 
        }
    }

    try {
        console.log('Alterando senha para usuário:', userId)
        
        // Use admin client to update user password
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        )

        if (error) {
            console.error('Erro ao alterar senha:', error)
            return { success: false, error: error.message }
        }

        console.log('Senha alterada com sucesso:', data)
        return { success: true }
    } catch (err: any) {
        console.error('Exceção ao alterar senha:', err)
        return { success: false, error: err.message || 'Erro ao alterar senha' }
    }
}
