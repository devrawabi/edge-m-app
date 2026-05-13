import { StyleSheet, Text, View } from 'react-native';

const brandMuted = '#94a3b8';

export function StubScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.help}>
        This screen mirrors the Rawabi Edge web routing. Full native UI arrives incrementally; use the web app until then.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: brandMuted,
    marginBottom: 16,
  },
  help: {
    fontSize: 13,
    lineHeight: 20,
    color: brandMuted,
  },
});
