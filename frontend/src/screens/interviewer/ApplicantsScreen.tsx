import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { supabase } from '../../services/supabase/config';
import { AppCard } from '../../components/AppCard';
import { AuthContext } from '../../context/AuthContext';

export const InterviewerApplicantsScreen = ({ route, navigation }: any) => {
  const { user } = useContext(AuthContext);
  const { jobId } = route.params || {};
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, shortlisted, rejected
  
  useEffect(() => {
    if (user) fetchApplicants();
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchApplicants();
    });
    return unsubscribe;
  }, [navigation, jobId, user]);

  const fetchApplicants = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // If no specific jobId is provided, we first need to find all jobs owned by this interviewer
      let targetJobIds = jobId ? [jobId] : [];
      
      if (!jobId) {
        const { data: myJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('created_by', user.id);
        
        if (myJobs && myJobs.length > 0) {
          targetJobIds = myJobs.map(j => j.id);
        } else {
          // No jobs owned, so no applicants to show
          setApplicants([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('applications')
        .select(`
          id,
          status,
          user_id,
          job_id,
          profiles (
            full_name, 
            trade, 
            district,
            interviews (average_score, classification, confidence_score, job_id)
          )
        `)
        .in('job_id', targetJobIds);

      const { data, error } = await query;

      if (error) throw error;
      
      const transformed = (data || []).map(app => {
        const jobInterview = (app.profiles as any)?.interviews?.find((i: any) => i.job_id === app.job_id) || 
                            (app.profiles as any)?.interviews?.[0];

        // Map 'applied' to 'pending' for consistency if needed
        const normalizedStatus = app.status === 'applied' ? 'pending' : app.status;

        return {
          id: app.id,
          userId: app.user_id,
          jobId: app.job_id,
          name: (app.profiles as any)?.full_name || 'Unknown',
          trade: (app.profiles as any)?.trade || 'N/A',
          district: (app.profiles as any)?.district || 'N/A',
          score: Math.round(Number(jobInterview?.average_score || 0)),
          classification: jobInterview?.classification || 'Pending',
          confidence: jobInterview?.confidence_score || 0,
          status: normalizedStatus
        };
      });

      const sorted = transformed.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.confidence - a.confidence;
      });

      setApplicants(sorted);
    } catch (err) {
      console.error('Error fetching applicants:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredApplicants = applicants.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const renderApplicantItem = ({ item, index }: { item: any, index: number }) => (
    <AppCard 
      style={styles.applicantCard}
      onPress={() => navigation.navigate('CandidateDetail', { candidateId: item.userId, jobId: item.jobId })}
    >
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, index < 3 && styles.topRank]}>#{index + 1}</Text>
      </View>
      
      <View style={styles.cardMain}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.candidateName} numberOfLines={1}>{item.name}</Text>
            </View>
            <Text style={styles.candidateInfo}>{item.trade} • {item.district}</Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: item.score >= 80 ? '#f0fdf4' : '#fff7ed' }]}>
            <Text style={[styles.scoreText, { color: item.score >= 80 ? '#16a34a' : '#ea580c' }]}>
              {item.score}%
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusTextSmall}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.confidenceText}>Confidence: {item.confidence}%</Text>
        </View>
      </View>
    </AppCard>
  );

  function getStatusColor(status: string) {
    switch (status) {
      case 'shortlisted': return '#16a34a';
      case 'rejected': return '#dc2626';
      case 'pending': return '#64748b';
      default: return '#64748b';
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {jobId && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Applicants Ranking</Text>
        </View>
        
        <View style={styles.filterRow}>
          {['all', 'pending', 'shortlisted', 'rejected'].map((f) => (
            <TouchableOpacity 
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredApplicants}
          renderItem={renderApplicantItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.colors.border} />
              <Text style={styles.emptyText}>No applicants found for this criteria.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: '#fff',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterBtnActive: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterTextActive: {
    color: theme.colors.primary,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  applicantCard: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 0,
    overflow: 'hidden',
  },
  rankContainer: {
    width: 44,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  topRank: {
    color: theme.colors.primary,
    fontSize: 18,
  },
  cardMain: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  candidateInfo: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classificationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  classificationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTextSmall: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
});
