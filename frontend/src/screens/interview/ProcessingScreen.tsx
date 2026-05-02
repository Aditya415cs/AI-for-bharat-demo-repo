import React, { useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { supabase } from '../../services/supabase/config';
import { AuthContext } from '../../context/AuthContext';

export const ProcessingScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId } = route.params || {};
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const saveAndNavigate = async () => {
      // 1. Generate Mock Result
      const mockResult = {
        score: Math.floor(Math.random() * (95 - 75 + 1)) + 75,
        classification: 'Job-Ready',
        confidence_score: Math.floor(Math.random() * (90 - 80 + 1)) + 80,
        feedback: {
          strengths: ['Clear Communication', 'Strong Trade Knowledge', 'Confidence'],
          improvements: ['Eye Contact', 'Pacing of complex answers'],
        }
      };

      // 2. Save to Supabase if jobId and user exist
      if (jobId && user) {
        try {
          await supabase.from('interviews').insert({
            user_id: user.id,
            job_id: jobId,
            score: mockResult.score,
            classification: mockResult.classification,
            confidence_score: mockResult.confidence_score,
            feedback: mockResult.feedback
          });
        } catch (err) {
          console.error('Error saving interview:', err);
        }
      }

      // 3. Navigate after delay
      setTimeout(() => {
        navigation.navigate('Result', { jobId, resultData: mockResult });
      }, 2000);
    };

    saveAndNavigate();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.aiGlow}>
          <Ionicons name="sparkles" size={80} color={theme.colors.primary} />
          <ActivityIndicator 
            size={120} 
            color={theme.colors.primary} 
            style={styles.spinner} 
          />
        </View>
        <Text style={styles.title}>Analyzing your interview...</Text>
        <Text style={styles.subtitle}>
          Our AI is evaluating your communication, confidence, and trade knowledge.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  aiGlow: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  spinner: {
    position: 'absolute',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});
