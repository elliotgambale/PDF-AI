// src/screens/main/FileUploadScreen.tsx
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import DocumentPicker from 'react-native-document-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { ApiService } from '../../services/ApiService';
import { AppContext } from '../../../App';
import { MainStackParamList, COLORS } from '../../types';

type FileUploadNavigationProp = StackNavigationProp<MainStackParamList, 'FileUpload'>;

interface Props {
  navigation: FileUploadNavigationProp;
}

interface SelectedFile {
  uri: string;
  name: string;
  size?: number;
  type: string;
}

const FileUploadScreen: React.FC<Props> = ({ navigation }) => {
  const { setCurrentPDF, refreshDatabaseStatus } = useContext(AppContext);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [startPage, setStartPage] = useState('1');
  const [endPage, setEndPage] = useState('');
  const [uploading, setUploading] = useState(false);

  const selectFile = async () => {
  try {
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.pdf],
      copyTo: 'cachesDirectory',
    });

    if (result && result.length > 0) {
      const file = result[0];
      const newFile: SelectedFile = {
        uri: file.fileCopyUri || file.uri,
        name: file.name || 'Unknown.pdf',
        size: file.size || undefined,
        type: file.type || 'application/pdf',
      };
      setSelectedFile(newFile);
    }
  } catch (error) {
    if (DocumentPicker.isCancel(error)) {
      // User cancelled the picker
    } else {
      Alert.alert('Error', 'Failed to select file');
    }
  }
};

const validatePageRange = (): boolean => {
  const startNum = Number(startPage);
  const endNum = endPage.trim() === '' ? undefined : Number(endPage);

  if (!Number.isInteger(startNum) || startNum < 1) {
    Alert.alert('Invalid Input', 'Start page must be a positive number');
    return false;
  }

  if (endNum !== undefined && (!Number.isInteger(endNum) || endNum < startNum)) {
    Alert.alert('Invalid Input', 'End page must be a valid number greater than or equal to start page');
    return false;
  }

  return true;
};

  const uploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('No File Selected', 'Please select a PDF file first');
      return;
    }

    if (!validatePageRange()) {
      return;
    }

    setUploading(true);

    try {
      const result = await ApiService.uploadPDF(
        selectedFile.uri,
        selectedFile.name,
        startPage,
        endPage
      );

      if (result.success) {
        Alert.alert(
          'Success',
          `PDF uploaded successfully! ${result.chunk_count} chunks processed.`,
          [
            {
              text: 'Start Chatting',
              onPress: async () => {
                // Get the uploaded PDF details
                try {
                  const pdfData = await ApiService.getPDFs();
                  if (pdfData.success) {
                    const uploadedPDF = pdfData.pdfs.find(pdf => pdf.id === result.pdf_id);
                    if (uploadedPDF) {
                      setCurrentPDF(uploadedPDF);
                      navigation.navigate('Chat', { pdf: uploadedPDF });
                    }
                  }
                } catch (error) {
                  navigation.navigate('PDFLibrary');
                }
                await refreshDatabaseStatus();
              },
            },
            {
              text: 'View Library',
              onPress: () => {
                navigation.navigate('PDFLibrary');
                refreshDatabaseStatus();
              },
            },
          ]
        );
        
        // Reset form
        setSelectedFile(null);
        setStartPage('1');
        setEndPage('');
      } else {
        Alert.alert('Upload Failed', result.error || 'Failed to upload PDF');
      }
    } catch (error) {
      Alert.alert('Upload Failed', 'An error occurred while uploading the file');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Icon name="upload-file" size={32} color={COLORS.primary} />
            <Text style={styles.title}>Upload PDF Document</Text>
            <Text style={styles.subtitle}>
              Select a PDF file and specify the page range to process
            </Text>
          </View>

          {/* File Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select PDF File</Text>
            
            {!selectedFile ? (
              <TouchableOpacity style={styles.fileSelector} onPress={selectFile}>
                <Icon name="folder-open" size={48} color={COLORS.textSecondary} />
                <Text style={styles.fileSelectorText}>Tap to select PDF file</Text>
                <Text style={styles.fileSelectorHint}>
                  Only PDF files are supported
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.selectedFile}>
                <View style={styles.fileInfo}>
                  <Icon name="picture-as-pdf" size={32} color={COLORS.error} />
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={2}>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {formatFileSize(selectedFile.size || 0)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={removeFile}>
                  <Icon name="close" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Page Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Page Range (Optional)</Text>
            <Text style={styles.sectionDescription}>
              Specify which pages to process. Leave end page empty to process to the end.
            </Text>
            
            <View style={styles.pageRangeContainer}>
              <View style={styles.pageInputContainer}>
                <Text style={styles.inputLabel}>Start Page</Text>
                <TextInput
                  style={styles.pageInput}
                  value={startPage}
                  onChangeText={setStartPage}
                  placeholder="1"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              
              <View style={styles.pageRangeSeparator}>
                <Text style={styles.separatorText}>to</Text>
              </View>
              
              <View style={styles.pageInputContainer}>
                <Text style={styles.inputLabel}>End Page</Text>
                <TextInput
                  style={styles.pageInput}
                  value={endPage}
                  onChangeText={setEndPage}
                  placeholder="(all pages)"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Upload Instructions */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>What happens next?</Text>
            <View style={styles.infoSteps}>
              <View style={styles.infoStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  PDF content is extracted and processed
                </Text>
              </View>
              <View style={styles.infoStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Text is split into chunks and embedded
                </Text>
              </View>
              <View style={styles.infoStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  You can immediately start chatting!
                </Text>
              </View>
            </View>
          </View>

          {/* Upload Button */}
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!selectedFile || uploading) && styles.uploadButtonDisabled
            ]}
            onPress={uploadFile}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Icon name="cloud-upload" size={24} color="white" />
            )}
            <Text style={styles.uploadButtonText}>
              {uploading ? 'Processing PDF...' : 'Upload & Process PDF'}
            </Text>
          </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  fileSelector: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileSelectorText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 12,
  },
  fileSelectorHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  selectedFile: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  removeButton: {
    padding: 8,
  },
  pageRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pageInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  pageInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    color: COLORS.text,
  },
  pageRangeSeparator: {
    paddingTop: 24,
  },
  separatorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoSteps: {
    gap: 12,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  uploadButton: {
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
  uploadButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default FileUploadScreen;