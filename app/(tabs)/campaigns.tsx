import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppColorScheme } from '@/context/ThemePreferenceContext';

export default function CampaignsScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  const [campaigns] = useState([
    { id: '1', name: 'Q2 Industrial Fittings Promo', status: 'Active', sent: 850, readRate: '98.2%', clicks: 124, budget: '$15.00/day' },
    { id: '2', name: 'Rawabi New Catalog Alert', status: 'Scheduled', sent: 0, readRate: '—', clicks: 0, budget: '$50.00 total' },
    { id: '3', name: 'Ramadan Special Deals', status: 'Completed', sent: 570, readRate: '99.1%', clicks: 121, budget: '$120.00 total' },
  ]);

  function handleCreateCampaign() {
    Alert.alert('Create Campaign', 'Broadcast marketing tools are managed through Meta Ads Manager. Pairing available in Rawabi Web console.');
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b141a' : '#f0f2f5' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#111921' : '#008069' }]}>
        <Pressable onPress={() => router.push('/tools' as any)} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Campaigns</Text>
        <Pressable onPress={handleCreateCampaign} style={styles.headerIcon} hitSlop={8}>
          <Ionicons name="megaphone-outline" size={22} color="#ffffff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quick Analytics Summary */}
        <View style={[styles.analyticsRow, { backgroundColor: isDark ? '#111b21' : '#ffffff', borderColor: isDark ? '#222d34' : '#e9edef' }]}>
          <View style={styles.metricBlock}>
            <Text style={[styles.metricVal, { color: '#00a884' }]}>1,420</Text>
            <Text style={[styles.metricLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Total Messages</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: isDark ? '#222d34' : '#e9edef' }]} />
          <View style={styles.metricBlock}>
            <Text style={[styles.metricVal, { color: '#00a884' }]}>98.6%</Text>
            <Text style={[styles.metricLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Avg Read Rate</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: isDark ? '#222d34' : '#e9edef' }]} />
          <View style={styles.metricBlock}>
            <Text style={[styles.metricVal, { color: '#00a884' }]}>245</Text>
            <Text style={[styles.metricLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Total Clicks</Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#8696a0' : '#667781' }]}>CAMPAIGNS ({campaigns.length})</Text>
        </View>

        {/* List of Campaigns */}
        <View style={styles.listContainer}>
          {campaigns.map((camp) => (
            <Pressable
              key={camp.id}
              style={({ pressed }) => [
                styles.campaignCard,
                { backgroundColor: isDark ? '#111b21' : '#ffffff', borderColor: isDark ? '#222d34' : '#e9edef' },
                pressed && { backgroundColor: isDark ? '#202c33' : '#f5f6f6' }
              ]}
              onPress={() => Alert.alert(camp.name, `Budget: ${camp.budget}\nSent: ${camp.sent}\nRead Rate: ${camp.readRate}\nClicks: ${camp.clicks}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: isDark ? '#e9edef' : '#111b21' }]} numberOfLines={1}>
                  {camp.name}
                </Text>
                <View style={[styles.badge, {
                  backgroundColor:
                    camp.status === 'Active' ? 'rgba(0,168,132,0.15)' :
                    camp.status === 'Scheduled' ? 'rgba(52,183,241,0.15)' : 'rgba(102,119,129,0.15)'
                }]}>
                  <Text style={[styles.badgeText, {
                    color:
                      camp.status === 'Active' ? '#00a884' :
                      camp.status === 'Scheduled' ? '#34b7f1' : isDark ? '#8696a0' : '#667781'
                  }]}>{camp.status}</Text>
                </View>
              </View>

              <Text style={[styles.cardSub, { color: isDark ? '#8696a0' : '#667781' }]}>Budget: {camp.budget}</Text>

              <View style={[styles.divider, { backgroundColor: isDark ? '#222d34' : '#f0f2f5' }]} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: isDark ? '#e9edef' : '#111b21' }]}>{camp.sent}</Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Sent</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: isDark ? '#e9edef' : '#111b21' }]}>{camp.readRate}</Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Read</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: isDark ? '#e9edef' : '#111b21' }]}>{camp.clicks}</Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Clicks</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Create Button */}
        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            pressed && { opacity: 0.8 }
          ]}
          onPress={handleCreateCampaign}
        >
          <Ionicons name="megaphone" size={20} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.createBtnText}>Create campaign</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerIcon: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 24,
    elevation: 1,
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
  },
  metricDivider: {
    width: 1,
    height: 30,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  listContainer: {
    gap: 16,
    marginBottom: 24,
  },
  campaignCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardSub: {
    fontSize: 13,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  createBtn: {
    backgroundColor: '#00a884',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
