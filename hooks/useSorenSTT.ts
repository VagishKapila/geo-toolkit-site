'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSorenEcho } from '../lib/extractWebsiteFromSpeech';

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

const LISTEN_TIMEOUT_MS = 20_000;

export function useSorenSTT(onResult: (text: string) => void): UseSorenSTTReturn {
  const [state, setState] = useState<STTState>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stateRef = useRef<STTState>('idle');
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

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

  const clearListenTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    clearListenTimeout();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState('idle');
  }, [clearListenTimeout]);

  const startRecognition = useCallback(() => {
    const SR = getRecognitionConstructor();
    if (!SR || !activeRef.current) return;

    recognitionRef.current?.stop();
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const results = Array.from(event.results);
      const current = results
        .map((result) => result[0]?.transcript ?? '')
        .join('')
        .trim();
      setTranscript(current);

      const lastResult = results[results.length - 1];
      if (!lastResult?.isFinal || current.length === 0) return;
      if (isSorenEcho(current)) return;

      setState('processing');
      activeRef.current = false;
      clearListenTimeout();
      recognition.stop();
      onResultRef.current(current);
    };

    recognition.onerror = () => {
      if (activeRef.current) {
        activeRef.current = false;
        setState('idle');
      }
    };

    recognition.onend = () => {
      if (activeRef.current && stateRef.current === 'listening') {
        startRecognition();
      } else if (stateRef.current !== 'processing') {
        setState('idle');
      }
    };

    try {
      recognition.start();
    } catch {
      activeRef.current = false;
      setState('idle');
    }
  }, [clearListenTimeout]);

  const startListening = useCallback(() => {
    const SR = getRecognitionConstructor();
    if (!SR) return;

    activeRef.current = true;
    setTranscript('');
    clearListenTimeout();
    timeoutRef.current = setTimeout(() => {
      if (activeRef.current) stopListening();
    }, LISTEN_TIMEOUT_MS);

    startRecognition();
  }, [clearListenTimeout, startRecognition, stopListening]);

  useEffect(() => {
    if (state !== 'processing') return;
    const timer = setTimeout(() => {
      setState('idle');
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => () => {
    activeRef.current = false;
    clearListenTimeout();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, [clearListenTimeout]);

  return { state, transcript, startListening, stopListening, isSupported };
}
