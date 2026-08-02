// frontend/App.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import CatalogView from './components/CatalogView';
import ModelDetailView from './components/ModelDetailView';
import AuthModal from './components/AuthModal';
import Footer from './components/Footer';

export default function App() {
  const [selectedModel, setSelectedModel] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isDark = theme === 'dark';
  const themeStyles = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.root, themeStyles.bg]}>
      {/* Navbar */}
      <View style={[styles.navbar, themeStyles.navbar]}>
        <View style={styles.brandGroup}>
          <Text style={[styles.brandTitle, themeStyles.textPrimary]}>TURQUOISE</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ECOSYSTEM</Text>
          </View>
        </View>

        <View style={styles.actionsGroup}>
          {/* Login / Account Status Button */}
          {isLoggedIn ? (
            <TouchableOpacity
              style={styles.devActivePill}
              onPress={() => setIsLoggedIn(false)}
            >
              <Text style={styles.devActiveText}>● Developer Account (Logout)</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.loginBtn, themeStyles.toggleBtn]}
              onPress={() => setShowAuthModal(true)}
            >
              <Text style={[styles.loginBtnText, themeStyles.toggleText]}>
                Sign In / Access
              </Text>
            </TouchableOpacity>
          )}

          {/* Theme Toggle */}
          <TouchableOpacity
            style={[styles.themeToggle, themeStyles.toggleBtn]}
            onPress={() => setTheme(isDark ? 'light' : 'dark')}
          >
            <Text style={[styles.themeToggleText, themeStyles.toggleText]}>
              {isDark ? 'LIGHT MODE' : 'DARK MODE'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* View Router */}
      <View style={{ flex: 1 }}>
        {selectedModel ? (
          <ModelDetailView
            model={selectedModel}
            onBack={() => setSelectedModel(null)}
            theme={theme}
          />
        ) : (
          <CatalogView
            onSelectModel={setSelectedModel}
            theme={theme}
            isDevMode={isLoggedIn}
          />
        )}
      </View>

      {/* Global Footer */}
      <Footer theme={theme} />

      {/* Auth Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={() => setIsLoggedIn(true)}
        theme={theme}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navbar: {
    height: 56,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  badge: {
    backgroundColor: 'rgba(0,242,254,0.12)',
    borderColor: '#00f2fe',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#00f2fe', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  actionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  loginBtn: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1 },
  loginBtnText: { fontSize: 11, fontWeight: '700' },

  devActivePill: {
    backgroundColor: 'rgba(0,242,254,0.12)',
    borderColor: '#00f2fe',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  devActiveText: { color: '#00f2fe', fontSize: 11, fontWeight: '800' },

  themeToggle: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1 },
  themeToggleText: { fontSize: 11, fontWeight: '700' },
});

const darkTheme = StyleSheet.create({
  bg: { backgroundColor: '#070a13' },
  navbar: { backgroundColor: '#090d16', borderBottomColor: '#1e293b' },
  textPrimary: { color: '#ffffff' },
  toggleBtn: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  toggleText: { color: '#94a3b8' },
});

const lightTheme = StyleSheet.create({
  bg: { backgroundColor: '#f8fafc' },
  navbar: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0' },
  textPrimary: { color: '#0f1f2a' },
  toggleBtn: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  toggleText: { color: '#334155' },
});
