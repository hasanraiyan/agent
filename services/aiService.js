// File: services/aiService.js

import Constants from "expo-constants";
const GEMINI_API_KEY = Constants.expoConfig.extra.GEMINI_API_KEY;

// Using a general model name that is more likely to be available. 
// The core logic works with any capable model, including Gemma variants.
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`;

// This function now correctly builds upon your original, robust prompt structure.
const createMasterPrompt = (history) => {
  // Format the history for inclusion in the prompt, distinguishing between AI decisions and tool results.
  const formattedHistory = history.map(turn => {
    if (turn.role === 'user') {
      return `User: "${turn.content}"`;
    } 
    else if (turn.role === 'ai') {
      // This is the AI's decision (the JSON command it generated).
      return `Your Response:\n${JSON.stringify(turn.content, null, 2)}`;
    }
    else { // 'tool' role
      // This is the result from the application running the command.
      return `TOOL_RESULT: "${turn.content}"`;
    }
  }).join('\n\n');

  // This is the robust prompt structure from your original example, now with history integrated.
  return `You are a helpful and efficient AI assistant for a student expense tracking app. Your task is to understand the user's request and translate it into a specific JSON command that the app can execute. The currency is Indian Rupees (INR) and the symbol is ₹.

You have access to the following tools:
1.  addExpense: Logs a new expense. Parameters: { "amount": number, "category": string, "note": string? }
2.  getSpendingHistory: Fetches transactions for a period. This is a preliminary step for summarization. Parameters: { "period": "today" | "this week" | "this month" | "all" }
3.  deleteLastExpense: Deletes the most recently added expense. Parameters: {}
4.  answerUser: Provides the final, natural language answer to the user after all tools have been used. This ends the process. Parameters: { "answer": string }
5.  clarify: Used when you don't understand or need more information. Parameters: { "question": string }

Your response MUST be a single, valid JSON object and nothing else.

---
Here is the conversation history. Analyze it to decide your next step. The user's most recent request is at the end.

${formattedHistory}
---

Now, based on the last user message and the entire history, decide on the next JSON command to execute.

Your Response:
`;
};

// This function now correctly implements your original, robust parsing logic.
export const processUserRequest = async (history) => {
  const prompt = createMasterPrompt(history);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // We send the prompt in the standard 'contents' body, without relying on special features.
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error Response:", errorBody);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    // ERROR HANDLING: Check if the response structure is as expected
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
        console.error("Invalid AI response structure:", data);
        throw new Error("Received an invalid response structure from the AI.");
    }

    const aiResponseText = data.candidates[0].content.parts[0].text;

    // THIS IS THE CRITICAL STEP I MISSED. 
    // It makes the app resilient to the AI adding markdown wrappers.
    const cleanedJsonString = aiResponseText.replace(/```json\n?/, '').replace(/```$/, '');
    
    // Parse the cleaned string into a JavaScript object
    return JSON.parse(cleanedJsonString);

  } catch (error) {
    console.error('Error processing AI request:', error);
    // Return a fallback command in case of any network or parsing error
    return {
      tool_name: 'clarify',
      parameters: { question: 'Sorry, I had trouble processing that request. Could you please rephrase?' },
    };
  }
};