import { create } from 'zustand';
import { User } from 'firebase/auth';

export type Role = 'student' | 'instructor' | 'admin';

export type Permission = 
  | 'create_course'
  | 'delete_course'
  | 'view_analytics'
  | 'manage_users'
  | 'study_course';

const rolePermissions: Record<Role, Permission[]> = {
  student: ['study_course'],
  instructor: ['create_course', 'view_analytics', 'study_course'],
  admin: ['create_course', 'delete_course', 'view_analytics', 'manage_users', 'study_course']
};

interface AuthState {
  userRole: Role;
  setUserRole: (role: Role) => void;
  hasPermission: (permission: Permission) => boolean;
  user: User | null;
  setUser: (user: User | null) => void;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  needsAuth: boolean;
  setNeedsAuth: (needsAuth: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userRole: 'student', // Default for demonstration
  setUserRole: (role: Role) => set({ userRole: role }),
  hasPermission: (permission: Permission) => {
    const role = get().userRole;
    return rolePermissions[role].includes(permission);
  },
  user: null,
  setUser: (user) => set({ user }),
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  needsAuth: true,
  setNeedsAuth: (needsAuth) => set({ needsAuth })
}));
