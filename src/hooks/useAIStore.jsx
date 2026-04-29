import { useReducer, useEffect, useRef } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const AI_KEY = 'streamtube_ai_settings';

const initialState = {
  provider: 'gemini', // 'gemini' | 'openai'
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  baseUrl: 'https://api.openai.com/v1', // Digunakan jika provider openai
};

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_CONFIG':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export function useAIStore() {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...(readUserData(AI_KEY) || {}),
  });

  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(AI_KEY, state);
  }, [state]);

  const updateConfig = (updates) => dispatch({ type: 'UPDATE_CONFIG', payload: updates });

  // Helper untuk generate text
  const generateText = async (promptText) => {
    if (!state.apiKey) throw new Error('API Key belum diatur di Settings > AI Assistants.');

    try {
      if (state.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.modelName || 'gemini-1.5-flash'}:generateContent?key=${state.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.7 }
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Gemini API Error');
        return data.candidates[0].content.parts[0].text;

      } else if (state.provider === 'anthropic' && state.baseUrl.includes('anthropic.com')) {
        const url = `${state.baseUrl.replace(/\/$/, '')}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': state.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerously-allow-browser': 'true'
          },
          body: JSON.stringify({
            model: state.modelName || 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [{ role: 'user', content: promptText }],
            temperature: 0.7
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Anthropic API Error');
        return data.content[0].text;

      } else {
        // Fallback for OpenAI, Groq, OpenRouter, xAI, Custom (all use standard OpenAI format)
        const url = `${state.baseUrl.replace(/\/$/, '')}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.apiKey}`
          },
          body: JSON.stringify({
            model: state.modelName || 'gpt-4o',
            messages: [{ role: 'user', content: promptText }],
            temperature: 0.7
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'API Error');
        return data.choices[0].message.content;
      }
    } catch (err) {
      console.error('AI Gen Error:', err);
      throw err;
    }
  };

  return {
    config: state,
    updateConfig,
    generateText,
  };
}
