// src/screens/auth/ForgotUsernameScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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
import { AuthStackParamList, COLORS } from '../../types';

type ForgotUsernameNavigationProp = StackNavigationProp<AuthStackParamList, 'ForgotUsername'>;

interface Props {
  navigation: ForgotUsernameNavigationProp;
}

const ForgotUsernameScreen: React.FC<Props> = ({ navigation }) => {
  const [recoveryMethod, setRecoveryMethod] = useState<'email' | 'phone'>('email');
  const [recoveryValue, setRecoveryValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleRecoverUsername = async () => {
    if (!recoveryValue.trim()) {
      Alert.alert(
        'Required Field',
        `Please enter your ${recoveryMethod === 'email' ? 'email address' : 'phone number'}.`
      );
      return;
    }

    // Validate input based on recovery method
    if (recoveryMethod === 'email' && !AuthService.isValidEmail(recoveryValue)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (recoveryMethod === 'phone' && !AuthService.isValidPhoneNumber(recoveryValue)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);

    try {
      await AuthService.recoverUsername(recoveryMethod, recoveryValue);
      setRequestSent(true);
      Alert.alert(
        'Recovery Information Sent',
        `We've sent your username recovery information to your ${recoveryMethod}. Please check your ${recoveryMethod === 'email' ? 'inbox' : 'messages'}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Recovery Failed',
        error.message || 'Failed to send recovery information. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
    return recoveryMethod === 'email' ? 'Enter your email address' : 'Enter your phone number';
  };

  const getInputIcon = () => {
    return recoveryMethod === 'email' ? 'email' : 'phone';
  };

  const getKeyboardType = () => {
    return recoveryMethod === 'email' ? 'email-address' : 'phone-pad';
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
            <View style={styles.iconContainer}>
              <Icon name="person-search" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Recover Username</Text>
            <Text style={styles.subtitle}>
              Enter your recovery information and we'll help you find your username.
            </Text>
          </View>

          {/* Recovery Method Selection */}
          <View style={styles.methodContainer}>
            <Text style={styles.methodTitle}>How would you like to recover your username?</Text>
            
            <View style={styles.methodOptions}>
              <TouchableOpacity
                style={[
                  styles.methodOption,
                  recoveryMethod === 'email' && styles.methodOptionSelected
                ]}
                onPress={() => {
                  setRecoveryMethod('email');
                  setRecoveryValue('');
                }}
                disabled={loading || requestSent}
              >
                <Icon 
                  name="email" 
                  size={24} 
                  color={recoveryMethod === 'email' ? COLORS.primary : COLORS.textSecondary} 
                />
                <View style={styles.methodTextContainer}>
                  <Text style={[
                    styles.methodLabel,
                    recoveryMethod === 'email' && styles.methodLabelSelected
                  ]}>
                    Email Address
                  </Text>
                  <Text style={styles.methodDescription}>
                    We'll send your username to your email
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodOption,
                  recoveryMethod === 'phone' && styles.methodOptionSelected
                ]}
                onPress={() => {
                  setRecoveryMethod('phone');
                  setRecoveryValue('');
                }}
                disabled={loading || requestSent}
              >
                <Icon 
                  name="phone" 
                  size={24} 
                  color={recoveryMethod === 'phone' ? COLORS.primary : COLORS.textSecondary} 
                />
                <View style={styles.methodTextContainer}>
                  <Text style={[
                    styles.methodLabel,
                    recoveryMethod === 'phone' && styles.methodLabelSelected
                  ]}>
                    Phone Number
                  </Text>
                  <Text style={styles.methodDescription}>
                    We'll send your username via SMS
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {recoveryMethod === 'email' ? 'Email Address' : 'Phone Number'}
              </Text>
              <View style={styles.inputWrapper}>
                <Icon 
                  name={getInputIcon()} 
                  size={20} 
                  color={COLORS.textSecondary} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.textInput}
                  value={recoveryValue}
                  onChangeText={setRecoveryValue}
                  placeholder={getPlaceholder()}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType={getKeyboardType()}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !requestSent}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.recoverButton,
                (!recoveryValue.trim() || loading || requestSent) && styles.recoverButtonDisabled
              ]}
              onPress={handleRecoverUsername}
              disabled={!recoveryValue.trim() || loading || requestSent}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={20} color="white" />
              )}
              <Text style={styles.recoverButtonText}>
                {loading ? 'Sending...' : requestSent ? 'Information Sent' : 'Send Recovery Info'}
              </Text>
            </TouchableOpacity>

            {requestSent && (
              <View style={styles.successMessage}>
                <Icon name="check-circle" size={20} color={COLORS.success} />
                <Text style={styles.successText}>
                  Recovery information sent to your {recoveryMethod}
                </Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Need help?</Text>
            
            <View style={styles.instructionsList}>
              <View style={styles.instructionItem}>
                <Icon name="info" size={16} color={COLORS.primary} />
                <Text style={styles.instructionText}>
                  Make sure to check your spam/junk folder
                </Text>
              </View>
              
              <View style={styles.instructionItem}>
                <Icon name="schedule" size={16} color={COLORS.primary} />
                <Text style={styles.instructionText}>
                  It may take a few minutes to receive the message
                </Text>
              </View>
              
              <View style={styles.instructionItem}>
                <Icon name="security" size={16} color={COLORS.primary} />
                <Text style={styles.instructionText}>
                  We only send usernames to verified accounts
                </Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={styles.backButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.linkText}>Forgot your password?</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  methodContainer: {
    marginBottom: 24,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  methodOptions: {
    gap: 12,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  methodOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  methodTextContainer: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  methodLabelSelected: {
    color: COLORS.primary,
  },
  methodDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 16,
  },
  recoverButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recoverButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  recoverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.success}20`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  successText: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '500',
  },
  instructionsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
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
});

export default ForgotUsernameScreen;