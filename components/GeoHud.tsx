'use client';

import { useSession } from '@livekit/components-react';
import type { Room } from 'livekit-client';
import '@/app/geo-hud.css';
import { AudioUnlockButton } from '@/components/AudioUnlockButton';
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
  const flow = useGeoHudFlow(session, room);

  const handleTalk = () => {
    void unlockAudioContext().then(() => session.start());
    flow.append('Connecting to Soren voice…');
  };

  const modeLine = flow.connected
    ? `● ${flow.status}`
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
      <AudioUnlockButton />
      <HudTopBar status={flow.status} onHome={flow.resetAll} />
      <main className="main">
        <HudLeftPanel
          brainMode={flow.brainMode}
          modeLine={modeLine}
          connected={flow.connected}
          onTalk={handleTalk}
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
