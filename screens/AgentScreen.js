import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Easing,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { processUserRequest } from '../services/aiService';
import * as AppFunctions from '../services/AppFunctions';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = 60; // Approximate item height for performance

const toolMapping = {
  addExpense: AppFunctions.addExpense,
  getSpendingHistory: AppFunctions.getSpendingHistory,
  deleteLastExpense: AppFunctions.deleteLastExpense,
  answerUser: AppFunctions.answerUser,
  listExpenses: AppFunctions.listExpenses,
  updateExpense: AppFunctions.updateExpense,
  deleteExpenseById: AppFunctions.deleteExpenseById,
};

// Optimized Shimmer Component
const Shimmer = React.memo(({ width: shimmerWidth, height }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, shimmerWidth],
  });

  return (
    <View style={[styles.skeletonBase, { width: shimmerWidth, height }]}>
      <Animated.View
        style={[
          styles.shimmerOverlay,
          { transform: [{ translateX }] },
        ]}
      />
    </View>
  );
});

// Enterprise-level Message Component with proper memoization
const MessageBubble = React.memo(({ item, index }) => {
  const isUser = item.role === 'user';
  const isSystem = item.role === 'system';
  const isTool = item.role === 'tool';

  if (isUser) {
    return (
      <View style={styles.messageContainer}>
        <View style={styles.userMessageContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userMessageText}>{item.content}</Text>
          </View>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </View>
    );
  }

  if (isSystem) {
    return (
      <View style={styles.messageContainer}>
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
      </View>
    );
  }

  if (isTool) {
    return (
      <View style={styles.messageContainer}>
        <View style={styles.toolMessageContainer}>
          <View style={styles.toolBubble}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.toolResultText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return prevProps.item.content === nextProps.item.content &&
         prevProps.item.timestamp === nextProps.item.timestamp;
});

// Enterprise Input Component with auto-resize
const ChatInput = React.memo(({ 
  value, 
  onChangeText, 
  onSubmit, 
  disabled, 
  isLoading 
}) => {
  const [inputHeight, setInputHeight] = useState(44);
  const maxHeight = 120;
  
  const handleContentSizeChange = useCallback((event) => {
    const { height: contentHeight } = event.nativeEvent.contentSize;
    const newHeight = Math.min(Math.max(44, contentHeight + 20), maxHeight);
    
    if (newHeight !== inputHeight) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputHeight(newHeight);
    }
  }, [inputHeight]);

  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSubmit();
    }
  }, [value, disabled, onSubmit]);

  const hasText = value.trim().length > 0;

  return (
    <View style={[styles.inputWrapper, { minHeight: inputHeight }]}>
      <TextInput
        style={[styles.input, { height: Math.max(44, inputHeight) }]}
        multiline
        maxLength={1000}
        placeholder="Type your message..."
        placeholderTextColor="#9CA3AF"
        editable={!disabled}
        value={value}
        onChangeText={onChangeText}
        onContentSizeChange={handleContentSizeChange}
        textAlignVertical="top"
        returnKeyType="default"
        enablesReturnKeyAutomatically
      />
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!hasText || disabled}
        style={[
          styles.sendButton,
          hasText && !disabled ? styles.sendButtonActive : styles.sendButtonInactive,
        ]}
        activeOpacity={0.7}>
        {isLoading ? (
          <View style={styles.sendButtonLoader}>
            <Shimmer width={20} height={20} />
          </View>
        ) : (
          <Ionicons 
            name="arrow-up" 
            size={20} 
            color={hasText && !disabled ? "#FFFFFF" : "#9CA3AF"} 
          />
        )}
      </TouchableOpacity>
    </View>
  );
});

// Processing indicators
const ProcessingIndicator = React.memo(({ type, toolName }) => {
  if (type === 'welcome') {
    return (
      <View style={styles.skeletonContainer}>
        <View style={styles.assistantAvatar}>
          <Ionicons name="sparkles" size={16} color="#2563EB" />
        </View>
        <View style={styles.skeletonBubbleContainer}>
          <View style={styles.skeletonBubble}>
            <Shimmer width={width * 0.6} height={16} />
            <View style={{ height: 8 }} />
            <Shimmer width={width * 0.4} height={16} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'ai') {
    return (
      <View style={styles.processingIndicatorContainer}>
        <View style={styles.processingBubble}>
          <View style={styles.processingDot} />
          <Text style={styles.processingText}>
            {toolName === 'thinking...' ? 'Thinking...' : `Processing: ${toolName}`}
          </Text>
        </View>
      </View>
    );
  }

  if (type === 'tool') {
    return (
      <View style={styles.skeletonToolContainer}>
        <View style={styles.skeletonToolBubble}>
          <View style={styles.skeletonIcon}>
            <Shimmer width={14} height={14} />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Shimmer width={width * 0.3} height={12} />
          </View>
        </View>
      </View>
    );
  }

  return null;
});

export default function AgentScreen() {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [processingState, setProcessingState] = useState({ type: 'welcome' });
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // Enterprise-level keyboard management
  useEffect(() => {
    const keyboardWillShow = (event) => {
      const { height: kbHeight } = event.endCoordinates;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(kbHeight);
      
      // Auto-scroll to bottom when keyboard opens
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const keyboardWillHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    };

    const keyboardDidShow = keyboardWillShow;
    const keyboardDidHide = keyboardWillHide;

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardDidShow
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardDidHide
    );

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  // Auto-scroll when new messages arrive
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  // Performance-optimized render functions
  const renderMessage = useCallback(({ item, index }) => (
    <MessageBubble item={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item, index) => `${item.role}-${index}`, []);

  const getItemLayout = useCallback((data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  // Enterprise welcome message loading
  useEffect(() => {
    const getWelcomeMessage = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const todaysData = await AppFunctions.getSpendingHistory({ period: 'today' });
        
        const primingHistory = [
          { 
            role: 'user', 
            content: `The user has just opened the app. Here is their expense data for today: ${todaysData}. Please provide a friendly greeting and a brief, natural-language summary of their spending. If there are no expenses, just give a simple welcome.`
          }
        ];

        const command = await processUserRequest(primingHistory);
        
        let welcomeMessage = "Welcome! How can I help with your expenses?";
        if (command.tool_name === 'answerUser' || command.tool_name === 'clarify') {
          welcomeMessage = command.parameters.answer || command.parameters.question;
        }
        
        setProcessingState(null);
        setConversation([
          {
            id: Date.now().toString(),
            role: 'system',
            content: welcomeMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (error) {
        setProcessingState(null);
        setConversation([
          {
            id: Date.now().toString(),
            role: 'system',
            content: "Welcome! How can I help with your expenses?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    };

    getWelcomeMessage();
  }, []);

  // Enterprise-level message handling
  const handleUserSubmit = useCallback(async () => {
    if (!userInput.trim() || isLoading) return;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const userMessage = { 
      id: Date.now().toString(),
      role: 'user', 
      content: userInput.trim(), 
      timestamp 
    };
    
    // Optimistic UI update
    setConversation(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    
    // Immediate scroll for better UX
    setTimeout(scrollToEnd, 50);

    let currentHistory = [...conversation, userMessage];
    const MAX_STEPS = 5;

    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        setProcessingState({ type: 'ai', toolName: 'thinking...' });
        scrollToEnd();
        
        const command = await processUserRequest(currentHistory);
        setProcessingState({ type: 'ai', toolName: command.tool_name });
        
        await new Promise(resolve => setTimeout(resolve, 200));

        if (command.tool_name === 'clarify' || command.tool_name === 'answerUser') {
          setProcessingState(null);
          
          const finalAnswer = {
            id: Date.now().toString(),
            role: 'system',
            content: command.parameters.question || command.parameters.answer,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          
          setConversation(prev => [...prev, finalAnswer]);
          scrollToEnd();
          break;
        }

        const toolToCall = toolMapping[command.tool_name];
        if (!toolToCall) {
          setProcessingState(null);
          const errorTurn = {
            id: Date.now().toString(),
            role: 'system',
            content: 'I encountered an error while processing your request. Please try again.',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setConversation(prev => [...prev, errorTurn]);
          scrollToEnd();
          break;
        }

        setProcessingState({ type: 'tool' });
        scrollToEnd();

        const toolResult = await toolToCall(command.parameters);
        setProcessingState(null);
        
        const toolTurn = {
          id: Date.now().toString(),
          role: 'tool',
          content: toolResult,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        
        currentHistory.push(toolTurn);
        setConversation(prev => [...prev, toolTurn]);
        scrollToEnd();

        if (i === MAX_STEPS - 1) {
          const finalTurn = {
            id: Date.now().toString(),
            role: 'system',
            content: "I need more information to complete this request. Could you please provide additional details?",
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setConversation(prev => [...prev, finalTurn]);
          scrollToEnd();
        }
      }
    } catch (error) {
      setProcessingState(null);
      const errorMessage = {
        id: Date.now().toString(),
        role: 'system',
        content: "Something went wrong. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setConversation(prev => [...prev, errorMessage]);
      scrollToEnd();
    } finally {
      setProcessingState(null);
      setIsLoading(false);
    }
  }, [userInput, isLoading, conversation, scrollToEnd]);

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

      {/* Chat Container with enterprise keyboard handling */}
      <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
        <FlatList
          ref={flatListRef}
          data={conversation}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          getItemLayout={getItemLayout}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
        />

        {processingState && (
          <ProcessingIndicator 
            type={processingState.type} 
            toolName={processingState.toolName} 
          />
        )}

        <View style={styles.inputContainer}>
          <ChatInput
            value={userInput}
            onChangeText={setUserInput}
            onSubmit={handleUserSubmit}
            disabled={isLoading}
            isLoading={isLoading}
          />
        </View>
      </View>
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
    zIndex: 1000,
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
    flexGrow: 1,
  },
  messageContainer: { 
    marginBottom: 16,
  },

  // Skeleton Styles
  skeletonBase: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    width: '30%',
  },
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  skeletonBubbleContainer: {
    flex: 1,
  },
  skeletonBubble: {
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
  skeletonToolContainer: {
    alignItems: 'flex-start',
    marginLeft: 44,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  skeletonToolBubble: {
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
  skeletonIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },

  // Processing Indicators
  processingIndicatorContainer: {
    alignItems: 'flex-start',
    marginLeft: 44,
    paddingHorizontal: 20,
    paddingBottom: 8,
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

  // Enterprise Input Container
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#2563EB',
  },
  sendButtonInactive: {
    backgroundColor: '#F3F4F6',
  },
  sendButtonLoader: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
});