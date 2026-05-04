import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AuthContext } from '../../context/AuthContext';

export const InterviewIntroScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId } = route.params || {};
  const { profile } = useContext(AuthContext);
  const instructions = [
    {
      icon: 'videocam',
      title: 'Stay Visible',
      desc: 'Ensure your face is clearly visible in the camera frame.',
      color: theme.colors.primary,
    },
    {
      icon: 'mic',
      title: 'Speak Clearly',
      desc: 'Talk at a steady pace and normal volume.',
      color: theme.colors.secondary,
    },
    {
      icon: 'volume-mute',
      title: 'Quiet Environment',
      desc: 'Find a place with minimal background noise.',
      color: theme.colors.accent,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppButton 
          variant="ghost" 
          title="" 
          icon={<Ionicons name="chevron-back" size={24} color={theme.colors.text} />}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        />
        <Text style={styles.headerTitle}>Interview Prep</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.illustrationContainer}>
          <View style={styles.circle}>
            <Ionicons name="headset" size={64} color={theme.colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Ready to begin?</Text>
        <Text style={styles.subtitle}>
          Follow these simple steps for the best AI interview experience.
        </Text>

        <View style={styles.instructionsContainer}>
          {instructions.map((item, index) => (
            <AppCard key={index} style={styles.instructionCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>{item.title}</Text>
                <Text style={styles.instructionDesc}>{item.desc}</Text>
              </View>
            </AppCard>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton 
          title="Begin Interview" 
          onPress={() => navigation.navigate('Interview', { 
            jobId,
            candidateName: profile?.full_name ?? 'Candidate',
            trade: profile?.trade ?? 'General',
            phoneNumber: profile?.phone ?? '',
          })}
          style={styles.beginBtn}
        />
      </View>
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: 56,
  },
  backBtn: {
    width: 40,
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  illustrationContainer: {
    marginVertical: theme.spacing.xl,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  instructionsContainer: {
    width: '100%',
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  instructionDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: theme.spacing.lg,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  beginBtn: {
    width: '100%',
  },
});
