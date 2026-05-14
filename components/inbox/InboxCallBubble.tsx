import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCallDuration, type ParsedCallBubble } from '@/lib/inbox-call-bubble';

type Props = {
  parsed: ParsedCallBubble;
  sent: boolean;
  bubbleTextColor: string;
  mediaHintColor: string;
  onPress?: () => void;
  isRinging?: boolean;
};

export function InboxCallBubble({ parsed, sent, bubbleTextColor, mediaHintColor, onPress, isRinging }: Props) {
  const { direction, outcome, durationSec } = parsed;
  const dur = formatCallDuration(durationSec);

  const isIncoming = direction === 'incoming';
  const isMissed = outcome === 'missed';
  const isAnswered = outcome === 'answered';
  const isActive = outcome === 'active';

  const palette = (() => {
    if (isIncoming && isMissed) {
      return {
        accent: '#dc2626',
        accentSoft: '#fecaca',
        iconBg: '#fee2e2',
        border: 'rgba(220,38,38,0.28)',
        strip: sent ? 'rgba(255,255,255,0.88)' : 'rgba(254,242,242,0.95)',
      };
    }
    if (isIncoming && (isAnswered || isActive)) {
      return {
        accent: '#15803d',
        accentSoft: '#bbf7d0',
        iconBg: '#dcfce7',
        border: 'rgba(22,163,74,0.25)',
        strip: sent ? 'rgba(255,255,255,0.88)' : 'rgba(240,253,244,0.96)',
      };
    }
    if (!isIncoming && isMissed) {
      return {
        accent: '#c2410c',
        accentSoft: '#fed7aa',
        iconBg: '#ffedd5',
        border: 'rgba(194,65,12,0.28)',
        strip: sent ? 'rgba(255,255,255,0.92)' : 'rgba(255,247,237,0.96)',
      };
    }
    return {
      accent: '#1d4ed8',
      accentSoft: '#bfdbfe',
      iconBg: '#dbeafe',
      border: 'rgba(29,78,216,0.22)',
      strip: sent ? 'rgba(255,255,255,0.9)' : 'rgba(239,246,255,0.96)',
    };
  })();

  const title = isIncoming ? 'Incoming call' : 'Outgoing call';
  let subtitle: string;
  if (isMissed) subtitle = 'Missed';
  else if (isAnswered) subtitle = dur ? `Answered · ${dur}` : 'Answered';
  else subtitle = isIncoming ? 'Ringing…' : 'Calling…';

  const iconName: keyof typeof Ionicons.glyphMap = isMissed
    ? 'call-outline'
    : isActive
      ? isIncoming
        ? 'call-outline'
        : 'arrow-up-outline'
      : 'call';

  const cardContent = (
    <View style={[styles.card, styles.cardStretch, { borderColor: palette.border, backgroundColor: palette.strip }]}>
      <View style={[styles.accentBar, { backgroundColor: palette.accent }]} />
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={iconName} size={22} color={palette.accent} />
        </View>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.kicker, { color: palette.accent }]}>Voice</Text>
            <View style={[styles.dot, { backgroundColor: palette.accentSoft }]} />
            <Text style={[styles.title, { color: bubbleTextColor }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: mediaHintColor }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );

  // Make the ringing incoming call card tappable to open the full call screen
  if (onPress && isRinging) {
    return (
      <Pressable onPress={onPress} style={styles.pressable}>
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxWidth: 300,
    minWidth: 220,
  },
  cardStretch: {
    alignSelf: 'stretch',
  },
  accentBar: {
    width: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingLeft: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  pressable: {
    alignSelf: 'stretch',
  },
});
