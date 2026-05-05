import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { theme } from '../../theme';
import { AppButton } from '../../components/AppButton';

const { width } = Dimensions.get('window');

type FaceState = 'scanning' | 'verified' | 'not_detected' | 'mismatch';

export const InterviewScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId } = route.params || {};
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(2);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [faceState, setFaceState] = useState<FaceState>('scanning');
  const totalQuestions = 10;

  const [permission, requestPermission] = useCameraPermissions();

  // Simulate face verification cycling for demo
  useEffect(() => {
    const states: FaceState[] = ['scanning', 'verified', 'scanning', 'not_detected', 'scanning', 'verified'];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % states.length;
      setFaceState(states[i]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getFaceConfig = () => {
    switch (faceState) {
      case 'verified':
        return { color: '#22c55e', icon: 'checkmark-circle' as const, label: 'Face Verified' };
      case 'not_detected':
        return { color: '#f59e0b', icon: 'warning' as const, label: 'Face Not Detected' };
      case 'mismatch':
        return { color: '#ef4444', icon: 'close-circle' as const, label: 'Identity Mismatch' };
      default:
        return { color: '#3b82f6', icon: 'scan' as const, label: 'Scanning...' };
    }
  };

  const faceConfig = getFaceConfig();

  // Still loading permissions
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.primary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            This interview requires camera access so the interviewer can see you during the session.
          </Text>
          <AppButton title="Grant Camera Access" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Progress */}
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

      {/* Full-width Camera with overlays */}
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing={facing}>

          {/* Face verification bounding box */}
          <View style={[styles.faceBox, { borderColor: faceConfig.color }]} />

          {/* Face verification badge — top left */}
          <View style={[styles.faceBadge, { backgroundColor: faceConfig.color }]}>
            <Ionicons name={faceConfig.icon} size={13} color="#fff" />
            <Text style={styles.faceBadgeText}>{faceConfig.label}</Text>
          </View>

          {/* Flip button — top right */}
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))}
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Live badge — bottom right */}
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>● LIVE</Text>
          </View>
        </CameraView>
      </View>

      {/* AI Question Section */}
      <View style={styles.questionSection}>
        <View style={styles.aiLabel}>
          <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
          <Text style={styles.aiLabelText}>AI INTERVIEWER</Text>
        </View>
        <Text style={styles.questionText}>
          "Tell me about a time when you had to deal with a difficult colleague. How did you resolve the situation?"
        </Text>

        {/* Waveform */}
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

      {/* Bottom Controls */}
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

  // Permission
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: 60,
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

  // Camera — full width, no horizontal padding
  cameraContainer: {
    width: width,
    height: width * 0.78,
  },
  camera: {
    flex: 1,
  },

  // Face verification bounding box
  faceBox: {
    position: 'absolute',
    top: '15%',
    left: '25%',
    width: '50%',
    height: '65%',
    borderWidth: 2,
    borderRadius: 8,
    borderStyle: 'dashed',
  },

  // Face badge top-left
  faceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  faceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Flip button top-right
  flipBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    padding: 8,
  },

  // Live badge bottom-right
  liveBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
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

  // Question
  questionSection: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  waveformContainer: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    marginTop: 20,
  },
  waveformBar: {
    width: 4,
    marginHorizontal: 3,
    borderRadius: 2,
  },

  // Controls
  controls: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  actionCircle: { alignItems: 'center' },
  actionLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: { backgroundColor: '#fee2e2' },
  micInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  micInnerActive: { backgroundColor: theme.colors.error },
  micPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: theme.colors.error,
    opacity: 0.3,
  },
  finishBtn: { marginTop: 16 },
});
