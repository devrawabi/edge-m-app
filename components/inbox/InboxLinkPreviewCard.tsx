import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '@/lib/http';
import { extractDistinctHttpUrls } from '@/lib/inbox-format';

type LinkPreviewMeta = {
  image: string | null;
  title: string | null;
  description: string | null;
};

type Props = {
  href: string;
  /** Bubble alignment side — outgoing cards use a lighter panel inside green bubbles. */
  sent: boolean;
};

export function BubbleLinkPreviews({ plain, sent }: { plain: string; sent: boolean }) {
  const urls = useMemo(() => extractDistinctHttpUrls(plain, 1), [plain]);

  if (urls.length === 0) return null;

  return (
    <View style={[styles.previewStack, styles.previewStretch]}>
      {urls.map((u) => (
        <InboxLinkPreviewCard key={u} href={u} sent={sent} />
      ))}
    </View>
  );
}

function InboxLinkPreviewCard({ href, sent }: Props) {
  const [meta, setMeta] = useState<LinkPreviewMeta | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setPhase('loading');
    setMeta(null);
    setImageBroken(false);
    const ac = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const res = await api().get(`/api/link-preview?url=${encodeURIComponent(href)}`, {
          signal: ac.signal,
        });
        if (cancelled) return;
        if (res.status !== 200) {
          setPhase('error');
          return;
        }
        const data = res.data as Partial<LinkPreviewMeta>;
        setMeta({
          image: typeof data.image === 'string' ? data.image : null,
          title: typeof data.title === 'string' ? data.title : null,
          description: typeof data.description === 'string' ? data.description : null,
        });
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [href]);

  let host = '';
  let path = '';
  try {
    const u = new URL(href);
    host = u.hostname.replace(/^www\./i, '');
    path = `${u.pathname}${u.search}${u.hash}` || '/';
    if (path.length > 96) path = `${path.slice(0, 94)}…`;
  } catch {
    return null;
  }

  const faviconSrc = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  const titleTrim = meta?.title?.trim();
  const headline = titleTrim || host;
  const detailRaw = meta?.description?.trim();
  const subline = detailRaw && detailRaw.length > 0 ? detailRaw : path;
  const showMetaImage = Boolean(meta?.image && !imageBroken && phase === 'ready');

  const shellStyle = sent ? styles.cardShellOutgoing : styles.cardShellIncoming;

  return (
    <Pressable
      onPress={() => void Linking.openURL(href)}
      style={({ pressed }) => [shellStyle, pressed && styles.cardPressed]}
    >
      {phase === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={sent ? '#374151' : '#64748b'} />
          <Text style={[styles.loadingHint, sent ? styles.loadingHintOut : styles.loadingHintIn]} numberOfLines={1}>
            Loading preview…
          </Text>
        </View>
      ) : null}

      {phase === 'ready' || phase === 'error' ? (
        <>
          {showMetaImage ? (
            <Image
              source={{ uri: meta!.image! }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageBroken(true)}
            />
          ) : null}
          <View style={styles.cardBody}>
            <Image source={{ uri: faviconSrc }} style={styles.favicon} resizeMode="contain" />
            <View style={styles.cardTextCol}>
              <Text style={[styles.headline, sent ? styles.headlineOut : styles.headlineIn]} numberOfLines={2}>
                {headline}
              </Text>
              {titleTrim ? (
                <Text style={[styles.hostLine, sent ? styles.hostLineOut : styles.hostLineIn]} numberOfLines={1}>
                  {host}
                </Text>
              ) : null}
              <Text style={[styles.desc, sent ? styles.descOut : styles.descIn]} numberOfLines={3}>
                {subline}
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  previewStack: {
    gap: 8,
    marginBottom: 6,
  },
  previewStretch: {
    alignSelf: 'stretch',
  },
  cardShellIncoming: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,27,33,0.12)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    maxWidth: 288,
  },
  cardShellOutgoing: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,27,33,0.14)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    maxWidth: 288,
  },
  cardPressed: {
    opacity: 0.88,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  loadingHint: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  loadingHintIn: { color: '#64748b' },
  loadingHintOut: { color: '#4b5563' },
  heroImage: {
    width: '100%',
    height: 128,
    backgroundColor: '#e5e7eb',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  favicon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  cardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  headlineIn: { color: '#111b21' },
  headlineOut: { color: '#0b141a' },
  hostLine: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
  },
  hostLineIn: { color: '#8696a0' },
  hostLineOut: { color: '#667781' },
  desc: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
  },
  descIn: { color: '#54656f' },
  descOut: { color: '#4a5568' },
});
