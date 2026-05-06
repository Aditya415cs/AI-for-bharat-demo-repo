import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { supabase } from '../../services/supabase/config';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';

export const InterviewerCandidateDetailScreen = ({ route, navigation }: any) => {
  const { candidateId, jobId } = route.params;
  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCandidateDetails();
  }, [candidateId]);

  const fetchCandidateDetails = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', candidateId)
        .single();

      const { data: interview } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', candidateId)
        .eq('job_id', jobId)
        .single();

      const { data: application } = await supabase
        .from('applications')
        .select('status')
        .eq('user_id', candidateId)
        .eq('job_id', jobId)
        .single();

      setCandidate({
        ...profile,
        interview: interview || null,
        status: application?.status || 'pending'
      });
    } catch (err) {
      console.error('Error fetching candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    // Optimistic Update
    const oldStatus = candidate.status;
    setCandidate((prev: any) => ({ ...prev, status }));
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('user_id', candidateId)
        .eq('job_id', jobId);

      if (error) throw error;
      Alert.alert('Status Updated', `Candidate has been ${status}.`);
      navigation.goBack();
    } catch (err) {
      console.error('Error updating status:', err);
      // Rollback on error
      setCandidate((prev: any) => ({ ...prev, status: oldStatus }));
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleBlock = async () => {
    Alert.alert(
      'Block Candidate',
      'Are you sure you want to block this candidate from all future roles at your company?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              // 1. Get job's company_id
              const { data: jobData } = await supabase.from('jobs').select('company_id').eq('id', jobId).single();
              if (!jobData) throw new Error('Job not found');

              const { error } = await supabase
                .from('blocked_candidates')
                .insert({
                  company_id: jobData.company_id,
                  user_id: candidateId,
                  reason: 'Blocked by interviewer'
                });

              if (error) throw error;
              Alert.alert('Blocked', 'Candidate has been blocked successfully.');
              navigation.goBack();
            } catch (err: any) {
              console.error('Error blocking candidate:', err);
              Alert.alert('Error', err.message || 'Failed to block candidate.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'shortlisted': return '#16a34a';
      case 'rejected': return '#dc2626';
      case 'pending': return '#64748b';
      default: return '#64748b';
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!candidate) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Candidate Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{candidate.full_name?.charAt(0)}</Text>
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{candidate.full_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(candidate.status) }]}>
              <Text style={styles.statusBadgeText}>{candidate.status.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.trade}>{candidate.trade} • {candidate.experience_level}</Text>
        </View>

        <View style={styles.scoreRow}>
          <AppCard style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Interview Score</Text>
            <Text style={[styles.scoreValue, { color: theme.colors.primary }]}>
              {Math.round(Number(candidate.interview?.average_score || 0))}%
            </Text>
          </AppCard>
          <AppCard style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Confidence</Text>
            <Text style={[styles.scoreValue, { color: theme.colors.secondary }]}>
              {candidate.interview?.confidence_score || 0}%
            </Text>
          </AppCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interview Summary</Text>
          <AppCard variant="outlined" style={styles.summaryCard}>
            <View style={styles.classificationRow}>
              <Text style={styles.summaryLabel}>Classification:</Text>
              <Text style={styles.summaryValue}>{candidate.interview?.classification || 'Pending'}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.summaryLabel}>AI Feedback:</Text>
            <Text style={styles.feedbackText}>
              Candidate demonstrated strong technical understanding of {candidate.trade} concepts. 
              Communication was clear, though some hesitation was noted during complex troubleshooting questions.
            </Text>
          </AppCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Skills</Text>
          <View style={styles.skillsContainer}>
            {candidate.skills?.map((skill: string, index: number) => (
              <View key={index} style={styles.skillBadge}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>District</Text>
              <Text style={styles.detailValue}>{candidate.district}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Work Preference</Text>
              <Text style={styles.detailValue}>{candidate.work_preference || 'Not specified'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Education</Text>
              <Text style={styles.detailValue}>{candidate.education}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Experience</Text>
              <Text style={styles.detailValue}>{candidate.experience_level}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {candidate.status === 'shortlisted' || candidate.status === 'rejected' ? (
          <View style={styles.finalDecision}>
            <Ionicons 
              name={candidate.status === 'shortlisted' ? "checkmark-circle" : "close-circle"} 
              size={24} 
              color={candidate.status === 'shortlisted' ? "#16a34a" : "#dc2626"} 
            />
            <Text style={[styles.finalDecisionText, { color: candidate.status === 'shortlisted' ? "#16a34a" : "#dc2626" }]}>
              Final Decision: {candidate.status.toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.footerRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
              onPress={() => updateStatus('rejected')}
              disabled={updating}
            >
              <Ionicons name="close-circle" size={24} color="#dc2626" />
              <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Reject</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#f0fdf4' }]}
              onPress={() => updateStatus('shortlisted')}
              disabled={updating}
            >
              <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
              <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>Shortlist</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]}
              onPress={handleBlock}
              disabled={updating}
            >
              <Ionicons name="ban" size={24} color="#475569" />
              <Text style={[styles.actionBtnText, { color: '#475569' }]}>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  content: {
    padding: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  trade: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  scoreCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  scoreLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
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
  summaryCard: {
    padding: 16,
  },
  classificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  skillText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailItem: {
    width: '45%',
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  finalDecision: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  finalDecisionText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
