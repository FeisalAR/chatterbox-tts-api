import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Upload, Trash2, Volume2, Download, X, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useApiEndpoint } from '../hooks/useApiEndpoint';
import { useVoiceLibrary } from '../hooks/useVoiceLibrary';
import { createTTSService } from '../services/tts';
import type { TTSRequest } from '../types';

interface ParsedLine {
  id: string;
  text: string;
  speakerTag: string; // e.g., "s1", "s2"
  originalLine: string;
}

interface SpeakerVoice {
  speakerTag: string;
  voiceId?: string;
  voiceName?: string;
}

export default function BatchTTSParserPage() {
  // Persistence key
  const STORAGE_KEY = 'batchTTSParserState';

  const [parsedLines, setParsedLines] = useState<ParsedLine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parsedLines && Array.isArray(parsed.parsedLines)) return parsed.parsedLines as ParsedLine[];
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [speakerVoices, setSpeakerVoices] = useState<SpeakerVoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.speakerVoices && Array.isArray(parsed.speakerVoices)) return parsed.speakerVoices as SpeakerVoice[];
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [fileName, setFileName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.fileName === 'string') return parsed.fileName;
      }
    } catch (e) {
      // ignore
    }
    return '';
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(() => {
    return null;
  });

  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.generatedAudioBase64 === 'string') return parsed.generatedAudioBase64;
      } catch {}
    }
    return null;
  });

  const [showAdvanced, setShowAdvanced] = useState(() => {
    const saved = localStorage.getItem('batchTTSParserState');
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
    const saved = localStorage.getItem('batchTTSParserState');
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
    const saved = localStorage.getItem('batchTTSParserState');
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
    const saved = localStorage.getItem('batchTTSParserState');
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


  // Hydration guard to avoid save-before-load race
  const isHydrated = useRef(false);

  // Hydrate state from localStorage on mount (parsedLines, speakerVoices, fileName, audio)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      console.debug('[BatchTTSParser] hydration: raw saved:', saved);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.debug('[BatchTTSParser] hydration: parsed:', parsed);
        if (parsed.parsedLines && Array.isArray(parsed.parsedLines)) {
          setParsedLines(parsed.parsedLines as ParsedLine[]);
        }
        if (parsed.speakerVoices && Array.isArray(parsed.speakerVoices)) {
          setSpeakerVoices(parsed.speakerVoices as SpeakerVoice[]);
        }
        if (typeof parsed.fileName === 'string') {
          setFileName(parsed.fileName);
        }
        if (typeof parsed.generatedAudioBase64 === 'string') {
          try {
            const b64 = parsed.generatedAudioBase64 as string;
            const bin = atob(b64);
            const len = bin.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            setGeneratedAudioUrl(url);
            setGeneratedAudioBase64(b64);
          } catch (e) {
            console.warn('Failed to restore audio from base64', e);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to hydrate parser state', e);
    } finally {
      isHydrated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state to localStorage on changes
  useEffect(() => {
    if (!isHydrated.current) return;
    try {
      const stateToSave = {
        parsedLines,
        speakerVoices,
        fileName,
        showAdvanced,
        exaggeration,
        cfgWeight,
        temperature,
        generatedAudioBase64
      };
      console.debug('[BatchTTSParser] saving state:', stateToSave);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save batch TTS parser state to localStorage:', e);
    }
  }, [parsedLines, speakerVoices, fileName, showAdvanced, exaggeration, cfgWeight, temperature, generatedAudioBase64]);

  const updateExaggeration = (value: number) => setExaggeration(value);
  const updateCfgWeight = (value: number) => setCfgWeight(value);
  const updateTemperature = (value: number) => setTemperature(value);

  const resetToDefaults = () => {
    setExaggeration(0.5);
    setCfgWeight(0.5);
    setTemperature(0.8);
  };

  const isDefault = exaggeration === 0.5 && cfgWeight === 0.5 && temperature === 0.8;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      parseTextFile(text, file.name);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert('Failed to read file. Please try again.');
    }
  };

  const parseTextFile = (text: string, filename: string) => {
    const lines = text.split('\n');
    const parsed: ParsedLine[] = [];
    const speakers = new Set<string>();

    // Regex to match speaker tags like [s1], [s2], etc.
    const speakerTagRegex = /^\[([a-zA-Z0-9]+)\]\s*(.*)$/;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return; // Skip empty lines

      const match = trimmedLine.match(speakerTagRegex);
      
      if (match) {
        const speakerTag = match[1];
        const textContent = match[2].trim();
        
        if (textContent) {
          speakers.add(speakerTag);
          parsed.push({
            id: crypto.randomUUID(),
            text: textContent,
            speakerTag,
            originalLine: trimmedLine
          });
        }
      } else {
        // Line without speaker tag - use default
        parsed.push({
          id: crypto.randomUUID(),
          text: trimmedLine,
          speakerTag: 'default',
          originalLine: trimmedLine
        });
        speakers.add('default');
      }
    });

    setParsedLines(parsed);
    setFileName(filename);

    // Create speaker voice assignments for all detected speakers
    const newSpeakerVoices: SpeakerVoice[] = Array.from(speakers).map(tag => ({
      speakerTag: tag,
      voiceId: undefined,
      voiceName: undefined
    }));
    setSpeakerVoices(newSpeakerVoices);
  };

  const updateSpeakerVoice = (speakerTag: string, voiceId: string) => {
    const voice = voices.find(v => v.id === voiceId);
    setSpeakerVoices(prev => 
      prev.map(sv => 
        sv.speakerTag === speakerTag 
          ? { ...sv, voiceId, voiceName: voice?.name }
          : sv
      )
    );
  };

  const updateLineText = (id: string, text: string) => {
    setParsedLines(prev =>
      prev.map(line =>
        line.id === id ? { ...line, text } : line
      )
    );
  };

  const removeLine = (id: string) => {
    setParsedLines(prev => prev.filter(line => line.id !== id));
  };

  const clearAll = () => {
    setParsedLines([]);
    setSpeakerVoices([]);
    setFileName('');
    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
      setGeneratedAudioUrl(null);
    }
    // Clear persisted base64 and saved state
    setGeneratedAudioBase64(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear localStorage', e);
    }
  };

  const handleBatchGenerate = async () => {
    if (parsedLines.length === 0) {
      alert('Please upload and parse a text file first.');
      return;
    }

    setIsGenerating(true);
    const audioBlobs: Blob[] = [];

    // Warm-up
    try {
      const warmupText = "This is a warm-up test. Are you ready?";
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
      // Process each parsed line
      for (const line of parsedLines) {
        const speakerVoice = speakerVoices.find(sv => sv.speakerTag === line.speakerTag);
        
        const requestData: TTSRequest = {
          input: line.text,
          exaggeration,
          cfg_weight: cfgWeight,
          temperature
        };

        if (speakerVoice?.voiceName) {
          requestData.voice = speakerVoice.voiceName;
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

      // Also save base64 of merged audio so it persists across reloads
      try {
        const arrayBuffer = await mergedBlob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
        const b64 = btoa(binary);
        setGeneratedAudioBase64(b64);
      } catch (e) {
        console.warn('Failed to serialize merged audio to base64', e);
      }

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
    link.download = `batch-tts-parsed-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearGenerated = () => {
    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
      setGeneratedAudioUrl(null);
      setGeneratedAudioBase64(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Batch TTS Text Parser</h1>
        <p className="text-muted-foreground">
          Upload a text file with speaker tags and generate speech with different voices for each speaker.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="mb-6 p-6 border-2 border-dashed border-border rounded-lg bg-card">
        <div className="flex flex-col items-center justify-center space-y-4">
          <FileText className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Upload Text File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Format: Each line should start with [s1], [s2], etc. for speaker tags
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isGenerating}
            />
            <Button asChild disabled={isGenerating}>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Choose Text File
              </span>
            </Button>
          </label>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>{fileName}</span>
              {parsedLines.length > 0 && (
                <>
                  <span className="mx-2">•</span>
                  <span>{parsedLines.length} lines parsed</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Speaker Voice Assignment */}
      {speakerVoices.length > 0 && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <h3 className="text-lg font-semibold mb-4">Speaker Voice Assignment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {speakerVoices.map((speaker) => (
              <div key={speaker.speakerTag} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-20">
                  <span className="text-sm font-medium text-muted-foreground">
                    [{speaker.speakerTag}]
                  </span>
                </div>
                <select
                  value={speaker.voiceId || ''}
                  onChange={(e) => updateSpeakerVoice(speaker.speakerTag, e.target.value)}
                  className="flex-1 p-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
            ))}
          </div>
        </div>
      )}

      {/* Parsed Lines */}
      {parsedLines.length > 0 && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Parsed Lines ({parsedLines.length})</h3>
            <Button
              onClick={clearAll}
              variant="outline"
              size="sm"
              disabled={isGenerating}
            >
              Clear All
            </Button>
          </div>
          {parsedLines.map((line, index) => (
            <div key={line.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      [{line.speakerTag}]
                    </span>
                    {speakerVoices.find(sv => sv.speakerTag === line.speakerTag)?.voiceName && (
                      <span className="text-xs text-muted-foreground">
                        → {speakerVoices.find(sv => sv.speakerTag === line.speakerTag)?.voiceName}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={line.text}
                    onChange={(e) => updateLineText(line.id, e.target.value)}
                    placeholder="Text content..."
                    className="w-full min-h-[80px] p-3 border border-border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isGenerating}
                  />
                </div>

                <button
                  onClick={() => removeLine(line.id)}
                  className="flex-shrink-0 p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  disabled={isGenerating}
                  title="Remove line"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advanced Settings */}
      {parsedLines.length > 0 && (
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
      )}

      {/* Generate Button */}
      {parsedLines.length > 0 && (
        <Button
          onClick={handleBatchGenerate}
          disabled={isGenerating || parsedLines.length === 0}
          className="w-full py-6 px-6 text-lg mb-6"
        >
          <Volume2 className="w-5 h-5 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate & Merge Speech'}
        </Button>
      )}

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
          <li>Upload a text file where each line starts with a speaker tag like [s1], [s2]</li>
          <li>Assign a voice to each detected speaker</li>
          <li>Lines without speaker tags will use the default voice</li>
          <li>Edit any line before generating if needed</li>
          <li>Audio segments are automatically merged with 0.5s silence between them</li>
        </ul>
        <div className="mt-3 p-3 bg-background rounded text-xs font-mono">
          <div className="font-semibold mb-1">Example format:</div>
          <div>[s1] Hello, how are you?</div>
          <div>[s2] I'm doing great, thanks!</div>
          <div>[s1] That's wonderful to hear.</div>
        </div>
      </div>
    </div>
  );
}
