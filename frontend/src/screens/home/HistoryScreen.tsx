import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { supabase } from '../../services/supabase/config';
import { AuthContext } from '../../context/AuthContext';
import { AppCard } from '../../components/AppCard';

export const HistoryScreen = ({ navigation }: any) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch applications
      const { data: apps, error: appError } = await supabase
        .from('applications')
        .select(`
          id,
          status,
          job_id,
          created_at,
          jobs (
            id,
            title,
            location,
            companies (company_name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (appError) throw appError;

      // 2. Fetch interviews for this user
      const { data: interviews, error: intError } = await supabase
        .from('interviews')
        .select('score, classification, job_id')
        .eq('user_id', user.id);
      
      if (intError) throw intError;

      // 3. Merge data
      const merged = (apps || []).map(app => ({
        ...app,
        interviews: interviews?.filter(i => i.job_id === app.job_id) || []
      }));

      setApplications(merged);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'shortlisted': return '#16a34a';
      case 'rejected': return '#dc2626';
      case 'marked_for_training': return '#ea580c';
      default: return theme.colors.primary;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <AppCard 
      style={styles.card} 
      onPress={() => navigation.navigate('JobDetail', { jobId: item.jobs.id })}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle}>{item.jobs?.title}</Text>
          <Text style={styles.companyName}>{item.jobs?.companies?.company_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status?.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        
        {item.interviews?.[0] && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>Score: {item.interviews[0].score}%</Text>
          </View>
        )}
      </View>
    </AppCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Applications</Text>
        <TouchableOpacity onPress={fetchHistory} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={applications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={64} color={theme.colors.border} />
              <Text style={styles.emptyText}>You haven't applied for any jobs yet.</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  refreshBtn: {
    padding: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  companyName: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  scoreBadge: {
    backgroundColor: theme.colors.secondary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
});
