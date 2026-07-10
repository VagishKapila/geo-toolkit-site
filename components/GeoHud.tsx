'use client';

import { useEffect } from 'react';
import '@/app/geo-hud.css';
import AuditResults from '@/components/AuditResults';
import { GeoConfirmScreen } from '@/components/geo/GeoConfirmScreen';
import { GeoInputScreen } from '@/components/geo/GeoInputScreen';
import { GeoScanScreen } from '@/components/geo/GeoScanScreen';
import { HudBottomBar } from '@/components/geo/HudBottomBar';
import { HudLeftPanel } from '@/components/geo/HudLeftPanel';
import { HudRightRail } from '@/components/geo/HudRightRail';
import { HudTopBar } from '@/components/geo/HudTopBar';
import { StepRail } from '@/components/geo/StepRail';
import { useCredits } from '@/hooks/useCredits';
import { useGeoHudFlow } from '@/hooks/useGeoHudFlow';
import { resolveBrainMode } from '@/lib/brainMode';
import { useSorenVoice, setVoiceSessionLog } from '@/lib/soren-voice/soren-voice-provider';
import { useSorenChatLog } from '@/lib/soren-voice/use-soren-chat-log';

export default function GeoHud() {
  const { email } = useCredits();
  const voice = useSorenVoice();
  const flow = useGeoHudFlow(voice.room);
  useSorenChatLog(flow.append);

  useEffect(() => {
    setVoiceSessionLog(flow.append);
    return () => setVoiceSessionLog(null);
  }, [flow.append]);

  const brainMode = resolveBrainMode(
    flow.phase,
    voice.rawAgentState,
    voice.isConnected,
    flow.voiceRequestedFix,
  );

  const modeLine = voice.isConnected
    ? `● ${voice.agentBadge}`
    : '● AWAITING WEBSITE';

  const timerLabel =
    flow.phase === 'confirm' && !flow.editing
      ? `${flow.countdown} sec`
      : '—';

  const sysMode =
    flow.railStep.charAt(0).toUpperCase() + flow.railStep.slice(1);

  const bottomText =
    flow.phase === 'input' ? 'Ready for website input.' : `${sysMode}…`;

  return (
    <div className="geo-hud-app">
      <HudTopBar status={voice.statusLabel} onHome={flow.resetAll} />
      <main className="main">
        <HudLeftPanel
          brainMode={brainMode}
          modeLine={modeLine}
          connected={voice.isConnected}
          onTalk={voice.activate}
          onTypedStart={() => {
            if (flow.url.trim()) flow.startConfirm(flow.url);
            else flow.goToInput();
          }}
          onViewMaster={() => {
            flow.setShowMaster(true);
            flow.setRailStep('execute');
            flow.append('Jumped to Master Repair Plan.');
          }}
          hasResult={!!flow.audit}
        />
        <section className="center">
          <StepRail active={flow.railStep} />
          <section className="panel workspace">
            {flow.phase === 'input' && (
              <GeoInputScreen
                url={flow.url}
                error={flow.error}
                onUrlChange={flow.setUrl}
                onStart={() => flow.startConfirm(flow.url)}
              />
            )}
            {flow.phase === 'confirm' && (
              <GeoConfirmScreen
                heardUrl={flow.heardUrl}
                countdown={flow.countdown}
                editing={flow.editing}
                onEdit={() => {
                  flow.setEditing(true);
                  flow.append('Timer paused. Edit spelling or resume countdown.');
                }}
                onConfirmNow={() => void flow.beginScan(flow.heardUrl)}
                onHeardChange={flow.setHeardUrl}
                onSaveScan={() => void flow.beginScan(flow.heardUrl)}
                onResume={() => {
                  flow.setEditing(false);
                  flow.setCountdown(8);
                  flow.append('Countdown resumed.');
                }}
              />
            )}
            {flow.phase === 'scanning' && (
              <GeoScanScreen heardUrl={flow.heardUrl} />
            )}
            {flow.phase === 'result' && flow.audit && (
              <AuditResults
                audit={flow.audit}
                autoOpenFix={flow.voiceRequestedFix}
                email={email ?? ''}
                showMaster={flow.showMaster}
                onShowMaster={flow.setShowMaster}
                onRailStep={flow.setRailStep}
                onLog={flow.append}
              />
            )}
          </section>
        </section>
        <HudRightRail
          mode={sysMode}
          timerLabel={timerLabel}
          audit={flow.audit}
          lines={flow.lines}
        />
      </main>
      <HudBottomBar
        bottomText={bottomText}
        onInput={flow.goToInput}
        onReset={flow.resetAll}
      />
    </div>
  );
}
