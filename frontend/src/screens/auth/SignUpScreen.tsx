import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { registerUser } from '../../services/supabase/auth';
import { AuthContext } from '../../context/AuthContext';

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

interface Props {
  navigation: SignUpScreenNavigationProp;
}

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!name) errors.name = t('filling_fields');
    if (!email) {
      errors.email = t('filling_fields');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!password) {
      errors.password = t('filling_fields');
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError('');
      await registerUser(name, email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('create_account')}</Text>
          <Text style={styles.subtitle}>{t('join_skillfit')}</Text>
        </View>

        {error ? <Text style={styles.globalError}>{error}</Text> : null}

        <Input
          label={t('full_name_label')}
          placeholder={t('enter_full_name')}
          value={name}
          onChangeText={setName}
          error={validationErrors.name}
        />

        <Input
          label={t('email_label')}
          placeholder={t('enter_email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={validationErrors.email}
        />

        <Input
          label={t('password_label')}
          placeholder={t('enter_password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={validationErrors.password}
        />

        <Input
          label={t('password_label')}
          placeholder={t('enter_password')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={validationErrors.confirmPassword}
        />

        <View style={styles.buttonContainer}>
          <Button 
            title={t('signup_btn')} 
            onPress={handleSignUp} 
            loading={loading} 
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('have_account')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>{t('login_link')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  globalError: {
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
  },
  buttonContainer: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#6b7280',
  },
  footerLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
