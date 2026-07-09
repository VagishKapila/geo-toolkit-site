'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Room } from 'livekit-client';
import { useHudLog } from '@/hooks/useHudLog';
import { useSorenEvents, type SorenEvent } from '@/lib/soren-voice/use-soren-events';
import { type RailStep } from '@/lib/geoMetrics';
import { runAudit, type GeoAudit } from '@/lib/geoApi';

export type HudPhase = 'input' | 'confirm' | 'scanning' | 'result';

export function useGeoHudFlow(room: Room) {
  const { lines, append } = useHudLog();
  const [phase, setPhase] = useState<HudPhase>('input');
  const [railStep, setRailStep] = useState<RailStep>('input');
  const [url, setUrl] = useState('');
  const [heardUrl, setHeardUrl] = useState('');
  const [countdown, setCountdown] = useState(8);
  const [editing, setEditing] = useState(false);
  const [audit, setAudit] = useState<GeoAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceRequestedFix, setVoiceRequestedFix] = useState(false);
  const [showMaster, setShowMaster] = useState(false);

  const beginScan = useCallback(async (target: string) => {
    setPhase('scanning');
    setRailStep('scan');
    setHeardUrl(target.trim());
    setError(null);
    append(`Scanning GEO signals for ${target.trim()}.`);
    try {
      const result = await runAudit(target);
      setAudit(result);
      setPhase('result');
      setRailStep('result');
      append(
        `Scan complete. Score ${result.score}. Findings are now clickable.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      setUrl(target.trim());
      setError(msg);
      setPhase('input');
      setRailStep('input');
      append(msg);
    }
  }, [append]);

  const startConfirm = useCallback((target: string) => {
    setHeardUrl(target.trim());
    setEditing(false);
    setCountdown(8);
    setPhase('confirm');
    setRailStep('confirm');
    append(`Showing 8-second confirmation for ${target.trim()}.`);
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

  const onSorenEvent = useCallback((e: SorenEvent) => {
    if (e.type === 'geo_audit_result') {
      const data = (e.data ?? e.payload) as GeoAudit;
      setAudit(data);
      setHeardUrl(data.url);
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

  const resetAll = useCallback(() => {
    setPhase('input');
    setRailStep('input');
    setUrl('');
    setHeardUrl('');
    setCountdown(8);
    setEditing(false);
    setAudit(null);
    setError(null);
    setVoiceRequestedFix(false);
    setShowMaster(false);
    append('Reset complete. Ready for website input.');
  }, [append]);

  const goToInput = useCallback(() => {
    setPhase('input');
    setRailStep('input');
  }, []);

  return {
    lines,
    append,
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
    voiceRequestedFix,
    showMaster,
    setShowMaster,
    beginScan,
    startConfirm,
    resetAll,
    goToInput,
  };
}
