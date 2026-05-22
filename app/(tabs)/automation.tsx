import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppColorScheme } from '@/context/ThemePreferenceContext';
import * as SecureStore from 'expo-secure-store';

export default function AutomationScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  const [awayEnabled, setAwayEnabled] = useState(true);
  const [greetingEnabled, setGreetingEnabled] = useState(true);
  const [autoAttendEnabled, setAutoAttendEnabled] = useState(false);

  useEffect(() => {
    const loadAutoAttend = async () => {
      try {
        const val = await SecureStore.getItemAsync('rawabi.auto_attend_calls.v1');
        setAutoAttendEnabled(val === 'true');
      } catch (err) {
        console.warn('Failed to load auto-attend setting:', err);
      }
    };
    loadAutoAttend();
  }, []);

  const handleAutoAttendToggle = async (val: boolean) => {
    setAutoAttendEnabled(val);
    try {
      await SecureStore.setItemAsync('rawabi.auto_attend_calls.v1', val ? 'true' : 'false');
    } catch (err) {
      console.warn('Failed to save auto-attend setting:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b141a' : '#f0f2f5' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#111921' : '#008069' }]}>
        <Pressable onPress={() => router.push('/tools' as any)} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Automation</Text>
        <Pressable onPress={() => Alert.alert('Quick Replies', 'Configure in Web Dashboard for rich rich-media response templates.')} style={styles.headerIcon} hitSlop={8}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Box */}
        <View style={[styles.infoCard, { backgroundColor: isDark ? '#1f2c34' : '#ffffff' }]}>
          <Ionicons name="sparkles-outline" size={24} color="#00a884" />
          <Text style={[styles.infoText, { color: isDark ? '#8696a0' : '#667781' }]}>
            Automate messages to greet, away, and reply instantly to customers, ensuring 24/7 engagement.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: isDark ? '#8696a0' : '#667781' }]}>MESSAGING TOOLS</Text>

        <View style={[styles.listContainer, { backgroundColor: isDark ? '#111b21' : '#ffffff', borderColor: isDark ? '#222d34' : '#e9edef' }]}>
          {/* Greeting message row */}
          <View style={[styles.row, { borderBottomColor: isDark ? '#222d34' : '#f0f2f5' }]}>
            <View style={[styles.iconContainer, { backgroundColor: '#34b7f1' }]}>
              <Ionicons name="hand-left-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: isDark ? '#e9edef' : '#111b21' }]}>Greeting message</Text>
              <Text style={[styles.rowSubtitle, { color: isDark ? '#8696a0' : '#667781' }]}>
                Welcome new customers automatically
              </Text>
            </View>
            <Switch
              value={greetingEnabled}
              onValueChange={setGreetingEnabled}
              trackColor={{ false: '#767577', true: 'rgba(0, 168, 132, 0.5)' }}
              thumbColor={greetingEnabled ? '#00a884' : '#f4f3f4'}
            />
          </View>

          {/* Away message row */}
          <View style={[styles.row, { borderBottomColor: isDark ? '#222d34' : '#f0f2f5' }]}>
            <View style={[styles.iconContainer, { backgroundColor: '#f4b400' }]}>
              <Ionicons name="time-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: isDark ? '#e9edef' : '#111b21' }]}>Away message</Text>
              <Text style={[styles.rowSubtitle, { color: isDark ? '#8696a0' : '#667781' }]}>
                {"Reply automatically when you're away"}
              </Text>
            </View>
            <Switch
              value={awayEnabled}
              onValueChange={setAwayEnabled}
              trackColor={{ false: '#767577', true: 'rgba(0, 168, 132, 0.5)' }}
              thumbColor={awayEnabled ? '#00a884' : '#f4f3f4'}
            />
          </View>

          {/* Auto-attend calls row */}
          <View style={[styles.row, { borderBottomColor: isDark ? '#222d34' : '#f0f2f5' }]}>
            <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6' }]}>
              <Ionicons name="call-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: isDark ? '#e9edef' : '#111b21' }]}>Auto-attend voice calls</Text>
              <Text style={[styles.rowSubtitle, { color: isDark ? '#8696a0' : '#667781' }]}>
                Answer calls automatically & play greeting
              </Text>
            </View>
            <Switch
              value={autoAttendEnabled}
              onValueChange={handleAutoAttendToggle}
              trackColor={{ false: '#767577', true: 'rgba(0, 168, 132, 0.5)' }}
              thumbColor={autoAttendEnabled ? '#00a884' : '#f4f3f4'}
            />
          </View>

          {/* Quick Replies row */}
          <Pressable
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: isDark ? '#222d34' : '#f0f2f5' },
              pressed && { backgroundColor: isDark ? '#202c33' : '#f5f6f6' }
            ]}
            onPress={() => Alert.alert('Quick Replies', 'Currently active: \n• /welcome - Greeting\n• /thanks - Thank you\n• /pricing - Catalog link')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#00a884' }]}>
              <Ionicons name="flash-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: isDark ? '#e9edef' : '#111b21' }]}>Quick replies</Text>
              <Text style={[styles.rowSubtitle, { color: isDark ? '#8696a0' : '#667781' }]}>
                3 shortcuts configured
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#8696a0' : '#aebac1'} />
          </Pressable>

          {/* Automated Chatbots row */}
          <Pressable
            style={({ pressed }) => [
              styles.row,
              { borderBottomWidth: 0 },
              pressed && { backgroundColor: isDark ? '#202c33' : '#f5f6f6' }
            ]}
            onPress={() => Alert.alert('AI Chatbots', '2 Bots Active: \n• Customer Support Agent\n• Sales Qualifier Flow')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ea4335' }]}>
              <Ionicons name="hardware-chip-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: isDark ? '#e9edef' : '#111b21' }]}>AI Conversational flows</Text>
              <Text style={[styles.rowSubtitle, { color: isDark ? '#8696a0' : '#667781' }]}>
                2 interactive bots running
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#8696a0' : '#aebac1'} />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: isDark ? '#8696a0' : '#667781' }]}>BOT STATISTICS (LAST 7 DAYS)</Text>

        <View style={[styles.statsCard, { backgroundColor: isDark ? '#111b21' : '#ffffff', borderColor: isDark ? '#222d34' : '#e9edef' }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#00a884' }]}>92.4%</Text>
            <Text style={[styles.statLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Bot Handled</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#00a884' }]}>2.4m</Text>
            <Text style={[styles.statLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Avg Response</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#00a884' }]}>12</Text>
            <Text style={[styles.statLabel, { color: isDark ? '#8696a0' : '#667781' }]}>Agent Handoffs</Text>
          </View>
        </View>
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 16,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  listContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
  },
  statsCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
  },
});
