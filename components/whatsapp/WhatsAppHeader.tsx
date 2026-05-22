import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useSessionContext } from '@/context/SessionContext';
import { WhatsAppLinkedDevicesModal } from './WhatsAppLinkedDevicesModal';
import { WhatsAppStarredMessagesModal } from './WhatsAppStarredMessagesModal';

type WhatsAppHeaderProps = {
  title?: string;
  onSearchPress?: () => void;
  onCameraPress?: () => void;
};

export function WhatsAppHeader({
  title = 'WhatsApp Business',
  onSearchPress,
  onCameraPress,
}: WhatsAppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const session = useSessionContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);

  const headerBg = isDark ? '#1f2c34' : '#008069';
  const dropdownBg = isDark ? '#233138' : '#ffffff';
  const dropdownText = isDark ? '#e9edef' : '#111b21';
  const dropdownBorder = isDark ? '#2f3b43' : '#e9edef';
  const dropdownDivider = isDark ? '#2c3941' : '#f0f2f5';

  const handleLogout = async () => {
    setMenuOpen(false);
    await session.signOutLocal();
    router.replace('/login');
  };

  const handleSelect = (key: string) => {
    setMenuOpen(false);
    if (key === 'linked') setLinkedOpen(true);
    else if (key === 'starred') setStarredOpen(true);
    else if (key === 'settings') router.push('/settings' as any);
    else if (key === 'tools') router.push('/tools' as any);
    else if (key === 'new-group') router.push('/contacts' as any);
    else if (key === 'new-broadcast') router.push('/campaigns' as any);
  };

  const menuItems = [
    { key: 'new-group', label: 'New group' },
    { key: 'new-broadcast', label: 'New broadcast' },
    { key: 'linked', label: 'Linked devices' },
    { key: 'starred', label: 'Starred messages' },
    { key: 'tools', label: 'Business tools' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <>
      {/* ── Main Header Bar ── */}
      <View
        style={[
          styles.bar,
          { backgroundColor: headerBg, paddingTop: insets.top + 8 },
        ]}
      >
        <Text style={styles.title}>{title}</Text>

        <View style={styles.icons}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onCameraPress}
            style={styles.iconBtn}
            accessibilityLabel="Camera"
          >
            <Ionicons name="camera-outline" size={23} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onSearchPress}
            style={styles.iconBtn}
            accessibilityLabel="Search"
          >
            <Ionicons name="search-outline" size={23} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setMenuOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={23} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Dropdown Menu Modal ── */}
      {menuOpen && (
        <Modal
          transparent
          visible={menuOpen}
          animationType="none"
          onRequestClose={() => setMenuOpen(false)}
        >
          {/* Invisible full-screen backdrop */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuOpen(false)}
          />

          {/* Floating dropdown */}
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: dropdownBg,
                borderColor: dropdownBorder,
                top: insets.top + 50,
              },
            ]}
          >
            {menuItems.map((item, idx) => (
              <View key={item.key}>
                {idx === menuItems.length - 2 && (
                  <View style={[styles.menuDivider, { backgroundColor: dropdownDivider }]} />
                )}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuItem}
                  onPress={() => handleSelect(item.key)}
                >
                  <Text style={[styles.menuText, { color: dropdownText }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={[styles.menuDivider, { backgroundColor: dropdownDivider }]} />

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.menuItem}
              onPress={handleLogout}
            >
              <Text style={[styles.menuText, { color: '#f87171' }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* ── Sub-Modals ── */}
      <WhatsAppLinkedDevicesModal
        visible={linkedOpen}
        onClose={() => setLinkedOpen(false)}
      />
      <WhatsAppStarredMessagesModal
        visible={starredOpen}
        onClose={() => setStarredOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    flex: 1,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  iconBtn: {
    padding: 2,
  },
  // ── Dropdown ──
  dropdown: {
    position: 'absolute',
    right: 10,
    width: 210,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    zIndex: 99999,
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '400',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});
