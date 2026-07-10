'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@/app/geo-hud.css';
import AuditResults from '@/components/AuditResults';
import {
  focusWebsiteInput,
  GeoInputScreen,
} from '@/components/geo/GeoInputScreen';
import { GeoConfirmScreen } from '@/components/geo/GeoConfirmScreen';
import { GeoScanErrorScreen } from '@/components/geo/GeoScanErrorScreen';
import { GeoScanScreen } from '@/components/geo/GeoScanScreen';
import { HudLeftPanel } from '@/components/geo/HudLeftPanel';
import { HudRightRail } from '@/components/geo/HudRightRail';
import { HudTopBar } from '@/components/geo/HudTopBar';
import { StepRail } from '@/components/geo/StepRail';
import { useCredits } from '@/hooks/useCredits';
import { useGeoHudFlow } from '@/hooks/useGeoHudFlow';
import { usePromo } from '@/hooks/usePromo';
import { useTranscriptLog } from '@/hooks/useTranscriptLog';
import { resolveBrainMode } from '@/lib/brainMode';
import { useSorenVoice, setVoiceSessionLog } from '@/lib/soren-voice/soren-voice-provider';
import { FixPackageDelivered } from '@/components/geo/FixPackageDelivered';
import { BookingConfirmed } from '@/components/geo/BookingConfirmed';
import {
  CALENDLY,
  deliverAiPackageFromStored,
  downloadFixZip,
  type FixPackageResponse,
  type StoredAiPackageData,
} from '@/lib/fixDeliveryActions';
import { useInterrupt } from '@/lib/soren-voice/use-interrupt';

export default function GeoHud() {
  const { email } = useCredits();
  const voice = useSorenVoice();
  const flow = useGeoHudFlow(voice.room);
  const promo = usePromo();
  const interrupt = useInterrupt();
  const [muted, setMuted] = useState(false);
  const [checkoutDelivery, setCheckoutDelivery] = useState<{
    pkg: FixPackageResponse;
    siteUrl: string;
  } | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const handledCheckoutRef = useRef(false);

  useEffect(() => {
    if (handledCheckoutRef.current) return;
    const params = new URLSearchParams(window.location.search);

    const bookingReturn =
      params.get('call_success') === 'true'
      || params.get('booking_success') === 'true';

    if (bookingReturn) {
      handledCheckoutRef.current = true;
      const calendly = params.get('calendly') || CALENDLY;
      window.history.replaceState({}, '', window.location.pathname);
      window.open(calendly, '_blank', 'noopener,noreferrer');
      setBookingConfirmed(true);
      flow.append('Payment confirmed — book your screen-share session on Calendly.');
      return;
    }

    if (params.get('ai_package_success') !== 'true') return;

    handledCheckoutRef.current = true;

    const raw = sessionStorage.getItem('soren_ai_package_data');
    window.history.replaceState({}, '', window.location.pathname);
    if (!raw) {
      flow.append(
        'Payment received — reopen Master Plan from your scan to download your AI package.',
      );
      return;
    }

    let data: StoredAiPackageData;
    try {
      data = JSON.parse(raw) as StoredAiPackageData;
    } catch {
      flow.append('Could not restore AI package session. Re-scan your site.');
      return;
    }
    sessionStorage.removeItem('soren_ai_package_data');

    void (async () => {
      try {
        flow.append('AI Assist payment confirmed — building your ZIP…');
        const pkg = await deliverAiPackageFromStored(data);
        setCheckoutDelivery({ pkg, siteUrl: data.siteInfo.url });
        flow.append(
          'ZIP downloaded. Open README.md, then paste PROMPT.txt into ChatGPT or Claude.',
        );
      } catch {
        flow.append('Could not build AI package. Try again from Master Plan.');
      }
    })();
    // Mount-only: handle Stripe return URLs once (sessionStorage is consumed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.append]);


  useTranscriptLog(voice.room, {
    onUserLine: (text) => flow.append(`You: ${text}`),
    onSorenLine: (text) => flow.append(`Soren: ${text}`),
  });

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

  const setMicEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        await voice.room.localParticipant.setMicrophoneEnabled(enabled);
      } catch {
        /* ignore */
      }
    },
    [voice.room],
  );

  const pauseConfirmEdit = useCallback(() => {
    interrupt();
    flow.setEditing(true);
    void setMicEnabled(false);
    flow.append('Timer paused. Edit spelling or resume countdown.');
  }, [flow, interrupt, setMicEnabled]);

  const resumeConfirmEdit = useCallback(() => {
    flow.setEditing(false);
    flow.setCountdown(8);
    if (!muted) void setMicEnabled(true);
    flow.append('Countdown resumed.');
  }, [flow, muted, setMicEnabled]);

  const saveConfirmAndScan = useCallback(() => {
    interrupt();
    if (!muted) void setMicEnabled(true);
    flow.setEditing(false);
    void flow.beginScan(flow.heardUrl);
  }, [flow, interrupt, muted, setMicEnabled]);

  const startVoiceConversation = useCallback(async () => {
    if (voice.isConnected) {
      await flow.prepareNewConversation();
      voice.activate();
      flow.append('Starting a fresh conversation.');
      return;
    }
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
          connected={voice.isConnected}
          onTalk={() => void startVoiceConversation()}
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
            {bookingConfirmed && (
              <BookingConfirmed onClose={() => setBookingConfirmed(false)} />
            )}
            {!bookingConfirmed && checkoutDelivery && (
              <FixPackageDelivered
                pkg={checkoutDelivery.pkg}
                siteUrl={checkoutDelivery.siteUrl}
                tier="ai"
                onClose={() => setCheckoutDelivery(null)}
                onRedownload={() =>
                  void downloadFixZip(
                    checkoutDelivery.pkg,
                    checkoutDelivery.siteUrl,
                    'ai',
                  )
                }
              />
            )}
            {!bookingConfirmed && !checkoutDelivery && flow.phase === 'input' && (
              <GeoInputScreen
                url={flow.url}
                error={flow.error}
                onUrlChange={flow.setUrl}
                onStart={() => flow.startConfirm(flow.url)}
                onStartVoice={() => void startVoiceConversation()}
              />
            )}
            {!bookingConfirmed && !checkoutDelivery && flow.phase === 'confirm' && (
              <GeoConfirmScreen
                heardUrl={flow.heardUrl}
                countdown={flow.countdown}
                editing={flow.editing}
                onEdit={pauseConfirmEdit}
                onConfirmNow={() => void flow.beginScan(flow.heardUrl)}
                onHeardChange={flow.setHeardUrl}
                onSaveScan={saveConfirmAndScan}
                onResume={resumeConfirmEdit}
              />
            )}
            {!bookingConfirmed && !checkoutDelivery && flow.phase === 'scanning' && (
              <GeoScanScreen heardUrl={flow.heardUrl} />
            )}
            {!bookingConfirmed && !checkoutDelivery && flow.phase === 'scan_failed' && flow.scanError && (
              <GeoScanErrorScreen
                url={flow.heardUrl || flow.url}
                message={flow.scanError}
                onTryAgain={flow.retryScan}
                onEditUrl={() => {
                  flow.setUrl(flow.heardUrl || flow.url);
                  flow.goToInput();
                  setTimeout(focusWebsiteInput, 60);
                }}
              />
            )}
            {!bookingConfirmed && !checkoutDelivery && flow.phase === 'result' && flow.audit && (
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
