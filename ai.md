# A Practical Guide to Building a Tool-Using AI Agent

This guide provides a blueprint for building a simple yet powerful AI agent. An agent goes beyond a standard chatbot; it doesn't just talk, it **takes action**. We'll walk through the core concepts and provide a step-by-step implementation guide using a student expense tracking app as our example.

The goal is to turn a user's natural language request (e.g., "spent 100 on lunch") into a machine-executable command that your application can understand and act upon.

## The Agentic Mindset: From Chatbot to Actor

Understanding the difference between a chatbot and an agent is key.

**A standard chatbot's flow:**
> User Input → LLM → Text Response

**An agent's flow:**
> User Input → **[BRAIN]** → **Decision (Structured Command)** → **[HANDS]** → **Action in the Real World** → Feedback

Our agent's architecture is composed of two primary components:
1.  **The Brain (The Reasoning Engine):** A Large Language Model (LLM) that understands the user's intent and decides *which tool to use* and *what parameters to use with it*.
2.  **The Hands (The Executor):** The code in your application that takes the Brain's decision and actually executes the corresponding function.

---

## How to Build Your Agent: A Step-by-Step Guide

### Prerequisites

*   **API Key:** You need an API key for an LLM. Our example uses the Google Gemini API. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).
*   **Environment:** A JavaScript environment (e.g., Node.js or a React Native project with `expo-constants` to store the key).

### Step 1: Define Your Tools (The "Hands")

Before writing any AI code, you must know what your application can *do*. These are your agent's "tools". For our expense tracker, the tools are simple functions.

Define them clearly. What is the function name? What arguments (parameters) does it need?

*   `addExpense`: Logs a new expense.
    *   `amount`: `number` (required)
    *   `category`: `string` (required)
    *   `note`: `string` (optional)
*   `getSpendingHistory`: Shows past transactions.
    *   `period`: `string` (required, can be "today", "this week", or "this month")
*   `deleteLastExpense`: Deletes the most recent expense.
    *   No parameters.
*   `clarify`: A special tool for when the AI is confused.
    *   `question`: `string` (The question to ask the user)

### Step 2: Build the Brain (The Reasoning Engine)

The Brain's job is to translate the user's request into a command to use one of the tools you defined. We achieve this with a carefully crafted **System Prompt**. This prompt is the "constitution" or "operating system" for your agent.

Below is the complete code for `services/aiService.js`, which contains both the system prompt and the logic to communicate with the AI.

#### `services/aiService.js`

```javascript
// File: services/aiService.js

import Constants from "expo-constants";
// Make sure to store your API key in your app's configuration (e.g., app.json for Expo)
const GEMINI_API_KEY = Constants.expoConfig.extra.GEMINI_API_KEY;

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// This function creates the master prompt, which is the "brain" of our agent.
const createMasterPrompt = (userQuery) => {
  return `
// 1. DEFINE THE PERSONA & GOAL
You are a helpful and efficient AI assistant for a student expense tracking app. Your task is to understand the user's request and translate it into a specific JSON command that the app can execute. The currency is Indian Rupees (INR) and the symbol is ₹.

// 2. DECLARE THE TOOLS
You have access to the following tools:
1.  addExpense: Logs a new expense. Parameters: { "amount": number, "category": string, "note": string? }
2.  getSpendingHistory: Shows past transactions. Parameters: { "period": "today" | "this week" | "this month" }
3.  deleteLastExpense: Deletes the most recently added expense. Parameters: {}
4.  clarify: Used when you don't understand the request. Parameters: { "question": string }

// 3. SET THE OUTPUT FORMAT
Your response MUST be a single, valid JSON object and nothing else.

// 4. PROVIDE EXAMPLES (FEW-SHOT PROMPTING)
Examples:
User: "had chai for 20 rupees"
Your Response:
{"tool_name": "addExpense", "parameters": {"amount": 20, "category": "Food", "note": "chai"}}

User: "show me my expenses for this week"
Your Response:
{"tool_name": "getSpendingHistory", "parameters": {"period": "this week"}}

User: "oops delete that last one"
Your Response:
{"tool_name": "deleteLastExpense", "parameters": {}}

User: "blablabla"
Your Response:
{"tool_name": "clarify", "parameters": {"question": "I'm sorry, I didn't understand that. Could you please rephrase your request?"}}

// 5. INSERT THE LIVE USER QUERY
Now, analyze the following user request and provide the corresponding JSON command.

User: "${userQuery}"
Your Response:
`;
};

// This function handles the full process of calling the API and parsing the response.
export const processUserRequest = async (userQuery) => {
  const prompt = createMasterPrompt(userQuery);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error Response:", errorBody);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    // Extract the text from the response
    const aiResponseText = data.candidates[0].content.parts[0].text;
    
    // Clean up potential markdown formatting from the AI's response
    const cleanedJsonString = aiResponseText.replace(/```json\n?/, '').replace(/```$/, '');
    
    // Parse the cleaned string into a JavaScript object
    return JSON.parse(cleanedJsonString);

  } catch (error) {
    console.error('Error processing AI request:', error);
    // Return a fallback command in case of any network or parsing error
    return {
      tool_name: 'clarify',
      parameters: { question: 'Sorry, I had trouble connecting. Please try again.' },
    };
  }
};
```

This service is powerful because it encapsulates all the AI logic. The rest of your app doesn't need to know about prompts or API calls; it just needs to call `processUserRequest` and get a structured command back.

### Step 3: Build the Executor (Connecting the Brain to the Hands)

Now you need a dispatcher in your main application logic that receives the command from the "Brain" and calls the correct function ("Hands").

Here is a hypothetical `ExpenseTracker` component that shows how to implement the Executor.

```javascript
// File: components/ExpenseTracker.js (Example)

import { processUserRequest } from '../services/aiService';

// This object maps the tool names from the AI to your actual app functions.
// These are your "Hands".
const AppFunctions = {
  addExpense: async ({ amount, category, note }) => {
    // Your actual logic to save the expense to state or a database
    console.log(`EXECUTE: Adding expense of ₹${amount} for ${category}.`);
    return `Added new expense: ${note || category}.`;
  },
  getSpendingHistory: async ({ period }) => {
    // Your logic to fetch expenses from a database
    console.log(`EXECUTE: Getting history for ${period}.`);
    return `Here are the expenses for ${period}: ...`;
  },
  deleteLastExpense: async () => {
    // Your logic to delete the last transaction
    console.log(`EXECUTE: Deleting last expense.`);
    return 'The last expense has been deleted.';
  },
  clarify: async ({ question }) => {
    // Logic to display the AI's question to the user
    console.log(`EXECUTE: Asking user for clarification.`);
    return question;
  },
};

// Main application logic
const handleUserSubmit = async (userInput) => {
  // 1. Call the "Brain" to get a command
  const command = await processUserRequest(userInput);
  console.log('AI Command Received:', command);

  // 2. The Executor/Dispatcher logic
  if (command && command.tool_name && AppFunctions[command.tool_name]) {
    // 3. Call the correct app function with the parameters from the AI
    const responseMessage = await AppFunctions[command.tool_name](command.parameters);
    // 4. Update your UI with the result
    console.log('App Response:', responseMessage);
  } else {
    // Fallback if the AI returns an unknown or malformed command
    console.log("I'm not sure how to do that.");
  }
};
```

This completes the loop: The user provides input, `handleUserSubmit` calls the `aiService` (Brain), receives a JSON command, and then uses the `AppFunctions` object to execute the correct function (Hands).

---

## How to Customize This For Your Project

To adapt this agent for your own application, follow these steps:

1.  **List Your Tools:** Make a list of the core functions in your app that you want the user to be able to control with language.
2.  **Update `createMasterPrompt` in `aiService.js`:**
    *   Change the **Persona** to match your app's domain (e.g., "You are a smart home assistant...").
    *   Replace the **Tool Declarations** with your own tools and their parameters.
    *   Update the **Examples** to reflect your new tools and common user requests. This is the most important part for getting high accuracy!
3.  **Update the Executor:**
    *   Create your own `AppFunctions` object (like in the `ExpenseTracker.js` example) that maps your tool names to your real application functions.

That's it! The core architecture remains the same.

## Taking Your Agent to the Next Level

This guide covers a simple but effective agent. To make it more powerful, you can explore:

*   **Native Tool Calling / Function Calling:** Modern LLM APIs (including Gemini) have a built-in feature for this. Instead of manually parsing JSON from a text response, the API itself is designed to return a structured "function call" object. This is more robust and the recommended modern approach.
*   **Conversational Memory:** To allow for follow-up questions (e.g., User: "Add 50 for lunch." -> Agent: "Done." -> User: "What category was that?"), you need to pass the recent conversation history back into the prompt on each turn.
*   **Multi-Step Reasoning:** For complex queries ("Which of my friends have I spent the most on this month?"), the agent might need to call one tool (e.g., `getSpendingHistory`), get the result, and then feed that result *back into the Brain* for a second step of reasoning.

Happy building