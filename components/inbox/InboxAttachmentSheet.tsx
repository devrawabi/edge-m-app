/**
 * WhatsApp-style attachment hub + sub-flows aligned with web `AttachmentMenu` / inbox.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { InboxStickerPickerPanel } from '@/components/inbox/InboxStickerPickerPanel';
import type { InboxUiTheme } from '@/lib/inbox-theme';
import { api } from '@/lib/http';

/** Same presets as web `LocationSelector`. */
export const INBOX_PRESET_LOCATIONS = [
  {
    name: 'AL RAWABI GROUP HEAD OFFICE, QATAR',
    address: 'Qatar',
    latitude: 25.417058433146806,
    longitude: 51.35284366774973,
  },
  {
    name: 'Rawabi Hypermarket Izghawa',
    address: 'Izghawa, Qatar',
    latitude: 25.351236999429897,
    longitude: 51.43078031007703,
  },
  {
    name: 'Rawabi Food International - Jary Al Samur',
    address: 'Jary Al Samur, Qatar',
    latitude: 25.421100255778978,
    longitude: 51.352380118936814,
  },
  {
    name: 'Rawabi Hypermarket- Umm salal',
    address: 'Umm Salal, Qatar',
    latitude: 25.412727769952614,
    longitude: 51.410916645559375,
  },
  {
    name: 'Al Rawabi Food Center',
    address: 'Qatar',
    latitude: 25.30295957304598,
    longitude: 51.43820418935805,
  },
  {
    name: 'RAWABI HYPERMARKET- MURRAH',
    address: 'Murrah, Qatar',
    latitude: 25.244127440752045,
    longitude: 51.43047942778029,
  },
  {
    name: 'Rawabi Hyper Market - Al Shafi, Al-Rayyan',
    address: 'Al Shafi, Al-Rayyan, Qatar',
    latitude: 25.293182066155172,
    longitude: 51.421209713886974,
  },
  {
    name: 'Rawabi Hypermarket - Al Wakrah',
    address: 'Al Wakrah, Qatar',
    latitude: 25.18211654739301,
    longitude: 51.603529441673594,
  },
  {
    name: 'Emdadco Foodstuff Trading',
    address: 'Qatar',
    latitude: 25.428142803708948,
    longitude: 51.393331037065835,
  },
].sort((a, b) => a.name.localeCompare(b.name));

type AttachPanel =
  | 'hub'
  | 'stickers'
  | 'quick_reply'
  | 'templates'
  | 'flows'
  | 'poll'
  | 'event'
  | 'location'
  | 'contacts';

type QuickReplyRow = { id: string; title: string; content: string };

type ApiTemplateRow = {
  id: string;
  name: string;
  language?: string | null;
  status?: string | null;
  components?: unknown;
  headerMediaId?: string | null;
};

type FlowRow = { id: string; name: string; status?: string };

type ContactRow = { id: string; name?: string | null; phoneNumber: string };

type HubHubAction =
  | { kind: 'catalog_web' }
  | { kind: 'native'; picker: 'photos' | 'videos' | 'document' }
  | { kind: 'sub'; panel: AttachPanel };

const HUB_ENTRIES: ReadonlyArray<{
  action: HubHubAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}> = [
  { action: { kind: 'catalog_web' }, label: 'Catalog Web', icon: 'storefront-outline', tint: '#047857' },
  { action: { kind: 'sub', panel: 'quick_reply' }, label: 'Quick Reply', icon: 'flash-outline', tint: '#ca8a04' },
  { action: { kind: 'sub', panel: 'templates' }, label: 'Templates', icon: 'calendar-clear-outline', tint: '#2563eb' },
  { action: { kind: 'native', picker: 'photos' }, label: 'Photos', icon: 'images-outline', tint: '#9333ea' },
  { action: { kind: 'native', picker: 'videos' }, label: 'Videos', icon: 'videocam-outline', tint: '#dc2626' },
  { action: { kind: 'native', picker: 'document' }, label: 'Document', icon: 'document-text-outline', tint: '#ea580c' },
  { action: { kind: 'sub', panel: 'location' }, label: 'Location', icon: 'location-outline', tint: '#16a34a' },
  { action: { kind: 'sub', panel: 'contacts' }, label: 'Contacts', icon: 'people-outline', tint: '#4f46e5' },
  { action: { kind: 'sub', panel: 'poll' }, label: 'Poll', icon: 'bar-chart-outline', tint: '#db2777' },
  { action: { kind: 'sub', panel: 'event' }, label: 'Events', icon: 'ticket-outline', tint: '#d97706' },
  { action: { kind: 'sub', panel: 'stickers' }, label: 'Sticker', icon: 'happy-outline', tint: '#16a34a' },
  { action: { kind: 'sub', panel: 'flows' }, label: 'Flow', icon: 'git-network-outline', tint: '#0891b2' },
];

function templateNeedsMediaHeader(tpl: ApiTemplateRow): boolean {
  const comps = Array.isArray(tpl.components) ? tpl.components : [];
  const header = comps.find((c: { type?: string }) => String(c?.type || '').toUpperCase() === 'HEADER');
  const fmt = String((header as { format?: string })?.format || '').toUpperCase();
  return !!header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(fmt);
}

function templateSelectable(tpl: ApiTemplateRow): boolean {
  const st = String(tpl.status || '').toUpperCase();
  if (st && st !== 'APPROVED') return false;
  const comps = tpl.components;
  const arr = Array.isArray(comps) ? comps : [];
  const carousel = arr.some((c: { type?: string }) => String(c?.type || '').toUpperCase() === 'CAROUSEL');
  if (carousel) return false;
  if (templateNeedsMediaHeader(tpl) && !(tpl.headerMediaId && String(tpl.headerMediaId).trim())) {
    return false;
  }
  return true;
}

export type InboxAttachmentSheetProps = {
  visible: boolean;
  onClose: () => void;
  safeBottom: number;
  theme: Pick<InboxUiTheme, 'composerStripBg' | 'composerStripBorderTop' | 'threadTitle' | 'mediaHint'>;
  blocked: boolean;
  selectedChatId: string | null;
  refreshMessages: () => Promise<void>;
  setComposerText: (next: string) => void;
  onPickPhotos: () => void;
  onPickVideos: () => void;
  onPickDocuments: () => void;
  onPickSticker: () => void;
  onSendStickerFromLibrary: (relativePath: string) => Promise<void>;
};

export function InboxAttachmentSheet({
  visible,
  onClose,
  safeBottom,
  theme,
  blocked,
  selectedChatId,
  refreshMessages,
  setComposerText,
  onPickPhotos,
  onPickVideos,
  onPickDocuments,
  onPickSticker,
  onSendStickerFromLibrary,
}: InboxAttachmentSheetProps) {
  const [panel, setPanel] = useState<AttachPanel>('hub');
  const [locSearch, setLocSearch] = useState('');
  const [qrSearch, setQrSearch] = useState('');
  const [contactsSearch, setContactsSearch] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);
  const [templates, setTemplates] = useState<ApiTemplateRow[]>([]);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const [pollQ, setPollQ] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  const [evName, setEvName] = useState('');
  const [evWhen, setEvWhen] = useState('');
  const [evPlace, setEvPlace] = useState('');

  const [flowPick, setFlowPick] = useState<FlowRow | null>(null);
  const [flowHeader, setFlowHeader] = useState('Open form');
  const [flowBody, setFlowBody] = useState('Tap the button below to continue.');
  const [flowCta, setFlowCta] = useState('Open');

  const resetSubState = useCallback(() => {
    setLocSearch('');
    setQrSearch('');
    setContactsSearch('');
    setPanel('hub');
    setPollQ('');
    setPollOpt1('');
    setPollOpt2('');
    setEvName('');
    setEvWhen('');
    setEvPlace('');
    setFlowPick(null);
    setFlowHeader('Open form');
    setFlowBody('Tap the button below to continue.');
    setFlowCta('Open');
  }, []);

  useEffect(() => {
    if (!visible) resetSubState();
  }, [visible, resetSubState]);

  const closeAll = () => {
    resetSubState();
    onClose();
  };

  const ensureChatId = (): string | null => {
    if (!selectedChatId) {
      Alert.alert('Chat', 'Open a conversation first.');
      return null;
    }
    return selectedChatId;
  };

  const postMessage = async (body: Record<string, unknown>): Promise<boolean> => {
    const cid = ensureChatId();
    if (!cid) return false;
    setWorking(true);
    try {
      const res = await api().post('/api/messages', { ...body, contactId: cid });
      if (res.status >= 400) {
        const err =
          typeof (res.data as { error?: string })?.error === 'string'
            ? (res.data as { error: string }).error
            : `HTTP ${res.status}`;
        throw new Error(err);
      }
      await refreshMessages();
      return true;
    } catch (e) {
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Could not send');
      return false;
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    if (panel === 'quick_reply') {
      void (async () => {
        setListLoading(true);
        try {
          const res = await api().get('/api/quick-replies');
          const rows = (res.status === 200 ? res.data : []) as QuickReplyRow[];
          setQuickReplies(Array.isArray(rows) ? rows : []);
        } catch {
          setQuickReplies([]);
        } finally {
          setListLoading(false);
        }
      })();
    } else if (panel === 'templates') {
      void (async () => {
        setListLoading(true);
        try {
          const res = await api().get('/api/templates');
          const rows = (res.status === 200 ? res.data : []) as ApiTemplateRow[];
          setTemplates(Array.isArray(rows) ? rows : []);
        } catch {
          setTemplates([]);
        } finally {
          setListLoading(false);
        }
      })();
    } else if (panel === 'flows') {
      void (async () => {
        setListLoading(true);
        try {
          const res = await api().get('/api/whatsapp/flows');
          const rows = (res.status === 200 ? res.data : []) as FlowRow[];
          setFlows(Array.isArray(rows) ? rows : []);
        } catch {
          setFlows([]);
        } finally {
          setListLoading(false);
        }
      })();
    } else if (panel === 'contacts') {
      void (async () => {
        setListLoading(true);
        try {
          const res = await api().get('/api/contacts');
          const rows = (res.status === 200 ? res.data : []) as ContactRow[];
          setContacts(Array.isArray(rows) ? rows : []);
        } catch {
          setContacts([]);
        } finally {
          setListLoading(false);
        }
      })();
    }
  }, [visible, panel]);

  const filteredLocations = useMemo(() => {
    const q = locSearch.trim().toLowerCase();
    if (!q) return INBOX_PRESET_LOCATIONS;
    return INBOX_PRESET_LOCATIONS.filter(
      (l) => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q),
    );
  }, [locSearch]);

  const filteredQr = useMemo(() => {
    const q = qrSearch.trim().toLowerCase();
    if (!q) return quickReplies;
    return quickReplies.filter(
      (r) => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q),
    );
  }, [quickReplies, qrSearch]);

  const filteredTpl = useMemo(() => templates.filter(templateSelectable), [templates]);

  const filteredContacts = useMemo(() => {
    const others = contacts.filter((c) => c.id !== selectedChatId);
    const q = contactsSearch.trim().toLowerCase();
    if (!q) return others.slice(0, 400);
    return others.filter(
      (c) =>
        String(c.phoneNumber || '')
          .toLowerCase()
          .includes(q) || String(c.name || '').toLowerCase().includes(q),
    );
  }, [contacts, contactsSearch, selectedChatId]);

  const handleHubTap = (row: (typeof HUB_ENTRIES)[number]) => {
    if (blocked || working) return;
    const cid = ensureChatId();
    if (!cid) return;

    if (row.action.kind === 'catalog_web') {
      void (async () => {
        setWorking(true);
        let shopUrl = '';
        try {
          const res = await api().post('/api/shop-order-one-time-links', { contactId: cid });
          const data = res.data as { url?: string; error?: string };
          if (res.status >= 400) throw new Error(data.error || `HTTP ${res.status}`);
          shopUrl = typeof data.url === 'string' ? data.url.trim() : '';
          if (!/^https?:\/\//i.test(shopUrl)) throw new Error('Invalid shop link from server.');
        } catch (e) {
          Alert.alert('Catalog Web', e instanceof Error ? e.message : 'Could not create shop link.');
          setWorking(false);
          return;
        }
        setWorking(false);
        const ok = await postMessage({
          content: {
            bodyText: 'Place your order now.',
            url: shopUrl,
            buttonText: 'Shop now',
          },
          type: 'cta_url',
        });
        if (ok) closeAll();
      })();
      return;
    }

    if (row.action.kind === 'native') {
      closeAll();
      if (row.action.picker === 'photos') onPickPhotos();
      else if (row.action.picker === 'videos') onPickVideos();
      else if (row.action.picker === 'document') onPickDocuments();
      return;
    }

    setPanel(row.action.panel);
  };

  const hubGrid = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.gridPad}
      style={{ maxHeight: Platform.OS === 'web' ? 420 : undefined }}
    >
      <Text style={[styles.sheetKicker, { color: theme.mediaHint }]}>Select attachment</Text>
      <View style={styles.grid}>
        {HUB_ENTRIES.map((row) => (
          <Pressable
            key={row.label}
            disabled={blocked || working}
            onPress={() => handleHubTap(row)}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: theme.composerStripBorderTop, backgroundColor: theme.composerStripBg },
              pressed && { opacity: 0.85 },
              (blocked || working) && { opacity: 0.45 },
            ]}
          >
            <View style={[styles.tileIconWrap, { backgroundColor: `${row.tint}22` }]}>
              <Ionicons name={row.icon} size={22} color={row.tint} />
            </View>
            <Text style={[styles.tileLabel, { color: theme.mediaHint }]} numberOfLines={2}>
              {row.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const subHeader = (title: string, onBack: () => void) => (
    <View style={styles.subHeaderRow}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={theme.threadTitle} />
      </Pressable>
      <Text style={[styles.subHeaderTitle, { color: theme.threadTitle }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 28 }} />
    </View>
  );

  const sheetBody = () => {
    if (panel === 'hub') return hubGrid;

    if (panel === 'stickers') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Select sticker', () => setPanel('hub'))}
          <InboxStickerPickerPanel
            active={visible && panel === 'stickers'}
            blocked={blocked}
            workingOuter={working}
            theme={theme}
            onCreateSticker={onPickSticker}
            onSendLibrarySticker={onSendStickerFromLibrary}
            onSent={() => closeAll()}
          />
        </View>
      );
    }

    if (panel === 'quick_reply') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Quick replies', () => setPanel('hub'))}
          <TextInput
            value={qrSearch}
            onChangeText={setQrSearch}
            placeholder="Search…"
            placeholderTextColor={theme.mediaHint}
            style={[
              styles.searchField,
              { color: theme.threadTitle, borderColor: theme.composerStripBorderTop, backgroundColor: theme.composerStripBg },
            ]}
          />
          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.mediaHint} />
          ) : (
            <FlatList
              data={filteredQr}
              keyExtractor={(x) => x.id}
              style={{ maxHeight: 360 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    setComposerText(item.content);
                    closeAll();
                  }}
                >
                  <Text style={[styles.listRowTitle, { color: theme.threadTitle }]}>{item.title}</Text>
                  <Text style={[styles.listRowSub, { color: theme.mediaHint }]} numberOfLines={2}>
                    {item.content}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyHint, { color: theme.mediaHint }]}>No quick replies found.</Text>
              }
            />
          )}
        </View>
      );
    }

    if (panel === 'templates') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Templates', () => setPanel('hub'))}
          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.mediaHint} />
          ) : (
            <FlatList
              data={filteredTpl}
              keyExtractor={(x) => `${x.name}-${x.language || ''}-${x.id}`}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  disabled={working}
                  style={({ pressed }) => [styles.listRow, pressed && !working && { opacity: 0.85 }]}
                  onPress={async () => {
                    const ok = await postMessage({
                      type: 'template',
                      templateName: item.name,
                      templateLanguage: item.language || 'en_US',
                      content: item.name,
                    });
                    if (ok) closeAll();
                  }}
                >
                  <Text style={[styles.listRowTitle, { color: theme.threadTitle }]}>{item.name}</Text>
                  <Text style={[styles.listRowSub, { color: theme.mediaHint }]}>
                    {item.language || '—'} · {item.status || '—'}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyHint, { color: theme.mediaHint }]}>
                  No approved templates available (carousel / missing header media are hidden).
                </Text>
              }
            />
          )}
        </View>
      );
    }

    if (panel === 'flows') {
      return (
        <View style={styles.subWrap}>
          {subHeader(flowPick ? flowPick.name : 'Flows', () => (flowPick ? setFlowPick(null) : setPanel('hub')))}
          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.mediaHint} />
          ) : !flowPick ? (
            <FlatList
              data={flows.filter((f) => String(f.status || '').toUpperCase() !== 'DEPRECATED')}
              keyExtractor={(x) => x.id}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={[styles.flowRow, { borderColor: theme.composerStripBorderTop }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.listRowTitle, { color: theme.threadTitle }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.listRowSub, { color: theme.mediaHint }]}>{item.status || 'PUBLISHED'}</Text>
                  </View>
                  <Pressable
                    disabled={working}
                    style={[styles.miniBtn, { backgroundColor: '#0d9488' }]}
                    onPress={async () => {
                      const ok = await postMessage({
                        type: 'flow',
                        flowId: item.id,
                        flowName: item.name,
                        flowHeader: 'Open form',
                        flowBody: 'Tap the button below to continue.',
                        flowCta: 'Open',
                        content: `Flow: ${item.name}`,
                      });
                      if (ok) closeAll();
                    }}
                  >
                    <Text style={styles.miniBtnText}>Send</Text>
                  </Pressable>
                  <Pressable
                    disabled={working}
                    style={[styles.miniBtn, { backgroundColor: '#e5e7eb' }]}
                    onPress={() => setFlowPick(item)}
                  >
                    <Text style={[styles.miniBtnText, { color: '#111827' }]}>Edit</Text>
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyHint, { color: theme.mediaHint }]}>No flows found.</Text>
              }
            />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
              <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Header</Text>
              <TextInput
                value={flowHeader}
                onChangeText={setFlowHeader}
                style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
              />
              <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Body</Text>
              <TextInput
                value={flowBody}
                onChangeText={setFlowBody}
                style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
              />
              <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Button</Text>
              <TextInput
                value={flowCta}
                onChangeText={setFlowCta}
                style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
              />
              <Pressable
                disabled={working}
                style={[styles.primaryBtn, { backgroundColor: '#0d9488', opacity: working ? 0.6 : 1 }]}
                onPress={async () => {
                  const ok = await postMessage({
                    type: 'flow',
                    flowId: flowPick.id,
                    flowName: flowPick.name,
                    flowHeader,
                    flowBody,
                    flowCta,
                    content: `Flow: ${flowPick.name}`,
                  });
                  if (ok) closeAll();
                }}
              >
                <Text style={styles.primaryBtnText}>Send flow</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      );
    }

    if (panel === 'poll') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Poll', () => setPanel('hub'))}
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Question</Text>
            <TextInput
              value={pollQ}
              onChangeText={setPollQ}
              style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
            />
            <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Option A</Text>
            <TextInput
              value={pollOpt1}
              onChangeText={setPollOpt1}
              style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
            />
            <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Option B</Text>
            <TextInput
              value={pollOpt2}
              onChangeText={setPollOpt2}
              style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
            />
            <Pressable
              disabled={working || !pollQ.trim() || !pollOpt1.trim() || !pollOpt2.trim()}
              style={[
                styles.primaryBtn,
                { backgroundColor: '#db2777', opacity: working || !pollQ.trim() ? 0.5 : 1 },
              ]}
              onPress={async () => {
                const ok = await postMessage({
                  type: 'poll',
                  location: { question: pollQ.trim(), options: [pollOpt1.trim(), pollOpt2.trim()] },
                });
                if (ok) closeAll();
              }}
            >
              <Text style={styles.primaryBtnText}>Send poll</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }

    if (panel === 'event') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Event', () => setPanel('hub'))}
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Name</Text>
            <TextInput
              value={evName}
              onChangeText={setEvName}
              style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
            />
            <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>When (ISO or any parseable datetime)</Text>
            <TextInput
              value={evWhen}
              onChangeText={setEvWhen}
              placeholder="2026-06-01T18:00:00"
              placeholderTextColor={theme.mediaHint}
              style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
            />
            <Text style={[styles.fieldLabel, { color: theme.mediaHint }]}>Venue / note (optional)</Text>
            <TextInput
              value={evPlace}
              onChangeText={setEvPlace}
              style={[styles.formInput, { color: theme.threadTitle, borderColor: theme.composerStripBorderTop }]}
            />
            <Pressable
              disabled={working || !evName.trim() || !evWhen.trim()}
              style={[
                styles.primaryBtn,
                { backgroundColor: '#d97706', opacity: working || !evName.trim() ? 0.5 : 1 },
              ]}
              onPress={async () => {
                const d = Date.parse(evWhen.trim());
                if (Number.isNaN(d)) {
                  Alert.alert('Events', 'Please enter a valid date/time.');
                  return;
                }
                const ok = await postMessage({
                  type: 'event',
                  location: { name: evName.trim(), date: evWhen.trim(), location: evPlace.trim() },
                });
                if (ok) closeAll();
              }}
            >
              <Text style={styles.primaryBtnText}>Send event</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }

    if (panel === 'location') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Location', () => setPanel('hub'))}
          <TextInput
            value={locSearch}
            onChangeText={setLocSearch}
            placeholder="Search locations…"
            placeholderTextColor={theme.mediaHint}
            style={[
              styles.searchField,
              { color: theme.threadTitle, borderColor: theme.composerStripBorderTop, backgroundColor: theme.composerStripBg },
            ]}
          />
          <FlatList
            data={filteredLocations}
            keyExtractor={(x) => x.name}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}
                onPress={async () => {
                  const ok = await postMessage({
                    type: 'location',
                    location: {
                      latitude: item.latitude,
                      longitude: item.longitude,
                      name: item.name,
                      address: item.address,
                    },
                  });
                  if (ok) closeAll();
                }}
              >
                <Text style={[styles.listRowTitle, { color: theme.threadTitle }]}>{item.name}</Text>
                <Text style={[styles.listRowSub, { color: theme.mediaHint }]}>{item.address}</Text>
              </Pressable>
            )}
          />
        </View>
      );
    }

    if (panel === 'contacts') {
      return (
        <View style={styles.subWrap}>
          {subHeader('Share contact', () => setPanel('hub'))}
          <TextInput
            value={contactsSearch}
            onChangeText={setContactsSearch}
            placeholder="Search name or phone…"
            placeholderTextColor={theme.mediaHint}
            style={[
              styles.searchField,
              { color: theme.threadTitle, borderColor: theme.composerStripBorderTop, backgroundColor: theme.composerStripBg },
            ]}
          />
          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.mediaHint} />
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(x) => x.id}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}
                  onPress={async () => {
                    const label = item.name?.trim() || item.phoneNumber || 'Contact';
                    const ok = await postMessage({
                      type: 'contacts',
                      content: label,
                      contacts: [
                        {
                          name: { formatted_name: label, first_name: label },
                          phones: [{ phone: item.phoneNumber, type: 'CELL' }],
                        },
                      ],
                    });
                    if (ok) closeAll();
                  }}
                >
                  <Text style={[styles.listRowTitle, { color: theme.threadTitle }]}>{item.name || 'Unknown'}</Text>
                  <Text style={[styles.listRowSub, { color: theme.mediaHint }]}>{item.phoneNumber}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyHint, { color: theme.mediaHint }]}>No other contacts loaded.</Text>
              }
            />
          )}
        </View>
      );
    }

    return null;
  };

  const showSpinner = working;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !working && closeAll()}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={[styles.overlay, { justifyContent: 'flex-end' }]}>
        <Pressable style={styles.backdrop} onPress={() => !working && closeAll()} accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.composerStripBg,
              borderTopColor: theme.composerStripBorderTop,
              paddingBottom: Math.max(safeBottom, 12),
            },
          ]}
        >
          <View style={styles.sheetTopRow}>
            {panel === 'hub' ? (
              <Text style={[styles.sheetTitle, { color: theme.threadTitle }]}>Select attachment</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable
              onPress={() => !working && closeAll()}
              hitSlop={10}
              style={styles.sheetCloseWrap}
              disabled={working}
            >
              <Ionicons name="close" size={22} color={theme.mediaHint} />
            </Pressable>
          </View>
          {showSpinner ? (
            <View style={styles.spinnerOverlay}>
              <ActivityIndicator color={theme.mediaHint} size="large" />
            </View>
          ) : null}
          {sheetBody()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 10,
    ...Platform.select({
      android: {
        elevation: 18,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      default: {},
    }),
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sheetCloseWrap: { padding: 6 },
  sheetKicker: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  gridPad: { paddingBottom: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  tile: {
    width: '31%',
    minWidth: 104,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  tileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  subWrap: { flexGrow: 0 },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  subHeaderTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  searchField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginBottom: 10,
    fontSize: 14,
  },
  listRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  listRowTitle: { fontSize: 14, fontWeight: '700' },
  listRowSub: { fontSize: 12, marginTop: 2 },
  emptyHint: { textAlign: 'center', marginTop: 20, paddingHorizontal: 12, fontSize: 13 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, marginTop: 8, textTransform: 'uppercase' },
  formInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  miniBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  spinnerOverlay: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
