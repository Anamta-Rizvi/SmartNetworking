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
  ghostMode: boolean;
  locationSharingUntil: string | null; // ISO string

  setUser: (id: number, name: string, email: string) => void;
  setProfile: (major: string, gradYear: string) => void;
  setGoal: (type: string, careerTrack: string, socialIntent: string) => void;
  setSelectedTagIds: (ids: number[]) => void;
  completeOnboarding: () => void;
  setGhostMode: (on: boolean) => void;
  setLocationSharingUntil: (until: string | null) => void;
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
      ghostMode: false,
      locationSharingUntil: null,

      setUser: (id, name, email) => set({ userId: id, displayName: name, email }),
      setProfile: (major, gradYear) => set({ major, gradYear }),
      setGoal: (goalType, careerTrack, socialIntent) => set({ goalType, careerTrack, socialIntent }),
      setSelectedTagIds: (ids) => set({ selectedTagIds: ids }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      setGhostMode: (on) => set({ ghostMode: on }),
      setLocationSharingUntil: (until) => set({ locationSharingUntil: until }),
      reset: () => set({
        userId: null, displayName: '', email: '', major: '', gradYear: '',
        goalType: 'both', careerTrack: '', socialIntent: '',
        selectedTagIds: [], onboardingComplete: false,
        ghostMode: false, locationSharingUntil: null,
      }),
    }),
    {
      name: 'campus-os-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
