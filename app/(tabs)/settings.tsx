import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useSessionContext } from '@/context/SessionContext';
import { useThemePreference } from '@/context/ThemePreferenceContext';

type SettingsRow = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isDestructive?: boolean;
};

export default function SettingsScreen() {
  const session = useSessionContext();
  const router = useRouter();
  const scheme = useColorScheme();
  const { preference, setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();
  const isDark = scheme === 'dark';

  const bg = isDark ? '#0b141a' : '#f0f2f5';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';
  const cardBg = isDark ? '#111b21' : '#ffffff';
  const divider = isDark ? '#222d34' : '#e9edef';
  const headerBg = isDark ? '#1f2c34' : '#008069';

  const userName =
    session.status === 'loggedIn' ? session.me.name || 'Rawabi Edge Admin' : 'Rawabi Edge Admin';
  const userEmail =
    session.status === 'loggedIn' ? session.me.email : 'admin@rawabiedge.com';
  const userInitial = userName.charAt(0).toUpperCase();

  const themeLabel =
    preference === 'system' ? 'System default' : preference === 'light' ? 'Light' : 'Dark';

  const handleLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => session.signOutLocal(),
      },
    ]);

  const showThemePicker = () =>
    Alert.alert('Choose theme', 'Select appearance for Rawabi Edge', [
      { text: 'System default', onPress: () => setPreference('system') },
      { text: 'Light', onPress: () => setPreference('light') },
      { text: 'Dark', onPress: () => setPreference('dark') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const rows: SettingsRow[] = [
    {
      id: 'tools',
      icon: 'briefcase-outline',
      iconBg: '#128C7E',
      title: 'Business tools',
      subtitle: 'Profile, catalog, quick replies, labels',
      onPress: () => router.push('/tools' as any),
    },
    {
      id: 'account',
      icon: 'key-outline',
      iconBg: '#34B7F1',
      title: 'Account',
      subtitle: 'Security notifications, request account info',
      onPress: () =>
        Alert.alert('Account', 'Managed by your corporate security policy.'),
    },
    {
      id: 'privacy',
      icon: 'lock-closed-outline',
      iconBg: '#00A884',
      title: 'Privacy',
      subtitle: 'Block contacts, disappearing messages',
      onPress: () =>
        Alert.alert('Privacy', 'Contact blocks are managed via the Tools menu.'),
    },
    {
      id: 'chats',
      icon: 'chatbubble-ellipses-outline',
      iconBg: '#25D366',
      title: 'Chats',
      subtitle: `Theme: ${themeLabel}`,
      onPress: showThemePicker,
    },
    {
      id: 'notifications',
      icon: 'notifications-outline',
      iconBg: '#F4B400',
      title: 'Notifications',
      subtitle: 'Message, group & call tones, popups',
      onPress: () =>
        Alert.alert(
          'Notifications',
          'Push alerts are managed via system notification settings.'
        ),
    },
    {
      id: 'storage',
      icon: 'pie-chart-outline',
      iconBg: '#E91E63',
      title: 'Storage and data',
      subtitle: 'Network usage, auto-download',
      onPress: () =>
        Alert.alert('Storage & Data', 'Media caches are managed automatically.'),
    },
    {
      id: 'language',
      icon: 'globe-outline',
      iconBg: '#673AB7',
      title: 'App language',
      subtitle: "English (phone's language)",
      onPress: () =>
        Alert.alert('Language', 'App language follows your system language settings.'),
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      iconBg: '#0097A7',
      title: 'Help',
      subtitle: 'Help center, contact us, privacy policy',
      onPress: () =>
        Alert.alert(
          'Rawabi Support',
          'Rawabi Edge Mobile v1.0.0\nContact your workspace administrator.'
        ),
    },
    {
      id: 'invite',
      icon: 'people-outline',
      iconBg: '#4CAF50',
      title: 'Invite a friend',
      onPress: () =>
        Alert.alert('Invite', 'Share: https://wa.me/download'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: headerBg, paddingTop: insets.top + 10 },
        ]}
      >
        <Text style={styles.headerText}>Settings</Text>
        <TouchableOpacity activeOpacity={0.7} style={styles.headerSearch}>
          <Ionicons name="search-outline" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Profile Card ── */}
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.profileCard, { backgroundColor: cardBg, borderBottomColor: divider }]}
          onPress={() =>
            Alert.alert('Edit Profile', 'Profile editing is managed via the web admin panel.')
          }
        >
          {/* Avatar */}
          <View style={[styles.profileAvatar, { backgroundColor: '#128C7E' }]}>
            <Text style={styles.profileAvatarText}>{userInitial}</Text>
          </View>

          {/* Name & info */}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: textHi }]} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={[styles.profileSub, { color: textMuted }]} numberOfLines={1}>
              {userEmail}
            </Text>
            <Text style={[styles.profileAvailability, { color: '#00a884' }]}>
              Available · Rawabi Edge Admin
            </Text>
          </View>

          {/* QR + chevron */}
          <View style={styles.profileActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert('My QR Code', `Pairing QR active for:\n${userEmail}`)
              }
              style={styles.qrBtn}
            >
              <Ionicons name="qr-code-outline" size={22} color="#00a884" />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </View>
        </TouchableOpacity>

        {/* ── Settings Rows ── */}
        <View style={{ marginTop: 12 }}>
          <View style={[styles.section, { backgroundColor: cardBg, borderColor: divider }]}>
            {rows.map((row, idx) => (
              <View key={row.id}>
                {idx > 0 && (
                  <View
                    style={[
                      styles.rowDivider,
                      { backgroundColor: divider, marginLeft: 72 },
                    ]}
                  />
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.settingsRow,
                    pressed && {
                      backgroundColor: isDark ? '#202c33' : '#f5f6f6',
                    },
                  ]}
                  onPress={row.onPress}
                >
                  {/* Colored square-rounded icon */}
                  <View style={[styles.rowIcon, { backgroundColor: row.iconBg }]}>
                    <Ionicons name={row.icon} size={19} color="#ffffff" />
                  </View>

                  {/* Text */}
                  <View style={styles.rowText}>
                    <Text
                      style={[
                        styles.rowTitle,
                        { color: row.isDestructive ? '#ef4444' : textHi },
                      ]}
                    >
                      {row.title}
                    </Text>
                    {row.subtitle ? (
                      <Text
                        style={[styles.rowSubtitle, { color: textMuted }]}
                        numberOfLines={1}
                      >
                        {row.subtitle}
                      </Text>
                    ) : null}
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={textMuted} />
                </Pressable>
              </View>
            ))}
          </View>

          {/* ── Log Out ── */}
          <View
            style={[
              styles.section,
              { backgroundColor: cardBg, borderColor: divider, marginTop: 12 },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.settingsRow,
                pressed && { backgroundColor: isDark ? '#202c33' : '#f5f6f6' },
              ]}
              onPress={handleLogout}
            >
              <View style={[styles.rowIcon, { backgroundColor: '#ea4335' }]}>
                <Ionicons name="log-out-outline" size={19} color="#ffffff" />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: '#ea4335' }]}>Log out</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={[styles.waLogoRow]}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={[styles.footerBrand, { color: textMuted }]}>
              WhatsApp Business
            </Text>
          </View>
          <Text style={[styles.footerVersion, { color: textMuted }]}>
            Rawabi Edge · v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  headerText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSearch: {
    padding: 4,
  },
  // ── Profile ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileSub: {
    fontSize: 13.5,
    marginBottom: 3,
  },
  profileAvailability: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrBtn: {
    padding: 4,
  },
  // ── Settings rows ──
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    minHeight: 62,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 1,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  // ── Footer ──
  footer: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
    gap: 6,
  },
  waLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerVersion: {
    fontSize: 12,
  },
});
