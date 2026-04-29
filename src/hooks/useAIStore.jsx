import { useReducer, useEffect, useRef, useCallback } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const AI_KEY = 'streamtube_ai_settings';

const initialState = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  baseUrl: '',
};

// Strip 'models/' prefix and whitespace — fixes "unexpected model name format" error
function sanitizeModel(name) {
  if (!name) return '';
  return name.replace(/^models\//, '').trim();
}

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_CONFIG':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export function useAIStore() {
  const saved = readUserData(AI_KEY) || {};
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...saved,
    modelName: sanitizeModel(saved.modelName || initialState.modelName),
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(AI_KEY, state);
  }, [state]);

  const updateConfig = (updates) => dispatch({
    type: 'UPDATE_CONFIG',
    payload: { ...updates, modelName: updates.modelName ? sanitizeModel(updates.modelName) : state.modelName },
  });

  // Fetch live model list from provider API
  const fetchAvailableModels = useCallback(async (provId, key, base) => {
    if (!key) throw new Error('Isi API Key terlebih dahulu untuk fetch model terbaru.');
    if (provId === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => sanitizeModel(m.name))
        .sort();
    }
    // OpenAI-compatible providers
    if (base) {
      const res = await fetch(`${base.replace(/\/$/, '')}/models`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return (data.data || []).map(m => m.id).sort();
    }
    return [];
  }, []);

  // Test connection with explicit (unsaved) params
  const testConnection = useCallback(async ({ provider: prov, apiKey: key, modelName: model, baseUrl: base }) => {
    if (!key) throw new Error('API Key belum diisi.');
    const cleanModel = sanitizeModel(model);
    const prompt = 'Reply with exactly: OK';

    if (prov === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 20 },
          }),
        }
      );
      const data = await res.json();
      if (data.error) {
        if (data.error.code === 429) throw new Error('Quota API habis atau model tidak tersedia (Free Tier Limit). Ganti model atau API key.');
        throw new Error(data.error.message);
      }
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
    }

    if (prov === 'anthropic') {
      const url = `${(base || 'https://api.anthropic.com/v1').replace(/\/$/, '')}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: cleanModel || 'claude-3-haiku-20240307',
          max_tokens: 20,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Anthropic Error');
      return data.content?.[0]?.text?.trim() || 'OK';
    }

    // OpenAI-compatible fallback
    const url = `${(base || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: cleanModel || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'API Error');
    return data.choices?.[0]?.message?.content?.trim() || 'OK';
  }, []);

  const generateText = async (promptText) => {
    if (!state.apiKey) throw new Error('API Key belum diatur di Settings > AI Assistants.');
    const cleanModel = sanitizeModel(state.modelName);
    try {
      if (state.provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${state.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { temperature: 0.7 },
            }),
          }
        );
        const data = await res.json();
        if (data.error) {
          if (data.error.code === 429) throw new Error('Quota API habis atau model ini tidak tersedia untuk free tier. Silakan ganti model (misal ke flash) atau gunakan API key lain.');
          throw new Error(data.error.message || 'Gemini API Error');
        }
        return data.candidates[0].content.parts[0].text;

      } else if (state.provider === 'anthropic') {
        const url = `${(state.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '')}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': state.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerously-allow-browser': 'true',
          },
          body: JSON.stringify({
            model: cleanModel || 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [{ role: 'user', content: promptText }],
            temperature: 0.7,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Anthropic API Error');
        return data.content[0].text;

      } else {
        const url = `${(state.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.apiKey}` },
          body: JSON.stringify({
            model: cleanModel || 'gpt-4o',
            messages: [{ role: 'user', content: promptText }],
            temperature: 0.7,
          }),
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

  return { config: state, updateConfig, generateText, fetchAvailableModels, testConnection };
}
