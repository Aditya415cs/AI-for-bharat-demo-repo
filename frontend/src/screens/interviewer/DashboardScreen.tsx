import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { AuthContext } from '../../context/AuthContext';
import { AppCard } from '../../components/AppCard';
import { supabase } from '../../services/supabase/config';

export const InterviewerDashboardScreen = ({ navigation }: any) => {
  const { profile, t } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalApplicants: 0,
    jobReady: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // In a real app, these would be real queries. For now, we mock or count.
      const { count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true });
        
      const { count: appCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalJobs: jobsCount || 0,
        totalApplicants: appCount || 0,
        jobReady: Math.floor((appCount || 0) * 0.4), // Mock calculation
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome, {profile?.full_name?.split(' ')[0] || 'Interviewer'} 🏢</Text>
            <Text style={styles.subtitle}>Manage your job postings and candidates</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-circle" size={40} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <AppCard style={[styles.statCard, { backgroundColor: '#eef2ff' }]}>
                <Ionicons name="briefcase" size={24} color={theme.colors.primary} />
                <Text style={styles.statValue}>{stats.totalJobs}</Text>
                <Text style={styles.statLabel}>Jobs Posted</Text>
              </AppCard>
              <AppCard style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="people" size={24} color={theme.colors.secondary} />
                <Text style={styles.statValue}>{stats.totalApplicants}</Text>
                <Text style={styles.statLabel}>Applicants</Text>
              </AppCard>
              <AppCard style={[styles.statCard, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="ribbon" size={24} color={theme.colors.accent} />
                <Text style={styles.statValue}>{stats.jobReady}</Text>
                <Text style={styles.statLabel}>Job-Ready</Text>
              </AppCard>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('CreateJob')}
                >
                  <AppCard style={styles.actionCard} variant="outlined">
                    <View style={[styles.actionIcon, { backgroundColor: '#fdf2f8' }]}>
                      <Ionicons name="add-circle" size={28} color="#db2777" />
                    </View>
                    <Text style={styles.actionText}>Post New Job</Text>
                  </AppCard>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('Jobs')}
                >
                  <AppCard style={styles.actionCard} variant="outlined">
                    <View style={[styles.actionIcon, { backgroundColor: '#f0f9ff' }]}>
                      <Ionicons name="list" size={28} color="#0ea5e9" />
                    </View>
                    <Text style={styles.actionText}>View All Jobs</Text>
                  </AppCard>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    width: '31%',
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    width: '48%',
  },
  actionCard: {
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
