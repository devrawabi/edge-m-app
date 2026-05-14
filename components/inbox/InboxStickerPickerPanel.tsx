/**
 * Mirrors web `StickerPicker.tsx`: SELECT STICKER header, tag chips (All / …), Create, 4‑column grid,
 * tap to send, long‑press sheet to tag / delete.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import type { InboxUiTheme } from '@/lib/inbox-theme';
import { stickerUrlFromServerPath } from '@/lib/sticker-assets';
import { api } from '@/lib/http';

export type StickerWithMetaRow = { path: string; tags: string[] };

export type InboxStickerPickerPanelProps = {
  active: boolean;
  blocked: boolean;
  workingOuter: boolean;
  theme: Pick<InboxUiTheme, 'composerStripBg' | 'composerStripBorderTop' | 'threadTitle' | 'mediaHint'>;
  /** Same as web: open image picker and run sticker-upload pipeline. */
  onCreateSticker: () => void;
  /** Download library asset → sticker-upload → send (parent handles). */
  onSendLibrarySticker: (relativePath: string) => Promise<void>;
  /** After successful send from grid. */
  onSent?: () => void;
};

export function InboxStickerPickerPanel({
  active,
  blocked,
  workingOuter,
  theme,
  onCreateSticker,
  onSendLibrarySticker,
  onSent,
}: InboxStickerPickerPanelProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [stickers, setStickers] = useState<StickerWithMetaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingSticker, setSendingSticker] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [mgmtSticker, setMgmtSticker] = useState<StickerWithMetaRow | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get('/api/stickers');
      const data = res.data as {
        stickersWithMeta?: StickerWithMetaRow[];
        stickers?: string[];
        metadata?: Record<string, { tags?: string[] }>;
      };
      if (Array.isArray(data?.stickersWithMeta)) {
        setStickers(data.stickersWithMeta);
      } else if (Array.isArray(data?.stickers)) {
        const md = data.metadata ?? {};
        setStickers(
          data.stickers.map((p) => ({
            path: p,
            tags: md[p]?.tags ?? [],
          })),
        );
      } else {
        setStickers([]);
      }
    } catch {
      setStickers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of stickers) {
      for (const t of s.tags) if (t?.trim()) set.add(t.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stickers]);

  const filtered = useMemo(() => {
    if (!selectedTag) return stickers;
    return stickers.filter((s) => s.tags.includes(selectedTag));
  }, [stickers, selectedTag]);

  const sheetMaxInner = Math.min(winW - 32, 512);
  const gap = 12;
  const tile = Math.floor((sheetMaxInner - 32 - gap * 3) / 4);

  const busy = blocked || sendingSticker || workingOuter;

  const handleTapSticker = async (s: StickerWithMetaRow) => {
    if (busy) return;
    setSendingSticker(true);
    try {
      await onSendLibrarySticker(s.path);
      onSent?.();
    } catch {
      /* Parent already alerted */
    } finally {
      setSendingSticker(false);
    }
  };

  const handleCreate = () => {
    if (busy) return;
    onCreateSticker();
  };

  const saveTagsRemote = async (path: string, tags: string[]) => {
    const res = await api().patch('/api/stickers', { path, tags });
    if (res.status >= 400) {
      const err =
        typeof (res.data as { error?: string })?.error === 'string'
          ? (res.data as { error: string }).error
          : `HTTP ${res.status}`;
      throw new Error(err);
    }
  };

  const handleAddTag = async () => {
    if (!mgmtSticker || !tagDraft.trim()) return;
    const nt = tagDraft.trim();
    if (mgmtSticker.tags.includes(nt)) {
      setTagDraft('');
      return;
    }
    try {
      const next = [...mgmtSticker.tags, nt];
      await saveTagsRemote(mgmtSticker.path, next);
      setStickers((prev) => prev.map((x) => (x.path === mgmtSticker.path ? { ...x, tags: next } : x)));
      setMgmtSticker((cur) => (cur ? { ...cur, tags: next } : null));
      setTagDraft('');
    } catch (e) {
      Alert.alert('Tags', e instanceof Error ? e.message : 'Failed to add tag');
    }
  };

  const removeTag = (tag: string) => async () => {
    if (!mgmtSticker) return;
    const next = mgmtSticker.tags.filter((x) => x !== tag);
    try {
      await saveTagsRemote(mgmtSticker.path, next);
      setStickers((prev) => prev.map((x) => (x.path === mgmtSticker.path ? { ...x, tags: next } : x)));
      setMgmtSticker((cur) => (cur ? { ...cur, tags: next } : null));
    } catch {
      Alert.alert('Tags', 'Failed to remove tag');
    }
  };

  const handleDeleteSticker = () => {
    if (!mgmtSticker) return;
    Alert.alert(
      'Delete sticker',
      'Remove this sticker from your library?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api().delete(
                `/api/stickers?path=${encodeURIComponent(mgmtSticker.path)}`,
              );
              if (res.status >= 400) {
                const err =
                  typeof (res.data as { error?: string })?.error === 'string'
                    ? (res.data as { error: string }).error
                    : `HTTP ${res.status}`;
                throw new Error(err);
              }
              setStickers((prev) => prev.filter((x) => x.path !== mgmtSticker.path));
              setMgmtSticker(null);
            } catch (e) {
              Alert.alert('Delete', e instanceof Error ? e.message : 'Failed to delete sticker');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <>
      <View style={[styles.tagRow, { flexWrap: 'wrap' }]}>
        {allTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRowScroll}
          >
            <Pressable
              onPress={() => setSelectedTag(null)}
              style={[
                styles.tagChip,
                !selectedTag ? styles.tagChipOn : styles.tagChipOff,
                !selectedTag ? { backgroundColor: '#111827' } : { backgroundColor: '#f3f4f6' },
              ]}
            >
              <Text style={[!selectedTag ? styles.tagChipTextOn : styles.tagChipTextOff]}>All</Text>
            </Pressable>
            {allTags.map((t) => (
              <Pressable
                key={t}
                onPress={() => setSelectedTag((cur) => (cur === t ? null : t))}
                style={[
                  styles.tagChip,
                  selectedTag === t ? styles.tagChipOn : styles.tagChipOff,
                  selectedTag === t ? { backgroundColor: '#111827' } : { backgroundColor: '#f3f4f6' },
                ]}
              >
                <Text style={[selectedTag === t ? styles.tagChipTextOn : styles.tagChipTextOff]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable
          onPress={handleCreate}
          disabled={busy}
          style={({ pressed }) => [
            styles.createBtn,
            { opacity: pressed ? 0.9 : busy ? 0.45 : 1 },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#15803d" />
          <Text style={styles.createBtnText}>Create</Text>
        </Pressable>
      </View>

      <View style={[styles.stickerGridWrap, { maxHeight: Math.min(winH * 0.52, 420) }]}>
        {loading ? (
          <View style={styles.stickerEmpty}>
            <ActivityIndicator size="large" color={theme.mediaHint} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stickerEmpty}>
            <Ionicons name="happy-outline" size={48} color={theme.mediaHint} style={{ opacity: 0.25 }} />
            <Text style={[styles.stickerEmptyText, { color: theme.mediaHint }]}>
              {selectedTag ? `No stickers with tag "${selectedTag}"` : 'No stickers found'}
            </Text>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.stickerGrid, { gap }]}>
              {filtered.map((s) => (
                <Pressable
                  key={s.path}
                  onPress={() => void handleTapSticker(s)}
                  onLongPress={() => {
                    setMgmtSticker(s);
                    setTagDraft('');
                  }}
                  delayLongPress={500}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.stickerTile,
                    {
                      width: tile,
                      height: tile,
                      borderColor: '#f3f4f6',
                      opacity: busy ? 0.45 : pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: stickerUrlFromServerPath(s.path) }}
                    style={styles.stickerImg}
                    resizeMode="contain"
                  />
                  {s.tags.length > 0 ? (
                    <View style={styles.stickerTagOverlay}>
                      {s.tags.slice(0, 2).map((tg) => (
                        <View key={tg} style={styles.stickerTagPill}>
                          <Text style={styles.stickerTagPillText} numberOfLines={1}>
                            {tg}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal
        visible={mgmtSticker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMgmtSticker(null)}
      >
        <Pressable style={styles.mgmtBackdrop} onPress={() => setMgmtSticker(null)} />
        <View style={[styles.mgmtSheet, { pointerEvents: 'box-none' }]}>
          <View style={[styles.mgmtCard, { borderColor: theme.composerStripBorderTop }]}>
            <Text style={[styles.mgmtTitle, { color: theme.threadTitle }]}>Sticker</Text>
            {mgmtSticker ? (
              <>
                <View style={styles.mgmtRow}>
                  <Image
                    source={{ uri: stickerUrlFromServerPath(mgmtSticker.path) }}
                    style={styles.mgmtThumb}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.mgmtPath, { color: theme.mediaHint }]} numberOfLines={1}>
                      {mgmtSticker.path.split('/').pop()}
                    </Text>
                    {mgmtSticker.tags.length > 0 ? (
                      <View style={styles.mgmtTagList}>
                        {mgmtSticker.tags.map((tg) => (
                          <View key={tg} style={styles.mgmtTagChip}>
                            <Text style={styles.mgmtTagChipText}>{tg}</Text>
                            <Pressable hitSlop={6} onPress={() => void removeTag(tg)()}>
                              <Text style={styles.mgmtTagRemove}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.mgmtAddRow}>
                  <TextInput
                    value={tagDraft}
                    onChangeText={setTagDraft}
                    placeholder="New tag…"
                    placeholderTextColor={theme.mediaHint}
                    style={[
                      styles.mgmtInput,
                      { color: theme.threadTitle, borderColor: theme.composerStripBorderTop },
                    ]}
                    onSubmitEditing={() => void handleAddTag()}
                  />
                  <Pressable
                    style={[styles.mgmtAddBtn, { opacity: tagDraft.trim() ? 1 : 0.45 }]}
                    disabled={!tagDraft.trim()}
                    onPress={() => void handleAddTag()}
                  >
                    <Ionicons name="pricetag-outline" size={18} color="#15803d" />
                  </Pressable>
                </View>
                <Pressable style={styles.mgmtDeleteBtn} onPress={handleDeleteSticker}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text style={styles.mgmtDeleteText}>Delete sticker</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.mgmtCloseFooter} onPress={() => setMgmtSticker(null)}>
              <Text style={[styles.mgmtCloseFooterText, { color: theme.mediaHint }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tagRowScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
    flexGrow: 0,
    maxWidth: Platform.OS === 'web' ? 340 : 220,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagChipOn: {},
  tagChipOff: {},
  tagChipTextOn: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tagChipTextOff: { color: '#4b5563', fontSize: 12, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    marginLeft: 'auto',
  },
  createBtnText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stickerGridWrap: {
    minHeight: 120,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
    paddingBottom: 12,
  },
  stickerTile: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  stickerImg: {
    width: '78%',
    height: '78%',
  },
  stickerTagOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
  },
  stickerTagPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.52)',
    maxWidth: '48%',
  },
  stickerTagPillText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  stickerEmpty: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stickerEmptyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  mgmtBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  mgmtSheet: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mgmtCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  mgmtTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  mgmtRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  mgmtThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#f9fafb' },
  mgmtPath: { fontSize: 12 },
  mgmtTagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  mgmtTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  mgmtTagChipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  mgmtTagRemove: { fontSize: 14, color: '#9ca3af', fontWeight: '700', paddingHorizontal: 2 },
  mgmtAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  mgmtInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  mgmtAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mgmtDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
  },
  mgmtDeleteText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  mgmtCloseFooter: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  mgmtCloseFooterText: { fontSize: 14, fontWeight: '600' },
});
