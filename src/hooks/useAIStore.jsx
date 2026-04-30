import { useReducer, useEffect, useRef, useCallback, useState } from 'react';

// ── Session Cache ────────────────────────────────────────────
const _aiCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(...parts) {
  return parts.map(p => String(p || '').toLowerCase().trim()).join('|');
}
function getFromCache(key) {
  const hit = _aiCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { _aiCache.delete(key); return null; }
  return hit.data;
}
function setToCache(key, data) {
  _aiCache.set(key, { data, ts: Date.now() });
  if (_aiCache.size > 50) { _aiCache.delete(_aiCache.keys().next().value); }
}

// ── Per-User Rate Limiter ────────────────────────────────────
const MAX_REQUESTS_PER_HOUR = 15;
const _requestLog = []; // timestamps

function checkRateLimit() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  while (_requestLog.length > 0 && _requestLog[0] < oneHourAgo) { _requestLog.shift(); }
  if (_requestLog.length >= MAX_REQUESTS_PER_HOUR) {
    const nextSlot = new Date(_requestLog[0] + 60 * 60 * 1000);
    throw new Error(`Rate limit reached (${MAX_REQUESTS_PER_HOUR}/hour). Try again after ${nextSlot.toLocaleTimeString()}.`);
  }
  _requestLog.push(now);
}

function getRemainingRequests() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  while (_requestLog.length > 0 && _requestLog[0] < oneHourAgo) { _requestLog.shift(); }
  return MAX_REQUESTS_PER_HOUR - _requestLog.length;
}

// ── Provider Base URL Defaults ───────────────────────────────
const PROVIDER_BASE_URLS = {
  gemini:     '', // Uses special URL pattern
  openai:     'https://api.openai.com/v1',
  anthropic:  'https://api.anthropic.com/v1',
  grok:       'https://api.x.ai/v1',
  groq:       'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  devin:      'https://api.devin.ai/v1',
  custom:     '',
};

// ── Cross-Provider Cascade Order (free/cheap first) ──────────
const CASCADE_ORDER = ['gemini', 'groq', 'openrouter', 'grok', 'openai', 'anthropic'];

// ── Max tokens per request type ──────────────────────────────
const MAX_TOKENS = {
  generate: 2048,      // single field (description can be 300+ words)
  generateAll: 3000,   // combined title + description + tags
  test: 20,            // connection test
};

// ── State ────────────────────────────────────────────────────
const initialState = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  baseUrl: '',
  apiKeys: {},
  baseUrls: {},
  providerModels: {},
  customBodyTemplate: '{\n  "messages": [\n    { "role": "user", "content": "{{PROMPT}}" }\n  ],\n  "model": "{{MODEL}}"\n}',
  customResponsePath: 'choices[0].message.content',
};

function sanitizeModel(name) {
  if (!name) return '';
  return name.replace(/^models\//, '').trim();
}

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_CONFIG': return { ...state, ...action.payload };
    default: return state;
  }
}

function getNestedValue(obj, path) {
  if (!path || !obj) return obj;
  try {
    const keys = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
    let result = obj;
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) { result = result[key]; }
      else { return undefined; }
    }
    return result;
  } catch (e) { return undefined; }
}

// ── Hook ─────────────────────────────────────────────────────
export function useAIStore() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const getToken = () => localStorage.getItem('streamtube_token');

  // Initialize from API
  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/settings/ai_config', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.data) {
          const saved = data.data;
          const initialApiKeys = { ...saved.apiKeys };
          const initialBaseUrls = { ...saved.baseUrls };
          
          if (saved.apiKey && !initialApiKeys[saved.provider || 'gemini']) {
            initialApiKeys[saved.provider || 'gemini'] = saved.apiKey;
          }

          const allDefaults = Object.values(PROVIDER_BASE_URLS).filter(Boolean);
          for (const provId of Object.keys(initialBaseUrls)) {
            const url = (initialBaseUrls[provId] || '').replace(/\/+$/, '');
            const correctDefault = (PROVIDER_BASE_URLS[provId] || '').replace(/\/+$/, '');
            if (!url) continue;
            if (url !== correctDefault && allDefaults.some(d => d.replace(/\/+$/, '') === url)) {
              delete initialBaseUrls[provId];
            }
            if (url === correctDefault) {
              delete initialBaseUrls[provId];
            }
          }

          dispatch({
            type: 'UPDATE_CONFIG',
            payload: {
              ...initialState,
              ...saved,
              apiKey: '',
              baseUrl: '',
              apiKeys: initialApiKeys,
              baseUrls: initialBaseUrls,
              providerModels: saved.providerModels || {},
              modelName: sanitizeModel(saved.modelName || initialState.modelName),
            }
          });
        }
      } catch {}
    };
    init();
  }, []);

  const saveConfig = (cfg) => {
    const token = getToken();
    if (token && cfg) {
      fetch('/api/settings/ai_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cfg)
      }).catch(() => {});
    }
  };

  const updateConfig = (updates) => {
    let newApiKeys = { ...state.apiKeys };
    let newBaseUrls = { ...state.baseUrls };
    const targetProv = updates.provider || state.provider;
    
    if (updates.apiKey !== undefined) {
      if (updates.apiKey.trim()) {
        newApiKeys[targetProv] = updates.apiKey.trim();
      } else {
        delete newApiKeys[targetProv];
      }
    }
    
    if (updates.baseUrl !== undefined) {
      const defaultUrl = (PROVIDER_BASE_URLS[targetProv] || '').replace(/\/+$/, '');
      const userUrl = (updates.baseUrl || '').replace(/\/+$/, '').trim();
      if (userUrl && userUrl !== defaultUrl) {
        newBaseUrls[targetProv] = userUrl;
      } else {
        delete newBaseUrls[targetProv];
      }
    }
    
    const nextState = {
      ...state,
      ...updates,
      apiKey: '',
      baseUrl: '',
      apiKeys: newApiKeys,
      baseUrls: newBaseUrls,
      providerModels: state.providerModels,
      modelName: updates.modelName ? sanitizeModel(updates.modelName) : state.modelName,
    };

    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
  };

  const saveProviderModels = (provId, models) => {
    const nextState = { ...stateRef.current, providerModels: { ...stateRef.current.providerModels, [provId]: models } };
    dispatch({ type: 'UPDATE_CONFIG', payload: { providerModels: nextState.providerModels } });
    saveConfig(nextState);
  };

  // ── Key / URL helpers (provider-isolated) ──────────────────
  const getEffectiveKey = (prov) => state.apiKeys[prov] || '';
  const getEffectiveBase = (prov) => state.baseUrls[prov] || PROVIDER_BASE_URLS[prov] || '';

  // ── Fetch Available Models ─────────────────────────────────
  const fetchAvailableModels = useCallback(async (prov, rawKey, base) => {
    if (!rawKey) throw new Error('API key required');
    if (prov === 'gemini') {
      const keys = Array.from(new Set(rawKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)));
      for (let i = 0; i < keys.length; i++) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keys[i]}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          return (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace('models/', ''));
        } catch (e) {
          if (i === keys.length - 1) throw e;
        }
      }
    }
    if (prov === 'anthropic') return [];
    if (prov === 'devin') return ['devin-session'];
    const url = `${(base || PROVIDER_BASE_URLS[prov] || PROVIDER_BASE_URLS.openai).replace(/\/$/, '')}/models`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${rawKey.trim()}` } });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return (data.data || []).map(m => m.id).sort();
  }, []);

  // ── Test Connection ────────────────────────────────────────
  const testConnection = useCallback(async (prov, rawKey, base, model, prompt = 'Say OK') => {
    if (!rawKey) throw new Error('API key required');
    const cleanModel = sanitizeModel(model);
    if (prov === 'gemini') {
      const keys = Array.from(new Set(rawKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)));
      for (let i = 0; i < keys.length; i++) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${keys[i]}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: MAX_TOKENS.test } }) }
          );
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
        } catch (e) {
          if (i === keys.length - 1) throw e;
        }
      }
    }
    if (prov === 'anthropic') {
      const url = `${(base || PROVIDER_BASE_URLS.anthropic).replace(/\/$/, '')}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': rawKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-browser': 'true' },
        body: JSON.stringify({ model: cleanModel || 'claude-3-haiku-20240307', max_tokens: MAX_TOKENS.test, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text?.trim() || 'OK';
    }
    if (prov === 'custom') {
      if (!base) throw new Error('Base URL required');
      const parsedBody = state.customBodyTemplate.replace(/\{\{PROMPT\}\}/g, prompt).replace(/\{\{MODEL\}\}/g, cleanModel);
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rawKey.trim()}` }, body: parsedBody });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (state.customResponsePath) { const val = getNestedValue(data, state.customResponsePath); if (val) return String(val).trim(); }
      return JSON.stringify(data).substring(0, 50) + '...';
    }
    // OpenAI-compatible
    const url = `${(base || PROVIDER_BASE_URLS[prov] || PROVIDER_BASE_URLS.openai).replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rawKey.trim()}` },
      body: JSON.stringify({ model: cleanModel || 'gpt-4o', messages: [{ role: 'user', content: prompt }], max_tokens: MAX_TOKENS.test }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content?.trim() || 'OK';
  }, [state.customBodyTemplate, state.customResponsePath]);

  // ── Generic Provider Caller (with token limits) ────────────
  const callProviderAPI = async (provider, model, key, base, promptText, maxTokens = MAX_TOKENS.generate) => {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens } }) }
      );
      const data = await res.json();
      return { data, status: res.status, provider: 'gemini' };
    }
    if (provider === 'anthropic') {
      const url = `${(base || PROVIDER_BASE_URLS.anthropic).replace(/\/$/, '')}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-browser': 'true' },
        body: JSON.stringify({ model: model || 'claude-3-haiku-20240307', max_tokens: maxTokens, messages: [{ role: 'user', content: promptText }], temperature: 0.7 }),
      });
      const data = await res.json();
      return { data, status: res.status, provider: 'anthropic' };
    }
    // OpenAI-compatible (openai, groq, grok, openrouter)
    const url = `${(base || PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.openai).replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: promptText }], temperature: 0.7, max_tokens: maxTokens }),
    });
    const data = await res.json();
    return { data, status: res.status, provider: 'openai-compat' };
  };

  const extractText = ({ data, provider: prov }) => {
    if (prov === 'gemini') { if (data.error) return null; return data.candidates?.[0]?.content?.parts?.[0]?.text || null; }
    if (prov === 'anthropic') { if (data.error) return null; return data.content?.[0]?.text || null; }
    if (data.error) return null;
    return data.choices?.[0]?.message?.content || null;
  };

  const isRetryable = ({ data, status }) => {
    const code = data?.error?.code || status;
    return code === 429 || code === 503 || code === 529;
  };

  // ── Try a single provider with model fallbacks ─────────────
  const tryProvider = async (provId, promptText, maxTokens) => {
    const rawKey = getEffectiveKey(provId);
    if (!rawKey) return { success: false, reason: 'no_key' };

    const keys = provId === 'gemini' 
      ? Array.from(new Set(rawKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)))
      : [rawKey.trim()];

    if (keys.length === 0) return { success: false, reason: 'no_key' };

    const base = getEffectiveBase(provId);
    const activeModel = (provId === state.provider) ? sanitizeModel(state.modelName) : '';
    const userModels = (state.providerModels?.[provId] || []).map(sanitizeModel);

    const models = [
      ...(activeModel ? [activeModel] : []),
      ...userModels.filter(m => m && m !== activeModel),
    ].filter(Boolean);

    if (models.length === 0) {
      const defaults = { gemini: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile', openrouter: 'google/gemini-2.5-flash', openai: 'gpt-4o-mini', grok: 'grok-2', anthropic: 'claude-3-haiku-20240307' };
      if (defaults[provId]) models.push(defaults[provId]);
    }

    for (let mIdx = 0; mIdx < models.length; mIdx++) {
      const model = models[mIdx];
      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const key = keys[kIdx];
        try {
          if (mIdx > 0 || kIdx > 0) await new Promise(r => setTimeout(r, 600));
          const response = await callProviderAPI(provId, model, key, base, promptText, maxTokens);
          const text = extractText(response);
          if (text) { console.log(`[AI] ✓ ${provId}/${model} (Key ${kIdx+1}) succeeded`); return { success: true, text }; }
          if (isRetryable(response)) { 
            console.warn(`[AI] ${provId}/${model} (Key ${kIdx+1}) rate limited/failed. Rotating...`); 
            continue; 
          }
          console.warn(`[AI] ${provId}/${model} (Key ${kIdx+1}) error: ${response.data?.error?.message || 'unknown'}`);
          if (mIdx === models.length - 1 && kIdx === keys.length - 1) return { success: false, reason: response.data?.error?.message || 'error' };
          break; // Not retryable -> next model
        } catch (err) {
          console.warn(`[AI] ${provId}/${model} (Key ${kIdx+1}) threw: ${err.message}`);
          continue;
        }
      }
    }
    return { success: false, reason: 'all_models_and_keys_failed' };
  };

  // ── Main generateText with cross-provider cascade ──────────
  const generateText = async (promptText, maxTokens = MAX_TOKENS.generate) => {
    // Check prompt cache
    const promptCacheKey = getCacheKey('prompt', state.provider, promptText.substring(0, 100));
    const cachedPrompt = getFromCache(promptCacheKey);
    if (cachedPrompt) { console.log('[AI] ✓ Prompt cache hit'); return cachedPrompt; }

    // Rate limit
    checkRateLimit();

    // Devin — no cascade
    if (state.provider === 'devin') {
      const key = getEffectiveKey('devin');
      if (!key) throw new Error('AI API Key is not set. Please configure it in Settings > AI Assistants.');
      const res = await fetch('https://api.devin.ai/v1/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Devin API Error');
      return `[Devin Session Created]\nCheck progress at: https://app.devin.ai/sessions/${data.session_id || data.id}`;
    }

    // Custom — no cascade
    if (state.provider === 'custom') {
      const key = getEffectiveKey('custom');
      if (!key) throw new Error('AI API Key is not set. Please configure it in Settings > AI Assistants.');
      const base = getEffectiveBase('custom');
      if (!base) throw new Error('Base URL is required for Custom Provider.');
      const parsedBody = state.customBodyTemplate.replace(/\{\{PROMPT\}\}/g, promptText).replace(/\{\{MODEL\}\}/g, sanitizeModel(state.modelName));
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: parsedBody });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Custom API Error');
      if (state.customResponsePath) { const val = getNestedValue(data, state.customResponsePath); if (val) return String(val).trim(); }
      return JSON.stringify(data);
    }

    // Cross-provider cascade: active provider first → free/cheap → paid
    const cascade = [state.provider, ...CASCADE_ORDER.filter(p => p !== state.provider)];
    const tried = [];

    for (const provId of cascade) {
      if (!getEffectiveKey(provId)) continue;
      console.log(`[AI] Cascade → trying ${provId}...`);
      tried.push(provId);
      const result = await tryProvider(provId, promptText, maxTokens);
      if (result.success) {
        setToCache(promptCacheKey, result.text);
        return result.text;
      }
      console.warn(`[AI] Cascade: ${provId} failed (${result.reason}), moving on...`);
    }

    if (tried.length === 0) throw new Error('No AI API keys configured. Please add at least one in Settings > AI Assistants.');
    throw new Error(`All providers failed (tried: ${tried.join(', ')}). Please try again later or check your API keys.`);
  };

  // ── Generate All Meta (1 call = title + desc + tags) ───────
  const generateAllMeta = async ({ context, keywords = '' } = {}) => {
    const cleanModel = sanitizeModel(state.modelName);
    const cacheKey = getCacheKey('meta', state.provider, cleanModel, context, keywords);
    const cached = getFromCache(cacheKey);
    if (cached) { console.log('[AI] ✓ Meta cache hit for:', context); return cached; }

    const keywordLine = keywords ? `\nFocus keywords: ${keywords}` : '';
    const prompt = `You are a top-tier YouTube content strategist. Generate complete metadata for a video/live stream about: "${context}"${keywordLine}

Write the final output in American English, but strictly follow these instructions:
1. TITLE: Gabungan antara SEO + curiosity + emosi. Make it highly engaging, clickbait but honest. Max 70 characters.
2. DESCRIPTION: Deskripsi YouTube yang SEO + natural + sedikit clickbait (gak kaku, terasa manusia). Include a hook, bullet points for value, and a natural call-to-action. Include 4-6 emojis naturally and 6-8 hashtags at the end.
3. TAGS: Generate tag sesuai judul + deskripsi maksimal 20 Tag. Make sure they are highly relevant search terms.

Respond EXACTLY in this format (no markdown, no extra commentary):

TITLE: <your title here>
---
DESCRIPTION: <your description here>
---
TAGS: <tag1, tag2, tag3, ..., tag20>`;

    const result = await generateText(prompt, MAX_TOKENS.generateAll);

    const titleMatch = result.match(/TITLE:\s*(.+?)(?:\n|$)/i);
    const descMatch = result.match(/DESCRIPTION:\s*([\s\S]+?)(?:\n---\s*\n|\n---$|---\s*\nTAGS:)/i);
    const tagsMatch = result.match(/TAGS:\s*([\s\S]+?)$/i);

    const title = titleMatch?.[1]?.replace(/^["'`]|["'`]$/g, '').trim() || '';
    const description = descMatch?.[1]?.trim() || '';
    const tagsRaw = tagsMatch?.[1]?.trim() || '';
    // Clean tags: remove bullet markers, numbering, newlines → split by comma
    const tags = tagsRaw
      .replace(/[\n\r]+/g, ', ')
      .replace(/^\s*[-•*]\s*/gm, '')
      .replace(/^\s*\d+[\.\)]\s*/gm, '')
      .split(',')
      .map(t => t.trim().replace(/^["']|["']$/g, ''))
      .filter(t => t.length > 0 && t.length < 60)
      .slice(0, 20);

    if (!title && !description && !tags.length) {
      throw new Error('AI returned an unexpected format. Please try again.');
    }

    const data = { title, description, tags };
    setToCache(cacheKey, data);
    console.log('[AI] ✓ Generated & cached metadata for:', context);
    return data;
  };

  return {
    config: state,
    updateConfig,
    generateText,
    generateAllMeta,
    fetchAvailableModels,
    testConnection,
    getEffectiveKey,
    getEffectiveBase,
    saveProviderModels,
    getRemainingRequests,
  };
}
