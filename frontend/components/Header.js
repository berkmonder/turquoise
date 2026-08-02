import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Header() {
  return (
    <View style={styles.navbar}>
      <View style={styles.brand}>
        <View style={styles.logoMark} />
        <View>
          <Text style={styles.logoText}>TURQUOISE ECOSYSTEM</Text>
          <Text style={styles.tagline}>Automated Infrastructure Framework</Text>
        </View>
      </View>
      <View style={styles.navRight}>
        <Text style={styles.statusLabel}>CORE SERVICES</Text>
        <Text style={styles.statusText}>OPERATIONAL</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 18,
    backgroundColor: '#090d16',
    borderBottomColor: '#1e293b',
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: { width: 12, height: 12, backgroundColor: '#00f2fe' },
  logoText: { fontSize: 12, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5 },
  tagline: { fontSize: 11, color: '#475569', marginTop: 2 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 0.5 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
});
