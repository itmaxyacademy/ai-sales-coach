import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Role baru sesuai backend
export type Role = 'karyawan' | 'manager' | 'company_admin' | 'super_admin' | null;

// Helper: apakah role ini setara "manager" lama?
export function isManagerRole(role: Role): boolean {
  return role === 'manager' || role === 'company_admin' || role === 'super_admin';
}

// Helper: apakah role ini setara "admin" lama?
export function isAdminRole(role: Role): boolean {
  return role === 'company_admin' || role === 'super_admin';
}

// Ke halaman mana redirect setelah login?
export function getDashboardPath(role: Role): string {
  switch (role) {
    case 'manager':
      return '/manager/dashboard';
    case 'super_admin':
      return '/admin/strategic';
    case 'company_admin':
      return '/admin/dashboard';
    default:
      return '/karyawan/dashboard';
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId?: string | null;
  companyName?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);
