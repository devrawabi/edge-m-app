import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter, type Href } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemeSwitcherHeaderButton } from '@/components/ThemeSwitcherHeaderButton';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSessionContext } from '@/context/SessionContext';
import { nudgeInboxHeader } from '@/lib/inbox-header-nudge';

function IonTabIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return <Ionicons name={name} size={26} style={{ marginBottom: -4 }} color={color} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerBg = isDark ? '#0f172a' : '#ffffff';
  const headerFg = isDark ? '#f8fafc' : '#0f172a';
  const tabBarBg = isDark ? '#0f172a' : '#f8fafc';
  const tabBarBorder = isDark ? '#1e293b' : '#e2e8f0';
  const sidebarBg = isDark ? '#0f172a' : '#ffffff';
  const sidebarBorder = isDark ? '#1e293b' : '#e2e8f0';
  const sidebarFg = headerFg;
  const backdropTint = isDark ? 'rgba(2, 6, 23, 0.5)' : 'rgba(15, 23, 42, 0.28)';
  const sidebarItemPressed = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
  const headerShown = useClientOnlyValue(false, Platform.OS !== 'android');
  const session = useSessionContext();
  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = React.useState(false);

  /** Paths omit the `(tabs)` group — same URLs as `<Redirect href="/" />` after login. */
  const toolItems: { route: Href; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { route: '/', title: 'Dashboard', icon: 'pulse-outline' },
    { route: '/inbox', title: 'Inbox', icon: 'chatbubbles-outline' },
    { route: '/contacts', title: 'Contacts', icon: 'people-outline' },
    { route: '/campaigns', title: 'Campaigns', icon: 'megaphone-outline' },
    { route: '/catalog', title: 'Catalog', icon: 'cube-outline' },
    { route: '/flows', title: 'Flows', icon: 'git-network-outline' },
    { route: '/automation', title: 'Automation', icon: 'hardware-chip-outline' },
    { route: '/templates', title: 'Templates', icon: 'documents-outline' },
    { route: '/insights', title: 'Insights', icon: 'analytics-outline' },
    { route: '/activity-log', title: 'Activity', icon: 'clipboard-outline' },
    { route: '/settings', title: 'Settings', icon: 'settings-outline' },
    { route: '/admin', title: 'Admin', icon: 'shield-outline' },
  ];

  if (session.status === 'loading') {
    return (
      <View style={[guardStyles.flex, { backgroundColor: isDark ? '#0b141a' : '#f8fafc' }]}>
        <ActivityIndicator size="large" color="#25D366" />
      </View>
    );
  }

  if (session.status === 'loggedOut') {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme].tint,
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: { fontSize: 10, maxWidth: 72 },
          tabBarItemStyle: { paddingHorizontal: 2 },
          tabBarStyle: {
            backgroundColor: tabBarBg,
            borderTopColor: tabBarBorder,
          },
          headerStyle: {
            backgroundColor: headerBg,
            borderBottomWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            shadowOffset: { width: 0, height: 0 },
          },
          headerTitleStyle: { color: headerFg },
          headerTintColor: headerFg,
          tabBarHideOnKeyboard: true,
          headerShown,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setSidebarVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="menu-outline" size={22} color={headerFg} />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IonTabIcon name="pulse-outline" color={color} />,
            headerRight: () => <ThemeSwitcherHeaderButton tintColor={headerFg} />,
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: 'Inbox',
            /** Inbox sets its own title via `setOptions`; header must be visible on Android too (tabs default hides it). */
            headerShown: true,
            /** Full-height inbox (thread + composer); hide tab bar like a dedicated chat screen. */
            tabBarStyle: { display: 'none', height: 0 },
            tabBarIcon: ({ color }) => <IonTabIcon name="chatbubbles-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            title: 'Contacts',
            tabBarIcon: ({ color }) => <IonTabIcon name="people-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="campaigns"
          options={{
            href: null,
            title: 'Campaigns',
            tabBarIcon: ({ color }) => <IonTabIcon name="megaphone-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            href: null,
            title: 'Catalog',
            tabBarIcon: ({ color }) => <IonTabIcon name="cube-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="flows"
          options={{
            href: null,
            title: 'Flows',
            tabBarIcon: ({ color }) => <IonTabIcon name="git-network-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="automation"
          options={{
            href: null,
            title: 'Automation',
            tabBarIcon: ({ color }) => <IonTabIcon name="hardware-chip-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="templates"
          options={{
            href: null,
            title: 'Templates',
            tabBarIcon: ({ color }) => <IonTabIcon name="documents-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            href: null,
            title: 'Insights',
            tabBarIcon: ({ color }) => <IonTabIcon name="analytics-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="activity-log"
          options={{
            href: null,
            title: 'Activity',
            tabBarIcon: ({ color }) => <IonTabIcon name="clipboard-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
            title: 'Settings',
            tabBarIcon: ({ color }) => <IonTabIcon name="settings-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            href: null,
            title: 'Admin',
            tabBarIcon: ({ color }) => <IonTabIcon name="shield-outline" color={color} />,
          }}
        />
      </Tabs>

      <Modal
        animationType="fade"
        transparent
        visible={sidebarVisible}
        onRequestClose={() => setSidebarVisible(false)}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: backdropTint }]} onPress={() => setSidebarVisible(false)}>
          <Pressable
            style={[
              styles.sidebar,
              {
                backgroundColor: sidebarBg,
                borderRightColor: sidebarBorder,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: sidebarFg }]}>All Tools</Text>
              <TouchableOpacity onPress={() => setSidebarVisible(false)} style={styles.closeButton}>
                <Ionicons name="close-outline" size={24} color={sidebarFg} />
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarList}>
              {toolItems.map((item) => (
                <Pressable
                  key={item.title}
                  style={({ pressed }) => [
                    styles.sidebarItem,
                    pressed && { backgroundColor: sidebarItemPressed },
                  ]}
                  onPress={() => {
                    setSidebarVisible(false);
                    router.push(item.route);
                    if (item.route === '/inbox') {
                      queueMicrotask(() => nudgeInboxHeader());
                    }
                  }}
                >
                  <Ionicons name={item.icon} size={18} color={sidebarFg} />
                  <Text style={[styles.sidebarItemText, { color: sidebarFg }]}>{item.title}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const guardStyles = StyleSheet.create({
  flex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  menuButton: {
    marginLeft: 12,
    padding: 2,
  },
  backdrop: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 290,
    height: '100%',
    borderRightWidth: 1,
    paddingTop: 56,
    paddingHorizontal: 14,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 2,
  },
  sidebarList: {
    gap: 4,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
