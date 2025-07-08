// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AgentScreen from './screens/AgentScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="ExpenseAgent" 
          component={AgentScreen} 
          options={{ title: 'AI Expense Agent' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}