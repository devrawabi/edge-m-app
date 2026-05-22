import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { avatarInitials } from '@/lib/inbox-format';

type StarredMessage = {
  id: string;
  senderName: string;
  senderPhone: string;
  chatName: string;
  chatId: string;
  text: string;
  time: string;
  date: string;
};

type WhatsAppStarredMessagesModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function WhatsAppStarredMessagesModal({ visible, onClose }: WhatsAppStarredMessagesModalProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Theming colors
  const bg = isDark ? '#0b141a' : '#f0f2f5';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';
  const cardBg = isDark ? '#111b21' : '#ffffff';
  const divider = isDark ? '#222d34' : '#e9edef';
  const brandGreen = '#00a884';

  const [starredList, setStarredList] = useState<StarredMessage[]>([
    {
      id: 'st-1',
      senderName: 'Ahmed (Rawabi Support)',
      senderPhone: '+966 50 123 4567',
      chatName: 'Rawabi Support',
      chatId: 'c- अहमद',
      text: 'Hello! Your wholesale catalog has been updated with the new bulk quantities. You can review them in the Catalog tool.',
      time: '10:45 AM',
      date: 'Today',
    },
    {
      id: 'st-2',
      senderName: 'Sarah Jenkins',
      senderPhone: '+1 415 555 2671',
      chatName: 'Sarah Jenkins',
      chatId: 'c-sarah',
      text: 'Thanks for sending over the project specification sheet. The automation flows are running perfectly in the sandbox env now! 🚀',
      time: 'Yesterday',
      date: 'May 21',
    },
    {
      id: 'st-3',
      senderName: 'System Bot',
      senderPhone: 'Info Alert',
      chatName: 'Rawabi Admin Bot',
      chatId: 'c-admin-bot',
      text: '⚠️ Campaign "Eid Mubarak Promo 2026" has achieved a 94.5% delivery rate and generated 142 new incoming customer conversations.',
      time: 'May 19',
      date: 'May 19',
    },
  ]);

  const handleUnstar = (id: string) => {
    setStarredList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGoToChat = (chatId: string) => {
    onClose();
    router.push({ pathname: '/inbox', params: { openContactId: chatId } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={textHi} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textHi }]}>Starred Messages</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={starredList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#202c33' : '#e1ebe6' }]}>
                <Ionicons name="star" size={48} color={brandGreen} />
              </View>
              <Text style={[styles.emptyText, { color: textHi }]}>No starred messages</Text>
              <Text style={[styles.emptySub, { color: textMuted }]}>
                Press and hold any message in a chat and tap Star (⭐) to save it here. Starred messages are easy to find later.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.msgCard, { backgroundColor: cardBg }]}>
              {/* Card Header (Sender & Date) */}
              <View style={styles.cardHeader}>
                <View style={styles.senderBlock}>
                  <View style={[styles.avatar, { backgroundColor: isDark ? '#202c33' : '#dcfce7' }]}>
                    <Text style={[styles.avatarText, { color: brandGreen }]}>
                      {avatarInitials(item.senderName)}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.senderName, { color: textHi }]} numberOfLines={1}>
                      {item.senderName}
                    </Text>
                    <Text style={[styles.chatLabel, { color: textMuted }]}>
                      in {item.chatName}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.dateText, { color: textMuted }]}>{item.date}</Text>
              </View>

              {/* Message Body */}
              <View style={[styles.msgBody, { borderLeftColor: brandGreen }]}>
                <Text style={[styles.msgText, { color: textHi }]}>{item.text}</Text>
              </View>

              {/* Footer Actions */}
              <View style={[styles.cardFooter, { borderTopColor: divider }]}>
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => handleUnstar(item.id)}
                >
                  <Ionicons name="star-outline" size={18} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Unstar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, styles.primaryAction]}
                  onPress={() => handleGoToChat(item.chatId)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={brandGreen} />
                  <Text style={[styles.actionBtnText, { color: brandGreen }]}>Go to Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  listPad: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  msgCard: {
    borderRadius: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  senderBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    maxWidth: 160,
  },
  chatLabel: {
    fontSize: 12,
    marginTop: 1,
  },
  dateText: {
    fontSize: 12,
  },
  msgBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginLeft: 16,
    marginRight: 16,
    marginVertical: 12,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(0, 168, 132, 0.04)',
  },
  msgText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  primaryAction: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(148, 163, 184, 0.2)',
  },
});
