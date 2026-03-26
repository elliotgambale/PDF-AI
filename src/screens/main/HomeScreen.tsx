// src/screens/main/HomeScreen.tsx
import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { AppContext } from '../../../App';
import { ApiService } from '../../services/ApiService';
import { AuthService } from '../../services/AuthService';
import DatabaseStatus from '../../components/DatabaseStatus';
import { MainStackParamList, PDF, COLORS } from '../../types';

type HomeScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, databaseStatus, refreshDatabaseStatus, logout } = useContext(AppContext);
  const [recentPDFs, setRecentPDFs] = useState<PDF[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const loadRecentPDFs = async () => {
    try {
      const result = await ApiService.getPDFs();
      if (result.success) {
        // Show most recent 3 PDFs
        const recent = result.pdfs
          .sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime())
          .slice(0, 3);
        setRecentPDFs(recent);
      }
    } catch (error) {
      console.error('Failed to load recent PDFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshDatabaseStatus(),
      loadRecentPDFs()
    ]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadRecentPDFs();
      refreshDatabaseStatus();
    }, [])
  );

  const handleInitializeDB = async () => {
    setIsInitializing(true);
    try {
      const result = await ApiService.initializeDatabase();
      if (result.success) {
        Alert.alert('Success', 'Database initialized successfully!');
        await refreshDatabaseStatus();
      } else {
        Alert.alert('Error', result.error || 'Failed to initialize database');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize database');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleClearDB = () => {
    Alert.alert(
      'Clear Database',
      'Are you sure you want to clear all data? This will delete all PDFs and chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await ApiService.clearDatabase();
              if (result.success) {
                Alert.alert('Success', 'Database cleared successfully!');
                await Promise.all([
                  refreshDatabaseStatus(),
                  loadRecentPDFs()
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to clear database');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to clear database');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderUserProfile = () => (
    <View style={styles.profileContainer}>
      <View style={styles.profileInfo}>
        {user?.photo ? (
          <Image source={{ uri: user.photo }} style={styles.profileImage} />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Text style={styles.profileImageText}>
              {AuthService.getUserInitials(user!)}
            </Text>
          </View>
        )}
        <View style={styles.profileText}>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('FileUpload')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${COLORS.primary}20` }]}>
            <Icon name="upload-file" size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.quickActionLabel}>Upload PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('PDFLibrary')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${COLORS.success}20` }]}>
            <Icon name="library-books" size={24} color={COLORS.success} />
          </View>
          <Text style={styles.quickActionLabel}>View Library</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRecentPDFs = () => (
    <View style={styles.recentContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent PDFs</Text>
        {recentPDFs.length > 0 && (
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('PDFLibrary')}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Icon name="chevron-right" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
      ) : recentPDFs.length > 0 ? (
        <View style={styles.recentList}>
          {recentPDFs.map((pdf) => (
            <TouchableOpacity
              key={pdf.id}
              style={styles.recentItem}
              onPress={() => navigation.navigate('Chat', { pdf })}
            >
              <Icon name="picture-as-pdf" size={20} color={COLORS.error} />
              <View style={styles.recentItemInfo}>
                <Text style={styles.recentItemTitle} numberOfLines={1}>
                  {pdf.original_name}
                </Text>
                <Text style={styles.recentItemSubtitle}>
                  {formatDate(pdf.upload_date)} • {pdf.chunk_count} chunks
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="folder-open" size={32} color={COLORS.textSecondary} />
          <Text style={styles.emptyStateText}>No PDFs uploaded yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Upload your first PDF to get started
          </Text>
        </View>
      )}
    </View>
  );

  const renderStats = () => {
    const totalPDFs = recentPDFs.length; // This would be the total count in a real app
    const totalChunks = recentPDFs.reduce((sum, pdf) => sum + pdf.chunk_count, 0);
    const totalChats = recentPDFs.reduce((sum, pdf) => sum + (pdf.message_count || 0), 0);

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Your Activity</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Icon name="description" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{totalPDFs}</Text>
            <Text style={styles.statLabel}>PDFs</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="auto-stories" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>{totalChunks}</Text>
            <Text style={styles.statLabel}>Chunks</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="chat" size={24} color={COLORS.warning} />
            <Text style={styles.statNumber}>{totalChats}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderUserProfile()}
        
        <DatabaseStatus
          status={databaseStatus}
          onInitialize={handleInitializeDB}
          onClear={handleClearDB}
          isInitializing={isInitializing}
        />

        {databaseStatus?.success && databaseStatus.has_data && (
          <>
            {renderQuickActions()}
            {renderStats()}
            {renderRecentPDFs()}
          </>
        )}

        {(!databaseStatus?.success || !databaseStatus.has_data) && (
          <View style={styles.getStartedContainer}>
            <Icon name="rocket-launch" size={48} color={COLORS.primary} />
            <Text style={styles.getStartedTitle}>Get Started</Text>
            <Text style={styles.getStartedText}>
              Initialize your database and upload your first PDF to start chatting with AI about your documents.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  profileImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileImageText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  profileText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  logoutButton: {
    padding: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  quickActionsContainer: {
    marginBottom: 32,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
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
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
  },
  statsContainer: {
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
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
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  recentContainer: {
    marginBottom: 32,
  },
  recentList: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
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
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  recentItemInfo: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  recentItemSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  loader: {
    paddingVertical: 20,
  },
  getStartedContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  getStartedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  getStartedText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default HomeScreen;