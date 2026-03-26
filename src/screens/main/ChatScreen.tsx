// src/screens/main/ChatScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { ApiService } from '../../services/ApiService';
import { PDF, ChatMessage, MainStackParamList, COLORS } from '../../types';

type ChatScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Chat'>;
type ChatScreenRouteProp = RouteProp<MainStackParamList, 'Chat'>;

interface Props {
  navigation: ChatScreenNavigationProp;
  route: ChatScreenRouteProp;
}

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const pdf: PDF = route.params?.pdf;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (pdf) {
      loadChatHistory();
    }
  }, [pdf]);

  const loadChatHistory = async () => {
    try {
      const result = await ApiService.getChatHistory(pdf.id);
      if (result.success) {
        setMessages(result.messages);
        // Scroll to bottom after messages load
        setTimeout(() => {
          if (result.messages.length > 0) {
            scrollToBottom();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const sendMessage = async () => {
    const messageText = inputText.trim();
    if (!messageText || loading) return;

    setInputText('');
    setLoading(true);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now(),
      pdf_id: pdf.id,
      message_type: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Scroll to bottom
    setTimeout(scrollToBottom, 100);

    try {
      const response = await ApiService.chatWithPDF(pdf.id, messageText);
      
      if (response.success && response.response) {
        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: Date.now() + 1,
          pdf_id: pdf.id,
          message_type: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
          sources_used: response.sources_count,
          context_used: response.context_used,
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
      } else {
        Alert.alert('Error', response.error || 'Failed to get response');
        // Remove the user message on error
        setMessages(prev => prev.slice(0, -1));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearChatHistory = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear all chat messages for this PDF?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await ApiService.clearChatHistory(pdf.id);
              if (result.success) {
                setMessages([]);
                Alert.alert('Success', 'Chat history cleared');
              } else {
                Alert.alert('Error', result.error || 'Failed to clear chat history');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to clear chat history');
            }
          },
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.message_type === 'user';
    const isLastMessage = index === messages.length - 1;

    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        isLastMessage && styles.lastMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.assistantMessage
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText
          ]}>
            {item.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.assistantTimestamp
            ]}>
              {formatTimestamp(item.timestamp)}
            </Text>
            
            {!isUser && item.context_used && (
              <View style={styles.contextIndicator}>
                <Icon name="description" size={12} color={COLORS.success} />
                <Text style={styles.contextText}>
                  {item.sources_used || 0} sources
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="chat" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>Start a conversation</Text>
      <Text style={styles.emptySubtitle}>
        Ask questions about "{pdf?.original_name}" and get AI-powered answers based on the document content.
      </Text>
    </View>
  );

  if (!pdf) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>No PDF selected</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="picture-as-pdf" size={24} color={COLORS.error} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {pdf.original_name}
              </Text>
              <Text style={styles.headerSubtitle}>
                {pdf.chunk_count} chunks • {messages.filter(m => m.message_type === 'user').length} questions
              </Text>
            </View>
          </View>
          
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearChatHistory}
            >
              <Icon name="clear-all" size={20} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          {loadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading chat history...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              contentContainerStyle={styles.messagesList}
              ListEmptyComponent={EmptyState}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
            />
          )}
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask a question about this PDF..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={1000}
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || loading) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  lastMessage: {
    marginBottom: 32,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  assistantMessageText: {
    color: COLORS.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  userTimestamp: {
    color: 'white',
  },
  assistantTimestamp: {
    color: COLORS.textSecondary,
  },
  contextIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  contextText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '500',
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
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
});

export default ChatScreen;