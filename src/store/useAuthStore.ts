import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { clearDemoData, isDemoModeActive, setDemoModeFlag } from '../lib/demoStorage';

export type Role = 'student' | 'instructor' | 'admin';

export const normalizeRole = (value: unknown): Role =>
  value === 'admin' || value === 'instructor' ? value : 'student';

export type Permission =
  | 'create_course'
  | 'delete_course'
  | 'view_analytics'
  | 'manage_users'
  | 'study_course';

const rolePermissions: Record<Role, Permission[]> = {
  student: ['study_course'],
  instructor: ['create_course', 'view_analytics', 'study_course'],
  admin: [
    'create_course',
    'delete_course',
    'view_analytics',
    'manage_users',
    'study_course',
  ],
};

interface AuthState {
  userRole: Role;
  setUserRole: (role: Role) => void;
  setClaimRole: (role: unknown) => void;
  hasPermission: (permission: Permission) => boolean;
  user: User | null;
  setUser: (user: User | null) => void;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  needsAuth: boolean;
  setNeedsAuth: (needsAuth: boolean) => void;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const readInitialDemoSession = () =>
  typeof localStorage !== 'undefined' && isDemoModeActive();

export const useAuthStore = create<AuthState>((set, get) => ({
  userRole: 'student',
  setUserRole: (role: Role) => {
    if (get().isDemoMode) set({ userRole: role });
  },
  setClaimRole: (role: unknown) => set({ userRole: normalizeRole(role) }),
  hasPermission: (permission: Permission) => {
    const role = get().userRole;
    return rolePermissions[role].includes(permission);
  },
  user: null,
  setUser: (user) => set({ user }),
  accessToken: readInitialDemoSession() ? 'demo-token' : null,
  setAccessToken: (token) => set({ accessToken: token }),
  needsAuth: !readInitialDemoSession(),
  setNeedsAuth: (needsAuth) => set({ needsAuth }),
  isDemoMode: readInitialDemoSession(),
  enterDemoMode: () => {
    setDemoModeFlag(true);
    set({
      isDemoMode: true,
      needsAuth: false,
      user: null,
      accessToken: 'demo-token',
      userRole: 'student',
    });
  },
  exitDemoMode: () => {
    setDemoModeFlag(false);
    void clearDemoData();
    set({
      isDemoMode: false,
      needsAuth: true,
      user: null,
      accessToken: null,
      userRole: 'student',
    });
  },
}));
