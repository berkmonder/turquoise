// frontend/components/Footer.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Footer({ theme }) {
  const isDark = theme === 'dark';
  const themeStyles = isDark ? darkStyles : lightStyles;

  return (
    <View style={[styles.footer, themeStyles.footer]}>
      <View style={styles.container}>
        {/* Left: Operational Health Telemetry */}
        <View style={styles.statusGroup}>
          <View style={styles.pulseIndicator} />
          <Text style={[styles.statusText, themeStyles.textSub]}>
            SYSTEM STATUS: ALL COMPUTING NODES OPERATIONAL
          </Text>
        </View>

        {/* Center: Engine Version */}
        <Text style={[styles.metaText, themeStyles.textSub]}>
          TURQUOISE ENGINE V1.0.0 // BYOH ROUTING PIPELINE
        </Text>

        {/* Right: Copyright */}
        <Text style={[styles.copyrightText, themeStyles.textSub]}>
          © 2026 TURQUOISE ECOSYSTEM. ALL RIGHTS RESERVED.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    height: 48,
    borderTopWidth: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metaText: { fontSize: 10, fontFamily: 'monospace', letterSpacing: 0.5 },
  copyrightText: { fontSize: 10, fontWeight: '600' },
});

const darkStyles = StyleSheet.create({
  footer: { backgroundColor: '#090d16', borderTopColor: '#1e293b' },
  textSub: { color: '#64748b' },
});

const lightStyles = StyleSheet.create({
  footer: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
  textSub: { color: '#94a3b8' },
});
