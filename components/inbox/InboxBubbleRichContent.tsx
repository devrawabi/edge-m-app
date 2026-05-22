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
  documentDisplayLabel,
  documentExtensionLabel,
  inboxCaptionShouldRender,
  parseInboxMetadataRecord,
  parseLocationCoords,
} from '@/lib/inbox-bubble-rich';
import { stripHtmlForMessageBody } from '@/lib/inbox-format';
import { tryParseCallBubble } from '@/lib/inbox-call-bubble';
import { api } from '@/lib/http';
import { initSessionJar, getCookieHeader } from '@/lib/session-store';
import { LinkifiedWhatsAppBubbleText, type WhatsAppBubblePalette } from '@/lib/whatsapp-message-text-rn';
import type { InboxMessage } from '@/types/inbox';
import type { InboxMediaPreviewRequest } from '@/types/inbox-media-preview';

import { BubbleLinkPreviews } from '@/components/inbox/InboxLinkPreviewCard';
import { InboxCallBubble } from '@/components/inbox/InboxCallBubble';
import { showIncomingCallScreen } from '@/components/WhatsAppIncomingCallHost';
import type { ContactCardActionPayload } from '@/components/inbox/InboxContactBubble';
import { InboxContactBubble } from '@/components/inbox/InboxContactBubble';

type Props = {
  message: InboxMessage;
  sent: boolean;
  waBubblePalette: WhatsAppBubblePalette;
  bubbleTextStyle: object;
  bubbleTextColor: string;
  mediaHintColor: string;
  /** WhatsApp-style attachment strip inside bubble */
  docStripBg: string;
  docStripBorder: string;
  onOpenMediaPreview?: (req: InboxMediaPreviewRequest) => void;
  onContactOpenChat?: (p: ContactCardActionPayload) => void | Promise<void>;
  onContactSaveToDevice?: (p: ContactCardActionPayload) => void | Promise<void>;
  contactCardBusyMessageId?: string | null;
  /** Shown on quoted incoming bubbles instead of the generic “Customer” label. */
  threadContactDisplayName?: string | null;
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
      <View style={[styles.expandFab, { pointerEvents: 'none' }]}>
        <Ionicons name="expand-outline" size={15} color="#fff" />
      </View>
    </Pressable>
  );
}

function ForwardedLabel({ color }: { color: string }) {
  return (
    <View style={styles.forwardedRow}>
      <Ionicons name="arrow-redo-outline" size={13} color={color} />
      <Text style={[styles.forwardedText, { color }]}>Forwarded</Text>
    </View>
  );
}

function quotedIncomingAuthorLabel(
  quoted: Record<string, unknown>,
  threadContactDisplayName?: string | null,
): string {
  const fromMeta = (k: string) => {
    const v = quoted[k];
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  };
  return (
    fromMeta('fromName') ||
    fromMeta('senderName') ||
    fromMeta('contactName') ||
    fromMeta('authorName') ||
    (threadContactDisplayName && String(threadContactDisplayName).trim()) ||
    'Contact'
  );
}

function QuotedSnippet({
  metadata,
  mediaHintColor,
  threadContactDisplayName,
  onPress,
}: {
  metadata: unknown;
  mediaHintColor: string;
  threadContactDisplayName?: string | null;
  onPress?: () => void;
}) {
  const meta = parseInboxMetadataRecord(metadata);
  const quoted = meta.quotedMessage as Record<string, unknown> | undefined;
  if (!quoted || typeof quoted !== 'object') return null;
  const dirUpper = String(quoted.direction ?? '').toUpperCase();
  const dir =
    dirUpper === 'OUTGOING' ? 'You' : quotedIncomingAuthorLabel(quoted, threadContactDisplayName);
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
        styles.rowAlignLeadingEdge,
        { borderLeftColor: '#25d366', opacity: pressed ? 0.85 : 1 },
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
  docStripBg,
  docStripBorder,
  onOpenMediaPreview,
  onContactOpenChat,
  onContactSaveToDevice,
  contactCardBusyMessageId,
  threadContactDisplayName,
}: Props) {
  const meta = parseInboxMetadataRecord(m.metadata);
  const upper = (m.type || 'TEXT').toUpperCase();
  const forwarded = Boolean(meta.isForwarded);
  const quoted = meta.quotedMessage ? (
    <QuotedSnippet
      metadata={m.metadata}
      mediaHintColor={mediaHintColor}
      threadContactDisplayName={threadContactDisplayName}
    />
  ) : null;

  const captionBlock = inboxCaptionShouldRender(m.text) ? (
    <>
      <BubbleLinkPreviews plain={stripHtmlForMessageBody(m.text || '')} sent={sent} />
      <LinkifiedWhatsAppBubbleText
        messageId={m.id}
        rawHtml={m.text || ''}
        sent={!!m.sent}
        palette={waBubblePalette}
        style={bubbleTextStyle}
      />
    </>
  ) : null;

  const maxW = 260;
  const blockRoot = [styles.block, sent ? styles.blockOutgoing : styles.blockIncoming];

  const callParsed = tryParseCallBubble(m);
  if (callParsed) {
    const isRingingIncoming =
      callParsed.direction === 'incoming' && callParsed.outcome === 'active';

    const handleRingingPress = () => {
      // Reconstruct a payload from the message metadata so the full call screen can show
      const meta = parseInboxMetadataRecord(m.metadata);
      const metaName = meta.contactName ? String(meta.contactName) : '';
      const metaPhone = meta.phoneNumber ? String(meta.phoneNumber) : '';
      const msgName = (m as any).contactName ? String((m as any).contactName) : '';
      const msgPhone = (m as any).phoneNumber ? String((m as any).phoneNumber) : '';

      const finalName = metaName || msgName || metaPhone || msgPhone || 'Unknown caller';
      const finalPhone = metaPhone || msgPhone || metaName || msgName || '';

      const payload = {
        callId: String(meta.callId || m.id || `call-${Date.now()}`),
        contactName: finalName,
        phoneNumber: finalPhone,
        status: 'ringing' as const,
        contactId: (m as any).contactId ? String((m as any).contactId) : undefined,
        timestamp: Date.now(),
      };
      showIncomingCallScreen(payload);
    };

    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <InboxCallBubble
          parsed={callParsed}
          sent={sent}
          bubbleTextColor={bubbleTextColor}
          mediaHintColor={mediaHintColor}
          onPress={isRingingIncoming ? handleRingingPress : undefined}
          isRinging={isRingingIncoming}
        />
      </View>
    );
  }

  const contactPlain = stripHtmlForMessageBody(m.text || '');
  const isContactMessage =
    upper === 'CONTACT' || /^CONTACT:\s*/i.test(contactPlain.trim());
  if (isContactMessage && onContactOpenChat && onContactSaveToDevice) {
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <InboxContactBubble
          rawHtml={m.text || ''}
          sent={sent}
          bubbleTextColor={bubbleTextColor}
          mediaHintColor={mediaHintColor}
          docStripBg={docStripBg}
          docStripBorder={docStripBorder}
          messageId={m.id}
          busyMessageId={contactCardBusyMessageId ?? null}
          onOpenChat={onContactOpenChat}
          onSaveToDevice={onContactSaveToDevice}
        />
      </View>
    );
  }

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
          {captionBlock}
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
        {captionBlock}
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
          {captionBlock}
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
        {captionBlock}
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
          {captionBlock}
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
        {captionBlock}
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
          {captionBlock}
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
        {captionBlock}
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
          {captionBlock}
        </View>
      );
    }
    const name = documentDisplayLabel(m);
    const ext = documentExtensionLabel(name);
    const extShort = ext.length > 4 ? ext.slice(0, 4) : ext;
    const extLower = ext.toLowerCase();
    const isPdf = extLower === 'pdf';
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
            styles.waDocRow,
            { alignSelf: sent ? 'flex-end' : 'flex-start' },
            {
              backgroundColor: docStripBg,
              borderColor: docStripBorder,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.waDocIconTile, isPdf ? styles.waDocIconPdf : styles.waDocIconNeutral]}>
            <Text style={styles.waDocIconExtLabel} numberOfLines={1}>
              {extShort}
            </Text>
          </View>
          <View style={styles.waDocTextCol}>
            <Text style={[styles.waDocFileName, { color: bubbleTextColor }]} numberOfLines={2}>
              {name}
            </Text>
            <Text style={[styles.waDocSubline, { color: mediaHintColor }]}>
              {onOpenMediaPreview ? 'Tap to preview · Hold to save' : 'Tap to download'}
            </Text>
          </View>
        </Pressable>
        {captionBlock}
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
    const tplPlain = stripHtmlForMessageBody(raw || m.text || '');
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <BubbleLinkPreviews plain={tplPlain} sent={sent} />
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
    const orderPlain = stripHtmlForMessageBody(body);
    return (
      <View style={blockRoot}>
        {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
        {quoted}
        <BubbleLinkPreviews plain={orderPlain} sent={sent} />
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
  const plain = stripHtmlForMessageBody(m.text || '');
  return (
    <View style={blockRoot}>
      {forwarded ? <ForwardedLabel color={mediaHintColor} /> : null}
      {quoted}
      <BubbleLinkPreviews plain={plain} sent={sent} />
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
  /** Full bubble width so outgoing bubbles don’t pin this row to the trailing edge (WhatsApp: header reads L→R from bubble start). */
  forwardedRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 4,
    paddingRight: 4,
  },
  forwardedText: { fontSize: 12, fontStyle: 'italic', fontWeight: '500', letterSpacing: 0.15 },
  rowAlignLeadingEdge: { alignSelf: 'stretch' },
  quotedBox: {
    borderLeftWidth: 4,
    paddingLeft: 10,
    paddingVertical: 6,
    marginBottom: 6,
    backgroundColor: 'rgba(134,150,160,0.12)',
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
    maxWidth: Platform.OS === 'web' ? 280 : 340,
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
  waDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: Platform.OS === 'web' ? 288 : 360,
    minHeight: 58,
  },
  waDocIconTile: {
    width: 44,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  waDocIconPdf: {
    backgroundColor: '#ea4335',
  },
  waDocIconNeutral: {
    backgroundColor: '#8696a0',
  },
  waDocIconExtLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  waDocTextCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  waDocFileName: {
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  waDocSubline: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
    opacity: 0.92,
  },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    maxWidth: Platform.OS === 'web' ? 280 : 360,
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
