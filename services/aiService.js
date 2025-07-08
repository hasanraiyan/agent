// services/aiService.js

import Constants from "expo-constants";
import { z } from "zod";

// Load API key from Expo config
const GEMINI_API_KEY = Constants.expoConfig.extra.GEMINI_API_KEY;
// Endpoint for Gemma model
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`;

// -----------------------------------------
// Zod Schemas for Tool Validation
// -----------------------------------------

const addExpenseSchema = z.object({
  tool_name: z.literal("addExpense"),
  parameters: z.object({
    amount: z.number(),
    category: z.string(),
    note: z.string().optional(),
  }),
});

const getSpendingHistorySchema = z.object({
  tool_name: z.literal("getSpendingHistory"),
  parameters: z.object({
    period: z.enum(["today", "this week", "this month", "all"]),
  }),
});

const listExpensesSchema = z.object({
  tool_name: z.literal("listExpenses"),
  parameters: z.object({
    query: z.string(),
  }),
});

const updateExpenseSchema = z.object({
  tool_name: z.literal("updateExpense"),
  parameters: z.object({
    id: z.string(),
    updates: z.object({
      amount: z.number().optional(),
      category: z.string().optional(),
      note: z.string().optional(),
    }),
  }),
});

const deleteExpenseByIdSchema = z.object({
  tool_name: z.literal("deleteExpenseById"),
  parameters: z.object({
    id: z.string(),
  }),
});

const deleteLastExpenseSchema = z.object({
  tool_name: z.literal("deleteLastExpense"),
  parameters: z.object({}),
});

const answerUserSchema = z.object({
  tool_name: z.literal("answerUser"),
  parameters: z.object({
    answer: z.string(),
  }),
});

const clarifySchema = z.object({
  tool_name: z.literal("clarify"),
  parameters: z.object({
    question: z.string(),
  }),
});

// Discriminated union of all possible tool responses
const ToolSchema = z.discriminatedUnion("tool_name", [
  addExpenseSchema,
  getSpendingHistorySchema,
  listExpensesSchema,
  updateExpenseSchema,
  deleteExpenseByIdSchema,
  deleteLastExpenseSchema,
  answerUserSchema,
  clarifySchema,
]);

// -----------------------------------------
// Build the system prompt with strict JSON enforcement
// -----------------------------------------
const createMasterPrompt = (history) => {
  const formattedHistory = history
    .map((turn) => {
      if (turn.role === "user") {
        return `User: "${turn.content.replace(/"/g, '\\"')}"`;
      } else if (turn.role === "ai") {
        return `Your Response:\n${JSON.stringify(turn.content, null, 2)}`;
      } else {
        return `TOOL_RESULT: "${turn.content.replace(/"/g, '\\"')}"`;
      }
    })
    .join("\n\n");

  return `You are an expert AI financial assistant designed solely to output a single valid JSON object per interaction. You do not speak in natural language unless using the answerUser or clarify tool.

RULES (No Exceptions):
1. Output exactly one JSON object, with no commentary or markdown.
2. Structure must be: { "tool_name": string, "parameters": { ... } }.
3. For destructive or ambiguous actions, use clarify first.
4. Only use these tools: addExpense, getSpendingHistory, listExpenses, updateExpense, deleteExpenseById, deleteLastExpense, answerUser, clarify.
5. No extra text. No code blocks.

AVAILABLE TOOLS:
1. addExpense — Params: { amount: number, category: string, note?: string }
2. getSpendingHistory — Params: { period: "today"|"this week"|"this month"|"all" }
3. listExpenses — Params: { query: string }
4. updateExpense — Params: { id: string, updates: { amount?: number, category?: string, note?: string } }
5. deleteExpenseById — Params: { id: string } (confirm with clarify)
6. deleteLastExpense — Params: {} (confirm with clarify)
7. answerUser — Params: { answer: string }
8. clarify — Params: { question: string }

EXAMPLE:
User: "that food expense from yesterday was wrong"
→ { "tool_name": "listExpenses", "parameters": { "query": "food yesterday" } }

---
Conversation History:
${formattedHistory}

JSON OUTPUT:`;
};

// -----------------------------------------
// Main processing function
// -----------------------------------------
export const processUserRequest = async (history) => {
  const prompt = createMasterPrompt(history);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("API Error Response:", errorBody);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiResponseText = data.candidates[0]?.content.parts[0]?.text || "";

    // Clean wrappers and isolate JSON
    const cleanedJsonString = aiResponseText
      .replace(/```json\n?/, "")
      .replace(/```$/, "")
      .replace(/^.*?{/, "{")
      .replace(/}[^}]*$/, "}")
      .trim();

    // Parse and validate against Zod schema
    let parsed;
    try {
      parsed = JSON.parse(cleanedJsonString);
    } catch (parseErr) {
      throw new Error("Failed to parse JSON from AI response");
    }

    // Validate structure
    const validated = ToolSchema.parse(parsed);
    return validated;

  } catch (error) {
    console.error("Error processing AI request:", error);
    // Fallback to clarification
    return {
      tool_name: "clarify",
      parameters: {
        question: "Sorry, I had trouble processing that request. Could you please rephrase?",
      },
    };
  }
};
