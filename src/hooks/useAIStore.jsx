import { useReducer, useEffect, useRef, useCallback } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const AI_KEY = 'streamtube_ai_settings';

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
  const saved = readUserData(AI_KEY) || {};

  const initialApiKeys = { ...saved.apiKeys };
  const initialBaseUrls = { ...saved.baseUrls };
  
  // Legacy migration: old single apiKey/baseUrl → per-provider
  if (saved.apiKey && !initialApiKeys[saved.provider || 'gemini']) {
    initialApiKeys[saved.provider || 'gemini'] = saved.apiKey;
  }

  // ── CLEANUP: Remove cross-contaminated baseUrls ────────────
  // If a provider's saved URL matches another provider's default, it was leaked — remove it
  const allDefaults = Object.values(PROVIDER_BASE_URLS).filter(Boolean);
  for (const provId of Object.keys(initialBaseUrls)) {
    const url = (initialBaseUrls[provId] || '').replace(/\/+$/, '');
    const correctDefault = (PROVIDER_BASE_URLS[provId] || '').replace(/\/+$/, '');
    
    if (!url) continue;
    // If it matches a DIFFERENT provider's default → contaminated, delete it
    if (url !== correctDefault && allDefaults.some(d => d.replace(/\/+$/, '') === url)) {
      console.warn(`[AI] Cleaned stale baseUrl for ${provId}: "${url}" (belonged to another provider)`);
      delete initialBaseUrls[provId];
    }
    // If it matches its own default → no need to store, delete to keep clean
    if (url === correctDefault) {
      delete initialBaseUrls[provId];
    }
  }
  // Clear the legacy baseUrl field entirely
  const cleanedBaseUrl = '';

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...saved,
    apiKey: '',  // Never use legacy single key
    baseUrl: cleanedBaseUrl,
    apiKeys: initialApiKeys,
    baseUrls: initialBaseUrls,
    providerModels: saved.providerModels || {},
    modelName: sanitizeModel(saved.modelName || initialState.modelName),
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(AI_KEY, state);
  }, [state]);

  const updateConfig = (updates) => {
    let newApiKeys = { ...state.apiKeys };
    let newBaseUrls = { ...state.baseUrls };
    const targetProv = updates.provider || state.provider;
    
    // Only store API key if it's not empty
    if (updates.apiKey !== undefined) {
      if (updates.apiKey.trim()) {
        newApiKeys[targetProv] = updates.apiKey.trim();
      } else {
        delete newApiKeys[targetProv]; // Remove empty keys
      }
    }
    
    // Only store baseUrl if it differs from the provider's built-in default
    if (updates.baseUrl !== undefined) {
      const defaultUrl = (PROVIDER_BASE_URLS[targetProv] || '').replace(/\/+$/, '');
      const userUrl = (updates.baseUrl || '').replace(/\/+$/, '').trim();
      if (userUrl && userUrl !== defaultUrl) {
        newBaseUrls[targetProv] = userUrl;
      } else {
        delete newBaseUrls[targetProv]; // Use built-in default
      }
    }
    
    dispatch({
      type: 'UPDATE_CONFIG',
      payload: {
        ...updates,
        apiKey: '', // Never persist legacy single key
        baseUrl: '', // Never persist legacy single URL
        apiKeys: newApiKeys,
        baseUrls: newBaseUrls,
        providerModels: state.providerModels,
        modelName: updates.modelName ? sanitizeModel(updates.modelName) : state.modelName,
      },
    });
  };

  const saveProviderModels = (provId, models) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { providerModels: { ...state.providerModels, [provId]: models } } });
  };

  // ── Key / URL helpers (provider-isolated) ──────────────────
  const getEffectiveKey = (prov) => state.apiKeys[prov] || '';
  const getEffectiveBase = (prov) => state.baseUrls[prov] || PROVIDER_BASE_URLS[prov] || '';

  // ── Fetch Available Models ─────────────────────────────────
  const fetchAvailableModels = useCallback(async (prov, key, base) => {
    if (!key) throw new Error('API key required');
    if (prov === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace('models/', ''));
    }
    if (prov === 'anthropic') return [];
    if (prov === 'devin') return ['devin-session'];
    const url = `${(base || PROVIDER_BASE_URLS[prov] || PROVIDER_BASE_URLS.openai).replace(/\/$/, '')}/models`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return (data.data || []).map(m => m.id).sort();
  }, []);

  // ── Test Connection ────────────────────────────────────────
  const testConnection = useCallback(async (prov, key, base, model, prompt = 'Say OK') => {
    if (!key) throw new Error('API key required');
    const cleanModel = sanitizeModel(model);
    if (prov === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: MAX_TOKENS.test } }) }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
    }
    if (prov === 'anthropic') {
      const url = `${(base || PROVIDER_BASE_URLS.anthropic).replace(/\/$/, '')}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-browser': 'true' },
        body: JSON.stringify({ model: cleanModel || 'claude-3-haiku-20240307', max_tokens: MAX_TOKENS.test, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text?.trim() || 'OK';
    }
    if (prov === 'custom') {
      if (!base) throw new Error('Base URL required');
      const parsedBody = state.customBodyTemplate.replace(/\{\{PROMPT\}\}/g, prompt).replace(/\{\{MODEL\}\}/g, cleanModel);
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: parsedBody });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (state.customResponsePath) { const val = getNestedValue(data, state.customResponsePath); if (val) return String(val).trim(); }
      return JSON.stringify(data).substring(0, 50) + '...';
    }
    // OpenAI-compatible
    const url = `${(base || PROVIDER_BASE_URLS[prov] || PROVIDER_BASE_URLS.openai).replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
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
    const key = getEffectiveKey(provId);
    if (!key) return { success: false, reason: 'no_key' };

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

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        if (i > 0) await new Promise(r => setTimeout(r, 600));
        const response = await callProviderAPI(provId, model, key, base, promptText, maxTokens);
        const text = extractText(response);
        if (text) { console.log(`[AI] ✓ ${provId}/${model} succeeded`); return { success: true, text }; }
        if (isRetryable(response)) { console.warn(`[AI] ${provId}/${model} rate limited`); continue; }
        console.warn(`[AI] ${provId}/${model} error: ${response.data?.error?.message || 'unknown'}`);
        if (i === 0 && models.length === 1) return { success: false, reason: response.data?.error?.message || 'error' };
        continue;
      } catch (err) {
        console.warn(`[AI] ${provId}/${model} threw: ${err.message}`);
        continue;
      }
    }
    return { success: false, reason: 'all_models_failed' };
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
    const prompt = `You are a top-tier YouTube content strategist who writes like a real creator, not a robot. Generate complete metadata for a video/live stream about: "${context}"${keywordLine}

Write in American English. Respond in EXACTLY this format (no markdown, no extra commentary):

TITLE: <Write ONE viral-worthy title. Use power words, curiosity gaps, or emotional triggers. Must feel human, slightly clickbait but honest. Max 70 characters. Examples of good patterns: "I Tried X for 30 Days — Here's What Happened", "The SECRET Nobody Tells You About X", "Why X Will Change Everything in 2025">
---
DESCRIPTION: <Write a FULL YouTube description (250-400 words). Follow these rules STRICTLY:

PARAGRAPH 1 (Hook - 2-3 sentences): Start with a bold statement, personal story, or question that makes viewers NEED to keep reading. Use emotion. Don't start with "Welcome to" or "In this video". Instead try: "Okay real talk...", "I wasn't going to share this, but...", "You've been doing X wrong your entire life."

PARAGRAPH 2 (Value - 3-4 sentences): Explain what the viewer will learn or experience. Be specific about benefits. Use "you" and "your" to speak directly to them.

BULLET POINTS (use •): List 4-5 key highlights or topics covered. Make each one specific and intriguing, not generic.

PARAGRAPH 3 (Social proof / urgency - 1-2 sentences): Add credibility or urgency. "Join 50K+ viewers who..." or "This info won't be free forever..."

CALL TO ACTION (1-2 sentences): Natural, not desperate. Example: "If this helped you even 1%, smash that subscribe button — I drop content like this every week 🔥"

HASHTAGS (last line): Add 6-8 relevant hashtags starting with #. Mix popular and niche.

Use 4-6 emojis naturally throughout (🔥 💡 🎯 ⚡ 🚀 etc). Do NOT sound like ChatGPT. Sound like a real YouTuber who's excited about their content.>
---
TAGS: <Generate exactly 20 YouTube search tags, comma-separated. Rules:
- First 5 tags: exact match / high-volume search terms related to the title
- Next 5 tags: long-tail variations (3-5 word phrases people actually search)
- Next 5 tags: related topics / trending terms in the same niche  
- Last 5 tags: competitor/alternative keywords viewers might search
- NO generic tags like "video", "youtube", "content", "2024"
- Each tag should be something a real person would type into YouTube search>`;

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
