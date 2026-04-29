import { useReducer, useEffect, useRef, useCallback } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const AI_KEY = 'streamtube_ai_settings';

const initialState = {
  provider: 'gemini',
  apiKey: '', 
  modelName: 'gemini-2.5-flash',
  baseUrl: '', 
  apiKeys: {}, // { providerId: 'key' }
  baseUrls: {}, // { providerId: 'url' }
  providerModels: {}, // { providerId: ['model1', 'model2'] }
  customBodyTemplate: '{\n  "messages": [\n    { "role": "user", "content": "{{PROMPT}}" }\n  ],\n  "model": "{{MODEL}}"\n}',
  customResponsePath: 'choices[0].message.content',
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

// Utility to get nested property using string path e.g. "choices[0].message.content"
function getNestedValue(obj, path) {
  if (!path || !obj) return obj;
  try {
    const keys = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
    let result = obj;
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }
    return result;
  } catch (e) {
    return undefined;
  }
}

export function useAIStore() {
  const saved = readUserData(AI_KEY) || {};
  
  // Migrate legacy
  const initialApiKeys = { ...saved.apiKeys };
  const initialBaseUrls = { ...saved.baseUrls };
  if (saved.apiKey && !initialApiKeys[saved.provider || 'gemini']) {
    initialApiKeys[saved.provider || 'gemini'] = saved.apiKey;
  }
  if (saved.baseUrl && !initialBaseUrls[saved.provider || 'gemini']) {
    initialBaseUrls[saved.provider || 'gemini'] = saved.baseUrl;
  }
  const initialProviderModels = saved.providerModels || {};

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...saved,
    apiKeys: initialApiKeys,
    baseUrls: initialBaseUrls,
    providerModels: initialProviderModels,
    modelName: sanitizeModel(saved.modelName || initialState.modelName),
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(AI_KEY, state);
  }, [state]);

  const updateConfig = (updates) => {
    // If saving api key/base url, also update the specific provider's entry
    let newApiKeys = { ...state.apiKeys };
    let newBaseUrls = { ...state.baseUrls };
    
    const targetProv = updates.provider || state.provider;
    if (updates.apiKey !== undefined) newApiKeys[targetProv] = updates.apiKey;
    if (updates.baseUrl !== undefined) newBaseUrls[targetProv] = updates.baseUrl;

    dispatch({
      type: 'UPDATE_CONFIG',
      payload: { 
        ...updates, 
        apiKeys: newApiKeys,
        baseUrls: newBaseUrls,
        providerModels: state.providerModels,
        modelName: updates.modelName ? sanitizeModel(updates.modelName) : state.modelName 
      },
    });
  };

  const saveProviderModels = (provId, models) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      payload: {
        providerModels: { ...state.providerModels, [provId]: models }
      }
    });
  };

  // Helper to get effective key/url
  const getEffectiveKey = (prov) => state.apiKeys[prov] || state.apiKey || '';
  const getEffectiveBase = (prov) => state.baseUrls[prov] || state.baseUrl || '';

  // Fetch live model list from provider API
  const fetchAvailableModels = useCallback(async (provId, keyOverride, baseOverride) => {
    const key = keyOverride || getEffectiveKey(provId);
    const base = baseOverride || getEffectiveBase(provId);
    if (!key && provId !== 'devin') throw new Error('Isi API Key terlebih dahulu untuk fetch model terbaru.');
    
    if (provId === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => sanitizeModel(m.name))
        .sort();
    }
    if (provId === 'devin') {
      return []; // Devin does not expose a models endpoint, only session creation
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
  }, [state.apiKeys, state.baseUrls, state.apiKey, state.baseUrl]);

  // Test connection with explicit (unsaved) params
  const testConnection = useCallback(async ({ provider: prov, apiKey: key, modelName: model, baseUrl: base, customTemplate, customPath }) => {
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

    if (prov === 'devin') {
      const res = await fetch('https://api.devin.ai/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ prompt: 'Create a simple test session and exit.' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Devin API Error');
      if (data.session_id || data.id) return `Sesi Devin berhasil dibuat! (ID: ${data.session_id || data.id})`;
      return 'Koneksi ke Devin berhasil.';
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

    if (prov === 'custom') {
      if (!base) throw new Error('Base URL wajib diisi untuk Custom Provider.');
      const tpl = customTemplate || state.customBodyTemplate;
      const parsedBody = tpl.replace(/\{\{PROMPT\}\}/g, prompt).replace(/\{\{MODEL\}\}/g, cleanModel);
      
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: parsedBody,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Custom API Error');
      
      const pth = customPath || state.customResponsePath;
      if (pth) {
        const val = getNestedValue(data, pth);
        if (val) return String(val).trim();
      }
      return JSON.stringify(data).substring(0, 50) + '...';
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
  }, [state.customBodyTemplate, state.customResponsePath]);


  // Generic caller that works for any provider/model
  const callProviderAPI = async (provider, model, key, base, promptText) => {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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
      return { data, status: res.status, provider: 'gemini' };
    }

    if (provider === 'anthropic') {
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
          model: model || 'claude-3-haiku-20240307',
          max_tokens: 2048,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      return { data, status: res.status, provider: 'anthropic' };
    }

    // OpenAI-compatible (openai, groq, grok, openrouter, custom, etc.)
    const url = `${(base || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    return { data, status: res.status, provider: 'openai-compat' };
  };

  // Extract text from any provider response
  const extractText = ({ data, provider: prov }) => {
    if (prov === 'gemini') {
      if (data.error) return null;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
    if (prov === 'anthropic') {
      if (data.error) return null;
      return data.content?.[0]?.text || null;
    }
    // OpenAI-compatible
    if (data.error) return null;
    return data.choices?.[0]?.message?.content || null;
  };

  // Check if response is a rate-limit / server error that warrants a retry
  const isRetryable = ({ data, status }) => {
    const code = data?.error?.code || status;
    return code === 429 || code === 503 || code === 529;
  };

  const generateText = async (promptText) => {
    const key = getEffectiveKey(state.provider);
    if (!key) throw new Error('AI API Key is not set. Please configure it in Settings > AI Assistants.');
    const cleanModel = sanitizeModel(state.modelName);
    const base = getEffectiveBase(state.provider);

    // Skip fallback for Devin (session-based, no model list)
    if (state.provider === 'devin') {
      const res = await fetch('https://api.devin.ai/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Devin API Error');
      const sessionUrl = `https://app.devin.ai/sessions/${data.session_id || data.id}`;
      return `[Devin Session Created]\nCheck progress at: ${sessionUrl}`;
    }

    // Skip fallback for custom (single endpoint, no model list)
    if (state.provider === 'custom') {
      if (!base) throw new Error('Base URL is required for Custom Provider.');
      const parsedBody = state.customBodyTemplate
        .replace(/\{\{PROMPT\}\}/g, promptText)
        .replace(/\{\{MODEL\}\}/g, cleanModel);
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: parsedBody,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Custom API Error');
      if (state.customResponsePath) {
        const val = getNestedValue(data, state.customResponsePath);
        if (val) return String(val).trim();
      }
      return JSON.stringify(data);
    }

    // Build fallback queue: active model first, then rest of user's model list
    const userModelList = (state.providerModels?.[state.provider] || []).map(sanitizeModel);
    const fallbackQueue = [
      cleanModel,
      // Add models from user's list that aren't the active model
      ...userModelList.filter(m => m && m !== cleanModel),
    ].filter(Boolean);

    console.log(`[AI] Provider: ${state.provider} | Active: ${cleanModel} | Fallback queue: ${fallbackQueue.length} models`);

    let lastError = null;
    for (let i = 0; i < fallbackQueue.length; i++) {
      const model = fallbackQueue[i];
      try {
        if (i > 0) {
          await new Promise(r => setTimeout(r, 800)); // brief delay between retries
          console.log(`[AI] Trying fallback model [${i}/${fallbackQueue.length - 1}]: ${model}`);
        }

        const response = await callProviderAPI(state.provider, model, key, base, promptText);
        const text = extractText(response);

        if (text) {
          if (i > 0) console.log(`[AI] ✓ Fallback model "${model}" succeeded`);
          return text;
        }

        if (isRetryable(response)) {
          console.warn(`[AI] Model "${model}" rate limited (${response.data?.error?.code || response.status}), trying next...`);
          lastError = new Error(`Model "${model}" is rate limited. Trying next model...`);
          continue;
        }

        // Non-retryable error
        const errMsg = response.data?.error?.message || `Unknown error from ${model}`;
        console.warn(`[AI] Model "${model}" error: ${errMsg}`);
        lastError = new Error(errMsg);
        // For non-retryable errors on the first model, stop immediately
        if (i === 0) throw lastError;
        continue;

      } catch (err) {
        if (err === lastError) throw err; // re-throw non-retryable
        lastError = err;
        console.warn(`[AI] Model "${model}" threw:`, err.message);
        continue;
      }
    }

    throw lastError || new Error(`All ${state.provider} models are unavailable or rate limited. Please try again later or switch API key.`);
  };

  return { config: state, updateConfig, generateText, fetchAvailableModels, testConnection, getEffectiveKey, getEffectiveBase, saveProviderModels };
}
