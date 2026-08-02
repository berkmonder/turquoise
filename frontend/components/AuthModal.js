import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';

const API_BASE = process.env.API_BASE || 'http://localhost:8000';

export default function AuthModal({ visible, onClose, onLoginSuccess, theme }) {
    const [activeTab, setActiveTab] = useState('login'); // 'login' | 'wishlist'
    const [apiKey, setApiKey] = useState('');
    const [email, setEmail] = useState('');

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const isDark = theme === 'dark';
    const themeStyles = isDark ? darkStyles : lightStyles;

    const handleLogin = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Authentication failed');
            }

            localStorage.setItem('turquoise_master_key', apiKey);

            setIsDevMode(true);
            onClose();
        } catch (err) {
            alert(`Login failed: ${err.message}`);
        }
    };

    const handleWishlistSubmit = async () => {
        setMsg(null);
        if (!email.includes('@')) {
            setMsg('Enter a valid developer email address.');
            setIsSuccess(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/wishlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Request failed');

            setIsSuccess(true);
            setMsg(data.message);
            setEmail('');
        } catch (err) {
            setIsSuccess(false);
            setMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setApiKey('');
        setEmail('');
        setMsg(null);
        setIsSuccess(false);
        setActiveTab('login');
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, themeStyles.card]}>
                    {/* Header */}
                    <Text style={[styles.modalTitle, themeStyles.textTitle]}>Platform Authentication</Text>
                    <Text style={[styles.modalSubtitle, themeStyles.textSub]}>
                        Access developer publishing controls or request onboarding access.
                    </Text>

                    {/* Mode Switcher Tabs */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
                            onPress={() => { setActiveTab('login'); setMsg(null); }}
                        >
                            <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
                                Developer Login
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'wishlist' && styles.tabBtnActive]}
                            onPress={() => { setActiveTab('wishlist'); setMsg(null); }}
                        >
                            <Text style={[styles.tabText, activeTab === 'wishlist' && styles.tabTextActive]}>
                                Request Access
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form 1: Developer Login */}
                    {activeTab === 'login' && (
                        <View style={styles.formGroup}>
                            <Text style={[styles.label, themeStyles.textSub]}>Master Secret Key</Text>
                            <TextInput
                                style={[styles.input, themeStyles.input]}
                                value={apiKey}
                                onChangeText={setApiKey}
                                placeholder="sk_turquoise_..."
                                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.submitBtn} onPress={handleLogin}>
                                <Text style={styles.submitBtnText}>Authenticate Account</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Form 2: Request Developer Key (Wishlist) */}
                    {activeTab === 'wishlist' && (
                        <View style={styles.formGroup}>
                            <Text style={[styles.label, themeStyles.textSub]}>Developer Email</Text>
                            <TextInput
                                style={[styles.input, themeStyles.input]}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="developer@company.com"
                                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={handleWishlistSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#070a13" size="small" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Submit Access Request</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Status Message */}
                    {msg && (
                        <Text style={[styles.statusMsg, isSuccess ? styles.msgSuccess : styles.msgError]}>
                            {msg}
                        </Text>
                    )}

                    {/* Dismiss Action */}
                    <TouchableOpacity
                        style={styles.guestBtn}
                        onPress={() => { onClose(); resetForm(); }}
                    >
                        <Text style={styles.guestBtnText}>Continue as Guest →</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7,10,19,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 440,
        borderRadius: 12,
        padding: 28,
        borderWidth: 1,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    modalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 20 },

    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        padding: 4,
        marginBottom: 20,
    },
    tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    tabBtnActive: { backgroundColor: '#00f2fe' },
    tabText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
    tabTextActive: { color: '#070a13' },

    formGroup: { gap: 8 },
    label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    input: { borderRadius: 8, padding: 12, fontSize: 13, outlineStyle: 'none' },

    submitBtn: {
        backgroundColor: '#00f2fe',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitBtnText: { color: '#070a13', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

    statusMsg: { fontSize: 12, fontWeight: '600', marginTop: 12, textAlign: 'center' },
    msgSuccess: { color: '#34d399' },
    msgError: { color: '#f87171' },

    guestBtn: { marginTop: 20, alignItems: 'center', paddingTop: 12, borderTopColor: 'rgba(0,0,0,0.1)', borderTopWidth: 1 },
    guestBtnText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
});

const darkStyles = StyleSheet.create({
    card: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
    textTitle: { color: '#ffffff' },
    textSub: { color: '#94a3b8' },
    input: { backgroundColor: '#070a13', borderColor: '#1e293b', color: '#ffffff' },
});

const lightStyles = StyleSheet.create({
    card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
    textTitle: { color: '#0f172a' },
    textSub: { color: '#475569' },
    input: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' },
});
