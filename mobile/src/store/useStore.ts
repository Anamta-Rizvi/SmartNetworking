import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserState {
  userId: number | null;
  displayName: string;
  email: string;
  major: string;
  gradYear: string;
  goalType: string;
  careerTrack: string;
  socialIntent: string;
  selectedTagIds: number[];
  onboardingComplete: boolean;

  setUser: (id: number, name: string, email: string) => void;
  setProfile: (major: string, gradYear: string) => void;
  setGoal: (type: string, careerTrack: string, socialIntent: string) => void;
  setSelectedTagIds: (ids: number[]) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useStore = create<UserState>()(
  persist(
    (set) => ({
      userId: null,
      displayName: '',
      email: '',
      major: '',
      gradYear: '',
      goalType: 'both',
      careerTrack: '',
      socialIntent: '',
      selectedTagIds: [],
      onboardingComplete: false,

      setUser: (id, name, email) => set({ userId: id, displayName: name, email }),
      setProfile: (major, gradYear) => set({ major, gradYear }),
      setGoal: (goalType, careerTrack, socialIntent) => set({ goalType, careerTrack, socialIntent }),
      setSelectedTagIds: (ids) => set({ selectedTagIds: ids }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      reset: () => set({
        userId: null, displayName: '', email: '', major: '', gradYear: '',
        goalType: 'both', careerTrack: '', socialIntent: '',
        selectedTagIds: [], onboardingComplete: false,
      }),
    }),
    {
      name: 'campus-os-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
