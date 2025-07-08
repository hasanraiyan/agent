// screens/AgentScreen.js
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { processUserRequest } from '../services/aiService';
import * as AppFunctions from '../services/AppFunctions';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CONVERSATION_KEY = '@conversation';
const ONBOARDING_KEY = '@onboardingTipDismissed';

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
  const isThinking = item.role === 'thinking';
  // Detect clarify fallback (system message with clarify content)
  const isClarify = isSystem && item.content && typeof item.content === 'string' && (
    item.content.toLowerCase().includes('could you please provide additional details') ||
    item.content.toLowerCase().includes('can you clarify') ||
    item.content.toLowerCase().includes('need more information')
  );
  // Detect error (system message with error content)
  const isError = isSystem && item.content && typeof item.content === 'string' && (
    item.content.toLowerCase().includes('error') ||
    item.content.toLowerCase().includes('failed') ||
    item.content.toLowerCase().includes('something went wrong') ||
    item.content.toLowerCase().includes('must be greater than zero') ||
    item.content.toLowerCase().includes('no expenses found to delete')
  );
  // Detect tool success (tool message with non-error content)
  const isSuccess = isTool && item.content && typeof item.content === 'string' && !item.content.toLowerCase().includes('failed');

  // Fade-in animation for new messages
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  if (isUser) {
    return (
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
        <View style={styles.userMessageContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userMessageText}>{item.content}</Text>
          </View>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </Animated.View>
    );
  }

  if (isError) {
    // Error message UI
    return (
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
        <View style={styles.systemMessageContainer}>
          <View style={styles.assistantAvatar}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
          </View>
          <View style={styles.systemBubbleContainer}>
            <View style={styles.errorBubble}>
              <Text style={styles.errorText}>{item.content}</Text>
            </View>
            <Text style={styles.timestampLeft}>{item.timestamp}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }
  if (isSuccess) {
    // Success tool message UI
    return (
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
        <View style={styles.toolMessageContainer}>
          <View style={styles.toolBubble}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.toolResultText}>{item.content}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  if (isClarify) {
    // Special clarify fallback UI
    return (
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
        <View style={styles.systemMessageContainer}>
          <View style={styles.assistantAvatar}>
            <Ionicons name="help-circle" size={16} color="#F59E42" />
          </View>
          <View style={styles.systemBubbleContainer}>
            <View style={styles.clarifyBubble}>
              <Text style={styles.clarifyText}>{item.content}</Text>
            </View>
            <Text style={styles.timestampLeft}>{item.timestamp}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }
  if (isSystem) {
    return (
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
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
      </Animated.View>
    );
  }

  if (isThinking) {
    return (
      <View style={styles.messageContainer}>
        <View style={styles.systemMessageContainer}>
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={16} color="#2563EB" />
          </View>
          <View style={styles.thinkingBubbleContainer}>
            <View style={styles.thinkingBubble}>
              {/* <View style={styles.thinkingDot} /> */}
              <Text style={styles.thinkingText}>{item.content}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (isTool) {
    // return (
    //   <View style={styles.messageContainer}>
    //     <View style={styles.toolMessageContainer}>
    //       <View style={styles.toolBubble}>
    //         <Ionicons name="checkmark-circle" size={14} color="#059669" />
    //         <Text style={styles.toolResultText}>{item.content}</Text>
    //       </View>
    //     </View>
    //   </View>
    // );
    // Tool bubble rendering is commented out as per request.
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

// Telemetry wrapper for tool calls
const telemetryToolCall = async (toolName, toolFn, params) => {
  const start = Date.now();
  let result, success = false, error = null;
  try {
    result = await toolFn(params);
    success = true;
    return result;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    const duration = Date.now() - start;
    console.log('[Telemetry]', {
      tool: toolName,
      durationMs: duration,
      success,
      result: success ? result : undefined,
      error: error ? error.message : undefined,
      params,
      timestamp: new Date().toISOString(),
    });
  }
};

export default function AgentScreen() {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // Enterprise-level scroll management
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && conversation.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [conversation.length]);

  // Enterprise-level keyboard management
  useEffect(() => {
    const keyboardWillShow = (event) => {
      const { height: kbHeight } = event.endCoordinates;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(kbHeight);
    };

    const keyboardWillHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardWillShow
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardWillHide
    );

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  // Auto-scroll whenever conversation changes (enterprise pattern)
  useEffect(() => {
    if (conversation.length > 0) {
      const timeoutId = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [conversation, scrollToBottom]);

  // Performance-optimized render functions
  const renderMessage = useCallback(({ item, index }) => (
    <MessageBubble item={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item, index) => `${item.role}-${index}`, []);

  // Helper function to add thinking message
  const addThinkingMessage = useCallback((message) => {
    const thinkingMsg = {
      id: `thinking-${Date.now()}`,
      role: 'thinking',
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setConversation(prev => [...prev, thinkingMsg]);
    return thinkingMsg.id;
  }, []);

  // Helper function to remove thinking message
  const removeThinkingMessage = useCallback((thinkingId) => {
    setConversation(prev => prev.filter(msg => msg.id !== thinkingId));
  }, []);

  // Helper function to update thinking message
  const updateThinkingMessage = useCallback((thinkingId, newMessage) => {
    setConversation(prev => prev.map(msg =>
      msg.id === thinkingId ? { ...msg, content: newMessage } : msg
    ));
  }, []);

  // Helper function to get tool display name
  const getToolDisplayName = useCallback((toolName) => {
    const toolNames = {
      addExpense: 'Adding expense...',
      getSpendingHistory: 'Getting spending history...',
      deleteLastExpense: 'Deleting last expense...',
      listExpenses: 'Listing expenses...',
      updateExpense: 'Updating expense...',
      deleteExpenseById: 'Deleting expense...',
      answerUser: 'Preparing response...',
      clarify: 'Preparing response...',
    };
    return toolNames[toolName] || `Processing: ${toolName}...`;
  }, []);

  // MODIFIED: useEffect for welcome message / loading conversation
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 1. Try to load an existing conversation
        const savedConversation = await AsyncStorage.getItem(CONVERSATION_KEY);
        if (savedConversation !== null && JSON.parse(savedConversation).length > 1) {
          setConversation(JSON.parse(savedConversation));
          // Check onboarding tip state
          const onboardingDismissed = await AsyncStorage.getItem(ONBOARDING_KEY);
          setShowOnboarding(!onboardingDismissed);
          return; // Exit if we loaded a conversation
        }

        // 2. If no conversation, fetch the welcome message (your existing logic)
        const welcomeThinkingId = addThinkingMessage('Getting your expense summary...');
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

        removeThinkingMessage(welcomeThinkingId);
        setConversation([
          {
            id: Date.now().toString(),
            role: 'system',
            content: welcomeMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        // Show onboarding tip on first launch
        setShowOnboarding(true);
        await AsyncStorage.removeItem(ONBOARDING_KEY);
      } catch (error) {
        removeThinkingMessage(welcomeThinkingId);
        setConversation([
          {
            id: Date.now().toString(),
            role: 'system',
            content: "Welcome! How can I help with your expenses?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setShowOnboarding(true);
        await AsyncStorage.removeItem(ONBOARDING_KEY);
      }
    };
    loadInitialData();
  }, [addThinkingMessage, removeThinkingMessage]); // Runs only once

  // NEW: useEffect to save conversation whenever it changes
  useEffect(() => {
    // We don't save the very initial empty state
    if (conversation.length > 0) {
      AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify(conversation));
    }
  }, [conversation]);

  // Clear conversation function
  const clearConversation = useCallback(() => {
    Alert.alert(
      "Clear Conversation",
      "Are you sure you want to clear all messages? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setConversation([]);
            await AsyncStorage.removeItem(CONVERSATION_KEY);
            setShowOnboarding(true);
            await AsyncStorage.removeItem(ONBOARDING_KEY);
          }
        }
      ]
    );
  }, []);

  // Dismiss onboarding tip
  const dismissOnboarding = useCallback(async () => {
    setShowOnboarding(false);
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
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

    let currentHistory = [...conversation, userMessage];
    const MAX_STEPS = 5;

    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        const thinkingId = addThinkingMessage('Thinking...');

        const command = await processUserRequest(currentHistory);
        updateThinkingMessage(thinkingId, getToolDisplayName(command.tool_name));

        await new Promise(resolve => setTimeout(resolve, 200));

        if (command.tool_name === 'clarify' || command.tool_name === 'answerUser') {
          removeThinkingMessage(thinkingId);

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
          break;
        }

        const toolToCall = toolMapping[command.tool_name];
        if (!toolToCall) {
          removeThinkingMessage(thinkingId);
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
          break;
        }

        // Logic validation before tool call
        let logicError = null;
        if (command.tool_name === 'addExpense') {
          const amount = Number(command.parameters.amount);
          if (isNaN(amount) || amount <= 0) {
            logicError = 'Expense amount must be greater than zero.';
          }
        }
        if (command.tool_name === 'deleteExpenseById') {
          // Check if any previous toolTurn in conversation is a listExpenses or getSpendingHistory with non-empty result
          const hasExpenseList = conversation.some(msg =>
            msg.role === 'tool' &&
            ((msg.content && typeof msg.content === 'string' && msg.content.includes('Expense')) ||
             (msg.content && Array.isArray(msg.content) && msg.content.length > 0))
          );
          if (!hasExpenseList) {
            logicError = 'No expenses found to delete. Please list expenses first.';
          }
        }
        if (logicError) {
          removeThinkingMessage(thinkingId);
          const errorTurn = {
            id: Date.now().toString(),
            role: 'system',
            content: logicError,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setConversation(prev => [...prev, errorTurn]);
          break;
        }

        removeThinkingMessage(thinkingId);
        // Telemetry-wrapped tool call
        let toolResult;
        try {
          toolResult = await telemetryToolCall(command.tool_name, toolToCall, command.parameters);
        } catch (err) {
          toolResult = 'Tool execution failed.';
        }
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
        }
      }
    } catch (error) {
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
    } finally {
      setIsLoading(false);
    }
  }, [userInput, isLoading, conversation, addThinkingMessage, removeThinkingMessage, updateThinkingMessage, getToolDisplayName]);

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
          <TouchableOpacity style={styles.headerAction} activeOpacity={0.7} onPress={clearConversation}>
            <Ionicons name="trash-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Container with enterprise keyboard handling */}
      <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
        {/* Onboarding Tip */}
        {showOnboarding && (
          <View style={styles.onboardingTipContainer}>
            <View style={styles.onboardingTipBox}>
              <Ionicons name="bulb-outline" size={18} color="#F59E42" style={{ marginRight: 8 }} />
              <Text style={styles.onboardingTipText}>
                Tip: You can ask me to add, list, or analyze your expenses. Try "Add an expense of 200 for groceries" or "Show my spending this week".
              </Text>
              <TouchableOpacity onPress={dismissOnboarding} style={styles.onboardingTipClose} accessibilityLabel="Dismiss onboarding tip">
                <Ionicons name="close" size={16} color="#B45309" />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
        />

        {/* Removed ProcessingIndicator as per new logic */}

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

  // Thinking messages
  thinkingBubbleContainer: {
    flex: 1,
  },
  thinkingBubble: {
    maxWidth: width * 0.75,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 3,
    marginRight: 8,
  },
  thinkingText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  clarifyBubble: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: width * 0.75,
    borderWidth: 1,
    borderColor: '#FDBA74',
    shadowColor: '#FDBA74',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  clarifyText: {
    color: '#B45309',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: width * 0.75,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    shadowColor: '#FCA5A5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  onboardingTipContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  onboardingTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: '#FDBA74',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  onboardingTipText: {
    flex: 1,
    color: '#B45309',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  onboardingTipClose: {
    padding: 4,
    borderRadius: 8,
  },
});