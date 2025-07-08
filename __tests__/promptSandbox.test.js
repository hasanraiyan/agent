import { processUserRequest } from '../services/aiService';

describe('Prompt Sandbox', () => {
  it('should return expected tool call for a simple add expense prompt', async () => {
    const history = [
      { role: 'user', content: 'Add an expense of 100 for groceries' }
    ];
    const result = await processUserRequest(history);
    expect(result).toHaveProperty('tool_name', 'addExpense');
    expect(result.parameters).toHaveProperty('amount');
    expect(Number(result.parameters.amount)).toBeGreaterThan(0);
    expect(result.parameters).toHaveProperty('category');
  });

  // Add more test cases as needed
}); 