'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/app/geo-hud.css';
import { ConnectionState, RoomEvent } from 'livekit-client';
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
import { VoiceStatusBanner } from '@/components/geo/VoiceStatusBanner';
import { useInterrupt } from '@/lib/soren-voice/use-interrupt';
import { teardownSession } from '@/lib/soren-voice/session-lifecycle';

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
  const [voiceActivating, setVoiceActivating] = useState(false);
  const [voiceConnectionFailed, setVoiceConnectionFailed] = useState(false);
  const [roomState, setRoomState] = useState(voice.room.state);
  const handledCheckoutRef = useRef(false);
  const connectionTimeoutRef = useRef<number | null>(null);
  const voicePendingRef = useRef({
    voiceActivating: false,
    roomState: voice.room.state,
    isConnected: false,
    rawAgentState: voice.rawAgentState,
  });

  voicePendingRef.current = {
    voiceActivating,
    roomState,
    isConnected: voice.isConnected,
    rawAgentState: voice.rawAgentState,
  };

  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current != null) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const isVoiceConnectionPending = useCallback(() => {
    const s = voicePendingRef.current;
    return (
      s.voiceActivating
      || s.roomState === ConnectionState.Connecting
      || s.roomState === ConnectionState.Reconnecting
      || s.roomState === ConnectionState.SignalReconnecting
      || (s.isConnected && s.rawAgentState === 'connecting')
    );
  }, []);

  useEffect(() => {
    const onStateChange = () => setRoomState(voice.room.state);
    voice.room.on(RoomEvent.ConnectionStateChanged, onStateChange);
    return () => {
      voice.room.off(RoomEvent.ConnectionStateChanged, onStateChange);
    };
  }, [voice.room]);

  useEffect(() => {
    if (voice.isConnected) {
      setVoiceActivating(false);
      setVoiceConnectionFailed(false);
    }
    if (
      voice.isConnected
      && voice.rawAgentState !== 'connecting'
      && roomState === ConnectionState.Connected
    ) {
      clearConnectionTimeout();
    }
  }, [
    clearConnectionTimeout,
    roomState,
    voice.isConnected,
    voice.rawAgentState,
  ]);

  useEffect(() => {
    if (voiceConnectionFailed) {
      clearConnectionTimeout();
      return;
    }

    if (!isVoiceConnectionPending()) {
      clearConnectionTimeout();
      return;
    }

    clearConnectionTimeout();
    connectionTimeoutRef.current = window.setTimeout(() => {
      connectionTimeoutRef.current = null;
      if (!isVoiceConnectionPending()) return;

      void (async () => {
        try {
          await teardownSession(voice.room);
        } catch {
          /* ignore */
        }
        setVoiceActivating(false);
        setVoiceConnectionFailed(true);
        flow.append('Voice connection timed out — tap Talk to Soren to retry.');
        console.log('[voice] connection timeout — forced teardown');
      })();
    }, 10_000);

    return clearConnectionTimeout;
  }, [
    clearConnectionTimeout,
    flow,
    isVoiceConnectionPending,
    roomState,
    voice.isConnected,
    voice.rawAgentState,
    voice.room,
    voiceActivating,
    voiceConnectionFailed,
  ]);

  useEffect(() => () => clearConnectionTimeout(), [clearConnectionTimeout]);

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

  const topStatus = flow.scanInFlight ? 'SCANNING' : voice.statusLabel;

  const timerLabel =
    flow.phase === 'confirm' && !flow.editing
      ? `${flow.countdown} sec`
      : '—';

  const sysMode =
    flow.railStep.charAt(0).toUpperCase() + flow.railStep.slice(1);

  const voiceStatusMessage = useMemo(() => {
    if (voiceConnectionFailed) {
      return 'Connection failed — tap to retry';
    }
    if (
      voiceActivating
      || roomState === ConnectionState.Connecting
      || roomState === ConnectionState.Reconnecting
    ) {
      return 'Connecting to Soren… this may take a few seconds.';
    }
    if (voice.isConnected && voice.rawAgentState === 'connecting') {
      return 'Soren is getting ready…';
    }
    if (
      voice.isConnected
      && (voice.rawAgentState === 'listening' || voice.rawAgentState === 'idle')
      && flow.phase === 'input'
    ) {
      return 'Listening — say the website you want to check.';
    }
    return null;
  }, [
    flow.phase,
    roomState,
    voice.isConnected,
    voice.rawAgentState,
    voiceActivating,
    voiceConnectionFailed,
  ]);

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

  const switchToTypedEntry = useCallback(() => {
    interrupt();
    void setMicEnabled(false);
    flow.prepareForRescan();
    setTimeout(focusWebsiteInput, 60);
    flow.append('Switched to typed entry. Soren paused.');
  }, [flow, interrupt, setMicEnabled]);

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
    const isMidConnect =
      roomState === ConnectionState.Connecting
      || roomState === ConnectionState.Reconnecting
      || roomState === ConnectionState.SignalReconnecting;

    if (voiceConnectionFailed || isMidConnect) {
      try {
        await teardownSession(voice.room);
      } catch {
        /* ignore */
      }
      setVoiceConnectionFailed(false);
    }

    const needsInputScreen =
      flow.phase === 'scan_failed'
      || flow.phase === 'confirm'
      || flow.phase === 'scanning';

    if (needsInputScreen) {
      flow.goToInput();
    }
    setVoiceActivating(true);

    if (voice.isConnected) {
      await flow.prepareNewConversation();
      voice.activate();
      if (!muted) void setMicEnabled(true);
      flow.append('Starting a fresh conversation.');
      return;
    }
    voice.activate();
    flow.append('Connecting to Soren…');
  }, [flow, muted, roomState, setMicEnabled, voice, voiceConnectionFailed]);

  useEffect(() => {
    if (voice.isConnected && voiceActivating && !muted) {
      void setMicEnabled(true);
    }
  }, [voice.isConnected, voiceActivating, muted, setMicEnabled]);

  const handleResetAll = useCallback(async () => {
    interrupt();
    promo.reset();
    await flow.resetAll();
  }, [flow, interrupt, promo]);

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
        status={topStatus}
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
          onEnterUrl={switchToTypedEntry}
          showEnterUrl={flow.phase !== 'input'}
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
            {voiceStatusMessage && (
              <VoiceStatusBanner
                message={voiceStatusMessage}
                failed={voiceConnectionFailed}
                onRetry={
                  voiceConnectionFailed
                    ? () => void startVoiceConversation()
                    : undefined
                }
              />
            )}
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
                scanInFlight={flow.scanInFlight}
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
                scanInFlight={flow.scanInFlight}
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
                  switchToTypedEntry();
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
                onGoHome={switchToTypedEntry}
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
          showConversationLog={voice.isConnected || voiceActivating}
        />
      </main>
    </div>
  );
}
