import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { getUser } from '../api/users';

import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';

import { StepAccount } from '../screens/onboarding/StepAccount';
import { StepGoal } from '../screens/onboarding/StepGoal';
import { StepInterests } from '../screens/onboarding/StepInterests';
import { HomeScreen } from '../screens/HomeScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { CopilotScreen } from '../screens/CopilotScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import GoalDashboardScreen from '../screens/GoalDashboardScreen';
import ConnectionsScreen from '../screens/ConnectionsScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ChatScreen from '../screens/ChatScreen';
import ConversationScreen from '../screens/ConversationScreen';
import FeedScreen from '../screens/FeedScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function OnboardingNavigator() {
  const [step, setStep] = useState(0);
  const completeOnboarding = useStore(s => s.completeOnboarding);

  if (step === 0) return <StepAccount onNext={() => setStep(1)} />;
  if (step === 1) return <StepGoal onNext={() => setStep(2)} />;
  return <StepInterests onDone={completeOnboarding} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🗺️</Text>,
        }}
      />
      <Tab.Screen
        name="Copilot"
        component={CopilotScreen}
        options={{
          tabBarLabel: 'Copilot',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🤖</Text>,
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📢</Text>,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { onboardingComplete, userId, displayName, reset, setUser } = useStore();

  // On app start, verify the stored userId still belongs to the stored email.
  // Guards against DB resets where IDs shift to different users.
  const { email: storedEmail } = useStore();
  useEffect(() => {
    if (!onboardingComplete || !userId || !storedEmail) return;
    getUser(userId)
      .then(user => {
        if (user.email.toLowerCase() !== storedEmail.toLowerCase()) {
          // ID exists but belongs to someone else — DB was wiped, reset
          reset();
        }
      })
      .catch(() => {
        // User ID not found at all — reset to onboarding
        reset();
      });
  }, []); // run once on mount

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: Colors.background } }}>
        {!onboardingComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="GoalDashboard"
              component={GoalDashboardScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="Connections"
              component={ConnectionsScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="Conversation"
              component={ConversationScreen}
              options={({ route }: any) => ({
                presentation: 'card',
                headerShown: true,
                title: route.params?.peerName ?? 'Chat',
                headerStyle: { backgroundColor: Colors.card },
                headerTintColor: Colors.text,
                headerTitleStyle: { fontWeight: '700' },
              })}
            />
            <Stack.Screen
              name="Progress"
              component={ProgressScreen}
              options={{
                presentation: 'card',
                headerShown: true,
                title: 'Progress',
                headerStyle: { backgroundColor: Colors.card },
                headerTintColor: Colors.text,
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
