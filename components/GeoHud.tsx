'use client';

import { useCallback, useEffect, useState } from 'react';
import { useVoiceAssistant, useSession } from '@livekit/components-react';
import type { Room } from 'livekit-client';
import { AudioUnlockButton } from '@/components/AudioUnlockButton';
import AuditResults from '@/components/AuditResults';
import { GeoConfirmScreen } from '@/components/geo/GeoConfirmScreen';
import { SorenBrain } from '@/components/SorenBrain';
import { useCredits } from '@/hooks/useCredits';
import { useSorenEvents, type SorenEvent } from '@/hooks/useSorenEvents';
import { resolveBrainMode } from '@/lib/brainMode';
import { runAudit, type GeoAudit } from '@/lib/geoApi';

type Phase = 'input' | 'confirm' | 'scanning' | 'result';

interface Props {
  session: ReturnType<typeof useSession>;
  room: Room;
}

async function unlockAudioContext() {
  try {
    const AC =
      window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    await ctx.resume();
    ctx.close();
  } catch {
    /* best-effort */
  }
}

export default function GeoHud({ session, room }: Props) {
  const { email } = useCredits();
  const [phase, setPhase] = useState<Phase>('input');
  const [url, setUrl] = useState('');
  const [heardUrl, setHeardUrl] = useState('');
  const [countdown, setCountdown] = useState(8);
  const [editing, setEditing] = useState(false);
  const [audit, setAudit] = useState<GeoAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceRequestedFix, setVoiceRequestedFix] = useState(false);

  const { state: agentState } = useVoiceAssistant();
  const connected =
    agentState !== 'disconnected'
    && agentState !== undefined
    && agentState !== 'failed';

  const beginScan = useCallback(async (target: string) => {
    setPhase('scanning');
    setHeardUrl(target.trim());
    setError(null);
    try {
      setAudit(await runAudit(target));
      setPhase('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setPhase('input');
    }
  }, []);

  const startConfirm = useCallback((target: string) => {
    setHeardUrl(target.trim());
    setEditing(false);
    setCountdown(8);
    setPhase('confirm');
  }, []);

  useEffect(() => {
    if (phase !== 'confirm' || editing) return;
    if (countdown <= 0) {
      void beginScan(heardUrl);
      return;
    }
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [phase, editing, countdown, heardUrl, beginScan]);

  const onSorenEvent = useCallback(
    (e: SorenEvent) => {
      if (e.type === 'geo_audit_result') {
        const data = (e.data ?? e.payload) as GeoAudit;
        setAudit(data);
        setHeardUrl(data.url);
        setPhase('result');
      }
      if (e.type === 'show_fix_modal') {
        setVoiceRequestedFix(true);
        setPhase('result');
      }
    },
    [],
  );
  useSorenEvents(room, onSorenEvent);

  const brainMode = resolveBrainMode(
    phase,
    agentState,
    connected,
    voiceRequestedFix,
  );

  const handleTalk = () => {
    void unlockAudioContext().then(() => session.start());
  };

  return (
    <div className="geo-hud">
      <AudioUnlockButton />
      <aside className="geo-panel geo-left">
        <SorenBrain mode={brainMode} fullscreen />
        <div className="geo-mode">
          {connected ? `● ${String(agentState).toUpperCase()}` : '● AWAITING WEBSITE'}
        </div>
        {!connected && (
          <button type="button" className="geo-btn geo-btn-primary" onClick={handleTalk}>
            TALK TO SOREN
          </button>
        )}
      </aside>

      <main className="geo-panel geo-center">
        {phase === 'input' && (
          <section className="geo-screen">
            <h2>Type or speak the website.</h2>
            <p className="geo-lead">
              Enter a URL or talk to Soren. You will get an 8-second confirmation
              card before the scan runs.
            </p>
            <div className="geo-urlbox">
              <input
                value={url}
                placeholder="varshyl.com"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && url && startConfirm(url)}
              />
              <button
                type="button"
                className="geo-btn geo-btn-primary"
                disabled={!url.trim()}
                onClick={() => startConfirm(url)}
              >
                CHECK WEBSITE
              </button>
            </div>
            {error && <p className="geo-error">{error}</p>}
          </section>
        )}

        {phase === 'confirm' && (
          <GeoConfirmScreen
            heardUrl={heardUrl}
            countdown={countdown}
            editing={editing}
            onEdit={() => setEditing(true)}
            onConfirmNow={() => void beginScan(heardUrl)}
            onHeardChange={setHeardUrl}
            onSaveScan={() => void beginScan(heardUrl)}
            onResume={() => {
              setEditing(false);
              setCountdown(8);
            }}
          />
        )}

        {phase === 'scanning' && (
          <section className="geo-screen">
            <h2>Scanning {heardUrl}…</h2>
            <ul className="geo-scanlist">
              <li>AI discoverability / GEO signals</li>
              <li>AI crawler rules</li>
              <li>Structured data</li>
              <li>Content clarity</li>
            </ul>
          </section>
        )}

        {phase === 'result' && audit && (
          <AuditResults
            audit={audit}
            autoOpenFix={voiceRequestedFix}
            email={email ?? ''}
            onReset={() => {
              setAudit(null);
              setVoiceRequestedFix(false);
              setUrl('');
              setPhase('input');
            }}
          />
        )}
      </main>
    </div>
  );
}
