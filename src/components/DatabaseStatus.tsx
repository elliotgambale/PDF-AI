// src/components/DatabaseStatus.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { DatabaseStatusResponse, COLORS } from '../types';

interface Props {
  status: DatabaseStatusResponse | null;
  onInitialize: () => void;
  onClear: () => void;
  isInitializing: boolean;
}

const DatabaseStatus: React.FC<Props> = ({
  status,
  onInitialize,
  onClear,
  isInitializing,
}) => {
  const getStatusColor = () => {
    if (!status) return COLORS.textSecondary;
    if (!status.success) return COLORS.error;
    if (status.has_data) return COLORS.success;
    return COLORS.warning;
  };

  const getStatusIcon = () => {
    if (!status) return 'help';
    if (!status.success) return 'error';
    if (status.has_data) return 'check-circle';
    return 'warning';
  };

  const getStatusText = () => {
    if (!status) return 'Checking database status...';
    if (!status.success) return status.error || 'Database connection failed';
    return status.message || 'Database status unknown';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusHeader}>
        <Icon name="storage" size={20} color={COLORS.textSecondary} />
        <Text style={styles.statusTitle}>Database Status</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusInfo}>
          <Icon 
            name={getStatusIcon()} 
            size={24} 
            color={getStatusColor()} 
          />
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
            {status?.system_type && (
              <Text style={styles.systemType}>
                System: {status.system_type}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          {(!status || !status.success || !status.has_data) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.initButton]}
              onPress={onInitialize}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="refresh" size={20} color="white" />
              )}
              <Text style={styles.buttonText}>
                {isInitializing ? 'Initializing...' : 'Initialize DB'}
              </Text>
            </TouchableOpacity>
          )}

          {status?.success && status.has_data && (
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={onClear}
            >
              <Icon name="clear" size={20} color={COLORS.error} />
              <Text style={[styles.buttonText, { color: COLORS.error }]}>
                Clear All Data
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {status?.success && status.has_data && (
        <View style={styles.successIndicator}>
          <Icon name="check" size={16} color={COLORS.success} />
          <Text style={styles.successText}>
            Ready for PDF uploads and chat!
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  systemType: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  initButton: {
    backgroundColor: COLORS.primary,
  },
  clearButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: `${COLORS.success}20`,
    borderRadius: 6,
    gap: 6,
  },
  successText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
});

export default DatabaseStatus;