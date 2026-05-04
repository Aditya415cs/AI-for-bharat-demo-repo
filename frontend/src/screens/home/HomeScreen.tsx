import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { theme } from '../../theme';
import { AppCard } from '../../components/AppCard';
import { AppButton } from '../../components/AppButton';

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { profile, t, language } = useContext(AuthContext);

  const langCode = language?.toUpperCase() || 'EN';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('welcome')}, {profile?.full_name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.subtitle}>{t('ready_interview')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.langButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="language" size={20} color={theme.colors.primary} />
            <Text style={styles.langText}>{langCode}</Text>
          </TouchableOpacity>
        </View>

        {/* Primary Action Card */}
        <AppCard style={styles.mainCard}>
          <View style={styles.mainCardContent}>
            <View style={styles.mainCardText}>
              <Text style={styles.mainCardTitle}>{t('practice_session')}</Text>
              <Text style={styles.mainCardDesc}>{t('boost_confidence')}</Text>
              <AppButton 
                title={t('start_interview')} 
                variant="primary" 
                style={styles.startBtn}
                textStyle={{ color: theme.colors.primary }}
                onPress={() => navigation.navigate('InterviewIntro')}
              />
            </View>
            <View style={styles.aiIconContainer}>
              <Ionicons name="sparkles" size={64} color="#fff" />
            </View>
          </View>
        </AppCard>

        {/* Jobs Shortcut Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('jobs')}</Text>
        </View>
        <AppCard style={styles.jobsCard} variant="outlined">
          <View style={styles.jobsContent}>
            <View style={styles.jobsIconContainer}>
              <Ionicons name="briefcase" size={32} color={theme.colors.secondary} />
            </View>
            <View style={styles.jobsTextContainer}>
              <Text style={styles.jobsTitle}>New Job Openings!</Text>
              <Text style={styles.jobsSubtitle}>Find companies looking for {profile?.trade || 'skilled workers'}.</Text>
            </View>
            <TouchableOpacity 
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Jobs')}
            >
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </AppCard>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <AppCard style={styles.statCard}>
            <Text style={styles.statLabel}>{t('interviews')}</Text>
            <Text style={styles.statValue}>12</Text>
          </AppCard>
          <AppCard style={styles.statCard}>
            <Text style={styles.statLabel}>{t('avg_score')}</Text>
            <Text style={styles.statValue}>84%</Text>
          </AppCard>
        </View>

        {/* Secondary Sections */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('explore')}</Text>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity 
            style={styles.gridItem} 
            onPress={() => navigation.navigate('Jobs')}
            activeOpacity={0.7}
          >
            <AppCard style={styles.gridCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="briefcase" size={24} color={theme.colors.secondary} />
              </View>
              <Text style={styles.gridLabel}>{t('jobs')}</Text>
            </AppCard>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem} 
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.7}
          >
            <AppCard style={styles.gridCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: '#eef2ff' }]}>
                <Ionicons name="time" size={24} color={theme.colors.primary} />
              </View>
              <Text style={styles.gridLabel}>{t('history')}</Text>
            </AppCard>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem} 
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <AppCard style={styles.gridCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="person" size={24} color={theme.colors.secondary} />
              </View>
              <Text style={styles.gridLabel}>{t('profile')}</Text>
            </AppCard>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Help')}
          >
            <AppCard style={styles.gridCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="help-circle" size={24} color={theme.colors.accent} />
              </View>
              <Text style={styles.gridLabel}>{t('help')}</Text>
            </AppCard>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} activeOpacity={0.7}>
            <AppCard style={styles.gridCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: '#fdf2f8' }]}>
                <Ionicons name="settings" size={24} color="#db2777" />
              </View>
              <Text style={styles.gridLabel}>{t('settings')}</Text>
            </AppCard>
          </TouchableOpacity>
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
  scrollContent: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  langText: {
    marginLeft: 4,
    fontWeight: '600',
    color: theme.colors.text,
  },
  mainCard: {
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainCardText: {
    flex: 1,
    paddingRight: 12,
  },
  mainCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  mainCardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    lineHeight: 20,
  },
  startBtn: {
    backgroundColor: '#fff',
    height: 44,
    width: 160,
  },
  aiIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: theme.spacing.md,
  },
  gridCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  jobsCard: {
    padding: 16,
    marginBottom: theme.spacing.xl,
    backgroundColor: '#fff',
    borderColor: theme.colors.secondary,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  jobsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobsIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  jobsTextContainer: {
    flex: 1,
  },
  jobsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  jobsSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  browseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
