import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
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

type StatusStory = {
  id: string;
  name: string;
  time: string;
  initials: string;
  avatarBg: string;
  storyBg: string;
  content: string;
  viewed: boolean;
  isMine?: boolean;
};

type Channel = {
  id: string;
  name: string;
  desc: string;
  followers: string;
  icon: keyof typeof Ionicons.glyphMap;
  followed: boolean;
  verified?: boolean;
};

const STATUSES: StatusStory[] = [
  {
    id: 'st-1',
    name: 'Ahmed',
    time: 'Just now',
    initials: 'AS',
    avatarBg: '#128C7E',
    storyBg: '#075e54',
    content: '💼 Eid Al-Adha wholesale catalog orders are now open! Place your requests before June 10th. 🌙',
    viewed: false,
  },
  {
    id: 'st-2',
    name: 'Sarah J.',
    time: '24 min ago',
    initials: 'SJ',
    avatarBg: '#a855f7',
    storyBg: '#475569',
    content: 'Working on the mobile redesign today! Everything is fitting together perfectly 😍🚀',
    viewed: false,
  },
  {
    id: 'st-3',
    name: 'Support',
    time: '2h ago',
    initials: 'CS',
    avatarBg: '#f97316',
    storyBg: '#b45309',
    content: 'VoIP systems are fully operational. Check the new Call History Logs! 📞✨',
    viewed: true,
  },
  {
    id: 'st-4',
    name: 'Rawabi HQ',
    time: 'Yesterday',
    initials: 'RH',
    avatarBg: '#0ea5e9',
    storyBg: '#0369a1',
    content: 'New campaign reporting dashboard is live. Visit Insights for detailed metrics! 📊',
    viewed: true,
  },
];

const CHANNELS: Channel[] = [
  {
    id: 'ch-1',
    name: 'Rawabi Edge',
    desc: 'Official updates, release notes, and product announcements for Rawabi CRM users.',
    followers: '4.2K followers',
    icon: 'logo-whatsapp',
    followed: false,
    verified: true,
  },
  {
    id: 'ch-2',
    name: 'Meta for Business',
    desc: 'Learn how to leverage WhatsApp flows, templates and advertising to grow your business.',
    followers: '128.5K followers',
    icon: 'briefcase-outline',
    followed: false,
    verified: true,
  },
  {
    id: 'ch-3',
    name: 'Tech Digest',
    desc: 'Weekly digests covering technology, software development, and AI innovations.',
    followers: '64.9K followers',
    icon: 'globe-outline',
    followed: false,
    verified: false,
  },
];

export default function UpdatesTab() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const session = useSessionContext();

  const bg = isDark ? '#0b141a' : '#f0f2f5';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';
  const cardBg = isDark ? '#111b21' : '#ffffff';
  const divider = isDark ? '#222d34' : '#e9edef';
  const brandGreen = '#00a884';
  const headerBg = isDark ? '#1f2c34' : '#008069';

  const userName = session.status === 'loggedIn'
    ? (session.me.name || 'Me')
    : 'Me';
  const myInitials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const [statuses, setStatuses] = useState<StatusStory[]>(STATUSES);
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const [activeStory, setActiveStory] = useState<StatusStory | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!activeStory) {
      progressAnim.stopAnimation();
      return;
    }
    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) closeStory();
    });
    return () => anim.stop();
  }, [activeStory, progressAnim]);

  const openStory = (story: StatusStory) => {
    setStatuses((prev) =>
      prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s))
    );
    setActiveStory(story);
  };

  const closeStory = () => setActiveStory(null);

  const toggleFollow = (id: string) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, followed: !ch.followed } : ch))
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Updates</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* ── STATUS SECTION ── */}
        <View style={[styles.sectionLabel, { paddingTop: 16 }]}>
          <Text style={[styles.sectionLabelText, { color: textHi }]}>Status</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={20} color={textMuted} />
          </TouchableOpacity>
        </View>

        {/* My Status row */}
        <View style={[styles.statusCard, { backgroundColor: cardBg }]}>
          <View style={styles.statusRow}>
            <View style={styles.myStatusAvatar}>
              <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#202c33' : '#dcfce7', width: 50, height: 50, borderRadius: 25 }]}>
                <Text style={[styles.initialsText, { color: brandGreen, fontSize: 18 }]}>{myInitials}</Text>
              </View>
              <View style={[styles.plusBadge, { backgroundColor: brandGreen, borderColor: cardBg }]}>
                <Ionicons name="add" size={12} color="#ffffff" />
              </View>
            </View>
            <View style={styles.statusTextBlock}>
              <Text style={[styles.statusName, { color: textHi }]}>My status</Text>
              <Text style={[styles.statusTime, { color: textMuted }]}>Tap to add status update</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: divider, marginLeft: 78 }]} />

          {/* Recent updates label */}
          <View style={styles.recentLabel}>
            <Text style={[styles.recentLabelText, { color: textMuted }]}>Recent updates</Text>
          </View>

          {/* Status list */}
          {statuses.map((item, idx) => (
            <View key={item.id}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: divider, marginLeft: 78 }]} />}
              <TouchableOpacity
                style={styles.statusRow}
                activeOpacity={0.7}
                onPress={() => openStory(item)}
              >
                <View
                  style={[
                    styles.statusRing,
                    {
                      borderColor: item.viewed
                        ? isDark ? '#374151' : '#d1d5db'
                        : brandGreen,
                    },
                  ]}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg, width: 44, height: 44, borderRadius: 22 }]}>
                    <Text style={[styles.initialsText, { fontSize: 15 }]}>{item.initials}</Text>
                  </View>
                </View>
                <View style={styles.statusTextBlock}>
                  <Text style={[styles.statusName, { color: textHi }]}>{item.name}</Text>
                  <Text style={[styles.statusTime, { color: textMuted }]}>{item.time}</Text>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── CHANNELS SECTION ── */}
        <View style={[styles.sectionLabel, { marginTop: 20 }]}>
          <Text style={[styles.sectionLabelText, { color: textHi }]}>Channels</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.findChannelsText, { color: brandGreen }]}>Find channels</Text>
          </TouchableOpacity>
        </View>

        {/* Channels intro banner */}
        <View style={[styles.channelsBanner, { backgroundColor: cardBg }]}>
          <View style={[styles.channelsBannerIcon, { backgroundColor: isDark ? '#202c33' : '#e1f5f1' }]}>
            <Ionicons name="megaphone-outline" size={28} color={brandGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.channelsBannerTitle, { color: textHi }]}>Stay updated on topics that matter</Text>
            <Text style={[styles.channelsBannerSub, { color: textMuted }]}>Follow channels to get updates in one place</Text>
          </View>
        </View>

        {/* Channels list */}
        <View style={[styles.channelsList, { backgroundColor: cardBg }]}>
          {channels.map((ch, idx) => (
            <View key={ch.id}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: divider, marginLeft: 76 }]} />}
              <View style={styles.channelRow}>
                <View style={[styles.channelAvatar, { backgroundColor: isDark ? '#202c33' : '#e1f5f1' }]}>
                  <Ionicons name={ch.icon} size={22} color={brandGreen} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.channelNameRow}>
                    <Text style={[styles.channelName, { color: textHi }]} numberOfLines={1}>{ch.name}</Text>
                    {ch.verified && (
                      <Ionicons name="checkmark-circle" size={14} color={brandGreen} style={{ marginLeft: 4, marginTop: 1 }} />
                    )}
                  </View>
                  <Text style={[styles.channelDesc, { color: textMuted }]} numberOfLines={2}>{ch.desc}</Text>
                  <Text style={[styles.channelFollowers, { color: textMuted }]}>{ch.followers}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.followBtn,
                    ch.followed
                      ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: isDark ? '#374151' : '#d1d5db' }
                      : { backgroundColor: brandGreen },
                  ]}
                  onPress={() => toggleFollow(ch.id)}
                >
                  {ch.followed ? (
                    <Ionicons name="checkmark" size={15} color={brandGreen} />
                  ) : (
                    <Text style={styles.followBtnText}>Follow</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Explore more */}
          <TouchableOpacity activeOpacity={0.7} style={[styles.exploreRow, { borderTopColor: divider }]}>
            <Text style={[styles.exploreText, { color: brandGreen }]}>Explore more channels</Text>
            <Ionicons name="chevron-forward" size={16} color={brandGreen} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Story Viewer Modal */}
      {activeStory && (
        <Modal
          visible={!!activeStory}
          transparent
          animationType="fade"
          onRequestClose={closeStory}
        >
          <View style={[styles.storyOverlay, { paddingTop: insets.top }]}>
            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Story header */}
            <View style={styles.storyHeader}>
              <View style={[styles.storyAvatar, { backgroundColor: activeStory.avatarBg }]}>
                <Text style={styles.storyAvatarText}>{activeStory.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storyName}>{activeStory.name}</Text>
                <Text style={styles.storyTime}>{activeStory.time}</Text>
              </View>
              <TouchableOpacity onPress={closeStory} style={styles.storyClose}>
                <Ionicons name="close" size={26} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Story content */}
            <Pressable style={styles.storyContent} onPress={closeStory}>
              <View style={[styles.storyCard, { backgroundColor: activeStory.storyBg }]}>
                <Text style={styles.storyText}>{activeStory.content}</Text>
              </View>
            </Pressable>

            {/* Story footer */}
            <View style={[styles.storyFooter, { paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.storyReplyBox, { borderColor: 'rgba(255,255,255,0.4)' }]}>
                <Text style={styles.storyReplyPlaceholder}>Reply to {activeStory.name}…</Text>
                <Ionicons name="happy-outline" size={22} color="rgba(255,255,255,0.7)" />
              </View>
              <TouchableOpacity style={styles.storyShareBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-redo-outline" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // ── Sections ──
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  sectionLabelText: {
    fontSize: 17,
    fontWeight: '700',
  },
  findChannelsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Status ──
  statusCard: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  myStatusAvatar: {
    position: 'relative',
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextBlock: {
    flex: 1,
  },
  statusName: {
    fontSize: 15.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusTime: {
    fontSize: 13,
  },
  recentLabel: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    paddingTop: 2,
  },
  recentLabelText: {
    fontSize: 12.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginRight: 0,
  },
  // ── Channels ──
  channelsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
    marginBottom: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
  },
  channelsBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelsBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  channelsBannerSub: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  channelsList: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  channelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  channelName: {
    fontSize: 15,
    fontWeight: '600',
  },
  channelDesc: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 3,
  },
  channelFollowers: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  exploreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Story Modal ──
  storyOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  storyAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  storyName: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  storyTime: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11.5,
    marginTop: 1,
  },
  storyClose: {
    padding: 4,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  storyCard: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  storyText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  storyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  storyReplyBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  storyReplyPlaceholder: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  storyShareBtn: {
    padding: 8,
  },
});
