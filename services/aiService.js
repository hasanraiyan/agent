// services/aiService.js

import Constants from "expo-constants";
import { z, ZodError } from "zod";

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
const deleteByIdSchema = z.object({
  tool_name: z.literal("deleteExpenseById"),
  parameters: z.object({
    id: z.string(),
  }),
});
const deleteLastSchema = z.object({
  tool_name: z.literal("deleteLastExpense"),
  parameters: z.object({}),
});
const answerSchema = z.object({
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
const ToolSchema = z.discriminatedUnion("tool_name", [
  addExpenseSchema,
  getSpendingHistorySchema,
  listExpensesSchema,
  updateExpenseSchema,
  deleteByIdSchema,
  deleteLastSchema,
  answerSchema,
  clarifySchema,
]);

const GEMINI_API_KEY = Constants.expoConfig.extra.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`;

const schemaInfo = [
  { name: 'addExpense', schema: addExpenseSchema },
  { name: 'getSpendingHistory', schema: getSpendingHistorySchema },
  { name: 'listExpenses', schema: listExpensesSchema },
  { name: 'updateExpense', schema: updateExpenseSchema },
  { name: 'deleteExpenseById', schema: deleteByIdSchema },
  { name: 'deleteLastExpense', schema: deleteLastSchema },
  { name: 'answerUser', schema: answerSchema },
  { name: 'clarify', schema: clarifySchema },
];

const describeSchema = (schema) => {
  const desc = schema.describe();
  if (!desc || !desc.typeName || desc.typeName !== 'ZodObject') return '';
  const fields = desc.value?.shape?.parameters?.shape;
  if (!fields) return '';
  return '{ ' + Object.entries(fields)
    .map(([key, val]) => `${key}: ${val.typeName || val._def.typeName}`)
    .join(', ') + ' }';
};

const createMasterPrompt = (history) => {
  const formattedHistory = history.map(turn => {
    if (turn.role === 'user') {
      return `User: "${turn.content.replace(/"/g, '\\"')}"`;
    } else if (turn.role === 'ai') {
      return `Your Response:\n${JSON.stringify(turn.content)}`;
    } else {
      return `TOOL_RESULT: "${JSON.stringify(turn.content)}"`;
    }
  }).join('\n\n');

  const toolDetails = schemaInfo.map(info =>
    `TOOL: ${info.name}\nPARAMETERS: ${describeSchema(info.schema)}`
  ).join('\n\n');

  return `You are a JSON-only financial assistant. You must translate user messages into JSON tool calls.

RESTRICTIONS:
- Only output JSON. Never speak in natural language unless using the 'answerUser' or 'clarify' tool.
- Use 'clarify' if anything is unclear.
- Output a single valid JSON object every time, with only \"tool_name\" and \"parameters\" fields.

TOOLS YOU CAN USE:
${toolDetails}

FEW-SHOT EXAMPLES:
{ "tool_name": "addExpense", "parameters": { "amount": 200, "category": "groceries" } }
{ "tool_name": "getSpendingHistory", "parameters": { "period": "this month" } }
{ "tool_name": "clarify", "parameters": { "question": "Which transaction do you want to update?" } }
{ "tool_name": "answerUser", "parameters": { "answer": "Your expense has been logged." } }

CONVERSATION HISTORY:
${formattedHistory}

YOUR RESPONSE:`;
};

export const processUserRequest = async (history) => {
  const prompt = createMasterPrompt(history);
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let jsonContent;
      const codeMatch = aiText.match(/```json\s*([\s\S]*?)```/);
      if (codeMatch) {
        jsonContent = codeMatch[1];
      } else {
        const braceMatch = aiText.match(/\{[\s\S]*\}/);
        jsonContent = braceMatch ? braceMatch[0] : aiText;
      }

      const parsed = JSON.parse(jsonContent.trim());
      return ToolSchema.parse(parsed);

    } catch (error) {
      if (error instanceof ZodError) {
        console.warn(`Validation failed (attempt ${attempt}):`, error.errors);
      } else {
        console.warn(`Attempt ${attempt} failed:`, error.message);
      }
      if (attempt === MAX_RETRIES) break;
      await new Promise(res => setTimeout(res, 200 * attempt));
    }
  }

  return {
    tool_name: 'clarify',
    parameters: { question: 'Sorry, I had trouble processing that request. Please rephrase.' },
  };
};

export const handleUserRequest = async (userMessage, toolHandlers) => {
  const history = [{ role: 'user', content: userMessage }];

  while (true) {
    const call = await processUserRequest(history);
    if (['answerUser', 'clarify'].includes(call.tool_name)) {
      return { call, history };
    }

    let result;
    try {
      result = await toolHandlers[call.tool_name](call.parameters);
    } catch (execError) {
      result = { error: execError.message };
    }

    history.push({ role: 'ai', content: call });
    history.push({ role: 'tool_result', content: JSON.stringify(result) });
  }
};