import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Volume2, Download, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { useApiEndpoint } from '../hooks/useApiEndpoint';
import { useVoiceLibrary } from '../hooks/useVoiceLibrary';
import { createTTSService } from '../services/tts';
import type { TTSRequest } from '../types';

interface BatchEntry {
  id: string;
  text: string;
  voiceId?: string;
  voiceName?: string;
}

export default function BatchTTSPage() {
  // Initialize state from localStorage
  const [entries, setEntries] = useState<BatchEntry[]>(() => {
    const saved = localStorage.getItem('batchTTSState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.entries && Array.isArray(parsed.entries)) {
          return parsed.entries;
        }
      } catch (error) {
        console.warn('Failed to load batch TTS entries from localStorage:', error);
      }
    }
    return [{ id: crypto.randomUUID(), text: '', voiceId: undefined, voiceName: undefined }];
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(() => {
    const saved = localStorage.getItem('batchTTSState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.generatedAudioUrl === 'string') {
          return parsed.generatedAudioUrl;
        }
      } catch {}
    }
    return null;
  });

  const [showAdvanced, setShowAdvanced] = useState(() => {
    const saved = localStorage.getItem('batchTTSState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.showAdvanced === 'boolean') {
          return parsed.showAdvanced;
        }
      } catch {}
    }
    return false;
  });

  const [exaggeration, setExaggeration] = useState(() => {
    const saved = localStorage.getItem('batchTTSState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.exaggeration === 'number') {
          return parsed.exaggeration;
        }
      } catch {}
    }
    return 0.5;
  });

  const [cfgWeight, setCfgWeight] = useState(() => {
    const saved = localStorage.getItem('batchTTSState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.cfgWeight === 'number') {
          return parsed.cfgWeight;
        }
      } catch {}
    }
    return 0.5;
  });

  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem('batchTTSState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.temperature === 'number') {
          return parsed.temperature;
        }
      } catch {}
    }
    return 0.8;
  });

  const { apiBaseUrl } = useApiEndpoint();
  const ttsService = useMemo(() => createTTSService(apiBaseUrl), [apiBaseUrl]);

  const {
    voices,
    isLoading: voicesLoading
  } = useVoiceLibrary();

  // Remove useAdvancedSettings hook usage

  // Persistence key
  const STORAGE_KEY = 'batchTTSState';

  // Save state to localStorage on changes
  useEffect(() => {
    const stateToSave = {
      entries,
      showAdvanced,
      exaggeration,
      cfgWeight,
      temperature,
      generatedAudioUrl
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [entries, showAdvanced, exaggeration, cfgWeight, temperature, generatedAudioUrl]);

  // Update functions for advanced settings
  const updateExaggeration = (value: number) => setExaggeration(value);
  const updateCfgWeight = (value: number) => setCfgWeight(value);
  const updateTemperature = (value: number) => setTemperature(value);

  const resetToDefaults = () => {
    setExaggeration(0.5);
    setCfgWeight(0.5);
    setTemperature(0.8);
  };

  const isDefault = exaggeration === 0.5 && cfgWeight === 0.5 && temperature === 0.8;

  const addEntry = () => {
    setEntries([...entries, { id: crypto.randomUUID(), text: '', voiceId: undefined, voiceName: undefined }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(entry => entry.id !== id));
    }
  };

  const updateEntryText = (id: string, text: string) => {
    setEntries(entries.map(entry =>
      entry.id === id ? { ...entry, text } : entry
    ));
  };

  const updateEntryVoice = (id: string, voiceId: string) => {
    const voice = voices.find(v => v.id === voiceId);
    setEntries(entries.map(entry =>
      entry.id === id ? { ...entry, voiceId, voiceName: voice?.name } : entry
    ));
  };

  const handleBatchGenerate = async () => {
    // Validate that all entries have text
    const validEntries = entries.filter(entry => entry.text.trim());
    
    if (validEntries.length === 0) {
      alert('Please add at least one text entry.');
      return;
    }

  setIsGenerating(true);
  const audioBlobs: Blob[] = [];
    
  // Extended warm-up with diverse dummy sentences (excluded from final output)
    try {
      const warmupText =
        "This is a warm-up test. Are you ready?";
      await ttsService.generateSpeech({
        input: warmupText,
        exaggeration,
        cfg_weight: cfgWeight,
        temperature
      });
    } catch {
      // ignore warm-up errors
    }

    try {
      // Process each valid entry (warm-up done only once)
      for (const entry of validEntries) {
        const requestData: TTSRequest = {
          input: entry.text,
          exaggeration,
          cfg_weight: cfgWeight,
          temperature
        };

        if (entry.voiceName) {
          requestData.voice = entry.voiceName;
        }

        const audioBlob = await ttsService.generateSpeech(requestData);
        audioBlobs.push(audioBlob);
      }

      // Merge audio blobs using Web Audio API
      const mergedBlob = await mergeAudioBlobs(audioBlobs);
      
      // Clean up previous audio URL
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }

      // Create new audio URL
      const url = URL.createObjectURL(mergedBlob);
      setGeneratedAudioUrl(url);

    } catch (error) {
      console.error('Batch TTS generation failed:', error);
      alert('Failed to generate batch speech. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const mergeAudioBlobs = async (blobs: Blob[]): Promise<Blob> => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffers: AudioBuffer[] = [];

    // Decode all audio blobs
    for (const blob of blobs) {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }

    // Calculate total length with silence gaps (0.5 seconds between each)
    const silenceGap = 0.5; // seconds
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0) + 
                       (audioBuffers.length - 1) * audioContext.sampleRate * silenceGap;

    // Create a new buffer to hold the merged audio
    const mergedBuffer = audioContext.createBuffer(
      audioBuffers[0].numberOfChannels,
      totalLength,
      audioContext.sampleRate
    );

    // Copy audio data into the merged buffer with silence gaps
    let offset = 0;
    for (let i = 0; i < audioBuffers.length; i++) {
      const buffer = audioBuffers[i];
      
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        mergedBuffer.copyToChannel(channelData, channel, offset);
      }

      offset += buffer.length;
      
      // Add silence gap (except after the last buffer)
      if (i < audioBuffers.length - 1) {
        offset += audioContext.sampleRate * silenceGap;
      }
    }

    // Convert AudioBuffer to WAV Blob
    const wavBlob = await audioBufferToWav(mergedBuffer);
    
    return wavBlob;
  };

  const audioBufferToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      data.push(audioBuffer.getChannelData(channel));
    }

    const dataLength = audioBuffer.length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, data[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const downloadMergedAudio = () => {
    if (!generatedAudioUrl) return;

    const link = document.createElement('a');
    link.href = generatedAudioUrl;
    link.download = `batch-tts-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearGenerated = () => {
    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
      setGeneratedAudioUrl(null);
    }
  };

  const hasValidEntries = entries.some(entry => entry.text.trim());

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Batch TTS Generation</h1>
        <p className="text-muted-foreground">
          Generate multiple text-to-speech segments with different voices and merge them into a single audio file.
        </p>
      </div>

      {/* Batch Entries */}
      <div className="space-y-4 mb-6">
        {entries.map((entry, index) => (
          <div key={entry.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {index + 1}
              </div>
              
              <div className="flex-1 space-y-3">
                {/* Text Input */}
                <div>
                  <label className="block text-sm font-medium mb-1">Text</label>
                  <textarea
                    value={entry.text}
                    onChange={(e) => updateEntryText(entry.id, e.target.value)}
                    placeholder="Enter text to convert to speech..."
                    className="w-full min-h-[100px] p-3 border border-border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isGenerating}
                  />
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Voice</label>
                  <select
                    value={entry.voiceId || ''}
                    onChange={(e) => updateEntryVoice(entry.id, e.target.value)}
                    className="w-full p-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isGenerating || voicesLoading}
                  >
                    <option value="">Default Voice</option>
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remove Button */}
              {entries.length > 1 && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="flex-shrink-0 p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  disabled={isGenerating}
                  title="Remove entry"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Entry Button */}
      <Button
        onClick={addEntry}
        variant="outline"
        className="w-full mb-6"
        disabled={isGenerating}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Another Entry
      </Button>

      {/* Advanced Settings */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          Advanced Settings
          {!isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Modified</span>}
        </button>

        {showAdvanced && (
          <div className="mt-4 p-4 border border-border rounded-lg bg-card space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Exaggeration: {exaggeration.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.25"
                max="2.0"
                step="0.05"
                value={exaggeration}
                onChange={(e) => updateExaggeration(parseFloat(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Controls emotion intensity (0.25-2.0)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                CFG Weight: {cfgWeight.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={cfgWeight}
                onChange={(e) => updateCfgWeight(parseFloat(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Controls pace (0.0-1.0)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Temperature: {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.05"
                max="5.0"
                step="0.05"
                value={temperature}
                onChange={(e) => updateTemperature(parseFloat(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Controls sampling randomness (0.05-5.0)
              </p>
            </div>

            <Button
              onClick={resetToDefaults}
              variant="outline"
              size="sm"
              disabled={isDefault || isGenerating}
            >
              Reset to Defaults
            </Button>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleBatchGenerate}
        disabled={isGenerating || !hasValidEntries}
        className="w-full py-6 px-6 text-lg mb-6"
      >
        <Volume2 className="w-5 h-5 mr-2" />
        {isGenerating ? 'Generating...' : 'Generate & Merge Speech'}
      </Button>

      {/* Generated Audio Player */}
      {generatedAudioUrl && (
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Merged Audio</h3>
            <button
              onClick={clearGenerated}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              title="Clear audio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <audio
            controls
            src={generatedAudioUrl}
            className="w-full mb-4"
          />

          <Button
            onClick={downloadMergedAudio}
            variant="outline"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Merged Audio
          </Button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 p-4 border border-border rounded-lg bg-muted/50">
        <h4 className="font-medium mb-2">How it works:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Add multiple text entries with different voices</li>
          <li>Each entry is generated separately using the selected voice</li>
          <li>Audio segments are automatically merged with 0.5s silence between them</li>
          <li>Download the final merged audio file</li>
        </ul>
      </div>
    </div>
  );
}
