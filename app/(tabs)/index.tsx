import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DailyVolumeBarChart } from '@/components/dashboard/DailyVolumeBarChart';
import { useColorScheme } from '@/components/useColorScheme';
import { useSessionContext } from '@/context/SessionContext';
import { api } from '@/lib/http';
import type { EcommerceReportSummary, MessagesReportResponse, OverviewStatsResponse } from '@/types/dashboard';

type TabKey = 'overview' | 'messages' | 'ecommerce';

function defaultReportRange(): { from: string; to: string } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatRangeHeader(fromIso: string, toIso: string): string {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${a.toLocaleDateString(undefined, o)} — ${b.toLocaleDateString(undefined, o)}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type DashboardPalette = {
  shell: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  sub: string;
  tabRail: string;
  tabRailBorder: string;
  tabActiveBg: string;
  tabActiveBorder: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  scopeBg: string;
  scopeText: string;
  statLabel: string;
  panelHint: string;
  activity: string;
};

function buildPalette(dark: boolean): DashboardPalette {
  if (dark) {
    return {
      shell: '#0f172a',
      card: '#1e293b',
      border: '#334155',
      text: '#f8fafc',
      muted: '#94a3b8',
      sub: '#94a3b8',
      tabRail: '#1e293b',
      tabRailBorder: '#334155',
      tabActiveBg: '#334155',
      tabActiveBorder: '#475569',
      errorBg: '#450a0a',
      errorBorder: '#991b1b',
      errorText: '#fecaca',
      scopeBg: '#1e293b',
      scopeText: '#cbd5e1',
      statLabel: '#94a3b8',
      panelHint: '#94a3b8',
      activity: '#f8fafc',
    };
  }
  return {
    shell: '#FAFAFA',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#0f172a',
    muted: '#64748b',
    sub: '#475569',
    tabRail: '#f1f5f9',
    tabRailBorder: '#e2e8f0',
    tabActiveBg: '#ffffff',
    tabActiveBorder: '#f1f5f9',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',
    errorText: '#b91c1c',
    scopeBg: '#f8fafc',
    scopeText: '#475569',
    statLabel: '#94a3b8',
    panelHint: '#64748b',
    activity: '#0f172a',
  };
}

export default function DashboardMetricsScreen() {
  const colorScheme = useColorScheme();
  const p = useMemo(() => buildPalette(colorScheme === 'dark'), [colorScheme]);
  const session = useSessionContext();
  const displayName =
    session.status === 'loggedIn'
      ? (session.me.name ?? session.me.email ?? 'Operator')
      : 'Dashboard';

  const [period] = useState(defaultReportRange);
  const [tab, setTab] = useState<TabKey>('overview');

  const [overview, setOverview] = useState<OverviewStatsResponse | null>(null);
  const [messages, setMessages] = useState<MessagesReportResponse | null>(null);
  const [ecommerce, setEcommerce] = useState<EcommerceReportSummary | null>(null);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingEcommerce, setLoadingEcommerce] = useState(false);

  const [errorOverview, setErrorOverview] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string | null>(null);
  const [errorEcommerce, setErrorEcommerce] = useState<string | null>(null);

  const periodParams = useMemo(
    () => ({ params: { from: period.from, to: period.to } }),
    [period.from, period.to],
  );

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setErrorOverview(null);
    try {
      const res = await api().get('/api/dashboard/overview-stats', periodParams);
      if (res.status !== 200) {
        throw new Error(
          typeof res.data === 'object' && res.data && 'error' in res.data && typeof res.data.error === 'string'
            ? res.data.error
            : `HTTP ${res.status}`,
        );
      }
      setOverview(res.data as OverviewStatsResponse);
    } catch (err) {
      setErrorOverview(err instanceof Error ? err.message : 'Unable to load overview');
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [periodParams]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    setErrorMessages(null);
    try {
      const res = await api().get('/api/dashboard/messages-report', periodParams);
      if (res.status !== 200) {
        throw new Error(
          typeof res.data === 'object' && res.data && 'error' in res.data && typeof res.data.error === 'string'
            ? res.data.error
            : `HTTP ${res.status}`,
        );
      }
      setMessages(res.data as MessagesReportResponse);
    } catch (err) {
      setErrorMessages(err instanceof Error ? err.message : 'Unable to load messages report');
      setMessages(null);
    } finally {
      setLoadingMessages(false);
    }
  }, [periodParams]);

  const loadEcommerce = useCallback(async () => {
    setLoadingEcommerce(true);
    setErrorEcommerce(null);
    try {
      const res = await api().get('/api/dashboard/ecommerce-report', {
        params: { from: period.from, to: period.to, inactiveMonths: 1 },
      });
      if (res.status !== 200) {
        throw new Error(
          typeof res.data === 'object' && res.data && 'error' in res.data && typeof res.data.error === 'string'
            ? res.data.error
            : `HTTP ${res.status}`,
        );
      }
      setEcommerce(res.data as EcommerceReportSummary);
    } catch (err) {
      setErrorEcommerce(err instanceof Error ? err.message : 'Unable to load ecommerce report');
      setEcommerce(null);
    } finally {
      setLoadingEcommerce(false);
    }
  }, [period.from, period.to]);

  useEffect(() => {
    if (session.status === 'loggedIn') {
      void loadOverview();
    }
  }, [loadOverview, session.status]);

  useEffect(() => {
    if (tab !== 'messages') setErrorMessages(null);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'ecommerce') setErrorEcommerce(null);
  }, [tab]);

  useEffect(() => {
    if (session.status !== 'loggedIn') return;
    if (tab === 'messages' && !messages && !loadingMessages && !errorMessages) void loadMessages();
  }, [tab, session.status, messages, loadingMessages, errorMessages, loadMessages]);

  useEffect(() => {
    if (session.status !== 'loggedIn') return;
    if (tab === 'ecommerce' && !ecommerce && !loadingEcommerce && !errorEcommerce) void loadEcommerce();
  }, [tab, session.status, ecommerce, loadingEcommerce, errorEcommerce, loadEcommerce]);

  const refreshing = loadingOverview || (tab === 'messages' && loadingMessages) || (tab === 'ecommerce' && loadingEcommerce);

  const onRefresh = useCallback(async () => {
    await loadOverview();
    if (tab === 'messages') await loadMessages();
    if (tab === 'ecommerce') await loadEcommerce();
  }, [loadOverview, loadMessages, loadEcommerce, tab]);

  if (session.status !== 'loggedIn') {
    return null;
  }

  const rangeLabel = overview
    ? formatRangeHeader(overview.period.from, overview.period.to)
    : formatRangeHeader(period.from, period.to);

  const overviewStats = overview
    ? [
        {
          name: 'Total Messages',
          value: overview.totalMessages.toLocaleString(),
          change: '+0%',
          accent: '#3b82f6',
          icon: 'chatbubbles-outline' as const,
        },
        {
          name: 'Active Contacts',
          value: overview.activeContacts.toLocaleString(),
          change: '+0%',
          accent: '#22c55e',
          icon: 'people-outline' as const,
        },
        {
          name: 'Connected Channels',
          value: String(overview.connectedChannels),
          change: 'Live',
          accent: '#a855f7',
          icon: 'flash-outline' as const,
        },
        {
          name: 'Read Messages',
          value: overview.readMessages.toLocaleString(),
          change: `${overview.readPct}%`,
          accent: '#06b6d4',
          icon: 'checkmark-done-outline' as const,
        },
        {
          name: 'Delivered Messages',
          value: overview.deliveredMessages.toLocaleString(),
          change: 'Out',
          accent: '#6366f1',
          icon: 'checkmark-outline' as const,
        },
        {
          name: 'Hot Leads',
          value: overview.hotLeads.toLocaleString(),
          change: 'High Priority',
          accent: '#f97316',
          icon: 'flame-outline' as const,
        },
        {
          name: 'Follow Ups',
          value: overview.followUps.toLocaleString(),
          change: 'Pending',
          accent: '#eab308',
          icon: 'time-outline' as const,
        },
        {
          name: 'Closed Deals',
          value: overview.closedDeals.toLocaleString(),
          change: 'Won/Lost',
          accent: '#64748b',
          icon: 'person-outline' as const,
        },
      ]
    : [];

  return (
    <ScrollView
      style={[styles.shell, { backgroundColor: p.shell }]}
      contentContainerStyle={styles.shellContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={[styles.heroTitle, { color: p.text }]}>Enterprise Overview</Text>
      <Text style={[styles.breadcrumb, { color: p.muted }]}>Dashboard / {displayName}</Text>
      <Text style={[styles.range, { color: p.sub }]}>{rangeLabel}</Text>

      <View style={[styles.tabRail, { backgroundColor: p.tabRail, borderColor: p.tabRailBorder }]}>
        <TabButton
          p={p}
          active={tab === 'overview'}
          label="Overview"
          icon="grid-outline"
          onPress={() => setTab('overview')}
        />
        <TabButton
          p={p}
          active={tab === 'messages'}
          label="Messages"
          icon="chatbubbles-outline"
          onPress={() => setTab('messages')}
        />
        <TabButton
          p={p}
          active={tab === 'ecommerce'}
          label="Ecommerce"
          icon="bag-outline"
          onPress={() => setTab('ecommerce')}
        />
      </View>

      {tab === 'overview' ? (
        <>
          {loadingOverview && !overview ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.activity} />
            </View>
          ) : null}
          {errorOverview ? (
            <Text style={[styles.error, { backgroundColor: p.errorBg, borderColor: p.errorBorder, color: p.errorText }]}>
              {errorOverview}
            </Text>
          ) : null}
          {overview?.scopeNote ? (
            <View style={[styles.scopeNote, { backgroundColor: p.scopeBg, borderColor: p.border }]}>
              <Text style={[styles.scopeNoteText, { color: p.scopeText }]}>{overview.scopeNote}</Text>
            </View>
          ) : null}
          {overview ? (
            <View style={styles.statGrid}>
              {overviewStats.map((s) => (
                <View key={s.name} style={[styles.statCard, { backgroundColor: p.card, borderColor: p.border }]}>
                  <View style={styles.statTop}>
                    <View style={[styles.statIcon, { backgroundColor: s.accent }]}>
                      <Ionicons name={s.icon} size={18} color="#fff" />
                    </View>
                    <View style={styles.changePill}>
                      <Text style={styles.changePillText}>{s.change}</Text>
                    </View>
                  </View>
                  <Text style={[styles.statName, { color: p.statLabel }]}>{s.name.toUpperCase()}</Text>
                  <Text style={[styles.statValue, { color: p.text }]}>{s.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {tab === 'messages' ? (
        <>
          {loadingMessages && !messages ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.activity} />
            </View>
          ) : null}
          {errorMessages ? (
            <Text style={[styles.error, { backgroundColor: p.errorBg, borderColor: p.errorBorder, color: p.errorText }]}>
              {errorMessages}
            </Text>
          ) : null}
          {messages ? (
            <>
              <Text style={[styles.panelHint, { color: p.panelHint }]}>
                Message counts follow the same role and branch rules as the web overview (agents see their traffic and related threads).
              </Text>
              <View style={styles.statGrid}>
                <MessageStatCard
                  p={p}
                  label="Total messages"
                  value={messages.summary.totalMessages}
                  accent="#3b82f6"
                />
                <MessageStatCard
                  p={p}
                  label="Outgoing"
                  value={messages.summary.outgoingMessages}
                  accent="#10b981"
                />
                <MessageStatCard
                  p={p}
                  label="Incoming"
                  value={messages.summary.incomingMessages}
                  accent="#0ea5e9"
                />
                <MessageStatCard
                  p={p}
                  label="Read (outgoing)"
                  value={messages.summary.readMessages}
                  sub={`${messages.summary.readPct}% of scoped total`}
                  accent="#8b5cf6"
                />
                <MessageStatCard
                  p={p}
                  label="Delivered (outgoing)"
                  value={messages.summary.deliveredMessages}
                  sub={`${messages.summary.deliveredPct}% of outgoing`}
                  accent="#4f46e5"
                />
              </View>

              <View style={[styles.chartCard, { backgroundColor: p.card, borderColor: p.border }]}>
                <Text style={[styles.chartTitle, { color: p.text }]}>Daily volume</Text>
                <DailyVolumeBarChart daily={messages.dailyData ?? []} chartHeight={200} />
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'ecommerce' ? (
        <>
          {loadingEcommerce && !ecommerce ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.activity} />
            </View>
          ) : null}
          {errorEcommerce ? (
            <Text style={[styles.error, { backgroundColor: p.errorBg, borderColor: p.errorBorder, color: p.errorText }]}>
              {errorEcommerce}
            </Text>
          ) : null}
          {ecommerce ? (
            <>
              <View style={styles.statGrid}>
                <MessageStatCard p={p} label="Total orders" value={ecommerce.stats.totalOrders} accent="#3b82f6" />
                <MessageStatCard p={p} label="Delivered orders" value={ecommerce.stats.deliveredOrders} accent="#22c55e" />
                <MessageStatCard p={p} label="Cancelled" value={ecommerce.stats.cancelledOrders} accent="#ef4444" />
                <MessageStatCard
                  p={p}
                  label="Total sales"
                  value={formatMoney(ecommerce.stats.totalSales)}
                  accent="#0ea5e9"
                  raw
                />
                <MessageStatCard
                  p={p}
                  label="Delivered sales"
                  value={formatMoney(ecommerce.stats.deliveredSales)}
                  accent="#10b981"
                  raw
                />
                <MessageStatCard p={p} label="New customers" value={ecommerce.stats.newCustomers} accent="#a855f7" />
                <MessageStatCard p={p} label="Repeat customers" value={ecommerce.stats.repeatCustomers} accent="#6366f1" />
              </View>
              {ecommerce.fulfillmentTiming &&
              (ecommerce.fulfillmentTiming.avgTotalFulfillmentMin != null ||
                ecommerce.fulfillmentTiming.avgPrepMin != null) ? (
                <View style={[styles.chartCard, { backgroundColor: p.card, borderColor: p.border }]}>
                  <Text style={[styles.chartTitle, { color: p.text }]}>Fulfillment timing (avg. minutes)</Text>
                  <Text style={[styles.timingLine, { color: p.sub }]}>
                    Total:{' '}
                    {ecommerce.fulfillmentTiming.avgTotalFulfillmentMin != null
                      ? `${Math.round(ecommerce.fulfillmentTiming.avgTotalFulfillmentMin)}m`
                      : '—'}
                  </Text>
                  <Text style={[styles.timingLine, { color: p.sub }]}>
                    Prep:{' '}
                    {ecommerce.fulfillmentTiming.avgPrepMin != null
                      ? `${Math.round(ecommerce.fulfillmentTiming.avgPrepMin)}m`
                      : '—'}{' '}
                    · Route:{' '}
                    {ecommerce.fulfillmentTiming.avgRouteMin != null
                      ? `${Math.round(ecommerce.fulfillmentTiming.avgRouteMin)}m`
                      : '—'}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.panelHint, { color: p.panelHint }]}>
                Order tables and exports match the web dashboard; use a desktop browser for full drill-down.
              </Text>
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function TabButton({
  p,
  active,
  label,
  icon,
  onPress,
}: {
  p: DashboardPalette;
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtn,
        active
          ? [styles.tabBtnActive, { backgroundColor: p.tabActiveBg, borderColor: p.tabActiveBorder }]
          : styles.tabBtnIdle,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? p.text : p.muted} />
      <Text style={[styles.tabBtnText, active && { color: p.text }]}>{label}</Text>
    </Pressable>
  );
}

function MessageStatCard({
  p,
  label,
  value,
  sub,
  accent,
  raw,
}: {
  p: DashboardPalette;
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
  raw?: boolean;
}) {
  const shown = raw || typeof value !== 'number' ? String(value) : value.toLocaleString();
  return (
    <View style={[styles.msgCard, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={[styles.msgIcon, { backgroundColor: accent }]}>
        <Ionicons name="stats-chart" size={16} color="#fff" />
      </View>
      <Text style={[styles.msgLabel, { color: p.statLabel }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.msgValue, { color: p.text }]}>{shown}</Text>
      {sub ? <Text style={[styles.msgSub, { color: p.muted }]}>{sub}</Text> : null}
    </View>
  );
}

const bg = '#FAFAFA';
const card = '#ffffff';
const border = '#e5e7eb';
const slate900 = '#0f172a';
const slate500 = '#64748b';
const slate400 = '#94a3b8';

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: bg,
  },
  shellContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 14,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: slate900,
    letterSpacing: -0.5,
  },
  breadcrumb: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: slate500,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  range: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  tabRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 6,
    marginTop: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnIdle: {
    backgroundColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: slate500,
  },
  center: {
    paddingVertical: 20,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    backgroundColor: '#fef2f2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
  },
  scopeNote: {
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  scopeNoteText: {
    fontSize: 13,
    color: '#475569',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statName: {
    fontSize: 10,
    fontWeight: '600',
    color: slate400,
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '600',
    color: slate900,
  },
  panelHint: {
    fontSize: 13,
    color: slate500,
    lineHeight: 18,
  },
  msgCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: border,
    padding: 14,
  },
  msgIcon: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  msgLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: slate400,
    letterSpacing: 0.8,
  },
  msgValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '600',
    color: slate900,
  },
  msgSub: {
    marginTop: 4,
    fontSize: 12,
    color: slate500,
  },
  chartCard: {
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: border,
    padding: 16,
    gap: 8,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: slate900,
  },
  timingLine: {
    fontSize: 13,
    color: '#475569',
  },
});
