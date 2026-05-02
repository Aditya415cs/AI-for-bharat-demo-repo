import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { AppButton } from '../../components/AppButton';

const { width } = Dimensions.get('window');

export const InterviewScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId } = route.params || {};
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(2);
  const totalQuestions = 10;

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

      {/* Camera Preview Area (Mock) */}
      <View style={styles.cameraContainer}>
        <View style={styles.cameraMock}>
          <Ionicons name="person" size={120} color="rgba(255,255,255,0.3)" />
          <View style={styles.cameraOverlay}>
            <Text style={styles.overlayText}>Camera Active</Text>
          </View>
        </View>
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
        
        {/* Waveform Mock */}
        <View style={styles.waveformContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View 
              key={i} 
              style={[
                styles.waveformBar, 
                { 
                  height: isRecording ? 10 + Math.random() * 30 : 4,
                  backgroundColor: isRecording ? theme.colors.primary : theme.colors.border
                }
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
            <Ionicons name={isRecording ? "stop" : "mic"} size={32} color="#fff" />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: 60,
    justifyContent: 'space-between',
  },
  closeBtn: {
    padding: 8,
  },
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
    height: width * 0.75,
    padding: theme.spacing.md,
  },
  cameraMock: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  overlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  waveformContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    marginTop: 32,
  },
  waveformBar: {
    width: 4,
    marginHorizontal: 3,
    borderRadius: 2,
  },
  controls: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  actionCircle: {
    alignItems: 'center',
  },
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
  micButtonActive: {
    backgroundColor: '#fee2e2',
  },
  micInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  micInnerActive: {
    backgroundColor: theme.colors.error,
  },
  micPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: theme.colors.error,
    opacity: 0.3,
  },
  finishBtn: {
    marginTop: 20,
  }
});
