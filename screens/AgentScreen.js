import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { processUserRequest } from '../services/aiService';
import * as AppFunctions from '../services/AppFunctions';

const { width } = Dimensions.get('window');

const toolMapping = {
  addExpense: AppFunctions.addExpense,
  getSpendingHistory: AppFunctions.getSpendingHistory,
  deleteLastExpense: AppFunctions.deleteLastExpense,
  answerUser: AppFunctions.answerUser,
  listExpenses: AppFunctions.listExpenses,
  updateExpense: AppFunctions.updateExpense,
  deleteExpenseById: AppFunctions.deleteExpenseById,
};

// Simplified Message Component - No animations on existing messages
const MessageBubble = React.memo(({ item, index, isLast }) => {
  const fadeAnim = useRef(new Animated.Value(isLast ? 0 : 1)).current;

  useEffect(() => {
    if (isLast) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [isLast]);

  return (
    <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
      {item.role === 'user' && (
        <View style={styles.userMessageContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userMessageText}>{item.content}</Text>
          </View>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      )}
      
      {item.role === 'system' && (
        <View style={styles.systemMessageContainer}>
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={16} color="#2563EB" />
          </View>
          <View style={styles.systemBubbleContainer}>
            <View style={styles.systemBubble}>
              <Text style={styles.systemMessageText}>{item.content}</Text>
            </View>
            <Text style={styles.timestampLeft}>{item.timestamp}</Text>
          </View>
        </View>
      )}
      
      {item.role === 'ai' && (
        <View style={styles.processingContainer}>
          <View style={styles.processingBubble}>
            <View style={styles.processingDot} />
            <Text style={styles.processingText}>Processing: {item.content.tool_name}</Text>
          </View>
        </View>
      )}
      
      {item.role === 'tool' && (
        <View style={styles.toolMessageContainer}>
          <View style={styles.toolBubble}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.toolResultText}>{item.content}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
});

// Simple Typing Indicator - No complex animations
const TypingIndicator = React.memo(() => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.assistantAvatar}>
        <Ionicons name="sparkles" size={16} color="#2563EB" />
      </View>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDots, { opacity }]}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
        </Animated.View>
      </View>
    </View>
  );
});

// Simple Send Button - Minimal animation
const SendButton = React.memo(({ onPress, disabled, hasText }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.sendButton,
        hasText && !disabled ? styles.sendButtonActive : styles.sendButtonInactive,
      ]}
      activeOpacity={0.8}>
      <Ionicons 
        name="arrow-up" 
        size={20} 
        color={hasText && !disabled ? "#FFFFFF" : "#9CA3AF"} 
      />
    </TouchableOpacity>
  );
});

export default function AgentScreen() {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([
    {
      role: 'system',
      content: 'Welcome! I\'m here to help you manage your expenses efficiently.',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);

  const flatListRef = useRef();
  const hasText = useMemo(() => userInput.trim().length > 0, [userInput]);

  // Simple scroll to end - no requestAnimationFrame
  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleUserSubmit = useCallback(async () => {
    if (!userInput.trim() || isLoading) return;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const userMessage = { 
      role: 'user', 
      content: userInput.trim(), 
      timestamp 
    };
    
    setConversation(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    scrollToEnd();

    let currentHistory = [...conversation, userMessage];
    const MAX_STEPS = 5;

    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        const command = await processUserRequest(currentHistory);

        const aiThought = {
          role: 'ai',
          content: command,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        currentHistory.push(aiThought);
        setConversation([...currentHistory]);
        scrollToEnd();

        if (command.tool_name === 'clarify' || command.tool_name === 'answerUser') {
          const finalAnswer = {
            role: 'system',
            content: command.parameters.question || command.parameters.answer,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setConversation([...currentHistory, finalAnswer]);
          scrollToEnd();
          break;
        }

        const toolToCall = toolMapping[command.tool_name];
        if (!toolToCall) {
          const errorTurn = {
            role: 'system',
            content: `I encountered an error while processing your request. Please try again.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setConversation([...currentHistory, errorTurn]);
          scrollToEnd();
          break;
        }

        const toolResult = await toolToCall(command.parameters);
        const toolTurn = {
          role: 'tool',
          content: toolResult,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        currentHistory.push(toolTurn);
        setConversation([...currentHistory]);
        scrollToEnd();

        if (i === MAX_STEPS - 1) {
          const finalTurn = {
            role: 'system',
            content: "I need more information to complete this request. Could you please provide additional details?",
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setConversation([...currentHistory, finalTurn]);
          scrollToEnd();
        }
      }
    } catch (error) {
      const errorMessage = {
        role: 'system',
        content: "Something went wrong. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [userInput, isLoading, conversation, scrollToEnd]);

  const renderMessage = useCallback(({ item, index }) => (
    <MessageBubble 
      item={item} 
      index={index} 
      isLast={index === conversation.length - 1} 
    />
  ), [conversation.length]);

  const keyExtractor = useCallback((_, index) => index.toString(), []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.appIcon}>
              <Ionicons name="wallet-outline" size={24} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Expense Assistant</Text>
              <Text style={styles.headerSubtitle}>AI-powered expense management</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        
        <FlatList
          ref={flatListRef}
          data={conversation}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          initialNumToRender={20}
        />

        {isLoading && <TypingIndicator />}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              multiline
              maxLength={500}
              placeholder="Describe your expense..."
              placeholderTextColor="#9CA3AF"
              editable={!isLoading}
              value={userInput}
              onChangeText={setUserInput}
              textAlignVertical="center"
            />
            <SendButton 
              onPress={handleUserSubmit}
              disabled={!hasText || isLoading}
              hasText={hasText}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  container: { 
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.025,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  headerAction: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },

  chatContent: { 
    padding: 20,
    paddingBottom: 10,
  },
  messageContainer: { 
    marginBottom: 16,
  },

  // User messages
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#2563EB',
    maxWidth: width * 0.75,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    marginRight: 4,
  },

  // System messages
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  systemBubbleContainer: {
    flex: 1,
  },
  systemBubble: {
    backgroundColor: '#FFFFFF',
    maxWidth: width * 0.75,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  systemMessageText: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  timestampLeft: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    marginLeft: 4,
  },

  // Processing messages
  processingContainer: {
    alignItems: 'flex-start',
    marginLeft: 44,
  },
  processingBubble: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  processingDot: {
    width: 6,
    height: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 3,
    marginRight: 8,
  },
  processingText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },

  // Tool messages
  toolMessageContainer: {
    alignItems: 'flex-start',
    marginLeft: 44,
  },
  toolBubble: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: width * 0.7,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  toolResultText: {
    color: '#166534',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typingDots: {
    flexDirection: 'row',
  },
  typingDot: {
    width: 6,
    height: 6,
    backgroundColor: '#9CA3AF',
    borderRadius: 3,
    marginRight: 4,
  },

  // Input
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    color: '#111827',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: '#2563EB',
  },
  sendButtonInactive: {
    backgroundColor: '#F3F4F6',
  },
});