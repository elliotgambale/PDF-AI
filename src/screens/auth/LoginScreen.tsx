// src/screens/auth/LoginScreen.tsx
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { AuthService } from '../../services/AuthService';
import { AppContext } from '../../../App';
import { AuthStackParamList, COLORS } from '../../types';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { setUser, refreshDatabaseStatus } = useContext(AppContext);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      const user = await AuthService.signInWithGoogle();
      setUser(user);
      await refreshDatabaseStatus();
    } catch (error: any) {
      Alert.alert(
        'Sign In Failed',
        error.message || 'An error occurred during sign in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Icon name="description" size={64} color={COLORS.primary} />
              <Text style={styles.logoText}>PDF Chat AI</Text>
            </View>
            <Text style={styles.welcomeText}>
              Welcome back
            </Text>
            <Text style={styles.subtitleText}>
              Sign in to chat with your PDF documents using AI
            </Text>
          </View>

          {/* Sign In Options */}
          <View style={styles.signInContainer}>
            {/* Google Sign In */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                loading && styles.buttonDisabled
              ]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="login" size={20} color="white" />
              )}
              <Text style={styles.googleButtonText}>
                {loading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Sign In (Placeholder) */}
            <TouchableOpacity
              style={styles.emailButton}
              disabled={true} // Disabled for now
              activeOpacity={0.7}
            >
              <Icon name="email" size={20} color={COLORS.textSecondary} />
              <Text style={styles.emailButtonText}>
                Continue with Email (Coming Soon)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Links */}
          <View style={styles.footerLinks}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.linkText}>Forgot your password?</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('ForgotUsername')}
            >
              <Text style={styles.linkText}>Forgot your username?</Text>
            </TouchableOpacity>
          </View>

          {/* Features Preview */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>What you can do:</Text>
            
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Icon name="upload-file" size={20} color={COLORS.primary} />
                <Text style={styles.featureText}>Upload PDF documents</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="chat" size={20} color={COLORS.primary} />
                <Text style={styles.featureText}>Chat with AI about your documents</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="search" size={20} color={COLORS.primary} />
                <Text style={styles.featureText}>Get answers from document content</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="library-books" size={20} color={COLORS.primary} />
                <Text style={styles.featureText}>Manage your PDF library</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 12,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  signInContainer: {
    marginBottom: 32,
  },
  googleButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonDisabled: {
    backgroundColor: COLORS.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 16,
  },
  emailButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  footerLinks: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  featuresContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
});

export default LoginScreen;