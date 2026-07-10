'use client';

import { useCallback, useEffect, useState } from 'react';
import '@/app/geo-hud.css';
import AuditResults from '@/components/AuditResults';
import {
  focusWebsiteInput,
  GeoInputScreen,
} from '@/components/geo/GeoInputScreen';
import { GeoConfirmScreen } from '@/components/geo/GeoConfirmScreen';
import { GeoScanScreen } from '@/components/geo/GeoScanScreen';
import { HudLeftPanel } from '@/components/geo/HudLeftPanel';
import { HudRightRail } from '@/components/geo/HudRightRail';
import { HudTopBar } from '@/components/geo/HudTopBar';
import { StepRail } from '@/components/geo/StepRail';
import { useCredits } from '@/hooks/useCredits';
import { useGeoHudFlow } from '@/hooks/useGeoHudFlow';
import { usePromo } from '@/hooks/usePromo';
import { resolveBrainMode } from '@/lib/brainMode';
import { useSorenVoice, setVoiceSessionLog } from '@/lib/soren-voice/soren-voice-provider';
import { useInterrupt } from '@/lib/soren-voice/use-interrupt';
import { useSorenChatLog } from '@/lib/soren-voice/use-soren-chat-log';

export default function GeoHud() {
  const { email } = useCredits();
  const voice = useSorenVoice();
  const flow = useGeoHudFlow(voice.room);
  const promo = usePromo();
  const interrupt = useInterrupt();
  const [muted, setMuted] = useState(false);

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
    ? voice.agentBadge
    : '● AWAITING WEBSITE';

  const timerLabel =
    flow.phase === 'confirm' && !flow.editing
      ? `${flow.countdown} sec`
      : '—';

  const sysMode =
    flow.railStep.charAt(0).toUpperCase() + flow.railStep.slice(1);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    try {
      await voice.room.localParticipant.setMicrophoneEnabled(!next);
      flow.append(next ? 'Microphone muted.' : 'Microphone unmuted.');
    } catch {
      flow.append('Could not toggle microphone.');
    }
  }, [flow, muted, voice.room]);

  const startVoiceConversation = useCallback(() => {
    voice.activate();
    flow.append("I'm listening. Please say the website you want me to check.");
  }, [flow, voice]);

  const handleResetAll = useCallback(async () => {
    promo.reset();
    await flow.resetAll();
  }, [flow, promo]);

  const handleEndSession = useCallback(async () => {
    await flow.endSession();
  }, [flow]);

  const handleStop = useCallback(() => {
    interrupt();
    flow.append('Stop sent — Soren should pause mid-sentence.');
  }, [flow, interrupt]);

  return (
    <div className="geo-hud-app">
      <HudTopBar
        status={voice.statusLabel}
        muted={muted}
        onMuteToggle={() => void toggleMute()}
        onStop={handleStop}
        onEndSession={() => void handleEndSession()}
        onHome={() => void handleResetAll()}
      />
      <main className="main">
        <HudLeftPanel
          brainMode={brainMode}
          modeLine={modeLine}
          onTalk={startVoiceConversation}
          onTypeWebsite={() => {
            flow.goToInput();
            setTimeout(focusWebsiteInput, 60);
            flow.append('Type the website, then choose Scan Typed Website.');
          }}
          onViewMaster={() => {
            flow.setShowMaster(true);
            flow.setRailStep('execute');
            flow.append('Opened Master Repair Plan.');
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
                onStartVoice={startVoiceConversation}
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
                showPartner={flow.showPartner}
                onShowMaster={flow.setShowMaster}
                onShowPartner={flow.setShowPartner}
                onRailStep={flow.setRailStep}
                onLog={flow.append}
                onGoHome={flow.goToInput}
                onBackToResults={flow.backToResults}
                promo={promo}
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
    </div>
  );
}
