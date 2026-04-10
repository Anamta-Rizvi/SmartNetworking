import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { createUser, loginByEmail } from '../../api/users';
import { getGoal } from '../../api/goals';
import { getInterests } from '../../api/users';
import { useStore } from '../../store/useStore';

interface Props {
  onNext: () => void;
}

export function StepAccount({ onNext }: Props) {
  const { setUser, setProfile, setGoal, setSelectedTagIds, completeOnboarding } = useStore();

  const [isSignIn, setIsSignIn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [major, setMajor] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignUp() {
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await createUser({
        display_name: name.trim(),
        email: email.trim().toLowerCase(),
        major: major.trim() || undefined,
        grad_year: gradYear ? parseInt(gradYear) : undefined,
        university: 'Rutgers',
      });
      setUser(user.id, user.display_name, user.email);
      setProfile(major, gradYear);
      onNext();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await loginByEmail(email.trim());
      setUser(user.id, user.display_name, user.email);
      setProfile(user.major ?? '', user.grad_year?.toString() ?? '');

      // Restore goal and interests from backend
      try {
        const goal = await getGoal(user.id);
        setGoal(goal.primary_type, goal.career_track ?? '', goal.social_intent ?? '');
      } catch {}

      try {
        const interests = await getInterests(user.id);
        setSelectedTagIds(interests.map(t => t.id));
      } catch {}

      completeOnboarding();
    } catch (e: any) {
      setError(e.message ?? 'No account found with that email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.appName}>Campus OS</Text>
        <Text style={styles.title}>{isSignIn ? 'Welcome back' : "Let's get you set up"}</Text>
        <Text style={styles.subtitle}>
          {isSignIn ? 'Sign in with your email' : 'Create your Campus OS profile'}
        </Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isSignIn && styles.toggleBtnActive]}
            onPress={() => { setIsSignIn(false); setError(''); }}
          >
            <Text style={[styles.toggleText, !isSignIn && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isSignIn && styles.toggleBtnActive]}
            onPress={() => { setIsSignIn(true); setError(''); }}
          >
            <Text style={[styles.toggleText, isSignIn && styles.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {!isSignIn && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Alex Chen"
                placeholderTextColor={Colors.muted}
                value={name}
                onChangeText={setName}
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="alex@rutgers.edu"
            placeholderTextColor={Colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {!isSignIn && (
            <>
              <Text style={styles.label}>Major (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Computer Science"
                placeholderTextColor={Colors.muted}
                value={major}
                onChangeText={setMajor}
              />

              <Text style={styles.label}>Graduation Year (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="2027"
                placeholderTextColor={Colors.muted}
                value={gradYear}
                onChangeText={setGradYear}
                keyboardType="numeric"
                maxLength={4}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={isSignIn ? handleSignIn : handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>
                  {isSignIn ? 'Sign In →' : 'Continue →'}
                </Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 28, paddingTop: 60 },
  appName: {
    color: Colors.primary, fontSize: 13, fontWeight: '800',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: Colors.subtext, fontSize: 15, marginBottom: 24 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleText: { color: Colors.subtext, fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  form: { gap: 8 },
  label: {
    color: Colors.subtext, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15, marginBottom: 4,
  },
  error: { color: Colors.accent, fontSize: 13, marginTop: 4, marginBottom: 4 },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
