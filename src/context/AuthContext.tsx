import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'gerente' | 'usuario'

export interface UserProfile {
  id: string
  email: string
  username: string | null
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  error: string | null
  signIn: (emailOrUsername: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, fullName?: string, role?: UserRole, username?: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean
  isAdmin: boolean
  isGerente: boolean
  isUsuario: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper function to get email by username
  const getEmailByUsername = async (username: string): Promise<string | null> => {
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

  // Helper function to check if input is email or username
  const isEmail = (input: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
  }

  // Create user profile if it doesn't exist
  const createUserProfile = useCallback(async (userId: string, email: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured) {
      return null
    }

    try {
      console.log('Creating user profile for:', { userId, email })
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: email,
          role: 'usuario', // Default role
          full_name: null,
          username: null
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating user profile:', error)
        return null
      }

      console.log('User profile created:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Error creating user profile:', err)
      return null
    }
  }, [])

  // Fetch user profile from database
  const fetchUserProfile = useCallback(async (userId: string, userEmail?: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured) {
      // Demo mode: return mock profile
      return {
        id: userId,
        email: 'demo@example.com',
        username: 'demo',
        full_name: 'Demo User',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    try {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      // If profile doesn't exist, try to create it
      if (profileError) {
        console.warn('Profile not found, error:', profileError)
        
        // Check if it's a "not found" error (PGRST116 or similar)
        const isNotFoundError = 
          profileError.code === 'PGRST116' || 
          profileError.code === '42P01' ||
          profileError.message?.includes('No rows') ||
          profileError.message?.includes('not found') ||
          profileError.message?.includes('does not exist')
        
        if (isNotFoundError) {
          console.log('Profile does not exist, attempting to create...')
          
          // Get user email from auth if not provided
          let email = userEmail
          if (!email) {
            try {
              const { data: authUser } = await supabase.auth.getUser()
              email = authUser?.user?.email || 'unknown@example.com'
            } catch (err) {
              console.error('Error getting user email:', err)
              email = 'unknown@example.com'
            }
          }
          
          // Try to create the profile
          const newProfile = await createUserProfile(userId, email)
          if (newProfile) {
            console.log('Profile created successfully')
            return newProfile
          } else {
            console.error('Failed to create profile automatically')
            // Return a fallback profile to prevent UI issues
            return {
              id: userId,
              email: email,
              username: null,
              full_name: null,
              role: 'usuario',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
        }
        
        console.error('Error fetching user profile:', profileError)
        return null
      }

      console.log('User profile fetched:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Error fetching user profile:', err)
      return null
    }
  }, [createUserProfile])

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode: set mock user
      const mockUser = {
        id: 'demo-user-id',
        email: 'demo@example.com',
      } as User
      setUser(mockUser)
      setProfile({
        id: mockUser.id,
        email: mockUser.email,
        username: 'demo',
        full_name: 'Demo User',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      setIsLoading(false)
      return
    }

    let mounted = true
    let hasSetLoading = false

    // Safety timeout to ensure loading is always set to false
    const safetyTimeout = setTimeout(() => {
      if (mounted && !hasSetLoading) {
        console.warn('Auth loading timeout - forcing isLoading to false')
        setIsLoading(false)
        hasSetLoading = true
      }
    }, 10000) // 10 seconds max

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return
      
      if (error) {
        console.error('Error getting session:', error)
        setError(error.message)
        clearTimeout(safetyTimeout)
        setIsLoading(false)
        hasSetLoading = true
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email).then((profile) => {
          if (!mounted) return
          setProfile(profile)
          clearTimeout(safetyTimeout)
          if (!hasSetLoading) {
            setIsLoading(false)
            hasSetLoading = true
          }
        }).catch((err) => {
          console.error('Error fetching profile:', err)
          if (!mounted) return
          clearTimeout(safetyTimeout)
          if (!hasSetLoading) {
            setIsLoading(false)
            hasSetLoading = true
          }
        })
      } else {
        clearTimeout(safetyTimeout)
        if (!hasSetLoading) {
          setIsLoading(false)
          hasSetLoading = true
        }
      }
    })

    // Listen for auth changes (but don't interfere with initial load)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      console.log('Auth state changed:', event, session?.user?.email)
      
      // Only handle auth state changes after initial load
      if (hasSetLoading) {
        setSession(session)
        setUser(session?.user ?? null)
        setError(null)

        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user.id, session.user.email)
          if (mounted) {
            setProfile(userProfile)
          }
        } else {
          setProfile(null)
        }
      }
    })

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set up real-time subscription for user profile changes
  // Disabled to avoid infinite loading issues - use refreshProfile() manually instead
  // useEffect(() => {
  //   if (!isSupabaseConfigured || !user) {
  //     return
  //   }

  //   let isSubscribed = true

  //   const profileChannel = supabase
  //     .channel(`user-profile-changes-${user.id}`)
  //     .on(
  //       'postgres_changes',
  //       {
  //         event: '*',
  //         schema: 'public',
  //         table: 'user_profiles',
  //         filter: `id=eq.${user.id}`,
  //       },
  //       async (payload) => {
  //         console.log('User profile changed:', payload)
  //         // Only update if component is still mounted and subscribed
  //         if (isSubscribed && user) {
  //           // Refresh profile when it changes (without setting isLoading)
  //           const updatedProfile = await fetchUserProfile(user.id)
  //           if (updatedProfile && isSubscribed) {
  //             setProfile(updatedProfile)
  //           }
  //         }
  //       }
  //     )
  //     .subscribe((status) => {
  //       console.log('Profile channel subscription status:', status)
  //     })

  //   return () => {
  //     isSubscribed = false
  //     supabase.removeChannel(profileChannel)
  //   }
  // }, [user?.id, fetchUserProfile])

  const signIn = async (emailOrUsername: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setError(null)
    
    if (!isSupabaseConfigured) {
      // Demo mode: allow any login
      const mockUser = {
        id: 'demo-user-id',
        email: emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@demo.com`,
      } as User
      setUser(mockUser)
      setProfile({
        id: mockUser.id,
        email: mockUser.email,
        username: emailOrUsername.includes('@') ? null : emailOrUsername,
        full_name: 'Demo User',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      return { success: true }
    }

    try {
      // Determine if input is email or username
      let email = emailOrUsername
      
      if (!isEmail(emailOrUsername)) {
        // It's a username, fetch the email
        const emailFromUsername = await getEmailByUsername(emailOrUsername)
        if (!emailFromUsername) {
          setError('Usuário não encontrado')
          return { success: false, error: 'Usuário não encontrado' }
        }
        email = emailFromUsername
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return { success: false, error: signInError.message }
      }

      if (data.user) {
        const userProfile = await fetchUserProfile(data.user.id, data.user.email)
        setProfile(userProfile)
      }

      return { success: true }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao fazer login'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    role: UserRole = 'usuario',
    username?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null)

    if (!isSupabaseConfigured) {
      return { success: false, error: 'Registro não disponível em modo demo' }
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
            role: role,
            username: username || null,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return { success: false, error: signUpError.message }
      }

      // Profile will be created automatically by trigger
      return { success: true }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar conta'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const refreshProfile = async (): Promise<void> => {
    if (!user) {
      return
    }

    try {
      // Don't set isLoading here to avoid infinite loading
      const updatedProfile = await fetchUserProfile(user.id, user.email)
      if (updatedProfile) {
        setProfile(updatedProfile)
      }
    } catch (err: any) {
      console.error('Error refreshing profile:', err)
      setError(err.message || 'Erro ao atualizar perfil')
    }
  }

  const signOut = async (): Promise<void> => {
    setError(null)

    if (!isSupabaseConfigured) {
      setUser(null)
      setProfile(null)
      setSession(null)
      return
    }

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError(signOutError.message)
      } else {
        setUser(null)
        setProfile(null)
        setSession(null)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer logout')
    }
  }

  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!profile) {
      console.warn('hasPermission: No profile found')
      return false
    }

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    // Normalize role to lowercase to handle case variations
    const userRole = (profile.role?.toLowerCase() || 'usuario') as UserRole
    
    // Admin tem acesso a tudo
    if (userRole === 'admin') {
      return true
    }
    
    // Gerente tem acesso a gerente e usuario
    if (userRole === 'gerente' && (roles.includes('gerente') || roles.includes('usuario'))) {
      return true
    }
    
    // Usuario só tem acesso a usuario
    if (userRole === 'usuario' && roles.includes('usuario')) {
      return true
    }

    return false
  }

  const isAdmin = profile?.role === 'admin'
  const isGerente = profile?.role === 'gerente'
  const isUsuario = profile?.role === 'usuario'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        hasPermission,
        isAdmin,
        isGerente,
        isUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

