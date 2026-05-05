import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  runAtTargetFps
} from 'react-native-vision-camera';
import { useFaceDetector, FaceDetectorConfig } from 'react-native-vision-camera-face-detector';
import { runOnJS } from 'react-native-reanimated';
import { theme } from '../../theme';
import { AppButton } from '../../components/AppButton';

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

export const InterviewScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId, referencePhoto } = route.params || {};
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(2);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('scanning');
  const [showRefPhoto, setShowRefPhoto] = useState(false);
  const [facesCount, setFacesCount] = useState(0);
  const totalQuestions = 10;

  // These hooks only work on Native
  const permission = isWeb ? { hasPermission: true } : useCameraPermission();
  const device = isWeb ? null : useCameraDevice('front');

  // Configure Face Detector
  const faceDetectorConfig = useRef<FaceDetectorConfig>({
    performanceMode: 'fast',
    landmarkMode: 'none',
    classificationMode: 'none',
  }).current;

  const { detectFaces } = isWeb ? { detectFaces: () => [] } : useFaceDetector(faceDetectorConfig);

  // Reanimated UI update function
  const onFacesDetected = (faceCount: number, yaw: number) => {
    setFacesCount(faceCount);

    if (faceCount === 0) {
      setVerificationStatus('no_face');
    } else if (faceCount > 1) {
      setVerificationStatus('multiple_faces');
    } else {
      if (Math.abs(yaw) > 20) {
        setVerificationStatus('not_looking');
      } else {
        setVerificationStatus('verified');
      }
    }
  };

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
    if (!isWeb && !permission.hasPermission) {
      permission.requestPermission();
    }

    // Web simulation
    if (isWeb) {
      const interval = setInterval(() => {
        const mockFaceCount = Math.random() > 0.1 ? 1 : 0;
        onFacesDetected(mockFaceCount, 0);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [permission?.hasPermission]);

  const config = STATUS_CONFIG[verificationStatus];

  if (!isWeb && !permission.hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.primary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            AI Interview Proctoring requires camera access for real-time monitoring.
          </Text>
          <AppButton title="Grant Permission" onPress={permission.requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(currentQuestion / totalQuestions) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{currentQuestion}/{totalQuestions}</Text>
        </View>
        <View style={styles.statusIndicator}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>LIVE</Text>
        </View>
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        {isWeb ? (
          <View style={styles.webCameraPlaceholder}>
            <Ionicons name="videocam" size={48} color="#475569" />
            <Text style={styles.webCameraText}>Camera preview only available on Native Mobile</Text>
            <Text style={styles.webCameraSubtext}>(Proctoring AI is active in simulation mode)</Text>
          </View>
        ) : device ? (
          <Camera
            style={styles.camera}
            device={device}
            isActive={true}
            frameProcessor={frameProcessor}
            pixelFormat="yuv"
          />
        ) : (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        )}

        {/* Proctoring status badge */}
        <View style={[styles.faceBadge, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={14} color="#fff" />
          <Text style={styles.faceBadgeText}>{config.label}</Text>
        </View>

        {/* Identity Box Overlay */}
        <View style={[styles.faceBox, { borderColor: config.color }]}>
          <View style={[styles.cornerTL, { borderColor: config.color }]} />
          <View style={[styles.cornerTR, { borderColor: config.color }]} />
          <View style={[styles.cornerBL, { borderColor: config.color }]} />
          <View style={[styles.cornerBR, { borderColor: config.color }]} />
        </View>

        {/* Reference Photo Comparison */}
        {referencePhoto && (
          <TouchableOpacity
            style={styles.refPhotoBtn}
            onPress={() => setShowRefPhoto(!showRefPhoto)}
          >
            <Image source={{ uri: referencePhoto }} style={styles.refPhotoThumb} />
            <View style={styles.refPhotoBadge}>
              <Text style={styles.refPhotoLabel}>REF</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Expanded reference photo */}
        {showRefPhoto && referencePhoto && (
          <TouchableOpacity
            style={styles.refPhotoOverlay}
            activeOpacity={1}
            onPress={() => setShowRefPhoto(false)}
          >
            <Image source={{ uri: referencePhoto }} style={styles.refPhotoLarge} />
            <Text style={styles.refPhotoCaption}>Verified Identity Reference</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cameraBottomBar}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>● MONITORING</Text>
          </View>
          <View style={styles.scanCountBadge}>
            <Ionicons name="people" size={12} color="#fff" />
            <Text style={styles.scanCountText}>{facesCount} detected</Text>
          </View>
        </View>
      </View>

      {/* AI Question */}
      <View style={styles.questionSection}>
        <View style={styles.aiLabel}>
          <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
          <Text style={styles.aiLabelText}>AI INTERVIEWER</Text>
        </View>
        <Text style={styles.questionText}>
          "Tell me about a time when you had to deal with a difficult colleague. How did you resolve the situation?"
        </Text>

        <View style={styles.waveformContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: isRecording ? 10 + Math.random() * 30 : 4,
                  backgroundColor: isRecording ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.actionCircle}>
            <Ionicons name="refresh" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.actionLabel}>Repeat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle}>
            <Ionicons name="play-skip-forward" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.actionLabel}>Skip</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={() => setIsRecording(!isRecording)}
          activeOpacity={0.7}
        >
          <View style={[styles.micInner, isRecording && styles.micInnerActive]}>
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={32} color="#fff" />
          </View>
          {isRecording && <View style={styles.micPulse} />}
        </TouchableOpacity>

        <AppButton
          title="Finish"
          variant="ghost"
          onPress={() => navigation.navigate('Processing', { jobId })}
          style={styles.finishBtn}
          textStyle={{ color: theme.colors.error }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: 56,
    justifyContent: 'space-between',
  },
  closeBtn: { padding: 8 },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    width: 35,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.error,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.error,
  },
  cameraContainer: {
    width: width,
    height: width * 0.78,
  },
  camera: {
    flex: 1,
    backgroundColor: '#000',
  },
  webCameraPlaceholder: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webCameraText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginTop: 12,
  },
  webCameraSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  faceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    zIndex: 10,
  },
  faceBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  faceBox: {
    position: 'absolute',
    top: '18%',
    left: '27%',
    width: '46%',
    height: '60%',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRadius: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderRadius: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRadius: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderRadius: 4,
  },
  refPhotoBtn: {
    position: 'absolute',
    bottom: 48,
    left: 12,
    zIndex: 10,
  },
  refPhotoThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  refPhotoBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  refPhotoLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  refPhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  refPhotoLarge: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: '#fff',
  },
  refPhotoCaption: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  scanCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  scanCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  questionSection: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aiLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    marginLeft: 4,
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  waveformContainer: {
    flexDirection: 'row',
    height: 40,
    alignItems: 'center',
    marginTop: 16,
  },
  waveformBar: {
    width: 4,
    marginHorizontal: 3,
    borderRadius: 2,
  },
  controls: {
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 14,
  },
  actionCircle: { alignItems: 'center' },
  actionLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: { backgroundColor: '#fee2e2' },
  micInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  micInnerActive: { backgroundColor: theme.colors.error },
  micPulse: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: theme.colors.error,
    opacity: 0.3,
  },
  finishBtn: { marginTop: 12 },
});
