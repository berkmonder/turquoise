// frontend/components/ModelDetailView.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.API_BASE || '';

function ImageCanvasInput({ onPixelDataChange, disabled, isDark }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 280, 280);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    isDrawing.current = true;
    lastPos.current = getCoordinates(e);
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    extractPixelArray();
  };

  const draw = (e) => {
    if (!isDrawing.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPos.current = { x, y };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 280, 280);
    onPixelDataChange(null);
  };

  const extractPixelArray = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = 28;
    offscreen.height = 28;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(canvas, 0, 0, 28, 28);

    const imgData = offCtx.getImageData(0, 0, 28, 28).data;
    const grayscalePixels = [];

    for (let i = 0; i < imgData.length; i += 4) {
      grayscalePixels.push(imgData[i] / 255.0);
    }

    onPixelDataChange([[grayscalePixels]]);
  };

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Text style={{ color: isDark ? '#94a3b8' : '#475569', fontSize: 12 }}>
        Draw a digit inside the box below:
      </Text>
      <canvas
        ref={canvasRef}
        width={280}
        height={280}
        style={{
          border: isDark ? '1px solid #1e293b' : '1px solid #cbd5e1',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'crosshair',
          touchAction: 'none',
        }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchMove={draw}
      />
      <TouchableOpacity style={styles.clearBtn} onPress={clearCanvas} disabled={disabled}>
        <Text style={styles.clearBtnText}>Clear Canvas</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ModelDetailView({ model, onBack, theme }) {
  const [csvData, setCsvData] = useState('1.0, 2.0\n3.5, 4.0\n-2.5, 0.5');
  const [textPrompt, setTextPrompt] = useState('Explain the benefits of decentralized machine learning execution.');
  const [canvasPayload, setCanvasPayload] = useState(null);

  const [predictionOutput, setPredictionOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isDark = theme === 'dark';
  const themeStyles = isDark ? darkStyles : lightStyles;
  const isOnline = model.node_status === 'online';

  const handleDownload = () => {
    Linking.openURL(`${API_BASE}/api/v1/download/${model.id}`);
  };

  const runInference = async () => {
    try {
      setLoading(true);
      setError(null);
      setPredictionOutput(null);

      let payload;
      if (model.input_type === 'image_canvas_28x28') {
        if (!canvasPayload) throw new Error('Please draw a digit on the canvas first.');
        payload = canvasPayload;
      } else if (model.input_type === 'text_prompt') {
        if (!textPrompt.trim()) throw new Error('Prompt cannot be empty.');
        payload = textPrompt;
      } else {
        payload = csvData;
      }

      const res = await fetch(`${API_BASE}/api/v1/execute/${model.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Execution failed');
      }

      // Handle Streaming LLM Output vs Standard JSON Response
      if (model.output_type === 'text_completion') {
        setPredictionOutput('');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = '';

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Keep last incomplete chunk

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.token) {
                    setPredictionOutput((prev) => (prev || '') + parsed.token);
                  }
                  if (parsed.error) {
                    setError(parsed.error);
                  }
                } catch (e) { }
              }
            }
          }
        }
      } else {
        const data = await res.json();
        setPredictionOutput(data.output);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const csvRows = csvData.split('\n').map((r) => r.trim()).filter(Boolean);

  return (
    <View style={[styles.root, themeStyles.bg]}>
      <View style={[styles.controlBar, themeStyles.controlBar]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={styles.backBtnText}>◄ Back to Catalog</Text>
        </TouchableOpacity>
        <View style={styles.modelMeta}>
          <Text style={[styles.modelName, themeStyles.textTitle]}>{model.name}</Text>
          {model.execution_type === 'local_onnx' && (
            <TouchableOpacity style={styles.onnxBadge} onPress={handleDownload} activeOpacity={0.7}>
              <Text style={styles.onnxBadgeText}>DOWNLOAD ASSET (.ONNX)</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.descBar, themeStyles.descBar]}>
        <Text style={[styles.descText, themeStyles.textSub]}>{model.description}</Text>
        <Text style={styles.modelIdText}>
          TYPE: {model.input_type.toUpperCase()} ➔ {model.output_type.toUpperCase()}
        </Text>
      </View>

      <View style={styles.workbench}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, themeStyles.textTitle]}>Input Interface</Text>
            <Text style={styles.panelHint}>{model.input_type}</Text>
          </View>

          <View style={styles.panelContent}>
            {model.input_type === 'image_canvas_28x28' && (
              <ImageCanvasInput
                onPixelDataChange={setCanvasPayload}
                disabled={!isOnline}
                isDark={isDark}
              />
            )}

            {model.input_type === 'text_prompt' && (
              <TextInput
                style={[styles.textArea, themeStyles.input]}
                multiline
                value={textPrompt}
                onChangeText={setTextPrompt}
                placeholder="Type prompt here..."
                placeholderTextColor={isDark ? '#334155' : '#cbd5e1'}
                textAlignVertical="top"
                editable={isOnline}
              />
            )}

            {model.input_type === 'tabular_csv' && (
              <TextInput
                style={[styles.textArea, themeStyles.input]}
                multiline
                value={csvData}
                onChangeText={setCsvData}
                placeholder="1.0, 2.0"
                placeholderTextColor={isDark ? '#334155' : '#cbd5e1'}
                textAlignVertical="top"
                editable={isOnline}
              />
            )}
          </View>

          <TouchableOpacity
            style={[styles.runBtn, (!isOnline || loading) && styles.runBtnDisabled]}
            onPress={runInference}
            disabled={!isOnline || loading}
          >
            {loading && model.output_type !== 'text_completion' ? (
              <ActivityIndicator color="#070a13" size="small" />
            ) : (
              <Text style={styles.runBtnText}>
                {isOnline ? 'Execute Pipeline' : 'Node Unreachable'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, themeStyles.divider]} />

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, themeStyles.textTitle]}>Execution Output</Text>
            <Text style={styles.panelHint}>{model.output_type}</Text>
          </View>

          <ScrollView style={styles.panelScroll}>
            {!loading && !error && predictionOutput === null && (
              <View style={styles.emptyState}>
                <Text style={themeStyles.textSub}>
                  {isOnline ? 'Provide input and execute to view output streams.' : 'Execution disabled.'}
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Gateway Exception</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {predictionOutput !== null && (
              <View style={styles.outputContainer}>
                {model.output_type === 'classification_label' && (
                  <View style={[styles.classBox, themeStyles.classBox]}>
                    <Text style={styles.classLabel}>PREDICTED CLASS</Text>
                    <Text style={[styles.classValue, themeStyles.textTitle]}>{String(predictionOutput)}</Text>
                  </View>
                )}

                {model.output_type === 'text_completion' && (
                  <View style={[styles.textOutputBox, themeStyles.input]}>
                    <Text style={[styles.textOutputContent, themeStyles.textTitle]}>
                      {String(predictionOutput)}
                      {loading && ' ▌'}
                    </Text>
                  </View>
                )}

                {model.output_type === 'numeric_array' && Array.isArray(predictionOutput) && (
                  <View style={[styles.table, themeStyles.input]}>
                    <View style={[styles.tableRow, styles.tableHead]}>
                      <Text style={[styles.cell, styles.cellIdx]}>#</Text>
                      <Text style={styles.cell}>Input Matrix (X)</Text>
                      <Text style={styles.cell}>Output Tensor (Y)</Text>
                    </View>
                    {predictionOutput.map((pred, i) => (
                      <View key={i} style={styles.tableRow}>
                        <Text style={[styles.cell, styles.cellIdx]}>{i + 1}</Text>
                        <Text style={[styles.cell, styles.cellMono]}>{csvRows[i] ?? '—'}</Text>
                        <Text style={[styles.cell, styles.cellPred]}>
                          {Array.isArray(pred)
                            ? pred.map((v) => Number(v).toFixed(4)).join(', ')
                            : Number(pred).toFixed(4)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column' },
  controlBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { backgroundColor: '#1e293b', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  backBtnText: { color: '#94a3b8', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  modelMeta: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modelName: { fontSize: 15, fontWeight: '700' },
  onnxBadge: { backgroundColor: 'rgba(0,242,254,0.08)', borderColor: '#00f2fe', borderWidth: 1, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  onnxBadgeText: { color: '#00f2fe', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  descBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 10, borderBottomWidth: 1 },
  descText: { fontSize: 13, flex: 1 },
  modelIdText: { fontSize: 10, color: '#00f2fe', fontFamily: 'monospace', fontWeight: '700', marginLeft: 16 },

  workbench: { flex: 1, flexDirection: 'row', minHeight: 400 },
  panel: { flex: 1, flexDirection: 'column', padding: 24, minWidth: 280 },
  panelContent: { flex: 1, marginBottom: 16 },
  divider: { width: 1, marginVertical: 16 },

  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { fontSize: 14, fontWeight: '700' },
  panelHint: { fontSize: 10, color: '#475569', fontFamily: 'monospace' },
  panelScroll: { flex: 1 },

  clearBtn: { backgroundColor: '#1e293b', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 16 },
  clearBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },

  textArea: { borderWidth: 1, borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 13, flex: 1, minHeight: 220, outlineStyle: 'none' },

  runBtn: { backgroundColor: '#00f2fe', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  runBtnDisabled: { opacity: 0.4 },
  runBtnText: { color: '#070a13', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1, borderRadius: 8, padding: 16 },
  errorTitle: { color: '#fca5a5', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  errorText: { color: '#fca5a5', fontSize: 12, lineHeight: 18 },

  outputContainer: { flex: 1 },
  classBox: { borderWidth: 1, borderRadius: 12, padding: 32, alignItems: 'center' },
  classLabel: { fontSize: 11, fontWeight: '800', color: '#00f2fe', letterSpacing: 1.5, marginBottom: 8 },
  classValue: { fontSize: 64, fontWeight: '900' },

  textOutputBox: { borderWidth: 1, borderRadius: 8, padding: 16 },
  textOutputContent: { fontSize: 14, lineHeight: 22, fontFamily: 'monospace' },

  table: { borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomColor: 'rgba(0,0,0,0.1)', borderBottomWidth: 1 },
  tableHead: { backgroundColor: 'rgba(0,0,0,0.05)' },
  cell: { flex: 1, fontSize: 12 },
  cellIdx: { flex: 0.3, color: '#475569', fontWeight: '700' },
  cellMono: { fontFamily: 'monospace', color: '#94a3b8' },
  cellPred: { color: '#00f2fe', fontWeight: '700' },
});

const darkStyles = StyleSheet.create({
  bg: { backgroundColor: '#070a13' },
  controlBar: { backgroundColor: '#090d16', borderBottomColor: '#1e293b' },
  descBar: { backgroundColor: '#0f172a', borderBottomColor: '#1e293b' },
  textTitle: { color: '#ffffff' },
  textSub: { color: '#94a3b8' },
  divider: { backgroundColor: '#1e293b' },
  input: { backgroundColor: '#090d16', borderColor: '#1e293b', color: '#e2e8f0' },
  classBox: { backgroundColor: '#090d16', borderColor: '#00f2fe' },
});

const lightStyles = StyleSheet.create({
  bg: { backgroundColor: '#f8fafc' },
  controlBar: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0' },
  descBar: { backgroundColor: '#f1f5f9', borderBottomColor: '#e2e8f0' },
  textTitle: { color: '#0f172a' },
  textSub: { color: '#475569' },
  divider: { backgroundColor: '#e2e8f0' },
  input: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  classBox: { backgroundColor: '#ffffff', borderColor: '#00f2fe' },
});
