import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  contactPhoneLineHasEnoughDigits,
  defaultNameForContactFromCard,
  parseContactCardPayload,
  stripContactPhoneSuffix,
} from '@/lib/contact-card-content';

export type ContactCardActionPayload = {
  displayName: string;
  phoneForLookup: string;
  messageId: string;
};

type Props = {
  rawHtml: string;
  sent: boolean;
  bubbleTextColor: string;
  mediaHintColor: string;
  docStripBg: string;
  docStripBorder: string;
  messageId: string;
  busyMessageId: string | null;
  onOpenChat: (p: ContactCardActionPayload) => void | Promise<void>;
  onSaveToDevice: (p: ContactCardActionPayload) => void | Promise<void>;
};

export function InboxContactBubble({
  rawHtml,
  sent,
  bubbleTextColor,
  mediaHintColor,
  docStripBg,
  docStripBorder,
  messageId,
  busyMessageId,
  onOpenChat,
  onSaveToDevice,
}: Props) {
  const parsed = useMemo(() => parseContactCardPayload(rawHtml), [rawHtml]);
  const openName = defaultNameForContactFromCard(parsed);
  const dialable = parsed.phoneLines.filter(contactPhoneLineHasEnoughDigits);
  const primary = dialable[0];
  const busy = busyMessageId === messageId;

  const fireOpen = () => {
    if (!primary) return;
    void onOpenChat({
      displayName: openName,
      phoneForLookup: stripContactPhoneSuffix(primary),
      messageId,
    });
  };

  const fireSave = () => {
    if (!primary) return;
    void onSaveToDevice({
      displayName: openName,
      phoneForLookup: stripContactPhoneSuffix(primary),
      messageId,
    });
  };

  return (
    <View
      style={[
        styles.card,
        styles.cardStretch,
        {
          backgroundColor: docStripBg,
          borderColor: docStripBorder,
        },
      ]}
    >
      {busy ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color={sent ? '#4c1d95' : '#6b21a8'} />
          <Text style={[styles.busyText, { color: sent ? '#4c1d95' : '#6b21a8' }]}>Working…</Text>
        </View>
      ) : null}
      <View style={styles.headerRow}>
        <View style={[styles.iconTile, { backgroundColor: sent ? 'rgba(255,255,255,0.55)' : '#f3e8ff' }]}>
          <Ionicons name="person" size={18} color={sent ? '#5b21b6' : '#7c3aed'} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.kicker, { color: sent ? '#6b21a8' : '#7c3aed' }]}>Contact card</Text>
          {(parsed.cardDisplayName.trim() || openName) ? (
            <Text style={[styles.name, { color: bubbleTextColor }]} numberOfLines={2}>
              {parsed.cardDisplayName.trim() || openName}
            </Text>
          ) : null}
        </View>
      </View>

      {parsed.phoneLines.length > 0 ? (
        <View style={styles.phoneBlock}>
          {parsed.phoneLines.map((line, i) => (
            <View key={`${i}-${line}`} style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={mediaHintColor} />
              <Text style={[styles.phoneText, { color: bubbleTextColor }]} selectable>
                {line}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.noPhone, { color: mediaHintColor }]}>No phone number on this card</Text>
      )}

      <View style={styles.btnRow}>
        <Pressable
          onPress={fireSave}
          disabled={busy || !primary}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            { borderColor: docStripBorder, opacity: pressed ? 0.88 : !primary ? 0.45 : 1 },
          ]}
        >
          <Ionicons name="book-outline" size={15} color={sent ? '#5b21b6' : '#6d28d9'} />
          <Text style={[styles.btnLabel, { color: sent ? '#5b21b6' : '#6d28d9' }]}>Add to contact</Text>
        </Pressable>
        <Pressable
          onPress={fireOpen}
          disabled={busy || !primary}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            { opacity: pressed ? 0.9 : !primary ? 0.45 : 1 },
          ]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={15} color="#fff" />
          <Text style={styles.btnLabelPrimary}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    maxWidth: 260,
    minWidth: 168,
    position: 'relative',
    overflow: 'hidden',
  },
  cardStretch: {
    alignSelf: 'stretch',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 4,
  },
  busyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  phoneBlock: {
    gap: 4,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  noPhone: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    minHeight: 34,
  },
  btnSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  btnPrimary: {
    backgroundColor: '#7c3aed',
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  btnLabelPrimary: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
