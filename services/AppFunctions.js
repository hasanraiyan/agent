import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPENSES_KEY = '@expenses';

// --- Private Helper Functions ---

// Reads all expenses from storage.
const _readExpenses = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(EXPENSES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to read expenses.', e);
    return []; // Return empty array on error
  }
};

// Writes the full expenses array to storage.
const _writeExpenses = async (expenses) => {
  try {
    const jsonValue = JSON.stringify(expenses);
    await AsyncStorage.setItem(EXPENSES_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save expenses.', e);
  }
};

// --- Public Tool Functions ---

export const addExpense = async ({ amount, category, note }) => {
  const expenses = await _readExpenses();
  const newExpense = {
    id: `${new Date().getTime()}-${Math.random()}`, // Simple unique ID
    amount: Number(amount),
    category,
    note: note || '',
    timestamp: new Date().getTime(),
  };
  expenses.push(newExpense);
  await _writeExpenses(expenses);
  return `SUCCESS: Expense of ₹${amount} for ${category} has been added.`;
};

export const getSpendingHistory = async ({ period }) => {
  const expenses = await _readExpenses();
  const now = new Date();
  let filteredExpenses = [];

  switch (period) {
    case 'today':
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      filteredExpenses = expenses.filter(e => e.timestamp >= todayStart.getTime());
      break;
    case 'this week':
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      filteredExpenses = expenses.filter(e => e.timestamp >= weekStart.getTime());
      break;
    case 'this month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      filteredExpenses = expenses.filter(e => e.timestamp >= monthStart.getTime());
      break;
    default: // 'all'
      filteredExpenses = expenses;
      break;
  }
  // Return data as a string for the AI to process.
  return JSON.stringify(filteredExpenses);
};

export const deleteLastExpense = async () => {
  let expenses = await _readExpenses();
  if (expenses.length === 0) {
    return 'ERROR: No expenses to delete.';
  }
  // Sort by timestamp to ensure we delete the actual last one
  expenses.sort((a, b) => a.timestamp - b.timestamp);
  const deletedExpense = expenses.pop();
  await _writeExpenses(expenses);
  return `SUCCESS: Deleted expense of ₹${deletedExpense.amount} for ${deletedExpense.category}.`;
};

/**
 * Finds expenses based on a simple text query.
 * This is intentionally simple for the MVP. It just checks if the query
 * string appears in the note or category.
 */
export const listExpenses = async ({ query }) => {
  const expenses = await _readExpenses();
  const lowerCaseQuery = query.toLowerCase();

  const filtered = expenses.filter(e => {
    const note = (e.note || '').toLowerCase();
    const category = (e.category || '').toLowerCase();
    return note.includes(lowerCaseQuery) || category.includes(lowerCaseQuery);
  });

  if (filtered.length === 0) {
    return 'RESULT: No expenses found matching that description.';
  }

  // Return a JSON string so the AI can read the data and decide what to do next.
  return JSON.stringify(filtered);
};

/**
 * Updates a specific expense by its ID.
 */
export const updateExpense = async ({ id, updates }) => {
  const expenses = await _readExpenses();
  const expenseIndex = expenses.findIndex(e => e.id === id);

  if (expenseIndex === -1) {
    return `ERROR: Could not find an expense with ID ${id}.`;
  }

  // Merge the old expense data with the new updates
  expenses[expenseIndex] = { ...expenses[expenseIndex], ...updates };
  await _writeExpenses(expenses);

  return `SUCCESS: Expense ${id} has been updated.`;
};

/**
 * Deletes a specific expense by its ID.
 */
export const deleteExpenseById = async ({ id }) => {
  const expenses = await _readExpenses();
  const initialLength = expenses.length;
  const expensesAfterDelete = expenses.filter(e => e.id !== id);

  if (expensesAfterDelete.length === initialLength) {
    return `ERROR: Could not find an expense with ID ${id}.`;
  }

  await _writeExpenses(expensesAfterDelete);
  return `SUCCESS: Expense ${id} has been deleted.`;
};

// This is a pseudo-tool. It doesn't do anything but signal the end of a loop.
export const answerUser = async ({ answer }) => {
  return answer;
};