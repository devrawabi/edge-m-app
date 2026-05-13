import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';

import { getApiBaseUrl } from '@/constants/Config';
import { useSessionContext } from '@/context/SessionContext';

type RnTextInput = React.ComponentRef<typeof TextInput>;

export default function LoginScreen() {
  const session = useSessionContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [show2fa, setShow2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<RnTextInput>(null);
  const passwordRef = useRef<RnTextInput>(null);
  const totpRef = useRef<RnTextInput>(null);

  const missingBase = useMemo(() => !getApiBaseUrl(), []);

  if (session.status === 'loggedIn') {
    return <Redirect href="/" />;
  }

  async function submit() {
    if (missingBase) return;
    setBusy(true);
    setError(null);
    try {
      const hint = await session.credentialsLogin(email.trim(), password, show2fa ? totp.trim() : undefined);
      if (hint === '2FA') {
        setShow2fa(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, width: '100%', backgroundColor: '#0b141a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.badge}>Rawabi Edge</Text>
        <Text style={styles.title}>Mobile console</Text>
        <Text style={styles.sub}>Session cookies stay on-device via SecureStore.</Text>
      </View>

      {missingBase ? (
        <Text style={styles.errorPanel}>
          Missing EXPO_PUBLIC_API_BASE_URL — create a .env file pointing at your deployed Next server.
        </Text>
      ) : null}

      <View style={styles.form}>
        {error ? (
          <Text style={styles.errorPanel} selectable>
            {error}
          </Text>
        ) : null}
        <Label text="Work email" />
        <TextInput
          ref={emailRef}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="username"
          autoComplete={Platform.OS === 'web' ? 'email' : 'username'}
          returnKeyType="next"
          blurOnSubmit={false}
          placeholder="admin@example.com"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Label text="Password" />
        <TextInput
          ref={passwordRef}
          style={styles.input}
          secureTextEntry
          textContentType="password"
          autoComplete={Platform.OS === 'web' ? 'current-password' : 'password'}
          returnKeyType={show2fa ? 'next' : 'go'}
          blurOnSubmit={false}
          placeholder="••••••••"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => {
            if (show2fa) totpRef.current?.focus();
            else void submit();
          }}
        />
        {show2fa ? (
          <>
            <Label text="Authenticator code" />
            <TextInput
              ref={totpRef}
              style={styles.input}
              keyboardType="number-pad"
              inputMode={Platform.OS === 'web' ? 'numeric' : undefined}
              returnKeyType="go"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor="#64748b"
              value={totp}
              onChangeText={(text) => setTotp(text.replace(/\D/g, ''))}
              onSubmitEditing={() => void submit()}
            />
          </>
        ) : null}
        <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void submit()} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#07110c" />
          ) : (
            <Text style={styles.buttonText}>{show2fa ? 'Verify & continue' : 'Sign in'}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const accent = '#25d366';
const border = '#23323a';

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 28 },
  badge: {
    color: accent,
    letterSpacing: 3,
    fontSize: 11,
    marginBottom: 8,
    fontWeight: '600',
  },
  title: { color: '#fff', fontSize: 32, fontWeight: '600' },
  sub: { marginTop: 8, color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  form: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  label: {
    color: '#94a3b8',
    letterSpacing: 1,
    fontSize: 11,
    marginTop: 8,
  },
  input: {
    alignSelf: 'stretch',
    width: '100%',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f8fafc',
    backgroundColor: '#0f172a',
  },
  button: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    backgroundColor: accent,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#07110c', fontWeight: '700', fontSize: 16 },
  errorPanel: {
    color: '#fecdd3',
    backgroundColor: '#3f0d12',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#7f1d1d',
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 20,
    alignSelf: 'stretch',
    maxWidth: '100%',
    flexShrink: 1,
  },
});
