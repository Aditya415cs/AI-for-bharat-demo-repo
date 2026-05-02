import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { AppCard } from '../../components/AppCard';
import { AppButton } from '../../components/AppButton';

export const ResultScreen: React.FC<any> = ({ navigation, route }) => {
  const { resultData } = route.params || {};
  
  const result = resultData || {
    status: 'Job-Ready',
    score: 88,
    color: theme.colors.secondary,
    strengths: ['Clear Communication', 'Strong Trade Knowledge', 'Confidence'],
    improvements: ['Eye Contact', 'Pacing of complex answers'],
  };

  const statusColor = result.status === 'Job-Ready' ? theme.colors.secondary : theme.colors.accent;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Interview Result</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Result Status Card */}
        <AppCard style={[styles.statusCard, { borderColor: statusColor }]} variant="outlined">
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{result.status || result.classification}</Text>
          </View>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Confidence Score</Text>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{result.score || result.confidence_score}%</Text>
            </View>
          </View>
        </AppCard>

        {/* Feedback Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Strengths</Text>
          {result.feedback?.strengths?.map((s: string, i: number) => (
            <View key={i} style={styles.feedbackItem}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.secondary} />
              <Text style={styles.feedbackText}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Areas to Improve</Text>
          {result.feedback?.improvements?.map((s: string, i: number) => (
            <View key={i} style={styles.feedbackItem}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.accent} />
              <Text style={styles.feedbackText}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <AppButton 
            title="Back to Dashboard" 
            variant="primary" 
            onPress={() => navigation.navigate('HomeTabs')} 
            style={styles.actionBtn}
          />
          <AppButton 
            title="Retake Interview" 
            variant="outline" 
            onPress={() => navigation.navigate('InterviewIntro')} 
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    height: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: 32,
    borderWidth: 2,
    marginBottom: 32,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  statusText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
  },
  feedbackText: {
    marginLeft: 12,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  actions: {
    paddingBottom: 40,
  },
  actionBtn: {
    marginBottom: 12,
  }
});
