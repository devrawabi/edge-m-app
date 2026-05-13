import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StubScreen } from '@/components/StubScreen';
import { useSessionContext } from '@/context/SessionContext';

export default function SettingsPlaceholder() {
  const session = useSessionContext();

  async function logout() {
    await session.signOutLocal();
  }

  const subtitle =
    session.status === 'loggedIn'
      ? `Signed in as ${session.me.email ?? '—'}`
      : 'Open the companion web app while native UI catches up here.';

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#0f172a' }}>
      <StubScreen title="Settings" subtitle={subtitle} />
      <View style={{ gap: 12, marginTop: 12 }}>
        <Pressable style={styles.btn} onPress={() => session.refresh()}>
          <Text style={styles.btnText}>Refresh session</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.logout]} onPress={logout}>
          <Text style={styles.btnLogout}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: '#e2e8f0', fontWeight: '600', fontSize: 15 },
  logout: { borderWidth: 1, borderColor: '#475569', backgroundColor: 'transparent' },
  btnLogout: { color: '#fecdd3', fontWeight: '600', fontSize: 15 },
});
