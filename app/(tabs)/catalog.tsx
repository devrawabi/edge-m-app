import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppColorScheme } from '@/context/ThemePreferenceContext';

export default function CatalogScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  const [items] = useState([
    { id: '1', name: 'Industrial Flange Valve v2', price: '$124.99', status: 'Approved', sku: 'FLG-VALVE-002', views: 342 },
    { id: '2', name: 'Copper Conduit Wire 100m', price: '$89.50', status: 'Approved', sku: 'COP-WIRE-100', views: 189 },
    { id: '3', name: 'Heavy Duty Steel Bolt Set', price: '$18.75', status: 'Pending', sku: 'ST-BOLT-M16', views: 45 },
    { id: '4', name: 'Galvanized Coupling 3-Inch', price: '$32.40', status: 'Approved', sku: 'GALV-COUP-3', views: 98 },
  ]);

  function handleAddItem() {
    Alert.alert('Add Product', 'Meta Catalog Sync requires authenticated business manager access. Create draft item in companion web console.');
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b141a' : '#f0f2f5' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#111921' : '#008069' }]}>
        <Pressable onPress={() => router.push('/tools' as any)} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Catalog</Text>
        <Pressable onPress={handleAddItem} style={styles.headerIcon} hitSlop={8}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sync Status Banner */}
        <View style={[styles.banner, { backgroundColor: isDark ? '#1f2c34' : '#ffffff' }]}>
          <View style={styles.bannerRow}>
            <Ionicons name="cloud-done-outline" size={28} color="#00a884" />
            <View style={styles.bannerInfo}>
              <Text style={[styles.bannerTitle, { color: isDark ? '#e9edef' : '#111b21' }]}>Synced with Meta Commerce</Text>
              <Text style={[styles.bannerDesc, { color: isDark ? '#8696a0' : '#667781' }]}>
                Products are active and visible in user messaging menus automatically.
              </Text>
            </View>
          </View>
        </View>

        {/* Catalog Items Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#8696a0' : '#667781' }]}>PRODUCTS ({items.length})</Text>
          <Pressable onPress={() => Alert.alert('Share Catalog', 'Copy link: https://wa.me/c/rawabiedge')}>
            <Text style={styles.shareText}>Share Catalog Link</Text>
          </Pressable>
        </View>

        {/* Grid/List of Products */}
        <View style={styles.itemsWrap}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.itemCard,
                { backgroundColor: isDark ? '#111b21' : '#ffffff', borderColor: isDark ? '#222d34' : '#e9edef' },
                pressed && { backgroundColor: isDark ? '#202c33' : '#f5f6f6' }
              ]}
              onPress={() => Alert.alert(item.name, `SKU: ${item.sku}\nStatus: ${item.status}\nViews: ${item.views}\nPrice: ${item.price}`)}
            >
              {/* Product Thumbnail Mock */}
              <View style={[styles.imageMock, { backgroundColor: isDark ? '#202d36' : '#f0f2f5' }]}>
                <Ionicons name="cube-outline" size={32} color="#00a884" />
              </View>

              <View style={styles.itemInfo}>
                <View style={styles.itemNameRow}>
                  <Text style={[styles.itemName, { color: isDark ? '#e9edef' : '#111b21' }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'Approved' ? 'rgba(0,168,132,0.15)' : 'rgba(244,180,0,0.15)' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'Approved' ? '#00a884' : '#f4b400' }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.itemPrice}>{item.price}</Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.itemSku, { color: isDark ? '#8696a0' : '#667781' }]}>SKU: {item.sku}</Text>
                  <View style={styles.viewsRow}>
                    <Ionicons name="eye-outline" size={14} color={isDark ? '#8696a0' : '#667781'} />
                    <Text style={[styles.viewsText, { color: isDark ? '#8696a0' : '#667781' }]}>{item.views}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Add New Item Button */}
        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.8 }
          ]}
          onPress={handleAddItem}
        >
          <Ionicons name="add-circle-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.addBtnText}>Add new product</Text>
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
  banner: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  shareText: {
    color: '#00a884',
    fontSize: 13,
    fontWeight: '600',
  },
  itemsWrap: {
    gap: 12,
    marginBottom: 24,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  imageMock: {
    width: 60,
    height: 60,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
  },
  itemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemPrice: {
    color: '#00a884',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemSku: {
    fontSize: 12,
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: '#00a884',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
