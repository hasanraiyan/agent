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

// This is a pseudo-tool. It doesn't do anything but signal the end of a loop.
export const answerUser = async ({ answer }) => {
  return answer;
};