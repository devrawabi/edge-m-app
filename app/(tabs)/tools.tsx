import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useSessionContext } from '@/context/SessionContext';

type ToolItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
};

const QUICK_ACTIONS: ToolItem[] = [
  { id: 'broadcast', icon: 'megaphone-outline', label: 'New broadcast', route: '/campaigns' },
  { id: 'catalog', icon: 'cube-outline', label: 'Products', route: '/catalog' },
  { id: 'labels', icon: 'pricetag-outline', label: 'Labels', route: '/contacts' },
  { id: 'flows', icon: 'git-network-outline', label: 'Flows', route: '/flows' },
];

export default function BusinessToolsTab() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const session = useSessionContext();

  const isSuperAdmin =
    session.status === 'loggedIn' &&
    (session.me.role === 'SUPER_ADMIN' || session.me.role === 'COMPANY_SUPER_ADMIN');

  const userName =
    session.status === 'loggedIn' ? session.me.name || 'Rawabi Edge Admin' : 'Rawabi Edge Admin';
  const userEmail =
    session.status === 'loggedIn' ? session.me.email : 'admin@rawabiedge.com';

  const bg = isDark ? '#0b141a' : '#f0f2f5';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';
  const cardBg = isDark ? '#111b21' : '#ffffff';
  const divider = isDark ? '#222d34' : '#e9edef';
  const brandGreen = '#00a884';
  const headerBg = isDark ? '#1f2c34' : '#008069';

  const push = (route: string) => router.push(route as any);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Business Tools</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Business Profile Card ── */}
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.profileCard, { backgroundColor: cardBg, borderBottomColor: divider }]}
          onPress={() => Alert.alert('Business Profile', 'Edit your business profile details via the Admin panel.')}
        >
          <View style={[styles.profileAvatar, { backgroundColor: '#128C7E' }]}>
            <Text style={styles.profileAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: textHi }]} numberOfLines={1}>{userName}</Text>
            <Text style={[styles.profileStatus, { color: textMuted }]} numberOfLines={1}>{userEmail}</Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={13} color={brandGreen} />
              <Text style={[styles.verifiedText, { color: brandGreen }]}>Verified Business</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={textMuted} />
        </TouchableOpacity>

        {/* ── Quick Actions Grid ── */}
        <View style={[styles.quickGrid, { backgroundColor: cardBg, borderBottomColor: divider }]}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              style={styles.quickItem}
              onPress={() => push(item.route)}
            >
              <View style={[styles.quickIcon, { backgroundColor: isDark ? '#202c33' : '#e8f5f1' }]}>
                <Ionicons name={item.icon} size={22} color={brandGreen} />
              </View>
              <Text style={[styles.quickLabel, { color: textHi }]} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Grow your business ── */}
        <View style={[styles.sectionHeader, { paddingTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: textMuted }]}>GROW YOUR BUSINESS</Text>
        </View>
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ToolRow
            icon="megaphone"
            iconBg="#FF6B35"
            title="Advertise on Facebook / Instagram"
            subtitle="Create campaigns that lead to WhatsApp chats"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/campaigns')}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="cube"
            iconBg="#6366F1"
            title="Catalog"
            subtitle="Showcase products and services in WhatsApp"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/catalog')}
          />
        </View>

        {/* ── Messaging Tools ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textMuted }]}>MESSAGING TOOLS</Text>
        </View>
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ToolRow
            icon="chatbubble-ellipses"
            iconBg="#128C7E"
            title="Greeting message"
            subtitle="Send a message when you open a new chat"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/automation')}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="alarm"
            iconBg="#F59E0B"
            title="Away message"
            subtitle="Auto-reply when you are not available"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/automation')}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="flash"
            iconBg="#3B82F6"
            title="Quick replies"
            subtitle="Send pre-written messages using keyboard shortcuts"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/automation')}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="documents"
            iconBg="#8B5CF6"
            title="Message templates"
            subtitle="Manage utility, verification, and marketing templates"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/templates')}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="pricetag"
            iconBg="#EC4899"
            title="Labels"
            subtitle="Organize your chats and messages with labels"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/contacts')}
          />
        </View>

        {/* ── Analytics ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textMuted }]}>ANALYTICS</Text>
        </View>
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ToolRow
            icon="analytics"
            iconBg="#10B981"
            title="Business analytics"
            subtitle="Inspect message delivery stats, sales reports, charts"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/insights')}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="git-network"
            iconBg="#0EA5E9"
            title="Flows"
            subtitle="Design automated chat journeys and questionnaires"
            showDivider={false}
            dividerColor={divider}
            onPress={() => push('/flows')}
          />
          {isSuperAdmin && (
            <>
              <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
              <ToolRow
                icon="shield"
                iconBg="#EF4444"
                title="Admin panel"
                subtitle="Manage roles, branches, and system integrations"
                showDivider={false}
                dividerColor={divider}
                onPress={() => push('/admin')}
              />
            </>
          )}
        </View>

        {/* ── Other ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textMuted }]}>OTHER</Text>
        </View>
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ToolRow
            icon="desktop-outline"
            iconBg="#64748B"
            title="WhatsApp Web"
            subtitle="Use WhatsApp on your computer"
            showDivider={false}
            dividerColor={divider}
            onPress={() => Linking.openURL('https://web.whatsapp.com').catch(() => {})}
          />
          <View style={[styles.inlineDivider, { backgroundColor: divider, marginLeft: 72 }]} />
          <ToolRow
            icon="person-add-outline"
            iconBg="#6B7280"
            title="Invite a friend"
            subtitle="Share a link to download WhatsApp Business"
            showDivider={false}
            dividerColor={divider}
            onPress={() =>
              Alert.alert('Invite a friend', 'Share: https://wa.me/download')
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ToolRow({
  icon,
  iconBg,
  title,
  subtitle,
  dividerColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  showDivider: boolean;
  dividerColor: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';

  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.toolRow} onPress={onPress}>
      <View style={[styles.toolIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color="#ffffff" />
      </View>
      <View style={styles.toolInfo}>
        <Text style={[styles.toolTitle, { color: textHi }]}>{title}</Text>
        <Text style={[styles.toolSubtitle, { color: textMuted }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerBtn: {
    padding: 2,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileStatus: {
    fontSize: 13.5,
    marginBottom: 4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Quick actions ──
  quickGrid: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-around',
  },
  quickItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  // ── Section header ──
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  // ── Tool section ──
  section: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 16,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolInfo: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 15.5,
    fontWeight: '500',
    marginBottom: 2,
  },
  toolSubtitle: {
    fontSize: 12.5,
    lineHeight: 16,
  },
});
