import { useState, useRef, useCallback } from 'react';

export type RecorderErrorCode = 'permission_denied' | 'device_unavailable' | 'format_unsupported' | 'unknown'

export interface RecorderError {
  code: RecorderErrorCode
  message: string
}

function classifyRecorderError(err: any): RecorderError {
  const name = err?.name || ''
  const msg = err?.message || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return { code: 'permission_denied', message: 'Microphone access was denied. Allow microphone permissions in your browser settings and try again.' }
  }
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') {
    return { code: 'device_unavailable', message: 'No microphone detected or the device is busy. Connect a microphone and try again.' }
  }
  if (msg.includes('mimetype') || msg.includes('MediaRecorder')) {
    return { code: 'format_unsupported', message: 'Your browser does not support a compatible recording format (webm/mp4).' }
  }
  return { code: 'unknown', message: `Recording failed: ${msg || 'Unknown error'}` }
}

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recorderError, setRecorderError] = useState<RecorderError | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setRecorderError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Validate MIME type support before constructing MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : null;

      if (!mimeType) {
        stream.getTracks().forEach(t => t.stop());
        setRecorderError({ code: 'format_unsupported', message: 'Your browser does not support a compatible recording format (webm/mp4).' });
        return;
      }
        
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Set up audio analysis for visualizer
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          // Normalize to 0-100 range
          const normalized = Math.min(100, (average / 128) * 100);
          setAudioLevel(normalized);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      updateAudioLevel();
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording', err);
      setRecorderError(classifyRecorderError(err));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setDuration(0);
    setAudioLevel(0);
    setRecorderError(null);
  }, []);

  return {
    isRecording,
    audioBlob,
    duration,
    audioLevel,
    recorderError,
    clearRecorderError: useCallback(() => setRecorderError(null), []),
    startRecording,
    stopRecording,
    resetRecording
  };
};

