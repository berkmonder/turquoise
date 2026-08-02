// frontend/components/CatalogView.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:8000`
  : 'http://localhost:8000';

const DEV_BEARER_TOKEN = 'sk_turquoise_prod_placeholder_token';

export default function CatalogView({ onSelectModel, theme, isDevMode }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pubId, setPubId] = useState('');
  const [pubName, setPubName] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubCategory, setPubCategory] = useState('general');
  const [pubExecType, setPubExecType] = useState('local_onnx');
  const [pubInputType, setPubInputType] = useState('tabular_csv');
  const [pubOutputType, setPubOutputType] = useState('numeric_array');
  const [pubWorkerUrl, setPubWorkerUrl] = useState('local');
  const [selectedFile, setSelectedFile] = useState(null);
  const [pubLoading, setPubLoading] = useState(false);
  const [pubMsg, setPubMsg] = useState(null);

  const isDark = theme === 'dark';
  const themeStyles = isDark ? darkStyles : lightStyles;

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/models`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setModels(await res.json());
    } catch (err) {
      setError('Could not reach control plane. Ensure Docker stack is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleDeleteModel = async (modelId, e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation(); // Prevents opening workbench when clicking Delete
    }

    if (!window.confirm(`Are you sure you want to permanently unpublish model '${modelId}'?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${DEV_BEARER_TOKEN}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Deletion failed.');
      }

      fetchModels(); // Refresh catalog state
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handlePublish = async () => {
    if (!pubId || !pubName || !pubDesc) {
      setPubMsg('ID, Name, and Description are required.');
      return;
    }

    try {
      setPubLoading(true);
      setPubMsg(null);

      const formData = new FormData();
      formData.append('id', pubId.toLowerCase().trim());
      formData.append('name', pubName.trim());
      formData.append('description', pubDesc.trim());
      formData.append('category', pubCategory);
      formData.append('execution_type', pubExecType);
      formData.append('input_type', pubInputType);
      formData.append('output_type', pubOutputType);
      formData.append('worker_url', pubWorkerUrl);

      if (pubExecType === 'local_onnx' && selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await fetch(`${API_BASE}/api/v1/models/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEV_BEARER_TOKEN}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to publish model');

      setShowPublishModal(false);
      resetPublishForm();
      fetchModels();
    } catch (err) {
      setPubMsg(err.message);
    } finally {
      setPubLoading(false);
    }
  };

  const resetPublishForm = () => {
    setPubId('');
    setPubName('');
    setPubDesc('');
    setPubCategory('general');
    setPubExecType('local_onnx');
    setPubInputType('tabular_csv');
    setPubOutputType('numeric_array');
    setPubWorkerUrl('local');
    setSelectedFile(null);
    setPubMsg(null);
  };

  const categories = ['ALL', 'VISION', 'NLP', 'TABULAR', 'GENERAL'];
  const filteredModels = models.filter((m) => {
    const matchesCategory =
      selectedCategory === 'ALL' || m.category.toUpperCase() === selectedCategory;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <ScrollView style={[styles.scroll, themeStyles.bg]} contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, themeStyles.textTitle]}>Ecosystem Models</Text>
          <Text style={[styles.pageDesc, themeStyles.textSub]}>
            Discover and execute independent ONNX graphs and distributed compute nodes.
          </Text>
        </View>

        {isDevMode && (
          <TouchableOpacity style={styles.publishBtn} onPress={() => setShowPublishModal(true)}>
            <Text style={styles.publishBtnText}>+ Publish Model</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={[styles.searchInput, themeStyles.input]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search models by name, ID, or description..."
          placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
        />

        <View style={styles.tabsRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.tab,
                themeStyles.tab,
                selectedCategory === cat && styles.tabActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  themeStyles.tabText,
                  selectedCategory === cat && styles.tabTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && <ActivityIndicator color="#00f2fe" size="large" style={styles.loader} />}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchModels}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && filteredModels.length === 0 && (
        <View style={styles.emptyCatalog}>
          <Text style={[styles.emptyCatalogTitle, themeStyles.textTitle]}>No Models Available</Text>
          <Text style={[styles.emptyCatalogDesc, themeStyles.textSub]}>
            {isDevMode
              ? 'Click "+ Publish Model" to add your first ONNX file or remote node.'
              : 'Check back later for newly published ecosystem models.'}
          </Text>
        </View>
      )}

      <View style={styles.grid}>
        {filteredModels.map((model) => {
          const isOnline = model.node_status === 'online';

          return (
            <TouchableOpacity
              key={model.id}
              style={[styles.modelCard, themeStyles.card, !isOnline && styles.cardOffline]}
              onPress={() => onSelectModel(model)}
              activeOpacity={0.75}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{model.category.toUpperCase()}</Text>
                </View>

                <View
                  style={[
                    styles.healthBadge,
                    isOnline ? styles.healthOnline : styles.healthOffline,
                  ]}
                >
                  <Text
                    style={[
                      styles.healthText,
                      isOnline ? styles.healthTextOnline : styles.healthTextOffline,
                    ]}
                  >
                    {isOnline ? 'NODE ACTIVE' : 'NODE OFFLINE'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, themeStyles.textTitle]}>{model.name}</Text>
              <Text style={[styles.cardDesc, themeStyles.textSub]}>{model.description}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.cardId}>ID: {model.id}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {isDevMode && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={(e) => handleDeleteModel(model.id, e)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={[styles.cardCta, !isOnline && styles.ctaDisabled]}>
                    {isOnline ? 'Open Workbench →' : 'Node Offline'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Publish Modal */}
      <Modal visible={showPublishModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.card]}>
            <Text style={[styles.modalTitle, themeStyles.textTitle]}>Publish Model to Ecosystem</Text>
            <Text style={[styles.modalDesc, themeStyles.textSub]}>
              Register a model metadata contract and upload its ONNX graph file.
            </Text>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>Model ID (slug)</Text>
              <TextInput
                style={[styles.input, themeStyles.input]}
                value={pubId}
                onChangeText={setPubId}
                placeholder="e.g. resnet-classifier"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              />

              <Text style={styles.label}>Model Name</Text>
              <TextInput
                style={[styles.input, themeStyles.input]}
                value={pubName}
                onChangeText={setPubName}
                placeholder="e.g. ResNet Image Classifier"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, themeStyles.input, { height: 60 }]}
                multiline
                value={pubDesc}
                onChangeText={setPubDesc}
                placeholder="Brief summary of capability..."
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.optionsRow}>
                {['vision', 'nlp', 'tabular', 'general'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.optBtn, pubCategory === c && styles.optBtnActive]}
                    onPress={() => setPubCategory(c)}
                  >
                    <Text style={[styles.optText, pubCategory === c && styles.optTextActive]}>
                      {c.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Execution Type</Text>
              <View style={styles.optionsRow}>
                {[
                  { id: 'local_onnx', label: 'Local ONNX' },
                  { id: 'openai_proxy', label: 'Remote LLM Proxy' },
                ].map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.optBtn, pubExecType === e.id && styles.optBtnActive]}
                    onPress={() => setPubExecType(e.id)}
                  >
                    <Text style={[styles.optText, pubExecType === e.id && styles.optTextActive]}>
                      {e.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Input Interface</Text>
              <View style={styles.optionsRow}>
                {[
                  { id: 'tabular_csv', label: 'CSV Matrix' },
                  { id: 'text_prompt', label: 'Text Prompt' },
                  { id: 'image_canvas_28x28', label: '28x28 Canvas' },
                ].map((i) => (
                  <TouchableOpacity
                    key={i.id}
                    style={[styles.optBtn, pubInputType === i.id && styles.optBtnActive]}
                    onPress={() => setPubInputType(i.id)}
                  >
                    <Text style={[styles.optText, pubInputType === i.id && styles.optTextActive]}>
                      {i.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Output Interface</Text>
              <View style={styles.optionsRow}>
                {[
                  { id: 'numeric_array', label: 'Numeric Array' },
                  { id: 'text_completion', label: 'Text Stream' },
                  { id: 'classification_label', label: 'Label Class' },
                ].map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.optBtn, pubOutputType === o.id && styles.optBtnActive]}
                    onPress={() => setPubOutputType(o.id)}
                  >
                    <Text style={[styles.optText, pubOutputType === o.id && styles.optTextActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {pubExecType === 'openai_proxy' && (
                <>
                  <Text style={styles.label}>Tailscale Worker URL</Text>
                  <TextInput
                    style={[styles.input, themeStyles.input]}
                    value={pubWorkerUrl}
                    onChangeText={setPubWorkerUrl}
                    placeholder="http://100.x.y.z:8080"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  />
                </>
              )}

              {pubExecType === 'local_onnx' && (
                <>
                  <Text style={styles.label}>Select ONNX File</Text>
                  <input
                    type="file"
                    accept=".onnx"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    style={{ color: isDark ? '#94a3b8' : '#334155', marginBottom: 12 }}
                  />
                </>
              )}

              {pubMsg && <Text style={styles.pubErr}>{pubMsg}</Text>}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowPublishModal(false);
                  resetPublishForm();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.submitBtn} onPress={handlePublish} disabled={pubLoading}>
                {pubLoading ? (
                  <ActivityIndicator color="#070a13" size="small" />
                ) : (
                  <Text style={styles.submitText}>Publish to Catalog</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 32, paddingBottom: 48 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageHeader: { flex: 1 },
  pageTitle: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  pageDesc: { fontSize: 14 },

  publishBtn: { backgroundColor: '#00f2fe', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  publishBtnText: { color: '#070a13', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  filterBar: { marginBottom: 28, gap: 16 },
  searchInput: { borderRadius: 8, padding: 12, fontSize: 13, outlineStyle: 'none' },
  tabsRow: { flexDirection: 'row', gap: 8 },
  tab: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1 },
  tabActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: '#00f2fe' },
  tabText: { fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#00f2fe' },

  loader: { marginVertical: 40 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 16 },
  errorText: { color: '#fca5a5', fontSize: 13, marginBottom: 8 },
  retryBtn: { backgroundColor: '#ef4444', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },

  emptyCatalog: { alignItems: 'center', paddingVertical: 60 },
  emptyCatalogTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyCatalogDesc: { fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  modelCard: { width: '31%', minWidth: 280, borderRadius: 12, padding: 20, borderWidth: 1, cursor: 'pointer' },
  cardOffline: { opacity: 0.65 },

  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pill: { backgroundColor: 'rgba(96,165,250,0.1)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: '700', color: '#60a5fa', letterSpacing: 0.5 },

  healthBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  healthOnline: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' },
  healthOffline: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' },
  healthText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  healthTextOnline: { color: '#34d399' },
  healthTextOffline: { color: '#f87171' },

  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { fontSize: 10, color: '#475569', fontFamily: 'monospace' },
  cardCta: { fontSize: 12, color: '#00f2fe', fontWeight: '700' },
  ctaDisabled: { color: '#64748b' },

  deleteBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  deleteBtnText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(7,10,19,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 540, borderRadius: 12, padding: 28, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalDesc: { fontSize: 13, marginBottom: 20 },

  label: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 6, padding: 10, fontSize: 13, outlineStyle: 'none' },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optBtn: { backgroundColor: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  optBtnActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: '#00f2fe' },
  optText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  optTextActive: { color: '#00f2fe' },

  pubErr: { color: '#f87171', fontSize: 12, marginTop: 10, fontWeight: '600' },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTopColor: 'rgba(0,0,0,0.1)', borderTopWidth: 1 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  submitBtn: { backgroundColor: '#00f2fe', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 18 },
  submitText: { color: '#070a13', fontWeight: '800', fontSize: 12 },
});

const darkStyles = StyleSheet.create({
  bg: { backgroundColor: '#070a13' },
  textTitle: { color: '#ffffff' },
  textSub: { color: '#94a3b8' },
  input: { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#ffffff' },
  tab: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  tabText: { color: '#64748b' },
  card: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
});

const lightStyles = StyleSheet.create({
  bg: { backgroundColor: '#f8fafc' },
  textTitle: { color: '#0f172a' },
  textSub: { color: '#475569' },
  input: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  tab: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  tabText: { color: '#475569' },
  card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
});
