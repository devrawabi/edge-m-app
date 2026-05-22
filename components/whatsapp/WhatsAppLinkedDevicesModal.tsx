import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';

type WhatsAppLinkedDevicesModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function WhatsAppLinkedDevicesModal({ visible, onClose }: WhatsAppLinkedDevicesModalProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  const [isScanning, setIsScanning] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Theming colors
  const bg = isDark ? '#0b141a' : '#f0f2f5';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';
  const cardBg = isDark ? '#111b21' : '#ffffff';
  const divider = isDark ? '#222d34' : '#e9edef';
  const brandGreen = '#00a884';

  useEffect(() => {
    if (isScanning) {
      scanLineAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [isScanning, scanLineAnim]);

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240], // Height of scanning window
  });

  const handleLinkDevice = () => {
    setIsScanning(true);
  };

  const handleScanSuccess = () => {
    setIsScanning(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={isScanning ? () => setIsScanning(false) : onClose}
    >
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: divider }]}>
          <TouchableOpacity 
            onPress={isScanning ? () => setIsScanning(false) : onClose} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={textHi} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textHi }]}>
            {isScanning ? 'Scan QR Code' : 'Linked Devices'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {isScanning ? (
          /* QR CODE SCANNER VIEWPORT OVERLAY */
          <View style={styles.scannerContainer}>
            <Text style={[styles.scannerInstructions, { color: textHi }]}>
              Visit <Text style={{ fontWeight: '700', color: brandGreen }}>web.whatsapp.com</Text> on your computer and scan the QR code to link your account.
            </Text>

            <View style={[styles.scannerFrame, { borderColor: brandGreen }]}>
              <View style={[styles.scannerCorner, styles.cornerTL, { borderColor: brandGreen }]} />
              <View style={[styles.scannerCorner, styles.cornerTR, { borderColor: brandGreen }]} />
              <View style={[styles.scannerCorner, styles.cornerBL, { borderColor: brandGreen }]} />
              <View style={[styles.scannerCorner, styles.cornerBR, { borderColor: brandGreen }]} />
              
              {/* Dynamic Scanning Line */}
              <Animated.View style={[styles.scanLine, { backgroundColor: brandGreen, transform: [{ translateY }] }]} />

              {/* QR Mock Centerpiece */}
              <View style={styles.qrMockPlaceholder}>
                <Ionicons name="qr-code-outline" size={140} color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'} />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.btnScanSuccess, { backgroundColor: brandGreen }]} 
              onPress={handleScanSuccess}
            >
              <Text style={styles.btnScanSuccessText}>Simulate Successful Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.btnCancelScan} 
              onPress={() => setIsScanning(false)}
            >
              <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* LINKED DEVICES LIST VIEW */
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Promo Graphic Banner */}
            <View style={[styles.promoCard, { backgroundColor: cardBg }]}>
              <View style={[styles.deviceGraphicContainer, { backgroundColor: isDark ? '#202c33' : '#e1ebe6' }]}>
                <Ionicons name="desktop-outline" size={54} color={brandGreen} />
                <View style={styles.deviceGraphicOverlap}>
                  <Ionicons name="phone-portrait-outline" size={26} color={brandGreen} style={styles.deviceGraphicPhone} />
                </View>
              </View>
              <Text style={[styles.promoTitle, { color: textHi }]}>Use WhatsApp on Web or Desktop</Text>
              <Text style={[styles.promoDesc, { color: textMuted }]}>
                Send and receive messages without keeping your phone online. Link up to 4 devices.
              </Text>
              
              <TouchableOpacity 
                activeOpacity={0.8}
                style={[styles.linkBtn, { backgroundColor: brandGreen }]}
                onPress={handleLinkDevice}
              >
                <Text style={styles.linkBtnText}>Link a device</Text>
              </TouchableOpacity>
            </View>

            {/* Devices Section */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, { color: textMuted }]}>DEVICE STATUS</Text>
            </View>

            <View style={[styles.deviceList, { backgroundColor: cardBg }]}>
              <View style={styles.deviceRow}>
                <View style={[styles.deviceIconCircle, { backgroundColor: isDark ? '#202c33' : '#f0f2f5' }]}>
                  <Ionicons name="logo-chrome" size={24} color={textHi} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, { color: textHi }]}>Google Chrome (Windows)</Text>
                  <Text style={[styles.deviceMeta, { color: textMuted }]}>Last active today at 11:32 AM</Text>
                </View>
              </View>
              <View style={[styles.rowDivider, { backgroundColor: divider }]} />

              <View style={styles.deviceRow}>
                <View style={[styles.deviceIconCircle, { backgroundColor: isDark ? '#202c33' : '#f0f2f5' }]}>
                  <Ionicons name="desktop-outline" size={24} color={textHi} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, { color: textHi }]}>macOS Desktop App</Text>
                  <Text style={[styles.deviceMeta, { color: textMuted }]}>Last active yesterday at 6:45 PM</Text>
                </View>
              </View>
            </View>

            {/* Privacy note */}
            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed" size={12} color={textMuted} />
              <Text style={[styles.privacyNoteText, { color: textMuted }]}>
                Your personal messages are end-to-end encrypted on all your devices.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingVertical: 16,
  },
  promoCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginHorizontal: 16,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  deviceGraphicContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  deviceGraphicOverlap: {
    position: 'absolute',
    bottom: 22,
    right: 22,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 3,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  deviceGraphicPhone: {
    backgroundColor: 'transparent',
  },
  promoTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  promoDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  linkBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deviceList: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  deviceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 84,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 36,
    marginTop: 32,
  },
  privacyNoteText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Scanner styles
  scannerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#000000',
  },
  scannerInstructions: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scannerCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 4,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    shadowColor: '#00a884',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  qrMockPlaceholder: {
    opacity: 0.25,
  },
  btnScanSuccess: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 48,
  },
  btnScanSuccessText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnCancelScan: {
    paddingVertical: 14,
    marginTop: 16,
  },
});
