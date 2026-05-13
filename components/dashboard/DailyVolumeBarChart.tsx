import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DailyMessageVolume } from '@/types/dashboard';

const INCOMING = '#0ea5e9';
const OUTGOING = '#25D366';

type Props = {
  daily: DailyMessageVolume[];
  chartHeight?: number;
};

function shortDayLabel(isoDay: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!m) return isoDay;
  return `${m[2]}/${m[3]}`;
}

export function DailyVolumeBarChart({ daily, chartHeight = 200 }: Props) {
  const maxVal = useMemo(() => {
    let m = 1;
    for (const d of daily) {
      m = Math.max(m, d.incoming, d.outgoing);
    }
    return m;
  }, [daily]);

  if (!daily.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No daily volume in this period.</Text>
      </View>
    );
  }

  const barAreaH = chartHeight - 36;

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: INCOMING }]} />
          <Text style={styles.legendLabel}>Incoming</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: OUTGOING }]} />
          <Text style={styles.legendLabel}>Outgoing</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {daily.map((d) => {
          const hIn = Math.round((d.incoming / maxVal) * barAreaH);
          const hOut = Math.round((d.outgoing / maxVal) * barAreaH);
          return (
            <View key={d.date} style={styles.col}>
              <View style={[styles.barStack, { height: barAreaH }]}>
                <View style={[styles.barPair, { height: barAreaH }]}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(hIn, d.incoming > 0 ? 4 : 0),
                        backgroundColor: INCOMING,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(hOut, d.outgoing > 0 ? 4 : 0),
                        backgroundColor: OUTGOING,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.dayLabel} numberOfLines={1}>
                {shortDayLabel(d.date)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  empty: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  col: {
    width: 44,
    alignItems: 'center',
  },
  barStack: {
    justifyContent: 'flex-end',
    width: '100%',
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  dayLabel: {
    marginTop: 6,
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
