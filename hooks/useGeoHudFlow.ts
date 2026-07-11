'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { useHudLog } from '@/hooks/useHudLog';
import {
  extractWebsiteFromSpeech,
  isSorenEcho,
} from '@/lib/extractWebsiteFromSpeech';
import { useSorenEvents, type SorenEvent } from '@/lib/soren-voice/use-soren-events';
import {
  resetVoiceSession,
  teardownSession,
} from '@/lib/soren-voice/session-lifecycle';
import { type RailStep } from '@/lib/geoMetrics';
import { runAudit, looksLikeWebsite, type GeoAudit } from '@/lib/geoApi';

export type HudPhase = 'input' | 'confirm' | 'scanning' | 'scan_failed' | 'result';

function displayUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');
}

export function useGeoHudFlow(room: Room) {
  const { lines, append, clear } = useHudLog();
  const [phase, setPhase] = useState<HudPhase>('input');
  const [railStep, setRailStep] = useState<RailStep>('input');
  const [url, setUrlState] = useState('');
  const [heardUrl, setHeardUrl] = useState('');
  const [countdown, setCountdown] = useState(8);
  const [editing, setEditing] = useState(false);
  const [audit, setAudit] = useState<GeoAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [voiceRequestedFix, setVoiceRequestedFix] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [scanInFlight, setScanInFlight] = useState(false);
  const [urlDetectionEnabled, setUrlDetectionEnabled] = useState(true);
  const processedVoiceRef = useRef<Set<string>>(new Set());

  const recoverVoiceAfterScanError = useCallback(async () => {
    resetVoiceSession();
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch {
      /* room may not be connected yet */
    }
    console.log('[voice] scan error recovery — mic/session reset');
  }, [room]);

  const setUrl = useCallback((value: string) => {
    setUrlState(value);
    setError(null);
  }, []);

  const clearFlowState = useCallback(() => {
    processedVoiceRef.current.clear();
    setPhase('input');
    setRailStep('input');
    setUrlState('');
    setHeardUrl('');
    setCountdown(8);
    setEditing(false);
    setAudit(null);
    setError(null);
    setScanError(null);
    setVoiceRequestedFix(false);
    setShowMaster(false);
    setShowPartner(false);
    clear();
  }, [clear]);

  const beginScan = useCallback(async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) {
      const msg = 'Enter a website address before scanning.';
      setError(msg);
      setPhase('input');
      setRailStep('input');
      append(msg);
      return;
    }
    if (!looksLikeWebsite(trimmed)) {
      const msg =
        "That doesn't look like a valid website. Try a domain like example.com.";
      setUrl(trimmed);
      setError(msg);
      setPhase('input');
      setRailStep('input');
      append(msg);
      return;
    }

    setPhase('scanning');
    setRailStep('scan');
    setHeardUrl(trimmed);
    setError(null);
    setScanError(null);
    setUrlDetectionEnabled(false);
    setScanInFlight(true);
    append(`Scanning GEO signals for ${trimmed}.`);
    try {
      const result = await runAudit(trimmed);
      setAudit(result);
      setPhase('result');
      setRailStep('result');
      append(
        `Scan complete. Score ${result.score}. Findings are now clickable.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      setUrl(trimmed);
      setScanError(msg);
      setPhase('scan_failed');
      setRailStep('input');
      setUrlDetectionEnabled(true);
      processedVoiceRef.current.clear();
      void recoverVoiceAfterScanError();
      append(`Scan failed: ${msg}`);
    } finally {
      setScanInFlight(false);
    }
  }, [append, recoverVoiceAfterScanError, setUrl]);

  const startConfirm = useCallback((target: string) => {
    const normalized = displayUrl(target);
    if (!looksLikeWebsite(normalized)) {
      const msg =
        "That doesn't look like a valid website. Try a domain like example.com.";
      setUrl(target.trim());
      setError(msg);
      append(msg);
      return;
    }
    setHeardUrl(normalized);
    setEditing(false);
    setCountdown(8);
    setUrlDetectionEnabled(false);
    setPhase('confirm');
    setRailStep('confirm');
    append(`Showing 8-second confirmation for ${normalized}.`);
  }, [append]);

  useEffect(() => {
    if (phase !== 'confirm' || editing) return;
    if (countdown <= 0) {
      void beginScan(heardUrl);
      return;
    }
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [phase, editing, countdown, heardUrl, beginScan]);

  useEffect(() => {
    if (!urlDetectionEnabled || phase !== 'input') return;
    for (const line of lines) {
      if (!line.startsWith('You: ')) continue;
      const text = line.slice(5);
      if (processedVoiceRef.current.has(text)) continue;
      if (isSorenEcho(text)) continue;
      const site = extractWebsiteFromSpeech(text);
      if (!site) continue;
      processedVoiceRef.current.add(text);
      startConfirm(displayUrl(site));
      break;
    }
  }, [lines, phase, startConfirm, urlDetectionEnabled]);

  const onSorenEvent = useCallback((e: SorenEvent) => {
    if (e.type === 'geo_audit_result') {
      const data = (e.data ?? e.payload) as GeoAudit;
      setAudit(data);
      setHeardUrl(displayUrl(data.url));
      setPhase('result');
      setRailStep('result');
      append(`Voice audit complete. Score ${data.score}.`);
    }
    if (e.type === 'show_fix_modal') {
      setVoiceRequestedFix(true);
      setPhase('result');
      setRailStep('execute');
      append('Master Repair Plan requested by voice.');
    }
  }, [append]);
  useSorenEvents(room, onSorenEvent);

  const resetAll = useCallback(async () => {
    clearFlowState();
    try {
      await teardownSession(room);
    } catch {
      /* ignore disconnect errors */
    }
    append('Reset complete. Ready for website input.');
  }, [append, clearFlowState, room]);

  const prepareNewConversation = useCallback(async () => {
    clearFlowState();
    try {
      await teardownSession(room);
    } catch {
      /* ignore disconnect errors */
    }
  }, [clearFlowState, room]);

  const endSession = useCallback(async () => {
    try {
      await teardownSession(room);
    } catch {
      /* ignore */
    }
    append('Session ended. Use Home to begin again.');
  }, [append, room]);

  const goToInput = useCallback(() => {
    setPhase('input');
    setRailStep('input');
    setShowMaster(false);
    setShowPartner(false);
    setEditing(false);
    setScanError(null);
    setUrlDetectionEnabled(true);
    append('Returned home. Enter a new website when ready.');
  }, [append]);

  const retryScan = useCallback(() => {
    void beginScan(heardUrl || url);
  }, [beginScan, heardUrl, url]);

  const backToResults = useCallback(() => {
    setShowMaster(false);
    setShowPartner(false);
    setRailStep('result');
    append('Returned to the results screen to review findings.');
  }, [append]);

  return {
    lines,
    append,
    clear,
    phase,
    railStep,
    setRailStep,
    url,
    setUrl,
    heardUrl,
    setHeardUrl,
    countdown,
    setCountdown,
    editing,
    setEditing,
    audit,
    error,
    scanError,
    scanInFlight,
    voiceRequestedFix,
    showMaster,
    setShowMaster,
    showPartner,
    setShowPartner,
    beginScan,
    startConfirm,
    resetAll,
    prepareNewConversation,
    endSession,
    goToInput,
    retryScan,
    backToResults,
  };
}
