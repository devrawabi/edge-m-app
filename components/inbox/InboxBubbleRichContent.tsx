import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { useInboxMediaSource } from '@/hooks/useInboxMediaSource';
import { getApiBaseUrl } from '@/constants/Config';
import {
  documentAccentForName,
  documentDisplayLabel,
  documentExtensionLabel,
  inboxCaptionShouldRender,
  parseInboxMetadataRecord,
  parseLocationCoords,
} from '@/lib/inbox-bubble-rich';
import { api } from '@/lib/http';
import { initSessionJar, getCookieHeader } from '@/lib/session-store';
import { LinkifiedWhatsAppBubbleText, type WhatsAppBubblePalette } from '@/lib/whatsapp-message-text-rn';
import type { InboxMessage } from '@/types/inbox';
import type { InboxMediaPreviewRequest } from '@/types/inbox-media-preview';

type Props = {
  message: InboxMessage;
  sent: boolean;
  waBubblePalette: WhatsAppBubblePalette;
  bubbleTextStyle: object;
  bubbleTextColor: string;
  mediaHintColor: string;
  onOpenMediaPreview?: (req: InboxMediaPreviewRequest) => void;
};

function MediaPreviewTarget({
  sent,
  children,
  onOpen,
}: {
  sent: boolean;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  if (!onOpen) return <>{children}</>;
  return (
    <Pressable onPress={onOpen} style={[styles.previewTap, { alignSelf: sent ? 'flex-end' : 'flex-start' }]}>
      {children}
      <View pointerEvents="none" style={styles.expandFab}>
        <Ionicons name="expand-outline" size={15} color="#fff" />
      </View>
    </Pressable>
  );
}

function ForwardedLabel({ color }: { color: string }) {
  return (
    <View style={styles.forwardedRow}>
      <Ionicons name="arrow-redo-outline" size={12} color={color} />
      <Text style={[styles.forwardedText, { color }]}>Forwarded</Text>
    </View>
  );
}

function QuotedSnippet({
  metadata,
  mediaHintColor,
  onPress,
}: {
  metadata: unknown;
  mediaHintColor: string;
  onPress?: () => void;
}) {
  const meta = parseInboxMetadataRecord(metadata);
  const quoted = meta.quotedMessage as Record<string, unknown> | undefined;
  if (!quoted || typeof quoted !== 'object') return null;
  const dir = quoted.direction === 'OUTGOING' ? 'You' : 'Customer';
  const qType = String(quoted.type || 'TEXT').toUpperCase();
  const qContent = quoted.content != null ? String(quoted.content) : '';
  let preview = qContent;
  if (qType === 'IMAGE') preview = '📷 Image';
  else if (qType === 'VIDEO') preview = '🎬 Video';
  else if (qType === 'STICKER') preview = '🎨 Sticker';
  else if (qType === 'DOCUMENT') preview = `📄 ${qContent || 'Document'}`;
  else if (qType === 'AUDIO' || qType === 'VOICE') preview = '🎤 Voice message';
  else if (qType === 'POLL') preview = '📊 Poll';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.quotedBox,
        { borderLeftColor: '#22c55e', opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.quotedWho, { color: mediaHintColor }]}>{dir}</Text>
      <Text style={[styles.quotedPreview, { color: mediaHintColor }]} numberOfLines={2}>
        {preview}
      </Text>
    </Pressable>
  );
}

function InboxAuthenticatedImage({
  mediaUrl,
  width,
  height,
  borderRadius,
  resizeMode,
}: {
  mediaUrl: string;
  width: number;
  height: number;
  borderRadius: number;
  resizeMode: 'cover' | 'contain';
}) {
  const src = useInboxMediaSource(mediaUrl);
  if (src.phase === 'empty' || src.phase === 'error') {
    return (
      <View style={[styles.mediaFail, { width, height, borderRadius }]}>
        <Ionicons name="image-outline" size={28} color="#94a3b8" />
        <Text style={styles.mediaFailText}>Unavailable</Text>
      </View>
    );
  }
  if (src.phase === 'loading') {
    return (
      <View style={[styles.mediaLoading, { width, height, borderRadius }]}>
        <ActivityIndicator color="#94a3b8" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src.uri, ...(src.headers ? { headers: src.headers } : {}) }}
      style={{ width, height, borderRadius }}
      resizeMode={resizeMode}
    />
  );
}

function InboxWebVideoOrAudio({
  kind,
  mediaUrl,
  maxWidth,
}: {
  kind: 'video' | 'audio';
  mediaUrl: string;
  maxWidth: number;
}) {
  const src = useInboxMediaSource(mediaUrl);
  if (src.phase !== 'ready' || Platform.OS !== 'web') return null;
  const common = {
    key: `${kind}-${mediaUrl}`,
    src: src.uri,
    controls: true,
    style: {
      width: maxWidth,
      maxHeight: kind === 'video' ? 280 : 48,
      borderRadius: 12,
      backgroundColor: kind === 'video' ? '#0f172a' : 'transparent',
    },
  };
  if (kind === 'video') {
    return React.createElement('video', common) as React.ReactElement;
  }
  return React.createElement('audio', common) as React.ReactElement;
}

async function openBinaryMediaNative(mediaUrl: string, suggestedName: string) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/media?mediaId=${encodeURIComponent(mediaUrl)}`;
  await initSessionJar();
  const cookie = await getCookieHeader();
  const safe = suggestedName.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'file';
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('Cache directory unavailable');
  const dest = `${dir}inbox_${Date.now()}_${safe}`;
  const res = await FileSystem.downloadAsync(url, dest, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
  await Share.share({ url: res.uri });
}

async function openBinaryMediaWeb(mediaUrl: string, filename: string) {
  const res = await api().get(`/api/media?mediaId=${encodeURIComponent(mediaUrl)}`, { responseType: 'blob' });
  if (res.status >= 400) throw new Error('Download failed');
  const blob = res.data as Blob;
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function NativeMediaOpenRow({
  icon,
  title,
  subtitle,
  mediaUrl,
  filename,
  sent,
  bubbleTextColor,
  mediaHintColor,
  onPreview,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  mediaUrl: string;
  filename: string;
  sent: boolean;
  bubbleTextColor: string;
  mediaHintColor: string;
  onPreview?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const onOpen = useCallback(() => {
    if (onPreview) {
      onPreview();
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        if (Platform.OS === 'web') {
          await openBinaryMediaWeb(mediaUrl, filename);
        } else {
          await openBinaryMediaNative(mediaUrl, filename);
        }
      } catch (e) {
        Alert.alert('Media', e instanceof Error ? e.message : 'Could not open file');
      } finally {
        setBusy(false);
      }
    })();
  }, [filename, mediaUrl, onPreview]);

  return (
    <Pressable
      onPress={onOpen}
      disabled={busy}
      style={({ pressed }) => [
        styles.mediaOpenRow,
        { alignSelf: sent ? 'flex-end' : 'flex-start' },
        {
          backgroundColor: sent ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.06)',
          opacity: pressed || busy ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.mediaOpenIcon, { backgroundColor: sent ? 'rgba(255,255,255,0.18)' : '#e2e8f0' }]}>
        <Ionicons name={icon} size={22} color={sent ? '#e2e8f0' : '#475569'} />
      </View>
      <View style={styles.mediaOpenText}>
        <Text style={[styles.mediaOpenTitle, { color: bubbleTextColor }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.mediaOpenSub, { color: mediaHintColor }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name={onPreview ? 'expand-outline' : 'download-outline'} size={20} color={mediaHintColor} />
    </Pressable>
  );
}

export function InboxBubbleRichContent({
  message: m,
  sent,
  waBubblePalette,
  bubbleTextStyle,
  bubbleTextColor,
  mediaHintColor,
  onOpenMediaPreview,
}: Props) {
  const meta = parseInboxMetadataRecord(m.metadata);
  const upper = (m.type || 'TEXT').toUpperCase();
  const forwarded = Boolean(meta.isForwarded);
  const quoted = meta.quotedMessage ? <QuotedSnippet metadata={m.metadata} mediaHintColor={mediaHintColor} /> : null;

  const caption = inboxCaptionShouldRender(m.text) ? (
    <LinkifiedWhatsAppBubbleText
      messageId={m.id}
      rawHtml={m.text || ''}
      sent={!!m.sent}
      palette={waBubblePalette}
      style={bubbleTextStyle}
    />
  ) : null;

  const maxW = 260;
  const blockRoot = [styles.block, sent ? styles.blockOutgoing : styles.blockIncoming];

  if (upper === 'IMAGE') {
    if (!m.mediaUrl) {
      return (
        <View style={blockRoot}>
          {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
          {quoted}
          <View style={styles.typePlaceholderRow}>
            <Ionicons name="image-outline" size={18} color={mediaHintColor} />
            <Text style={[styles.typePlaceholderText, { color: mediaHintColor }]}>Image</Text>
          </View>
          {caption}
        </View>
      );
    }
    const mediaId = m.mediaUrl;
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <MediaPreviewTarget
          sent={sent}
          onOpen={
            onOpenMediaPreview && mediaId
              ? () => onOpenMediaPreview({ kind: 'image', mediaUrl: mediaId })
              : undefined
          }
        >
          <InboxAuthenticatedImage
            mediaUrl={mediaId}
            width={maxW}
            height={200}
            borderRadius={14}
            resizeMode="cover"
          />
        </MediaPreviewTarget>
        {caption}
      </View>
    );
  }

  if (upper === 'STICKER') {
    if (!m.mediaUrl) {
      return (
        <View style={blockRoot}>
          {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
          {quoted}
          <View style={styles.typePlaceholderRow}>
            <Ionicons name="happy-outline" size={18} color={mediaHintColor} />
            <Text style={[styles.typePlaceholderText, { color: mediaHintColor }]}>Sticker</Text>
          </View>
          {caption}
        </View>
      );
    }
    const stickerId = m.mediaUrl;
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <View style={styles.stickerWrap}>
          <InboxAuthenticatedImage
            mediaUrl={stickerId}
            width={128}
            height={128}
            borderRadius={8}
            resizeMode="contain"
          />
        </View>
        {caption}
      </View>
    );
  }

  if (upper === 'VIDEO') {
    if (!m.mediaUrl) {
      return (
        <View style={blockRoot}>
          {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
          {quoted}
          <View style={styles.typePlaceholderRow}>
            <Ionicons name="videocam-outline" size={18} color={mediaHintColor} />
            <Text style={[styles.typePlaceholderText, { color: mediaHintColor }]}>Video</Text>
          </View>
          {caption}
        </View>
      );
    }
    const videoId = m.mediaUrl;
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        {Platform.OS === 'web' ? (
          <View style={[styles.videoWebOuter, { alignSelf: sent ? 'flex-end' : 'flex-start' }]}>
            <View style={styles.videoWebWrap}>
              <InboxWebVideoOrAudio kind="video" mediaUrl={videoId} maxWidth={maxW} />
            </View>
            {onOpenMediaPreview ? (
              <Pressable
                accessibilityLabel="Fullscreen video"
                onPress={() => onOpenMediaPreview({ kind: 'video', mediaUrl: videoId })}
                style={styles.videoExpandHit}
              >
                <Ionicons name="expand-outline" size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <NativeMediaOpenRow
            icon="videocam-outline"
            title="Video"
            subtitle={onOpenMediaPreview ? 'Tap for fullscreen' : 'Tap to download / open'}
            mediaUrl={videoId}
            filename={`video_${m.id}.mp4`}
            sent={sent}
            bubbleTextColor={bubbleTextColor}
            mediaHintColor={mediaHintColor}
            onPreview={
              onOpenMediaPreview ? () => onOpenMediaPreview({ kind: 'video', mediaUrl: videoId }) : undefined
            }
          />
        )}
        {caption}
      </View>
    );
  }

  if (upper === 'AUDIO' || upper === 'VOICE') {
    if (!m.mediaUrl) {
      return (
        <View style={blockRoot}>
          {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
          {quoted}
          <View style={styles.typePlaceholderRow}>
            <Ionicons name="mic-outline" size={18} color={mediaHintColor} />
            <Text style={[styles.typePlaceholderText, { color: mediaHintColor }]}>Voice message</Text>
          </View>
          {caption}
        </View>
      );
    }
    const audioId = m.mediaUrl;
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        {Platform.OS === 'web' ? (
          <View style={[styles.videoWebOuter, { alignSelf: sent ? 'flex-end' : 'flex-start' }]}>
            <View style={styles.audioWebWrap}>
              <InboxWebVideoOrAudio kind="audio" mediaUrl={audioId} maxWidth={maxW} />
            </View>
            {onOpenMediaPreview ? (
              <Pressable
                accessibilityLabel="Fullscreen audio"
                onPress={() => onOpenMediaPreview({ kind: 'audio', mediaUrl: audioId })}
                style={styles.audioExpandHit}
              >
                <Ionicons name="expand-outline" size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <NativeMediaOpenRow
            icon="mic-outline"
            title="Voice message"
            subtitle={onOpenMediaPreview ? 'Tap for fullscreen' : 'Tap to download / open'}
            mediaUrl={audioId}
            filename={`voice_${m.id}.ogg`}
            sent={sent}
            bubbleTextColor={bubbleTextColor}
            mediaHintColor={mediaHintColor}
            onPreview={
              onOpenMediaPreview ? () => onOpenMediaPreview({ kind: 'audio', mediaUrl: audioId }) : undefined
            }
          />
        )}
        {caption}
      </View>
    );
  }

  if (upper === 'DOCUMENT') {
    if (!m.mediaUrl) {
      return (
        <View style={blockRoot}>
          {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
          {quoted}
          <View style={styles.typePlaceholderRow}>
            <Ionicons name="document-text-outline" size={18} color={mediaHintColor} />
            <Text style={[styles.typePlaceholderText, { color: mediaHintColor }]}>Document</Text>
          </View>
          {caption}
        </View>
      );
    }
    const name = documentDisplayLabel(m);
    const ext = documentExtensionLabel(name);
    const accent = documentAccentForName(name);
    const downloadDoc = () =>
      void (async () => {
        try {
          if (Platform.OS === 'web') await openBinaryMediaWeb(m.mediaUrl!, name);
          else await openBinaryMediaNative(m.mediaUrl!, name);
        } catch (e) {
          Alert.alert('Document', e instanceof Error ? e.message : 'Could not save');
        }
      })();
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <Pressable
          onPress={() => {
            if (onOpenMediaPreview) {
              onOpenMediaPreview({ kind: 'document', mediaUrl: m.mediaUrl!, fileName: name });
            } else {
              downloadDoc();
            }
          }}
          onLongPress={onOpenMediaPreview ? downloadDoc : undefined}
          style={({ pressed }) => [
            styles.docCard,
            { alignSelf: sent ? 'flex-end' : 'flex-start' },
            {
              backgroundColor: accent.bg,
              borderColor: accent.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.docExtBadge, { backgroundColor: accent.fg }]}>
            <Text style={styles.docExtText}>{ext}</Text>
          </View>
          <View style={styles.docBody}>
            <Text style={[styles.docTitle, { color: accent.fg }]} numberOfLines={2}>
              {name}
            </Text>
            <Text style={[styles.docHint, { color: mediaHintColor }]}>
              {onOpenMediaPreview ? 'Tap to preview · hold to save' : 'Tap to download'}
            </Text>
          </View>
          <Ionicons name={onOpenMediaPreview ? 'expand-outline' : 'document-attach-outline'} size={26} color={accent.fg} />
        </Pressable>
        {caption}
      </View>
    );
  }

  if (upper === 'LOCATION') {
    const coords = parseLocationCoords(m.text);
    if (coords) {
      const href = `https://www.google.com/maps?q=${encodeURIComponent(coords.lat)},${encodeURIComponent(coords.lng)}`;
      return (
        <View style={blockRoot}>
          {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
          {quoted}
          <Pressable
            onPress={() => void Linking.openURL(href)}
            style={({ pressed }) => [styles.locCard, { opacity: pressed ? 0.88 : 1 }]}
          >
            <Ionicons name="location-outline" size={22} color="#1d4ed8" />
            <View style={styles.locText}>
              <Text style={styles.locTitle}>Location</Text>
              <Text style={styles.locSub}>Open in Maps</Text>
            </View>
          </Pressable>
        </View>
      );
    }
  }

  if (upper === 'TEMPLATE') {
    const raw = (m.text || '').replace(/^TEMPLATE:\s*/i, '').trim();
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <View style={styles.templateCard}>
          <Ionicons name="mail-outline" size={20} color="#4338ca" />
          <View style={styles.templateText}>
            <Text style={styles.templateLabel}>Template</Text>
            <Text style={styles.templateName} numberOfLines={2}>
              {raw || 'Template message'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (upper === 'ORDER') {
    const body =
      m.text === '[ORDER]' || m.text === '[order]'
        ? 'Catalog order received (details may be unavailable for older messages).'
        : m.text || 'Order';
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <View style={styles.orderCard}>
          <Ionicons name="bag-handle-outline" size={20} color="#047857" />
          <Text style={styles.orderTitle}>Order</Text>
          <Text style={styles.orderBody}>{body}</Text>
        </View>
      </View>
    );
  }

  if (upper === 'UNSUPPORTED' || m.text === '[UNSUPPORTED]' || m.text === 'UNSUPPORTED_MEDIA') {
    const rawType = String((meta as { rawType?: string }).rawType || '').toLowerCase();
    const isOtp = rawType === 'authentication' || rawType === 'system';
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <View style={styles.unsupportedRow}>
          <Ionicons name={isOtp ? 'key-outline' : 'alert-circle-outline'} size={18} color={mediaHintColor} />
          <Text style={[styles.unsupportedText, { color: mediaHintColor }]}>
            {isOtp ? 'OTP / verification (preview not available)' : 'Unsupported media'}
          </Text>
        </View>
      </View>
    );
  }

  // Default: plain / interactive / contact stored as text, etc.
  return (
    <View style={blockRoot}>
      {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
      {quoted}
      <LinkifiedWhatsAppBubbleText
        messageId={m.id}
        rawHtml={m.text || ''}
        sent={!!m.sent}
        palette={waBubblePalette}
        style={bubbleTextStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  blockIncoming: { alignItems: 'flex-start' },
  blockOutgoing: { alignItems: 'flex-end' },
  forwardedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  forwardedText: { fontSize: 11, fontStyle: 'italic', fontWeight: '600' },
  quotedBox: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderRadius: 6,
  },
  quotedWho: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  quotedPreview: { fontSize: 12, lineHeight: 16 },
  stickerWrap: { paddingVertical: 4 },
  previewTap: { position: 'relative', alignSelf: 'flex-start' },
  expandFab: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  videoWebOuter: { position: 'relative', alignSelf: 'flex-start', maxWidth: 260 },
  videoExpandHit: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 8,
    zIndex: 2,
  },
  audioExpandHit: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 7,
    zIndex: 2,
  },
  mediaFail: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.15)',
    gap: 4,
  },
  mediaFailText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  mediaLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  videoWebWrap: { maxWidth: 260, borderRadius: 12, overflow: 'hidden' },
  audioWebWrap: { maxWidth: 260 },
  mediaOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    maxWidth: 280,
  },
  mediaOpenIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaOpenText: { flex: 1, minWidth: 0 },
  mediaOpenTitle: { fontSize: 14, fontWeight: '700' },
  mediaOpenSub: { fontSize: 11, marginTop: 2 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 280,
  },
  docExtBadge: {
    minWidth: 40,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docExtText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  docBody: { flex: 1, minWidth: 0 },
  docTitle: { fontSize: 14, fontWeight: '700' },
  docHint: { fontSize: 11, marginTop: 2 },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    maxWidth: 280,
  },
  locText: { flex: 1 },
  locTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a8a' },
  locSub: { fontSize: 11, color: '#3b82f6', marginTop: 2 },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    maxWidth: 280,
  },
  templateText: { flex: 1, minWidth: 0 },
  templateLabel: { fontSize: 10, fontWeight: '800', color: '#4338ca', letterSpacing: 0.8 },
  templateName: { fontSize: 14, color: '#312e81', marginTop: 4, fontWeight: '600' },
  orderCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#a7f3d0',
    maxWidth: 280,
    gap: 6,
  },
  orderTitle: { fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.8 },
  orderBody: { fontSize: 14, color: '#064e3b', lineHeight: 20 },
  unsupportedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  unsupportedText: { fontSize: 13, fontStyle: 'italic', flex: 1 },
  typePlaceholderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  typePlaceholderText: { fontSize: 14, fontStyle: 'italic', fontWeight: '600' },
});
