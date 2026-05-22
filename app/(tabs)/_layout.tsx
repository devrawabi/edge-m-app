import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { WhatsAppIncomingCallHost } from '@/components/WhatsAppIncomingCallHost';
import { useSessionContext } from '@/context/SessionContext';
import { useAppColorScheme } from '@/context/ThemePreferenceContext';

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name.replace('-outline', '') as keyof typeof Ionicons.glyphMap : name}
      size={24}
      color={color}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  const session = useSessionContext();

  const activeColor = '#00a884';
  const inactiveColor = isDark ? '#8696a0' : '#667781';
  const tabBarBg = isDark ? '#111b21' : '#ffffff';
  const tabBarBorder = isDark ? '#2a3942' : '#e2e8f0';

  if (session.status === 'loading') {
    return (
      <View
        style={[
          guardStyles.center,
          { backgroundColor: isDark ? '#0b141a' : '#f8fafc' },
        ]}
      >
        <ActivityIndicator size="large" color="#00a884" />
      </View>
    );
  }

  if (session.status === 'loggedOut') {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <WhatsAppIncomingCallHost />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: inactiveColor,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: tabBarBg,
            borderTopColor: tabBarBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: Platform.OS === 'ios' ? 82 : 60,
            paddingBottom: Platform.OS === 'ios' ? 22 : 8,
            paddingTop: 8,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          },
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontWeight: '500',
            letterSpacing: 0.1,
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 0,
          },
        }}
      >
        {/* ── Visible Tabs (WA Business order) ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Chats',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="chatbubble-ellipses-outline" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="updates"
          options={{
            title: 'Updates',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="sync-circle-outline" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="tools"
          options={{
            title: 'Tools',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="briefcase-outline" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="calls"
          options={{
            title: 'Calls',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="call-outline" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="settings-outline" color={color} focused={focused} />
            ),
          }}
        />

        {/* ── Hidden Screens ── */}
        <Tabs.Screen name="inbox"         options={{ href: null }} />
        <Tabs.Screen name="contacts"      options={{ href: null }} />
        <Tabs.Screen name="campaigns"     options={{ href: null }} />
        <Tabs.Screen name="catalog"       options={{ href: null }} />
        <Tabs.Screen name="flows"         options={{ href: null }} />
        <Tabs.Screen name="automation"    options={{ href: null }} />
        <Tabs.Screen name="templates"     options={{ href: null }} />
        <Tabs.Screen name="insights"      options={{ href: null }} />
        <Tabs.Screen name="activity-log"  options={{ href: null }} />
        <Tabs.Screen name="admin"         options={{ href: null }} />
      </Tabs>
    </>
  );
}

const guardStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
