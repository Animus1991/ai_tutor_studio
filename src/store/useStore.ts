import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/db';

interface AppState {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  pomodoroSessions: number;
  studySessionsHistory: { id: string; date: string; duration: number; type: 'focus' | 'break' }[];
  addPomodoroSession: (durationMinutes: number) => void;
  timerTimeLeft: number;
  timerIsActive: boolean;
  timerMode: 'focus' | 'break';
  setTimerTimeLeft: (time: number | ((prev: number) => number)) => void;
  setTimerIsActive: (isActive: boolean) => void;
  setTimerMode: (mode: 'focus' | 'break') => void;
  dailyGoal: number; // in minutes
  setDailyGoal: (goal: number) => void;
  customGoals: { id: string, text: string, type: 'daily' | 'weekly', completed: boolean }[];
  addCustomGoal: (text: string, type: 'daily' | 'weekly') => void;
  toggleCustomGoal: (id: string) => void;
  deleteCustomGoal: (id: string) => void;
  focusDuration: number;
  breakDuration: number;
  setFocusDuration: (minutes: number) => void;
  setBreakDuration: (minutes: number) => void;
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  isBionicReading: boolean;
  toggleBionicReading: () => void;
  isDyslexiaFont: boolean;
  toggleDyslexiaFont: () => void;
  isFeynmanMode: boolean;
  toggleFeynmanMode: () => void;
  isTTSActive: boolean;
  toggleTTS: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      pomodoroSessions: 0,
      studySessionsHistory: [],
      addPomodoroSession: (duration) => set((state) => ({ 
        pomodoroSessions: state.pomodoroSessions + 1,
        studySessionsHistory: [...state.studySessionsHistory, { id: crypto.randomUUID(), date: new Date().toISOString(), duration, type: 'focus' }]
      })),
      timerTimeLeft: 25 * 60,
      timerIsActive: false,
      timerMode: 'focus',
      setTimerTimeLeft: (time) => set((state) => ({ 
        timerTimeLeft: typeof time === 'function' ? time(state.timerTimeLeft) : time 
      })),
      setTimerIsActive: (isActive) => set({ timerIsActive: isActive }),
      setTimerMode: (mode) => set({ timerMode: mode }),
      dailyGoal: 120, // default 2 hours
      setDailyGoal: (goal) => set({ dailyGoal: goal }),
      customGoals: [],
      addCustomGoal: (text, type) => set((state) => ({ customGoals: [...state.customGoals, { id: crypto.randomUUID(), text, type, completed: false }] })),
      toggleCustomGoal: (id) => set((state) => ({ customGoals: state.customGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g) })),
      deleteCustomGoal: (id) => set((state) => ({ customGoals: state.customGoals.filter(g => g.id !== id) })),
      focusDuration: 25,
      breakDuration: 5,
      setFocusDuration: (minutes) => set({ focusDuration: minutes }),
      setBreakDuration: (minutes) => set({ breakDuration: minutes }),
      isFocusMode: false,
      toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),
      isBionicReading: false,
      toggleBionicReading: () => set((state) => ({ isBionicReading: !state.isBionicReading })),
      isDyslexiaFont: false,
      toggleDyslexiaFont: () => set((state) => ({ isDyslexiaFont: !state.isDyslexiaFont })),
      isFeynmanMode: false,
      toggleFeynmanMode: () => set((state) => ({ isFeynmanMode: !state.isFeynmanMode })),
      isTTSActive: false,
      toggleTTS: () => set((state) => ({ isTTSActive: !state.isTTSActive })),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
