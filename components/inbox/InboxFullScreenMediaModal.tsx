import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as XLSX from 'xlsx';

import { useInboxMediaSource } from '@/hooks/useInboxMediaSource';
import { downloadInboxMediaToCache, fetchInboxMediaBlob } from '@/lib/inbox-download-media';
import type { InboxMediaPreviewRequest } from '@/types/inbox-media-preview';
import { ZoomablePreviewImage } from '@/components/inbox/ZoomablePreviewImage';

type Props = {
  visible: boolean;
  request: InboxMediaPreviewRequest | null;
  onClose: () => void;
};

/** expo-video player + view; `key` on caller remounts when `source` URI changes. */
function InboxResolvedVideoPlayer({ source }: { source: string }) {
  const player = useVideoPlayer(source, (p) => {
    p.pause();
  });
  return (
    <VideoView player={player} style={styles.videoFill} nativeControls contentFit="contain" />
  );
}

function docKindFromName(name: string): 'pdf' | 'text' | 'sheet' | 'image' | 'video' | 'audio' | 'binary' {
  const l = name.toLowerCase();
  if (l.endsWith('.pdf')) return 'pdf';
  if (/\.(csv|tsv|txt|json|log|md|html?|xml|yml|yaml)$/i.test(l)) return 'text';
  if (/\.(xlsx?|xlsm|ods)$/i.test(l)) return 'sheet';
  if (/\.(jpe?g|png|gif|webp|bmp|heic|svg|avif)$/i.test(l)) return 'image';
  if (/\.(mp4|webm|mov|mkv|m4v)$/i.test(l)) return 'video';
  if (/\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(l)) return 'audio';
  return 'binary';
}

function PreviewImageBody({ mediaUrl }: { mediaUrl: string }) {
  const src = useInboxMediaSource(mediaUrl);
  if (src.phase === 'loading' || src.phase === 'empty') {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  if (src.phase === 'error') {
    return (
      <View style={styles.centerFill}>
        <Ionicons name="image-outline" size={48} color="#9ca3af" />
        <Text style={styles.errorText}>Could not load image</Text>
      </View>
    );
  }
  return (
    <View style={styles.imageZoomShell}>
      <ZoomablePreviewImage uri={src.uri} headers={src.headers} />
      <Text style={styles.zoomHint} pointerEvents="none">
        {Platform.OS === 'web' ? 'Scroll or pinch to zoom' : 'Pinch to zoom · drag when zoomed'}
      </Text>
    </View>
  );
}

function PreviewDocumentImage({ mediaUrl, fileName }: { mediaUrl: string; fileName: string }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [uri, setUri] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setUri(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          const blob = await fetchInboxMediaBlob(mediaUrl);
          if (cancelled) return;
          const u = URL.createObjectURL(blob);
          blobUrlRef.current = u;
          setUri(u);
        } else {
          const local = await downloadInboxMediaToCache(mediaUrl, fileName);
          if (cancelled) return;
          setUri(local);
        }
        if (!cancelled) setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [fileName, mediaUrl]);

  if (phase === 'loading') {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.hintBelowSpinner}>Loading image…</Text>
      </View>
    );
  }
  if (phase === 'error' || !uri) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>Could not load image</Text>
      </View>
    );
  }
  return (
    <View style={styles.imageZoomShell}>
      <ZoomablePreviewImage uri={uri} />
      <Text style={styles.zoomHint} pointerEvents="none">
        {Platform.OS === 'web' ? 'Scroll or pinch to zoom' : 'Pinch to zoom · drag when zoomed'}
      </Text>
    </View>
  );
}

function PreviewVideoAudioBody({
  kind,
  mediaUrl,
}: {
  kind: 'video' | 'audio';
  mediaUrl: string;
}) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const webSrc = useInboxMediaSource(Platform.OS === 'web' ? mediaUrl : null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    setLocalUri(null);
    setErr(null);
    void (async () => {
      try {
        const ext = kind === 'video' ? 'video_preview.mp4' : 'voice_preview.ogg';
        const uri = await downloadInboxMediaToCache(mediaUrl, ext);
        if (!cancelled) setLocalUri(uri);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, mediaUrl]);

  if (Platform.OS === 'web') {
    if (webSrc.phase === 'loading' || webSrc.phase === 'empty') {
      return (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }
    if (webSrc.phase === 'error' || webSrc.phase !== 'ready') {
      return (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Could not load media</Text>
        </View>
      );
    }
    return <InboxResolvedVideoPlayer key={webSrc.uri} source={webSrc.uri} />;
  }

  if (err) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>{err}</Text>
      </View>
    );
  }
  if (!localUri) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  return <InboxResolvedVideoPlayer key={localUri} source={localUri} />;
}

function PreviewPdfWeb({ blobUrl }: { blobUrl: string }) {
  return React.createElement('iframe', {
    src: blobUrl,
    title: 'pdf',
    style: { flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#111' },
  }) as React.ReactElement;
}

/** PDF / text / spreadsheet / non-preview file types only (owns all hooks below). */
function PreviewDocumentPdfTextSheetBinary({
  mediaUrl,
  fileName,
  onShare,
  kind,
}: {
  mediaUrl: string;
  fileName: string;
  onShare: () => void;
  kind: 'pdf' | 'text' | 'sheet' | 'binary';
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<unknown[][] | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFileUri, setPdfFileUri] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const revokePdfBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setTextContent(null);
    setSheetRows(null);
    setPdfBlobUrl(null);
    setPdfFileUri(null);
    revokePdfBlob();

    void (async () => {
      try {
        if (kind === 'binary') {
          if (!cancelled) setPhase('ready');
          return;
        }
        const blob = await fetchInboxMediaBlob(mediaUrl);
        if (cancelled) return;

        if (kind === 'pdf') {
          if (Platform.OS === 'web') {
            const u = URL.createObjectURL(blob);
            blobUrlRef.current = u;
            setPdfBlobUrl(u);
          } else {
            const uri = await downloadInboxMediaToCache(mediaUrl, fileName.endsWith('.pdf') ? fileName : 'preview.pdf');
            setPdfFileUri(uri);
          }
          setPhase('ready');
          return;
        }

        if (kind === 'text') {
          const t = await blob.text();
          if (!cancelled) {
            setTextContent(t.length > 1_200_000 ? `${t.slice(0, 1_200_000)}\n\n…(truncated)` : t);
            setPhase('ready');
          }
          return;
        }

        if (kind === 'sheet') {
          const buf = await blob.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          const first = wb.SheetNames[0];
          if (!first) {
            setSheetRows([]);
            setPhase('ready');
            return;
          }
          const sheet = wb.Sheets[first];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
          const capped = rows.slice(0, 500).map((r) => (Array.isArray(r) ? r.slice(0, 24) : [String(r)]));
          if (!cancelled) {
            setSheetRows(capped);
            setPhase('ready');
          }
          return;
        }
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      revokePdfBlob();
    };
  }, [fileName, kind, mediaUrl]);

  if (phase === 'loading') {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.hintBelowSpinner}>Loading preview…</Text>
      </View>
    );
  }
  if (phase === 'error') {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>Preview unavailable</Text>
      </View>
    );
  }

  if (kind === 'binary') {
    return (
      <View style={styles.centerFill}>
        <Ionicons name="document-text-outline" size={56} color="#9ca3af" />
        <Text style={styles.binaryTitle}>No preview for this file type</Text>
        <Text style={styles.binarySub}>Share opens it in another app (Word, Drive, etc.).</Text>
        <Pressable onPress={onShare} style={styles.sharePrimaryBtn}>
          <Ionicons name="share-outline" size={22} color="#fff" />
          <Text style={styles.sharePrimaryBtnText}>Share file</Text>
        </Pressable>
      </View>
    );
  }

  if (kind === 'pdf') {
    if (Platform.OS === 'web' && pdfBlobUrl) {
      return <View style={styles.pdfWrap}>{PreviewPdfWeb({ blobUrl: pdfBlobUrl })}</View>;
    }
    if (pdfFileUri) {
      return (
        <WebView
          source={{ uri: pdfFileUri }}
          style={styles.webviewFill}
          originWhitelist={['*']}
          allowFileAccess
          scalesPageToFit
        />
      );
    }
  }

  if (kind === 'text' && textContent != null) {
    return (
      <ScrollView style={styles.textScroll} contentContainerStyle={styles.textScrollContent}>
        <Text selectable style={styles.monoText}>
          {textContent}
        </Text>
      </ScrollView>
    );
  }

  if (kind === 'sheet' && sheetRows) {
    return (
      <ScrollView horizontal style={styles.sheetOuter} contentContainerStyle={styles.sheetInner}>
        <ScrollView nestedScrollEnabled>
          {sheetRows.map((row, ri) => (
            <View key={`r-${ri}`} style={styles.sheetRow}>
              {row.map((cell, ci) => (
                <View key={`c-${ci}`} style={[styles.sheetCell, ci === 0 && styles.sheetCellFirst]}>
                  <Text style={styles.sheetCellText} numberOfLines={3}>
                    {String(cell ?? '')}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    );
  }

  return (
    <View style={styles.centerFill}>
      <Text style={styles.errorText}>Nothing to show</Text>
    </View>
  );
}

function PreviewDocumentBody({
  mediaUrl,
  fileName,
  onShare,
}: {
  mediaUrl: string;
  fileName: string;
  onShare: () => void;
}) {
  const kind = useMemo(() => docKindFromName(fileName), [fileName]);

  if (kind === 'image') {
    return <PreviewDocumentImage mediaUrl={mediaUrl} fileName={fileName} />;
  }
  if (kind === 'video') {
    return <PreviewVideoAudioBody kind="video" mediaUrl={mediaUrl} />;
  }
  if (kind === 'audio') {
    return <PreviewVideoAudioBody kind="audio" mediaUrl={mediaUrl} />;
  }
  return <PreviewDocumentPdfTextSheetBinary mediaUrl={mediaUrl} fileName={fileName} onShare={onShare} kind={kind} />;
}

export function InboxFullScreenMediaModal({ visible, request, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const title = useMemo(() => {
    if (!request) return '';
    if (request.kind === 'document') return request.fileName;
    if (request.kind === 'image') return 'Photo';
    if (request.kind === 'video') return 'Video';
    return 'Audio';
  }, [request]);

  const onShare = useCallback(async () => {
    if (!request) return;
    try {
      if (Platform.OS === 'web') {
        const blob = await fetchInboxMediaBlob(request.mediaUrl);
        const name =
          request.kind === 'document'
            ? request.fileName
            : request.kind === 'video'
              ? 'video.mp4'
                : request.kind === 'audio'
                ? 'audio.ogg'
                : 'image.jpg';
        if (typeof document === 'undefined') return;
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = name;
        a.rel = 'noopener';
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 60_000);
        return;
      }
      if (request.kind === 'document') {
        const uri = await downloadInboxMediaToCache(request.mediaUrl, request.fileName);
        await Share.share({ url: uri, title: request.fileName });
        return;
      }
      const ext =
        request.kind === 'video'
          ? 'clip.mp4'
          : request.kind === 'audio'
            ? 'voice.ogg'
            : 'photo.jpg';
      const uri = await downloadInboxMediaToCache(request.mediaUrl, ext);
      await Share.share({ url: uri });
    } catch (e) {
      if (typeof globalThis.alert === 'function') {
        globalThis.alert(e instanceof Error ? e.message : 'Share failed');
      }
    }
  }, [request]);

  if (!request) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.toolbar}>
          <Pressable onPress={onClose} style={styles.toolBtn} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={() => void onShare()} style={styles.toolBtn} hitSlop={12}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {request.kind === 'image' ? <PreviewImageBody mediaUrl={request.mediaUrl} /> : null}
          {request.kind === 'video' || request.kind === 'audio' ? (
            <PreviewVideoAudioBody kind={request.kind === 'video' ? 'video' : 'audio'} mediaUrl={request.mediaUrl} />
          ) : null}
          {request.kind === 'document' ? (
            <PreviewDocumentBody
              mediaUrl={request.mediaUrl}
              fileName={request.fileName}
              onShare={() => void onShare()}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  toolBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTitle: {
    flex: 1,
    color: '#f9fafb',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  hintBelowSpinner: {
    color: '#9ca3af',
    fontSize: 13,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 15,
    textAlign: 'center',
  },
  imageZoomShell: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  sharePrimaryBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  sharePrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  videoFill: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  pdfWrap: {
    flex: 1,
    width: '100%',
  },
  webviewFill: {
    flex: 1,
    backgroundColor: '#111',
  },
  textScroll: {
    flex: 1,
    backgroundColor: '#0b0f1a',
  },
  textScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  monoText: {
    color: '#e5e7eb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 17,
  },
  sheetOuter: {
    flex: 1,
    backgroundColor: '#0b0f1a',
  },
  sheetInner: {
    paddingBottom: 32,
  },
  sheetRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  sheetCell: {
    minWidth: 88,
    maxWidth: 200,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(148,163,184,0.25)',
  },
  sheetCellFirst: {
    backgroundColor: 'rgba(30,41,59,0.6)',
  },
  sheetCellText: {
    color: '#e2e8f0',
    fontSize: 11,
  },
  binaryTitle: {
    color: '#f3f4f6',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  binarySub: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
});
