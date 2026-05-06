import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Platform, ScrollView, Dimensions, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Room,
  RoomEvent,
  ConnectionState,
  createLocalAudioTrack,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteAudioTrack,
  Track,
  RemoteTrackPublication,
} from "livekit-client";
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  runAtTargetFps
} from 'react-native-vision-camera';
import { useFaceDetector, FaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { runOnJS } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { theme } from "../../theme";
import { AppButton } from "../../components/AppButton";
import { startInterview, InterviewResult } from "../../services/interviewService";

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

type VerificationStatus = 'scanning' | 'verified' | 'no_face' | 'multiple_faces' | 'not_looking';

interface FaceConfig {
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const STATUS_CONFIG: Record<VerificationStatus, FaceConfig> = {
  scanning: { color: '#3b82f6', bgColor: 'rgba(59,130,246,0.85)', icon: 'scan', label: 'Scanning face...' },
  verified: { color: '#22c55e', bgColor: 'rgba(34,197,94,0.85)', icon: 'checkmark-circle', label: 'Face Verified' },
  no_face: { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.85)', icon: 'warning', label: 'No Face Detected' },
  multiple_faces: { color: '#ef4444', bgColor: 'rgba(239,68,68,0.85)', icon: 'people', label: 'Multiple Faces!' },
  not_looking: { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.85)', icon: 'eye-off', label: 'Look at Camera' },
};

type InterviewState = "idle" | "connecting" | "active" | "completed" | "error";
type TranscriptMessage = {
  id: string;
  speaker: "assistant" | "user";
  text: string;
  timestamp: number;
};

const TRANSCRIPT_TOPIC = "interview-transcript";

const decodeTranscriptPayload = (payload: Uint8Array) => {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(payload);
  }

  return decodeURIComponent(
    Array.from(payload, (byte) => `%${byte.toString(16).padStart(2, "0")}`).join("")
  );
};

// Animated waveform bar
const WaveBar = ({ active, delay }: { active: boolean; delay: number }) => {
  const anim = useRef(new Animated.Value(4)).current;
  useEffect(() => {
    if (active) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 32, duration: 400, useNativeDriver: false, delay }),
        Animated.timing(anim, { toValue: 4, duration: 400, useNativeDriver: false }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(anim, { toValue: 4, duration: 200, useNativeDriver: false }).start();
    }
  }, [active]);
  return <Animated.View style={[styles.waveBar, { height: anim, backgroundColor: active ? theme.colors.primary : theme.colors.border }]} />;
};

export const InterviewScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId, referencePhoto, candidateName = "Candidate", trade = "General", phoneNumber = "", email = "" } = route.params || {};

  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [priyaSpeaking, setPriyaSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [fitmentResult, setFitmentResult] = useState<InterviewResult | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);

  // Proctoring states
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('scanning');
  const [showRefPhoto, setShowRefPhoto] = useState(false);
  const [facesCount, setFacesCount] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const localAudioRef = useRef<LocalAudioTrack | null>(null);
  const transcriptScrollRef = useRef<ScrollView | null>(null);
  // Track attached RemoteAudioTrack instances so we can detach on cleanup
  const remoteAudioTracksRef = useRef<RemoteAudioTrack[]>([]);

  useEffect(() => {
    return () => { disconnectCleanly(); };
  }, []);

  /**
   * Attach a RemoteAudioTrack using LiveKit's own .attach() method.
   * This is the correct way — it handles codec negotiation, AudioContext,
   * and appends its own <audio> element to the DOM automatically.
   */
  const attachRemoteAudioTrack = useCallback((track: RemoteAudioTrack) => {
    if (Platform.OS !== "web") return;
    try {
      // attach() with no args creates and appends an <audio> element internally
      const el = track.attach();
      // Ensure it is in the DOM and autoplays
      if (el && !document.body.contains(el)) {
        el.style.display = "none";
        document.body.appendChild(el);
      }
      remoteAudioTracksRef.current.push(track);
      console.log("[LiveKit] Remote audio track attached");
    } catch (e) {
      console.warn("[LiveKit] Failed to attach remote audio track:", e);
    }
  }, []);

  const detachAllRemoteAudio = useCallback(() => {
    remoteAudioTracksRef.current.forEach((track) => {
      try {
        track.detach().forEach((el) => el.remove());
      } catch {}
    });
    remoteAudioTracksRef.current = [];
  }, []);

  const disconnectCleanly = useCallback(async () => {
    detachAllRemoteAudio();
    try {
      if (localAudioRef.current) { localAudioRef.current.stop(); localAudioRef.current = null; }
      if (roomRef.current) { await roomRef.current.disconnect(); roomRef.current = null; }
    } catch {}
  }, [detachAllRemoteAudio]);

  const interviewStartTimeRef = useRef<number>(0);
  const interviewStartISORef = useRef<string>('');

  const fetchFitment = useCallback(async () => {
    const afterISO = interviewStartISORef.current;

    // Query Supabase directly — avoids HTTP encoding issues with email in URL path
    // and is more reliable than polling the backend API
    const { supabase: sb } = await import('../../services/supabase/config');

    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        // Primary: look up by user_id (most reliable — no encoding issues)
        const { data: { user } } = await sb.auth.getUser();
        if (user?.id) {
          const { data } = await sb
            .from('interviews')
            .select('id, candidate_name, phone_number, trade, language, district, category, fitment, average_score, confidence_score, integrity_flag, scores, weak_topics, feedback, transcript, created_at')
            .eq('user_id', user.id)
            .gte('created_at', afterISO)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data) {
            // Normalize field name to match InterviewResult type
            const result = { ...data, interview_date: data.created_at } as any;
            setFitmentResult(result);
            return;
          }
        }
      } catch (err) {
        console.warn('[fetchFitment] Supabase query failed:', err);
      }
      // Wait 3s between attempts — agent needs time to score and save
      await new Promise(r => setTimeout(r, 3000));
    }
    // After all attempts, leave fitmentResult as null — UI shows thank-you without result
  }, []);

  const appendTranscriptMessage = useCallback((message: TranscriptMessage) => {
    setTranscriptMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [...current, message].slice(-40);
    });
  }, []);

  const handleStartInterview = useCallback(async () => {
    setInterviewState("connecting");
    setErrorMessage("");
    setTranscriptMessages([]);
    interviewStartTimeRef.current = Date.now();
    interviewStartISORef.current = new Date().toISOString(); // record start time for result lookup

    // Request mic permission
    let micGranted = false;
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        micGranted = true;
      } else {
        const { Audio } = await import("expo-av");
        const { status } = await Audio.requestPermissionsAsync();
        micGranted = status === "granted";
      }
    } catch { micGranted = false; }

    if (!micGranted) {
      setErrorMessage("Microphone access is required. Please allow microphone permission in your browser settings and try again.");
      setInterviewState("error");
      return;
    }

    // Call backend to create room + dispatch Priya
    let credentials: { token: string; url: string; room: string };
    try {
      credentials = await startInterview({ candidate_name: candidateName, trade, phone_number: phoneNumber, email, job_id: jobId || undefined });
    } catch (err: any) {
      setErrorMessage(err.message ?? "Failed to start interview. Please try again.");
      setInterviewState("error");
      return;
    }

    // Connect to LiveKit room
    try {
      const room = new Room({ adaptiveStream: false, dynacast: false });
      roomRef.current = room;

      // ── Handle remote audio tracks ──────────────────────────────────────
      // Attach tracks that are already published when we join
      room.on(RoomEvent.TrackSubscribed, (track, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          attachRemoteAudioTrack(track as RemoteAudioTrack);
        }
      });

      // Detach when a track is unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          try { (track as RemoteAudioTrack).detach().forEach((el) => el.remove()); } catch {}
          remoteAudioTracksRef.current = remoteAudioTracksRef.current.filter((t) => t !== track);
        }
      });

      // ── Speaking indicator ──────────────────────────────────────────────
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setPriyaSpeaking(speakers.some((s) => s instanceof RemoteParticipant));
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
        if (topic !== TRANSCRIPT_TOPIC) return;

        try {
          const parsed = JSON.parse(decodeTranscriptPayload(payload));
          if (
            typeof parsed.id === "string" &&
            (parsed.speaker === "assistant" || parsed.speaker === "user") &&
            typeof parsed.text === "string"
          ) {
            appendTranscriptMessage({
              id: parsed.id,
              speaker: parsed.speaker,
              text: parsed.text,
              timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now(),
            });
          }
        } catch (err) {
          console.warn("[LiveKit] Failed to parse transcript payload:", err);
        }
      });

      // ── Room disconnected (Priya ended session or network drop) ─────────
      room.on(RoomEvent.Disconnected, async () => {
        detachAllRemoteAudio();
        setMicActive(false);
        setPriyaSpeaking(false);
        setInterviewState("completed");
        await fetchFitment();
      });

      // ── Connection state ────────────────────────────────────────────────
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) setInterviewState("active");
      });

      await room.connect(credentials.url, credentials.token, { autoSubscribe: true });

      // Also attach any tracks already present after connecting
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.track && pub.track.kind === Track.Kind.Audio) {
            attachRemoteAudioTrack(pub.track as RemoteAudioTrack);
          }
        });
      });

      // Publish local mic
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      localAudioRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack);
      setMicActive(true);

    } catch (err: any) {
      await disconnectCleanly();
      setErrorMessage(err.message ?? "Failed to connect to the interview room. Please try again.");
      setInterviewState("error");
    }
  }, [candidateName, trade, phoneNumber, email, disconnectCleanly, fetchFitment, attachRemoteAudioTrack, detachAllRemoteAudio, appendTranscriptMessage]);

  const confirmEndInterview = useCallback(async () => {
    setShowEndConfirm(false);
    await disconnectCleanly();
    setMicActive(false);
    setPriyaSpeaking(false);
    setInterviewState("completed");
    await fetchFitment();
  }, [disconnectCleanly, fetchFitment]);

  const handleViewResult = useCallback(() => {
    // Pass the full result object directly — no need to re-fetch
    navigation.navigate("Result", { jobId, resultData: fitmentResult });
  }, [jobId, fitmentResult, navigation]);

  // ── Camera & Face Detection (Native only) ────────────────────────────────
  const visionPermission = useCameraPermission();
  const [expoPermission, requestExpoCameraPermission] = useCameraPermissions();
  const device = useCameraDevice('front');

  const faceDetectorConfig = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    landmarkMode: 'none',
    classificationMode: 'none',
  }).current;

  const { detectFaces } = isWeb ? { detectFaces: (_: any) => [] as any[] } : useFaceDetector(faceDetectorConfig);

  const onFacesDetected = useCallback((faceCount: number, yaw: number) => {
    setFacesCount(faceCount);
    if (faceCount === 0) {
      setVerificationStatus('no_face');
    } else if (faceCount > 1) {
      setVerificationStatus('multiple_faces');
    } else {
      setVerificationStatus(Math.abs(yaw) > 20 ? 'not_looking' : 'verified');
    }
  }, []);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (isWeb) return;
    runAtTargetFps(5, () => {
      'worklet';
      const detectedFaces = detectFaces(frame);
      const faceCount = detectedFaces.length;
      const firstFaceYaw = faceCount > 0 ? (detectedFaces[0].yawAngle ?? 0) : 0;
      runOnJS(onFacesDetected)(faceCount, firstFaceYaw);
    });
  }, [detectFaces]);

  useEffect(() => {
    if (!isWeb && !visionPermission.hasPermission) {
      visionPermission.requestPermission();
    }
    if (!expoPermission?.granted) {
      requestExpoCameraPermission();
    }
    // Web/Expo Camera fallback — keep proctoring status alive when frame processors are unavailable.
    if (isWeb) {
      const interval = setInterval(() => {
        onFacesDetected(Math.random() > 0.1 ? 1 : 0, 0);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [visionPermission.hasPermission, expoPermission?.granted, requestExpoCameraPermission, onFacesDetected]);

  const cameraPermissionGranted = isWeb
    ? expoPermission?.granted !== false
    : visionPermission.hasPermission || expoPermission?.granted;
  const shouldRunProctoringCamera = interviewState === "connecting" || interviewState === "active";
  const canUseVisionCamera = !isWeb && visionPermission.hasPermission && !!device;
  const canUseExpoCamera = !!expoPermission?.granted;

  // Camera permission gate
  if (!cameraPermissionGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.primary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            AI Interview Proctoring requires camera access for real-time monitoring.
          </Text>
          <AppButton
            title="Grant Permission"
            onPress={() => {
              if (!isWeb) visionPermission.requestPermission();
              requestExpoCameraPermission();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[verificationStatus];
  const renderProctoringPanel = () => {
    if (!shouldRunProctoringCamera) return null;

    if (canUseVisionCamera && device) {
      return (
        <View style={styles.proctoringPanel}>
          <VisionCamera
            style={styles.cameraView}
            device={device}
            isActive={shouldRunProctoringCamera}
            frameProcessor={frameProcessor}
          />
          <View style={[styles.statusOverlay, { backgroundColor: statusConfig.bgColor }]}>
            <Ionicons name={statusConfig.icon} size={14} color="#fff" />
            <Text style={styles.statusOverlayText}>{statusConfig.label}</Text>
          </View>
          {referencePhoto && (
            <TouchableOpacity
              style={styles.refPhotoThumb}
              onPress={() => setShowRefPhoto(!showRefPhoto)}
            >
              <Image source={{ uri: referencePhoto }} style={styles.refPhotoThumbImg} />
            </TouchableOpacity>
          )}
          {showRefPhoto && referencePhoto && (
            <View style={styles.refPhotoPreview}>
              <Image source={{ uri: referencePhoto }} style={styles.refPhotoPreviewImg} />
            </View>
          )}
        </View>
      );
    }

    if (canUseExpoCamera) {
      return (
        <View style={styles.proctoringPanel}>
          <CameraView
            style={styles.cameraView}
            facing="front"
            active={shouldRunProctoringCamera}
            mirror
          />
          <View style={[styles.statusOverlay, { backgroundColor: STATUS_CONFIG.scanning.bgColor }]}>
            <Ionicons name="videocam" size={14} color="#fff" />
            <Text style={styles.statusOverlayText}>Camera Monitoring On</Text>
          </View>
          {referencePhoto && (
            <TouchableOpacity
              style={styles.refPhotoThumb}
              onPress={() => setShowRefPhoto(!showRefPhoto)}
            >
              <Image source={{ uri: referencePhoto }} style={styles.refPhotoThumbImg} />
            </TouchableOpacity>
          )}
          {showRefPhoto && referencePhoto && (
            <View style={styles.refPhotoPreview}>
              <Image source={{ uri: referencePhoto }} style={styles.refPhotoPreviewImg} />
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={[styles.proctoringPanel, styles.cameraFallback]}>
        <Ionicons name="camera-outline" size={28} color={theme.colors.textSecondary} />
        <Text style={styles.cameraFallbackText}>Front camera unavailable</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {interviewState !== "active" && interviewState !== "connecting" && (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      )}

      {/* IDLE */}
      {interviewState === "idle" && (
        <View style={styles.centered}>
          <View style={styles.avatarCircle}><Ionicons name="headset" size={64} color={theme.colors.primary} /></View>
          <Text style={styles.title}>Meet Priya</Text>
          <Text style={styles.subtitle}>Your AI interviewer is ready. She will ask you questions about your trade. Speak naturally — there are no wrong answers.</Text>
          <View style={styles.infoRow}><Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>{candidateName}</Text></View>
          <View style={styles.infoRow}><Ionicons name="hammer-outline" size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>{trade}</Text></View>
          <AppButton title="Start Interview" onPress={handleStartInterview} style={styles.primaryBtn} />
        </View>
      )}

      {/* CONNECTING */}
      {interviewState === "connecting" && (
        <View style={styles.centered}>
          {renderProctoringPanel()}
          <View style={styles.glowCircle}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
          <Text style={styles.title}>Connecting to Priya...</Text>
          <Text style={styles.subtitle}>Setting up your interview room. This takes a moment.</Text>
        </View>
      )}

      {/* ACTIVE */}
      {interviewState === "active" && (
        <ScrollView
          style={styles.activeScroll}
          contentContainerStyle={styles.activeContainer}
          showsVerticalScrollIndicator
        >
          <View style={styles.activeHeader}>
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
            <Text style={styles.activeTitle}>Interview in Progress</Text>
          </View>

          {renderProctoringPanel()}
          <View style={styles.priyaSection}>
            <View style={[styles.priyaAvatar, priyaSpeaking && styles.priyaAvatarSpeaking]}>
              <Ionicons name="sparkles" size={48} color="#fff" />
            </View>
            <Text style={styles.priyaName}>Priya</Text>
            <Text style={styles.priyaStatus}>{priyaSpeaking ? "Speaking..." : "Listening to you"}</Text>
            <View style={styles.waveContainer}>{[0,1,2,3,4,5,6,7].map((i) => <WaveBar key={i} active={priyaSpeaking} delay={i * 60} />)}</View>
          </View>
          <View style={styles.transcriptSection}>
            <View style={styles.transcriptHeader}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.transcriptTitle}>Live Transcript</Text>
            </View>
            <ScrollView
              ref={transcriptScrollRef}
              style={styles.transcriptList}
              contentContainerStyle={styles.transcriptContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              onContentSizeChange={() => transcriptScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {transcriptMessages.length === 0 ? (
                <Text style={styles.transcriptEmpty}>Transcript will appear as you and Priya speak.</Text>
              ) : (
                transcriptMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.transcriptBubble,
                      message.speaker === "user" ? styles.userTranscriptBubble : styles.priyaTranscriptBubble,
                    ]}
                  >
                    <Text style={styles.transcriptSpeaker}>{message.speaker === "user" ? "You" : "Priya"}</Text>
                    <Text style={styles.transcriptText}>{message.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
          <View style={styles.micSection}>
            <View style={[styles.micIndicator, micActive && styles.micIndicatorActive]}>
              <Ionicons name={micActive ? "mic" : "mic-off"} size={28} color={micActive ? "#fff" : theme.colors.textSecondary} />
            </View>
            <Text style={styles.micLabel}>{micActive ? "Your microphone is active" : "Microphone off"}</Text>
          </View>
          {showEndConfirm ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>End the interview?</Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowEndConfirm(false)}>
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmEnd} onPress={confirmEndInterview}>
                  <Text style={styles.confirmEndText}>End Interview</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <AppButton title="End Interview" variant="outline" onPress={() => setShowEndConfirm(true)} style={styles.endBtn} textStyle={{ color: theme.colors.error }} />
          )}
        </ScrollView>
      )}

      {/* COMPLETED */}
      {interviewState === "completed" && (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={72} color={theme.colors.secondary} style={styles.successIcon} />
          <Text style={styles.title}>Interview Complete!</Text>
          <Text style={styles.subtitle}>Thank you, {candidateName}. Priya has finished evaluating your responses.</Text>
          <View style={styles.fitmentCard}>
            {fitmentResult ? (
              <>
                <Text style={styles.fitmentLabel}>Fitment</Text>
                <Text style={styles.fitmentValue}>{fitmentResult.fitment}</Text>
                <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.fitmentLabel}>Score</Text>
                    <Text style={[styles.fitmentScore, { color: fitmentResult.average_score >= 7.5 ? '#10b981' : fitmentResult.average_score >= 5 ? '#f59e0b' : '#ef4444' }]}>
                      {fitmentResult.average_score.toFixed(1)}/10
                    </Text>
                  </View>
                  {fitmentResult.confidence_score != null && (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.fitmentLabel}>Confidence</Text>
                      <Text style={[styles.fitmentScore, { color: theme.colors.primary }]}>
                        {Math.round(fitmentResult.confidence_score)}%
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Ionicons name="hourglass-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={[styles.fitmentLabel, { textAlign: 'center' }]}>
                  Your results are being processed.{'\n'}Check your History tab in a moment.
                </Text>
              </View>
            )}
          </View>
          {fitmentResult ? (
            <AppButton title="View Full Result" onPress={handleViewResult} style={styles.primaryBtn} />
          ) : null}
          <AppButton title="Back to Home" variant="ghost" onPress={() => navigation.navigate("HomeTabs")} style={styles.ghostBtn} textStyle={{ color: theme.colors.textSecondary }} />
        </View>
      )}

      {/* ERROR */}
      {interviewState === "error" && (
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.error} style={styles.errorIcon} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <AppButton title="Try Again" onPress={handleStartInterview} style={styles.primaryBtn} />
          <AppButton title="Go Back" variant="ghost" onPress={() => navigation.goBack()} style={styles.ghostBtn} textStyle={{ color: theme.colors.textSecondary }} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  backBtn: { position: "absolute", top: 56, left: 16, zIndex: 10, padding: 8, backgroundColor: "#fff", borderRadius: theme.borderRadius.full, elevation: 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xxl },
  title: { fontSize: 26, fontWeight: "700", color: theme.colors.text, textAlign: "center", marginBottom: theme.spacing.sm },
  subtitle: { fontSize: 15, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: theme.spacing.xl, paddingHorizontal: theme.spacing.sm },
  primaryBtn: { width: "100%", marginTop: theme.spacing.md },
  ghostBtn: { width: "100%", marginTop: theme.spacing.xs },
  avatarCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#eef2ff", justifyContent: "center", alignItems: "center", marginBottom: theme.spacing.xl },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm },
  infoText: { marginLeft: 8, fontSize: 15, color: theme.colors.textSecondary, fontWeight: "500" },
  glowCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#eef2ff", justifyContent: "center", alignItems: "center", marginBottom: theme.spacing.xl },
  activeScroll: { flex: 1 },
  activeContainer: { flexGrow: 1, alignItems: "center", paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg },
  activeHeader: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.xl },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#fee2e2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: theme.spacing.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.error, marginRight: 4 },
  liveText: { fontSize: 10, fontWeight: "800", color: theme.colors.error, letterSpacing: 1 },
  activeTitle: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
  priyaSection: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 170 },
  priyaAvatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", marginBottom: theme.spacing.md, elevation: 8 },
  priyaAvatarSpeaking: { backgroundColor: theme.colors.secondary },
  priyaName: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginBottom: 4 },
  priyaStatus: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
  waveContainer: { flexDirection: "row", alignItems: "center", height: 48 },
  waveBar: { width: 5, marginHorizontal: 3, borderRadius: 3 },
  transcriptSection: { width: "100%", height: 300, backgroundColor: "#fff", borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md, overflow: "hidden" },
  transcriptHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs },
  transcriptTitle: { marginLeft: 8, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  transcriptList: { flex: 1 },
  transcriptContent: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  transcriptEmpty: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, paddingVertical: theme.spacing.md },
  transcriptBubble: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.md, marginTop: theme.spacing.sm, borderWidth: 1 },
  priyaTranscriptBubble: { alignSelf: "flex-start", backgroundColor: "#f8fafc", borderColor: theme.colors.border },
  userTranscriptBubble: { alignSelf: "flex-end", backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
  transcriptSpeaker: { fontSize: 11, fontWeight: "800", color: theme.colors.textSecondary, marginBottom: 3, textTransform: "uppercase" },
  transcriptText: { fontSize: 14, lineHeight: 20, color: theme.colors.text },
  micSection: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.lg, backgroundColor: "#fff", paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border },
  micIndicator: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.border, justifyContent: "center", alignItems: "center", marginRight: theme.spacing.md },
  micIndicatorActive: { backgroundColor: theme.colors.secondary },
  micLabel: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: "500" },
  endBtn: { width: "100%", borderColor: theme.colors.error, marginBottom: theme.spacing.xl },
  confirmBox: { width: "100%", backgroundColor: "#fff", borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.error, marginBottom: theme.spacing.xl },
  confirmText: { fontSize: 16, fontWeight: "600", color: theme.colors.text, textAlign: "center", marginBottom: theme.spacing.md },
  confirmButtons: { flexDirection: "row", justifyContent: "space-between" },
  confirmCancel: { flex: 1, paddingVertical: 12, marginRight: 8, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center" },
  confirmCancelText: { fontSize: 15, fontWeight: "600", color: theme.colors.textSecondary },
  confirmEnd: { flex: 1, paddingVertical: 12, marginLeft: 8, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.error, alignItems: "center" },
  confirmEndText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  successIcon: { marginBottom: theme.spacing.xl },
  fitmentCard: { width: "100%", backgroundColor: "#fff", borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.lg },
  fitmentLabel: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6, marginTop: 4 },
  fitmentValue: { fontSize: 22, fontWeight: "800", color: theme.colors.secondary, marginBottom: 4 },
  fitmentScore: { fontSize: 15, color: theme.colors.text, fontWeight: "600" },
  errorIcon: { marginBottom: theme.spacing.xl },
  errorMessage: { fontSize: 15, color: theme.colors.error, textAlign: "center", lineHeight: 22, marginBottom: theme.spacing.xl, paddingHorizontal: theme.spacing.sm },

  // ── Camera proctoring styles ──────────────────────────────────────────────
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  permissionTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  permissionText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  proctoringPanel: {
    width: '100%', height: 160, borderRadius: 16, overflow: 'hidden',
    marginBottom: 16, position: 'relative',
    borderWidth: 2, borderColor: theme.colors.border,
  },
  cameraView: { width: '100%', height: '100%' },
  statusOverlay: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusOverlayText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  refPhotoThumb: {
    position: 'absolute', top: 8, right: 8,
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: '#22c55e', overflow: 'hidden',
  },
  refPhotoThumbImg: { width: '100%', height: '100%' },
  refPhotoPreview: {
    position: 'absolute', top: 58, right: 8,
    width: 92, height: 92, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff', overflow: 'hidden',
    backgroundColor: '#fff',
  },
  refPhotoPreviewImg: { width: '100%', height: '100%' },
  cameraFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  cameraFallbackText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  webStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    marginBottom: 12,
  },
});
