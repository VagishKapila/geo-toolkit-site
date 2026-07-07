'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type STTState = 'idle' | 'listening' | 'processing';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface UseSorenSTTReturn {
  state: STTState;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
}

export function useSorenSTT(onResult: (text: string) => void): UseSorenSTTReturn {
  const [state, setState] = useState<STTState>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stateRef = useRef<STTState>('idle');

  const getRecognitionConstructor = (): SpeechRecognitionCtor | null => {
    if (typeof window === 'undefined') return null;
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  };

  const isSupported = getRecognitionConstructor() !== null;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState('idle');
  }, []);

  const startListening = useCallback(() => {
    const SR = getRecognitionConstructor();
    if (!SR) return;

    recognitionRef.current?.stop();
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const results = Array.from(event.results);
      const current = results
        .map((result) => result[0]?.transcript ?? '')
        .join('')
        .trim();
      setTranscript(current);

      const lastResult = results[results.length - 1];
      if (lastResult?.isFinal && current.length > 0) {
        setState('processing');
        onResult(current);
      }
    };

    recognition.onerror = () => {
      setState('idle');
    };

    recognition.onend = () => {
      if (stateRef.current !== 'processing') {
        setState('idle');
      }
    };

    recognition.start();
  }, [onResult]);

  useEffect(() => {
    if (state !== 'processing') return;
    const timer = setTimeout(() => {
      setState('idle');
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  return { state, transcript, startListening, stopListening, isSupported };
}
