import * as Clipboard from 'expo-clipboard';
import { Alert, Platform } from 'react-native';

import { stripContactPhoneSuffix } from '@/lib/contact-card-content';

export async function saveContactToDeviceAddressBook(displayName: string, phoneLine: string) {
  const normalized = stripContactPhoneSuffix(phoneLine).trim();
  if (Platform.OS === 'web') {
    const safeName = displayName.replace(/[\n\r]/g, ' ').trim() || 'Contact';
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${safeName}\nTEL;TYPE=CELL:${normalized.replace(/\s/g, '')}\nEND:VCARD`;
    await Clipboard.setStringAsync(vcard);
    Alert.alert('Copied', 'A vCard was copied to the clipboard. Paste it into your contacts app.');
    return;
  }
  const Contacts = await import('expo-contacts');
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Contacts', 'Permission is required to save to your address book.');
    return;
  }
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Contact';
  const lastName = parts.slice(1).join(' ') || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || displayName.trim() || 'Contact';
  await Contacts.addContactAsync({
    contactType: Contacts.ContactTypes.Person,
    name: fullName,
    firstName,
    lastName,
    phoneNumbers: [{ number: normalized, label: 'mobile' }],
  });
  Alert.alert('Saved', 'Contact was added to your address book.');
}
