import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { InboxMessage } from '@/types/inbox';

import type { InboxChatRowContextMenuTheme } from '@/components/inbox/InboxChatRowContextMenu';

export type InboxMessageContextMenuTheme = InboxChatRowContextMenuTheme;

export type MessageRowContextAction =
  | 'reply'
  | 'select'
  | 'forward'
  | 'copy'
  | 'star'
  | 'pin'
  | 'translate'
  | 'ai-response'
  | 'download'
  | 'info'
  | 'delete';

type Props = {
  visible: boolean;
  message: InboxMessage | null;
  theme: InboxChatRowContextMenuTheme;
  onClose: () => void;
  onSelect: (action: MessageRowContextAction, message: InboxMessage) => void;
};

const ROWS: { action: MessageRowContextAction; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }[] = [
  { action: 'reply', label: 'Reply', icon: 'arrow-undo-outline' },
  { action: 'select', label: 'Select messages', icon: 'checkbox-outline' },
  { action: 'forward', label: 'Forward', icon: 'arrow-redo-outline' },
  { action: 'copy', label: 'Copy', icon: 'copy-outline' },
  { action: 'star', label: 'Star', icon: 'star-outline' },
  { action: 'pin', label: 'Pin', icon: 'pin-outline' },
  { action: 'translate', label: 'Translate', icon: 'language-outline' },
  { action: 'ai-response', label: 'AI response', icon: 'sparkles-outline' },
  { action: 'download', label: 'Download', icon: 'download-outline' },
  { action: 'info', label: 'Info', icon: 'information-circle-outline' },
  { action: 'delete', label: 'Delete', icon: 'trash-outline', danger: true },
];

export function InboxMessageContextMenu({ visible, message, theme, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  const fire = useCallback(
    (action: MessageRowContextAction) => {
      const snapshot = message;
      if (!snapshot) return;
      onClose();
      setTimeout(() => onSelect(action, snapshot), 60);
    },
    [onClose, onSelect, message],
  );

  if (!message) return null;

  const sheetMaxH = Math.min(winH * 0.72, 520);
  const isStarred = !!message.isStarred;
  const isPinned = !!message.isPinned;

  const labelFor = (action: MessageRowContextAction, base: string) => {
    if (action === 'star') return isStarred ? 'Unstar' : 'Star';
    if (action === 'pin') return isPinned ? 'Unpin' : 'Pin';
    return base;
  };

  const iconFor = (action: MessageRowContextAction, base: keyof typeof Ionicons.glyphMap) => {
    if (action === 'star') return (isStarred ? 'star' : 'star-outline') as keyof typeof Ionicons.glyphMap;
    if (action === 'pin') return (isPinned ? 'pin' : 'pin-outline') as keyof typeof Ionicons.glyphMap;
    return base;
  };

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
            <Text style={[styles.headerKicker, { color: theme.rowMuted }]}>MESSAGE</Text>
            <Text style={[styles.headerTitle, { color: theme.rowHi }]} numberOfLines={3}>
              {message.text ? message.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : 'Message'}
            </Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {ROWS.map((row) => {
              const danger = row.danger;
              const fg = danger ? theme.danger : theme.rowHi;
              const ic = danger ? theme.danger : theme.rowMuted;
              const icon = iconFor(row.action, row.icon);
              return (
                <Pressable
                  key={row.action}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.chatDivider },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => fire(row.action)}
                >
                  <Ionicons name={icon} size={20} color={ic} />
                  <Text style={[styles.rowLabel, { color: fg }]}>{labelFor(row.action, row.label)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.rowMuted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
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
