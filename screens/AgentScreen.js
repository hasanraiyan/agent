import React, { useState, useRef } from 'react';
import { View, TextInput, Button, StyleSheet, FlatList, Text, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { processUserRequest } from '../services/aiService';
import * as AppFunctions from '../services/AppFunctions'; // Import all functions

const toolMapping = {
  addExpense: AppFunctions.addExpense,
  getSpendingHistory: AppFunctions.getSpendingHistory,
  deleteLastExpense: AppFunctions.deleteLastExpense,
  answerUser: AppFunctions.answerUser,
};

export default function AgentScreen() {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([
    { role: 'system', content: 'Welcome! How can I help you manage your expenses today?' }
  ]);
  const flatListRef = useRef();

  const handleUserSubmit = async () => {
    if (!userInput.trim()) return;

    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    const newHistory = [...conversation, { role: 'user', content: currentInput }];
    setConversation(newHistory);
    
    let currentHistory = [...newHistory];
    const MAX_STEPS = 5;

    for (let i = 0; i < MAX_STEPS; i++) {
      const command = await processUserRequest(currentHistory);

      // Add AI's "thought" to the conversation for clarity
      const aiThought = { role: 'ai', content: command };
      currentHistory.push(aiThought);
      setConversation([...currentHistory]);

      if (command.tool_name === 'clarify' || command.tool_name === 'answerUser') {
        const finalAnswer = { role: 'system', content: command.parameters.question || command.parameters.answer };
        setConversation([...currentHistory, finalAnswer]);
        break;
      }

      const toolToCall = toolMapping[command.tool_name];
      if (toolToCall) {
        const toolResult = await toolToCall(command.parameters);
        const toolTurn = { role: 'tool', content: toolResult };
        currentHistory.push(toolTurn);
        setConversation([...currentHistory]);
      } else {
        const errorTurn = { role: 'system', content: `Error: AI tried to use an unknown tool '${command.tool_name}'.` };
        setConversation([...currentHistory, errorTurn]);
        break;
      }
       if (i === MAX_STEPS - 1) {
        const finalTurn = { role: 'system', content: "Sorry, I couldn't complete the request in the allowed steps." };
        setConversation([...currentHistory, finalTurn]);
      }
    }
    setIsLoading(false);
  };

  const renderMessage = ({ item }) => {
    switch (item.role) {
      case 'user':
        return <Text style={styles.userMessage}>{item.content}</Text>;
      case 'system':
        return <Text style={styles.systemMessage}>{item.content}</Text>;
      case 'ai':
        return <Text style={styles.aiThought}>🤖 Thought: Use `{item.content.tool_name}`</Text>;
      case 'tool':
        return <Text style={styles.toolResult}>🔧 Result: {item.content}</Text>;
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={flatListRef}
        data={conversation}
        renderItem={renderMessage}
        keyExtractor={(item, index) => index.toString()}
        style={styles.chatArea}
        onContentSizeChange={() => flatListRef.current.scrollToEnd()}
        onLayout={() => flatListRef.current.scrollToEnd()}
      />
      {isLoading && <ActivityIndicator size="large" color="#0000ff" />}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={userInput}
          onChangeText={setUserInput}
          placeholder="e.g., spent 50 on coffee"
          editable={!isLoading}
        />
        <Button title="Send" onPress={handleUserSubmit} disabled={isLoading || !userInput.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  chatArea: { flex: 1, padding: 10 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 15, marginRight: 10 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#007bff', color: 'white', padding: 10, borderRadius: 15, marginBottom: 5, maxWidth: '80%' },
  systemMessage: { alignSelf: 'center', backgroundColor: '#e0e0e0', padding: 10, borderRadius: 15, marginBottom: 5, color: '#333', fontStyle: 'italic' },
  aiThought: { alignSelf: 'flex-start', color: '#888', marginBottom: 5, fontSize: 12, marginLeft: 10, fontStyle: 'italic' },
  toolResult: { alignSelf: 'flex-start', backgroundColor: '#dff0d8', color: '#3c763d', padding: 8, borderRadius: 10, marginBottom: 5, maxWidth: '80%', fontSize: 12 },
});