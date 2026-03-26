// src/screens/main/PDFLibraryScreen.tsx
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Import context and types
import { AppContext } from '../../../App';
import { PDF, COLORS } from '../../types';
import { ApiService } from '../../services/ApiService';
import { MainStackParamList } from '../../../App';

type PDFLibraryScreenNavigationProp = StackNavigationProp<MainStackParamList>;

interface PDFItemProps {
  pdf: PDF;
  onPress: (pdf: PDF) => void;
  onDelete: (pdf: PDF) => void;
  onShare: (pdf: PDF) => void;
}

const PDFItem: React.FC<PDFItemProps> = ({ pdf, onPress, onDelete, onShare }) => {
  const [showOptions, setShowOptions] = useState(false);

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

  return (
    <TouchableOpacity 
      style={styles.pdfItem} 
      onPress={() => onPress(pdf)}
      activeOpacity={0.7}
    >
      <View style={styles.pdfInfo}>
        <View style={styles.pdfIcon}>
          <Icon name="picture-as-pdf" size={32} color={COLORS.error} />
        </View>
        <View style={styles.pdfDetails}>
          <Text style={styles.pdfName} numberOfLines={2}>
            {pdf.original_name}
          </Text>
          <Text style={styles.pdfMetadata}>
            {pdf.chunk_count} chunks • {formatDate(pdf.upload_date)}
          </Text>
          {pdf.has_chat_history && (
            <Text style={styles.pdfDescription}>
              {pdf.message_count} messages
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.optionsButton}
        onPress={() => setShowOptions(true)}
      >
        <Icon name="more-vert" size={24} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowOptions(false)}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptions(false);
                onPress(pdf);
              }}
            >
              <Icon name="chat" size={20} color={COLORS.primary} />
              <Text style={styles.optionText}>Open Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptions(false);
                onShare(pdf);
              }}
            >
              <Icon name="share" size={20} color={COLORS.success} />
              <Text style={styles.optionText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, styles.deleteOption]}
              onPress={() => {
                setShowOptions(false);
                onDelete(pdf);
              }}
            >
              <Icon name="delete" size={20} color={COLORS.error} />
              <Text style={[styles.optionText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
};

const PDFLibraryScreen: React.FC = () => {
  const navigation = useNavigation<PDFLibraryScreenNavigationProp>();
  const { user, setCurrentPDF } = useContext(AppContext);
  
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [filteredPdfs, setFilteredPdfs] = useState<PDF[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'chunks'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadPDFs();
  }, []);

  useEffect(() => {
    filterAndSortPDFs();
  }, [pdfs, searchQuery, sortBy, sortOrder]);

  const loadPDFs = async () => {
    try {
      setLoading(true);
      const result = await ApiService.getPDFs();
      if (result.success) {
        setPdfs(result.pdfs);
      } else {
        Alert.alert('Error', result.error || 'Failed to load PDFs');
      }
    } catch (error) {
      console.error('Error loading PDFs:', error);
      Alert.alert('Error', 'Failed to load PDF library');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPDFs();
    setRefreshing(false);
  };

  const filterAndSortPDFs = () => {
    let filtered = pdfs.filter(pdf =>
      pdf.original_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.original_name.localeCompare(b.original_name);
          break;
        case 'date':
          comparison = new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime();
          break;
        case 'chunks':
          comparison = a.chunk_count - b.chunk_count;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredPdfs(filtered);
  };

  const handlePDFPress = (pdf: PDF) => {
    setCurrentPDF(pdf);
    navigation.navigate('Chat', { pdf });
  };

  const handleDeletePDF = (pdf: PDF) => {
    Alert.alert(
      'Delete PDF',
      `Are you sure you want to delete "${pdf.original_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await ApiService.deletePDF(pdf.id);
              if (result.success) {
                setPdfs(prev => prev.filter(p => p.id !== pdf.id));
                Alert.alert('Success', 'PDF deleted successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete PDF');
              }
            } catch (error) {
              console.error('Error deleting PDF:', error);
              Alert.alert('Error', 'Failed to delete PDF');
            }
          },
        },
      ]
    );
  };

  const handleSharePDF = async (pdf: PDF) => {
    try {
      await Share.share({
        message: `Check out this PDF: ${pdf.original_name}`,
        title: pdf.original_name,
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
    }
  };

  const toggleSort = (newSortBy: 'name' | 'date' | 'chunks') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="library-books" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No PDFs Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'No PDFs match your search' : 'Upload your first PDF to get started'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => navigation.navigate('FileUpload')}
        >
          <Icon name="add" size={20} color="#ffffff" />
          <Text style={styles.uploadButtonText}>Upload PDF</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search PDFs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="clear" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'date' && styles.sortButtonActive]}
          onPress={() => toggleSort('date')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'date' && styles.sortButtonTextActive]}>
            Date {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
          onPress={() => toggleSort('name')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
            Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'chunks' && styles.sortButtonActive]}
          onPress={() => toggleSort('chunks')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'chunks' && styles.sortButtonTextActive]}>
            Chunks {sortBy === 'chunks' && (sortOrder === 'desc' ? '↓' : '↑')}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredPdfs.length} of {pdfs.length} PDFs
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your PDF library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPdfs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PDFItem
            pdf={item}
            onPress={handlePDFPress}
            onDelete={handleDeletePDF}
            onShare={handleSharePDF}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={filteredPdfs.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
  },
  sortContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#ffffff',
  },
  statsContainer: {
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  pdfItem: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pdfInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfIcon: {
    marginRight: 12,
  },
  pdfDetails: {
    flex: 1,
  },
  pdfName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  pdfMetadata: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  pdfDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  optionsButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 8,
    minWidth: 150,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteOption: {
    backgroundColor: `${COLORS.error}10`,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  deleteText: {
    color: COLORS.error,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  uploadButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default PDFLibraryScreen;