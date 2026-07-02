// src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  organization_id: string | null
  full_name: string
  role: 'hidrobr_admin' | 'hidrobr_consultant' | 'client_admin' | 'client_user' | 'readonly'
  job_title?: string
  avatar_url?: string
  organization?: { id: string; name: string; segment?: string } | null
}

interface AuthState {
  profile: Profile | null
  isAuthenticated: boolean
  isLoading: boolean
  setProfile: (profile: Profile | null) => void
  setLoading: (v: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      profile: null,
      isAuthenticated: false,
      isLoading: true,
      setProfile: (profile) => set({ profile, isAuthenticated: !!profile }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: async () => {
        await supabase.auth.signOut()
        set({ profile: null, isAuthenticated: false })
      },
    }),
    { name: 'hidrobr-auth', partialize: (s) => ({ profile: s.profile, isAuthenticated: s.isAuthenticated }) }
  )
)

export const isHidrobr = (role?: string) =>
  role === 'hidrobr_admin' || role === 'hidrobr_consultant'
