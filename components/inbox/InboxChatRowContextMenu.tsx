import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { InboxChat } from '@/types/inbox';

export type ChatRowContextAction =
  | 'assign_branch'
  | 'tag_lead'
  | 'mark_unread'
  | 'pin'
  | 'archive'
  | 'unarchive'
  | 'tag'
  | 'favorite'
  | 'block'
  | 'delete_chat'
  | 'clear_chat';

export type InboxChatRowContextMenuTheme = {
  listBg: string;
  rowHi: string;
  rowMuted: string;
  chatDivider: string;
  danger: string;
};

type BranchRow = { id: string; name: string; shortCode?: string | null; displayName?: string | null };

type Props = {
  visible: boolean;
  chat: InboxChat | null;
  /** When viewing the archived mailbox, primary archive action is "unarchive". */
  isArchivedMailbox: boolean;
  showAssignBranch: boolean;
  branches: BranchRow[];
  isFavorite: boolean;
  theme: InboxChatRowContextMenuTheme;
  onClose: () => void;
  /** `chat` is the row snapshot so the parent can run after the menu closes (avoids Alert/modal races). */
  onSelect: (action: ChatRowContextAction, chat: InboxChat, extra?: string) => void;
};

const TAG_LEAD_OPTIONS = [
  { id: 'HOT LEAD', label: 'Hot Lead', color: '#2563eb', icon: 'flame-outline' as const },
  { id: 'FOLLOW UP', label: 'Follow Up', color: '#ca8a04', icon: 'time-outline' as const },
  { id: 'CLOSED', label: 'Closed', color: '#6b7280', icon: 'checkmark-circle-outline' as const },
] as const;

export function InboxChatRowContextMenu({
  visible,
  chat,
  isArchivedMailbox,
  showAssignBranch,
  branches,
  isFavorite,
  theme,
  onClose,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [branchOpen, setBranchOpen] = useState(false);
  const [tagLeadOpen, setTagLeadOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setBranchOpen(false);
      setTagLeadOpen(false);
    }
  }, [visible]);

  const fire = useCallback(
    (action: ChatRowContextAction, extra?: string) => {
      const snapshot = chat;
      if (!snapshot) return;
      onClose();
      // Let the modal dismiss before confirm sheets / follow-up UI (fixes RN Web + native races).
      setTimeout(() => onSelect(action, snapshot, extra), 60);
    },
    [onClose, onSelect, chat],
  );

  if (!chat) return null;

  const sheetMaxH = Math.min(winH * 0.72, 520);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxH,
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: theme.listBg,
              borderColor: theme.chatDivider,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: theme.chatDivider }]}>
            <Text style={[styles.headerKicker, { color: theme.rowMuted }]}>CHAT</Text>
            <Text style={[styles.headerTitle, { color: theme.rowHi }]} numberOfLines={2}>
              {chat.name || chat.phoneNumber || 'Chat'}
            </Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {showAssignBranch ? (
              <View style={[styles.block, { borderBottomColor: theme.chatDivider }]}>
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                  onPress={() => setBranchOpen((o) => !o)}
                >
                  <Ionicons name="business-outline" size={20} color={theme.rowMuted} />
                  <Text style={[styles.rowLabel, { color: theme.rowHi }]}>Assign to branch</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.rowMuted}
                    style={{ transform: [{ rotate: branchOpen ? '90deg' : '0deg' }] }}
                  />
                </Pressable>
                {branchOpen ? (
                  <View style={[styles.subWrap, { backgroundColor: `${theme.rowMuted}12` }]}>
                    {chat.branchId ? (
                      <Pressable
                        style={({ pressed }) => [styles.subRow, pressed && { opacity: 0.85 }]}
                        onPress={() => fire('assign_branch', '__clear__')}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={theme.rowMuted} />
                        <Text style={[styles.subLabel, { color: theme.rowHi }]}>Unassign (main line)</Text>
                      </Pressable>
                    ) : null}
                    {branches.length === 0 ? (
                      <Text style={[styles.subHint, { color: theme.rowMuted }]}>
                        No branches yet. Add one in Settings → Team.
                      </Text>
                    ) : (
                      branches.map((b) => (
                        <Pressable
                          key={b.id}
                          style={({ pressed }) => [
                            styles.subRow,
                            chat.branchId === b.id && { backgroundColor: `${theme.rowMuted}18` },
                            pressed && { opacity: 0.85 },
                          ]}
                          onPress={() => fire('assign_branch', b.id)}
                        >
                          <Ionicons name="git-branch-outline" size={18} color={theme.rowMuted} />
                          <Text style={[styles.subLabel, { color: theme.rowHi }]} numberOfLines={1}>
                            {b.name}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.block, { borderBottomColor: theme.chatDivider }]}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                onPress={() => setTagLeadOpen((o) => !o)}
              >
                <Ionicons name="pricetag-outline" size={20} color={theme.rowMuted} />
                <Text style={[styles.rowLabel, { color: theme.rowHi }]}>Tag lead</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.rowMuted}
                  style={{ transform: [{ rotate: tagLeadOpen ? '90deg' : '0deg' }] }}
                />
              </Pressable>
              {tagLeadOpen ? (
                <View style={[styles.subWrap, { backgroundColor: `${theme.rowMuted}12` }]}>
                  {TAG_LEAD_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      style={({ pressed }) => [styles.subRow, pressed && { opacity: 0.85 }]}
                      onPress={() => fire('tag_lead', opt.id)}
                    >
                      <Ionicons name={opt.icon} size={18} color={opt.color} />
                      <Text style={[styles.subLabel, { color: opt.color }]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <MenuRow
              icon="mail-unread-outline"
              label="Mark as unread"
              theme={theme}
              onPress={() => fire('mark_unread')}
            />
            <MenuRow
              icon={chat.isPinned ? 'pin' : 'pin-outline'}
              label={chat.isPinned ? 'Unpin' : 'Pin'}
              theme={theme}
              onPress={() => fire('pin')}
            />
            <MenuRow
              icon={isArchivedMailbox ? 'arrow-undo-outline' : 'archive-outline'}
              label={isArchivedMailbox ? 'Unarchive' : 'Archive'}
              theme={theme}
              onPress={() => fire(isArchivedMailbox ? 'unarchive' : 'archive')}
            />
            <MenuRow
              icon="pricetags-outline"
              label="Tag"
              theme={theme}
              onPress={() => fire('tag')}
            />
            <MenuRow
              icon={isFavorite ? 'star' : 'star-outline'}
              label={isFavorite ? 'Remove favorite' : 'Add favorite'}
              theme={theme}
              onPress={() => fire('favorite')}
            />
            <MenuRow icon="ban-outline" label="Block" theme={theme} onPress={() => fire('block')} />
            <MenuRow
              icon="trash-outline"
              label="Delete chat"
              theme={theme}
              danger
              dangerColor={theme.danger}
              onPress={() => fire('delete_chat')}
            />
            <MenuRow
              icon="chatbubbles-outline"
              label="Clear chat"
              theme={theme}
              danger
              dangerColor={theme.danger}
              onPress={() => fire('clear_chat')}
            />
          </ScrollView>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.rowMuted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  theme,
  danger,
  dangerColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  theme: InboxChatRowContextMenuTheme;
  danger?: boolean;
  dangerColor?: string;
  onPress: () => void;
}) {
  const fg = danger && dangerColor ? dangerColor : theme.rowHi;
  const ic = danger && dangerColor ? dangerColor : theme.rowMuted;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.chatDivider },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={ic} />
      <Text style={[styles.rowLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 24,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  block: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  subWrap: {
    paddingBottom: 8,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingLeft: 48,
  },
  subLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  subHint: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingLeft: 48,
    lineHeight: 18,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
