import { useReducer, useEffect, useRef, useCallback } from 'react';

const _aiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _aiCache) {
    if (now - val.ts > CACHE_TTL_MS) _aiCache.delete(key);
  }
}, CACHE_TTL_MS);

function getCacheKey(...parts) {
  return parts.map(p => String(p || '').toLowerCase().trim()).join('|');
}

function getFromCache(key) {
  const hit = _aiCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    _aiCache.delete(key);
    return null;
  }
  return hit.data;
}

function setToCache(key, data) {
  _aiCache.set(key, { data, ts: Date.now() });
  if (_aiCache.size > 50) _aiCache.delete(_aiCache.keys().next().value);
}

const MAX_REQUESTS_PER_HOUR = 15;
const _requestLog = [];

function checkRateLimit() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  while (_requestLog.length > 0 && _requestLog[0] < oneHourAgo) _requestLog.shift();
  if (_requestLog.length >= MAX_REQUESTS_PER_HOUR) {
    const nextSlot = new Date(_requestLog[0] + 60 * 60 * 1000);
    throw new Error(`Rate limit reached (${MAX_REQUESTS_PER_HOUR}/hour). Try again after ${nextSlot.toLocaleTimeString()}.`);
  }
  _requestLog.push(now);
}

function getRemainingRequests() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  while (_requestLog.length > 0 && _requestLog[0] < oneHourAgo) _requestLog.shift();
  return MAX_REQUESTS_PER_HOUR - _requestLog.length;
}

const MAX_TOKENS = {
  generate: 2048,
  generateAll: 3000,
  test: 20,
};

export const DEFAULT_AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    short: 'Gemini',
    type: 'gemini',
    system: true,
    capabilities: ['text'],
    baseUrl: '',
    endpoints: { models: '', chat: '' },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    short: 'OpenAI',
    type: 'openai-compatible',
    system: true,
    capabilities: ['text'],
    baseUrl: 'https://api.openai.com/v1',
    endpoints: { models: '/models', chat: '/chat/completions' },
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    short: 'Claude',
    type: 'anthropic',
    system: true,
    capabilities: ['text'],
    baseUrl: 'https://api.anthropic.com/v1',
    endpoints: { messages: '/messages' },
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    short: 'Grok',
    type: 'openai-compatible',
    system: true,
    capabilities: ['text'],
    baseUrl: 'https://api.x.ai/v1',
    endpoints: { models: '/models', chat: '/chat/completions' },
  },
  {
    id: 'groq',
    name: 'Groq',
    short: 'Groq',
    type: 'openai-compatible',
    system: true,
    capabilities: ['text'],
    baseUrl: 'https://api.groq.com/openai/v1',
    endpoints: { models: '/models', chat: '/chat/completions' },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    short: 'Router',
    type: 'openai-compatible',
    system: true,
    capabilities: ['text'],
    baseUrl: 'https://openrouter.ai/api/v1',
    endpoints: { models: '/models', chat: '/chat/completions' },
  },
  {
    id: 'devin',
    name: 'Devin.ai',
    short: 'Devin',
    type: 'devin',
    system: true,
    capabilities: ['agent'],
    baseUrl: 'https://api.devin.ai/v1',
    endpoints: { sessions: '/sessions' },
  },
  {
    id: 'leonardo',
    name: 'Leonardo.Ai',
    short: 'Leonardo',
    type: 'leonardo',
    system: true,
    capabilities: ['image', 'video'],
    baseUrl: 'https://cloud.leonardo.ai/api/rest',
    endpoints: {
      image: '/v2/generations',
      imageLegacy: '/v1/generations',
      video: '/v2/generations',
      videoImage: '/v1/generations-image-to-video',
      status: '/v1/generations/{{id}}',
    },
  },
];

const DEFAULT_MODEL_MAP = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-3-haiku-20240307'],
  grok: ['grok-3', 'grok-3-mini', 'grok-2', 'grok-2-mini'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  openrouter: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'anthropic/claude-3-opus', 'meta-llama/llama-3-70b-instruct'],
  devin: ['devin-session'],
  leonardo: [
    'gpt-image-2', 'gpt-image-1.5', 'gemini-2.5-flash-image', 'gemini-image-2',
    'nano-banana-2', 'seedream-4.5', 'flux-pro-2.0', 'hailuo-2_3',
    'kling-3.0', 'kling-video-o-3', 'ltxv-2.3-pro', 'seedance-1.0-pro',
    'VEO3', 'VEO3_1', 'KLING2_5', 'KLING2_1',
  ],
};

const DEFAULT_TEXT_CASCADE = ['gemini', 'groq', 'openrouter', 'grok', 'openai', 'anthropic'];
const DEFAULT_IDS = new Set(DEFAULT_AI_PROVIDERS.map(p => p.id));

const initialState = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  baseUrl: '',
  apiKeys: {},
  baseUrls: {},
  providerEndpoints: {},
  providerModels: {},
  providers: cloneProviders(DEFAULT_AI_PROVIDERS),
};

function cloneProviders(providers) {
  return providers.map(provider => ({
    ...provider,
    capabilities: [...(provider.capabilities || [])],
    endpoints: { ...(provider.endpoints || {}) },
  }));
}

function sanitizeModel(name) {
  if (!name) return '';
  return String(name).replace(/^models\//, '').trim();
}

function slugifyProviderName(name) {
  const base = String(name || 'provider').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'provider';
}

function makeProviderId(name, existingIds) {
  const base = slugifyProviderName(name);
  let id = base;
  let idx = 2;
  while (existingIds.has(id)) {
    id = `${base}-${idx}`;
    idx += 1;
  }
  return id;
}

function defaultCapabilitiesForType(type) {
  if (type === 'leonardo') return ['image', 'video'];
  if (type === 'devin') return ['agent'];
  return ['text'];
}

function defaultEndpointsForType(type) {
  if (type === 'anthropic') return { messages: '/messages' };
  if (type === 'devin') return { sessions: '/sessions' };
  if (type === 'leonardo') {
    return {
      image: '/v2/generations',
      imageLegacy: '/v1/generations',
      video: '/v2/generations',
      videoImage: '/v1/generations-image-to-video',
      status: '/v1/generations/{{id}}',
    };
  }
  return { models: '/models', chat: '/chat/completions' };
}

function normalizeProvider(provider) {
  const type = provider.type || 'openai-compatible';
  return {
    id: provider.id,
    name: provider.name || provider.short || provider.id,
    short: provider.short || provider.name || provider.id,
    type,
    system: !!provider.system,
    capabilities: Array.isArray(provider.capabilities) && provider.capabilities.length ? provider.capabilities : defaultCapabilitiesForType(type),
    baseUrl: provider.baseUrl || '',
    endpoints: { ...defaultEndpointsForType(type), ...(provider.endpoints || {}) },
  };
}

function mergeProviders(savedProviders, savedConfig = {}) {
  const defaults = cloneProviders(DEFAULT_AI_PROVIDERS);
  const saved = Array.isArray(savedProviders) ? savedProviders : [];
  const customProviders = saved
    .filter(provider => provider?.id && !DEFAULT_IDS.has(provider.id) && provider.id !== 'custom')
    .map(provider => normalizeProvider(provider));

  if ((savedConfig?.apiKeys?.custom || savedConfig?.baseUrls?.custom) && !customProviders.some(p => p.id === 'custom-provider')) {
    customProviders.push(normalizeProvider({
      id: 'custom-provider',
      name: 'Custom Provider',
      short: 'Custom',
      type: 'openai-compatible',
      baseUrl: savedConfig?.baseUrls?.custom || '',
    }));
  }

  return [...defaults, ...customProviders];
}

function providerHas(provider, capability) {
  return (provider?.capabilities || []).includes(capability);
}

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_CONFIG':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

function getProviderFromState(state, provId) {
  return (state.providers || []).find(p => p.id === provId) || DEFAULT_AI_PROVIDERS.find(p => p.id === provId) || null;
}

function joinEndpoint(base, endpoint) {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanEndpoint = String(endpoint || '').trim();
  if (!cleanEndpoint) return cleanBase;
  if (/^https?:\/\//i.test(cleanEndpoint)) return cleanEndpoint;
  if (!cleanBase) return cleanEndpoint;
  if (cleanBase.endsWith(cleanEndpoint)) return cleanBase;
  return `${cleanBase}/${cleanEndpoint.replace(/^\/+/, '')}`;
}

// Parse response that might be SSE (data: {...}) or plain JSON
async function parseOpenAIResponse(res) {
  const text = await res.text();
  // Try plain JSON first
  try {
    return JSON.parse(text);
  } catch {}
  // Try SSE: extract last complete JSON from "data: {...}" lines
  const lines = text.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'));
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i].slice(6));
    } catch {}
  }
  // If nothing parsed, throw with raw response
  throw new Error(`Invalid response: ${text.substring(0, 200)}`);
}

export function useAIStore() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const getToken = () => localStorage.getItem('streamtube_token');

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/settings/ai_config', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.data) {
          const saved = data.data;
          const initialApiKeys = { ...(saved.apiKeys || {}) };
          const initialBaseUrls = { ...(saved.baseUrls || {}) };
          const providers = mergeProviders(saved.providers, saved);
          const provider = saved.provider && saved.provider !== 'custom' ? saved.provider : 'gemini';

          if (saved.apiKey && !initialApiKeys[provider]) initialApiKeys[provider] = saved.apiKey;
          if (initialApiKeys.custom && !initialApiKeys['custom-provider']) {
            initialApiKeys['custom-provider'] = initialApiKeys.custom;
            delete initialApiKeys.custom;
          }
          if (initialBaseUrls.custom && !initialBaseUrls['custom-provider']) {
            initialBaseUrls['custom-provider'] = initialBaseUrls.custom;
            delete initialBaseUrls.custom;
          }

          dispatch({
            type: 'UPDATE_CONFIG',
            payload: {
              ...initialState,
              ...saved,
              provider,
              apiKey: '',
              baseUrl: '',
              apiKeys: initialApiKeys,
              baseUrls: initialBaseUrls,
              providerEndpoints: saved.providerEndpoints || {},
              providerModels: saved.providerModels || {},
              providers,
              modelName: sanitizeModel(saved.modelName || initialState.modelName),
            },
          });
        }
      } catch {}
    };
    init();
  }, []);

  const saveConfig = (cfg) => {
    const token = getToken();
    if (!token || !cfg) return;
    fetch('/api/settings/ai_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...cfg, apiKey: '', baseUrl: '' }),
    }).catch(() => {});
  };

  const getEffectiveKey = useCallback((prov) => {
    return stateRef.current.apiKeys?.[prov] || '';
  }, []);

  const getEffectiveBase = useCallback((prov) => {
    const cur = stateRef.current;
    const provider = getProviderFromState(cur, prov);
    return cur.baseUrls?.[prov] || provider?.baseUrl || '';
  }, []);

  const getEffectiveEndpoint = useCallback((prov, endpointName) => {
    const cur = stateRef.current;
    const provider = getProviderFromState(cur, prov);
    return cur.providerEndpoints?.[prov]?.[endpointName] || provider?.endpoints?.[endpointName] || '';
  }, []);

  const updateConfig = (updates) => {
    const cur = stateRef.current;
    let newApiKeys = { ...cur.apiKeys };
    let newBaseUrls = { ...cur.baseUrls };
    const targetProv = updates.provider || cur.provider;
    const provider = getProviderFromState(cur, targetProv);

    if (updates.apiKey !== undefined) {
      if (String(updates.apiKey).trim()) newApiKeys[targetProv] = String(updates.apiKey).trim();
      else delete newApiKeys[targetProv];
    }

    if (updates.baseUrl !== undefined) {
      const defaultUrl = (provider?.baseUrl || '').replace(/\/+$/, '');
      const userUrl = String(updates.baseUrl || '').replace(/\/+$/, '').trim();
      if (userUrl && userUrl !== defaultUrl) newBaseUrls[targetProv] = userUrl;
      else delete newBaseUrls[targetProv];
    }

    const nextState = {
      ...cur,
      ...updates,
      apiKey: '',
      baseUrl: '',
      apiKeys: newApiKeys,
      baseUrls: newBaseUrls,
      modelName: updates.modelName !== undefined ? sanitizeModel(updates.modelName) : cur.modelName,
    };

    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
  };

  const updateProviderDetails = (provId, details) => {
    const cur = stateRef.current;
    const provider = getProviderFromState(cur, provId);
    if (!provider) return { success: false, error: 'Provider not found' };

    const endpoints = { ...(provider.endpoints || {}), ...(details.endpoints || {}) };
    const providers = cur.providers.map(p => (
      p.id === provId
        ? normalizeProvider({
            ...p,
            name: details.name ?? p.name,
            short: details.short ?? p.short,
            type: details.type ?? p.type,
            baseUrl: details.baseUrl ?? p.baseUrl,
            endpoints,
          })
        : p
    ));

    const providerEndpoints = { ...cur.providerEndpoints, [provId]: endpoints };
    const baseUrls = { ...cur.baseUrls };
    const nextBase = String(details.baseUrl ?? provider.baseUrl ?? '').replace(/\/+$/, '').trim();
    const defaultBase = (DEFAULT_AI_PROVIDERS.find(p => p.id === provId)?.baseUrl || '').replace(/\/+$/, '');
    if (nextBase && nextBase !== defaultBase) baseUrls[provId] = nextBase;
    else delete baseUrls[provId];

    const nextState = { ...cur, providers, providerEndpoints, baseUrls };
    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
    return { success: true };
  };

  const addProvider = (details) => {
    const cur = stateRef.current;
    const existingIds = new Set((cur.providers || []).map(p => p.id));
    const id = makeProviderId(details.name || 'Provider', existingIds);
    const provider = normalizeProvider({
      id,
      name: details.name || 'New Provider',
      short: details.short || details.name || 'Provider',
      type: details.type || 'openai-compatible',
      system: false,
      baseUrl: details.baseUrl || '',
      endpoints: { ...defaultEndpointsForType(details.type || 'openai-compatible'), ...(details.endpoints || {}) },
    });
    const providers = [...cur.providers, provider];
    const nextProvider = providerHas(provider, 'text') ? id : cur.provider;
    const nextModel = providerHas(provider, 'text') ? (DEFAULT_MODEL_MAP[id]?.[0] || details.modelName || '') : cur.modelName;
    const nextState = {
      ...cur,
      providers,
      provider: nextProvider,
      modelName: nextModel,
      providerModels: { ...cur.providerModels, [id]: details.modelName ? [details.modelName] : [] },
    };
    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
    return provider;
  };

  const deleteProvider = (provId) => {
    const cur = stateRef.current;
    const provider = getProviderFromState(cur, provId);
    if (!provider) return { success: false, error: 'Provider not found' };
    if (provider.system) return { success: false, error: 'Provider bawaan tidak bisa dihapus' };

    const providers = cur.providers.filter(p => p.id !== provId);
    const apiKeys = { ...cur.apiKeys };
    const baseUrls = { ...cur.baseUrls };
    const providerEndpoints = { ...cur.providerEndpoints };
    const providerModels = { ...cur.providerModels };
    delete apiKeys[provId];
    delete baseUrls[provId];
    delete providerEndpoints[provId];
    delete providerModels[provId];

    const fallback = providers.find(p => providerHas(p, 'text'))?.id || 'gemini';
    const nextState = {
      ...cur,
      providers,
      apiKeys,
      baseUrls,
      providerEndpoints,
      providerModels,
      provider: cur.provider === provId ? fallback : cur.provider,
      modelName: cur.provider === provId ? (providerModels[fallback]?.[0] || DEFAULT_MODEL_MAP[fallback]?.[0] || '') : cur.modelName,
    };
    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
    return { success: true };
  };

  const saveProviderModels = (provId, models) => {
    const cur = stateRef.current;
    const nextModels = { ...cur.providerModels, [provId]: models };
    const nextState = { ...cur, providerModels: nextModels };
    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
  };

  const deleteApiKey = (provId, singleKey) => {
    const prov = provId || stateRef.current.provider;
    const newApiKeys = { ...stateRef.current.apiKeys };
    if (singleKey && newApiKeys[prov]) {
      const keys = newApiKeys[prov].split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
      const filtered = keys.filter(k => k !== singleKey.trim());
      if (filtered.length > 0) newApiKeys[prov] = filtered.join(', ');
      else delete newApiKeys[prov];
    } else {
      delete newApiKeys[prov];
    }
    const nextState = { ...stateRef.current, apiKey: '', apiKeys: newApiKeys };
    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
  };

  const addApiKeys = (provId, newKeysRaw) => {
    const prov = provId || stateRef.current.provider;
    const newApiKeys = { ...stateRef.current.apiKeys };
    const existingKeys = (newApiKeys[prov] || '').split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
    const incomingKeys = String(newKeysRaw || '').split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existingKeys, ...incomingKeys]));
    if (merged.length > 0) newApiKeys[prov] = merged.join(', ');
    const nextState = { ...stateRef.current, apiKey: '', apiKeys: newApiKeys };
    dispatch({ type: 'UPDATE_CONFIG', payload: nextState });
    saveConfig(nextState);
    return { added: incomingKeys.length, duplicates: incomingKeys.length - (merged.length - existingKeys.length), total: merged.length };
  };

  const fetchAvailableModels = useCallback(async (prov, rawKey, base) => {
    if (!rawKey) throw new Error('API key required');
    const cur = stateRef.current;
    const provider = getProviderFromState(cur, prov);
    if (!provider) throw new Error('Provider not found');

    if (provider.type === 'gemini') {
      const keys = Array.from(new Set(rawKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)));
      for (let i = 0; i < keys.length; i += 1) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keys[i]}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          return (data.models || [])
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
        } catch (e) {
          if (i === keys.length - 1) throw e;
        }
      }
    }

    if (provider.type === 'anthropic') return DEFAULT_MODEL_MAP.anthropic;
    if (provider.type === 'devin') return DEFAULT_MODEL_MAP.devin;
    if (provider.type === 'leonardo') return DEFAULT_MODEL_MAP.leonardo;

    const effectiveBase = base || getEffectiveBase(prov);
    const modelsEndpoint = getEffectiveEndpoint(prov, 'models') || '/models';
    const url = joinEndpoint(effectiveBase, modelsEndpoint);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${rawKey.trim()}` } });
    const data = await parseOpenAIResponse(res);
    if (data.error) throw new Error(data.error.message || data.error);
    return (data.data || []).map(m => m.id).sort();
  }, [getEffectiveBase, getEffectiveEndpoint]);

  const testConnection = useCallback(async (prov, rawKey, base, model, prompt = 'Say OK') => {
    if (!rawKey) throw new Error('API key required');
    const cur = stateRef.current;
    const provider = getProviderFromState(cur, prov);
    if (!provider) throw new Error('Provider not found');
    const cleanModel = sanitizeModel(model);

    if (provider.type === 'gemini') {
      const keys = Array.from(new Set(rawKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)));
      const results = [];
      for (let i = 0; i < keys.length; i += 1) {
        const keyLabel = keys.length > 1 ? `Key ${i + 1} (...${keys[i].slice(-6)})` : 'Key';
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${keys[i]}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: MAX_TOKENS.test } }),
            },
          );
          const data = await res.json();
          if (data.error) results.push(`${keyLabel}: FAILED ${data.error.message}`);
          else results.push(`${keyLabel}: OK "${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK'}"`);
        } catch (e) {
          results.push(`${keyLabel}: FAILED ${e.message}`);
        }
      }
      if (results.every(r => r.includes('FAILED'))) throw new Error(results.join('\n'));
      return results.join('\n');
    }

    if (provider.type === 'anthropic') {
      const url = joinEndpoint(base || getEffectiveBase(prov), getEffectiveEndpoint(prov, 'messages') || '/messages');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': rawKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-browser': 'true' },
        body: JSON.stringify({ model: cleanModel || 'claude-3-haiku-20240307', max_tokens: MAX_TOKENS.test, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text?.trim() || 'OK';
    }

    if (provider.type === 'devin') return 'Devin key saved. Sessions are created only during generation.';
    if (provider.type === 'leonardo') return 'Leonardo key saved. Image/video generation runs through the server proxy.';

    const effectiveBase = base || getEffectiveBase(prov);
    const chatEndpoint = getEffectiveEndpoint(prov, 'chat') || '/chat/completions';
    const url = joinEndpoint(effectiveBase, chatEndpoint);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawKey.trim()}` },
      body: JSON.stringify({ model: cleanModel || 'gpt-4o', messages: [{ role: 'user', content: prompt }], max_tokens: MAX_TOKENS.test }),
    });
    const data = await parseOpenAIResponse(res);
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content?.trim() || 'OK';
  }, [getEffectiveBase, getEffectiveEndpoint]);

  const callProviderAPI = async (provider, model, key, base, promptText, maxTokens = MAX_TOKENS.generate) => {
    const provDef = getProviderFromState(stateRef.current, provider);
    if (!provDef) throw new Error('Provider not found');

    if (provDef.type === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens } }),
        },
      );
      const data = await res.json();
      return { data, status: res.status, provider: 'gemini' };
    }

    if (provDef.type === 'anthropic') {
      const url = joinEndpoint(base || getEffectiveBase(provider), getEffectiveEndpoint(provider, 'messages') || '/messages');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-browser': 'true' },
        body: JSON.stringify({ model: model || 'claude-3-haiku-20240307', max_tokens: maxTokens, messages: [{ role: 'user', content: promptText }], temperature: 0.7 }),
      });
      const data = await res.json();
      return { data, status: res.status, provider: 'anthropic' };
    }

    const url = joinEndpoint(base || getEffectiveBase(provider), getEffectiveEndpoint(provider, 'chat') || '/chat/completions');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: promptText }], temperature: 0.7, max_tokens: maxTokens }),
    });
    const data = await parseOpenAIResponse(res);
    return { data, status: res.status, provider: 'openai-compat' };
  };

  const extractText = ({ data, provider: prov }) => {
    if (prov === 'gemini') {
      if (data.error) return null;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
    if (prov === 'anthropic') {
      if (data.error) return null;
      return data.content?.[0]?.text || null;
    }
    if (data.error) return null;
    return data.choices?.[0]?.message?.content || null;
  };

  const isRetryable = ({ data, status }) => {
    const code = data?.error?.code || status;
    return code === 429 || code === 503 || code === 529;
  };

  const tryProvider = async (provId, promptText, maxTokens) => {
    const cur = stateRef.current;
    const provDef = getProviderFromState(cur, provId);
    if (!providerHas(provDef, 'text')) return { success: false, reason: 'not_text_provider' };
    const rawKey = getEffectiveKey(provId);
    if (!rawKey) return { success: false, reason: 'no_key' };

    const keys = provDef.type === 'gemini'
      ? Array.from(new Set(rawKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)))
      : [rawKey.trim()];
    if (keys.length === 0) return { success: false, reason: 'no_key' };

    const base = getEffectiveBase(provId);
    const activeModel = provId === cur.provider ? sanitizeModel(cur.modelName) : '';
    const userModels = (cur.providerModels?.[provId] || []).map(sanitizeModel);
    const defaults = DEFAULT_MODEL_MAP[provId] || [];
    const models = [
      ...(activeModel ? [activeModel] : []),
      ...userModels.filter(m => m && m !== activeModel),
      ...defaults.filter(m => m && m !== activeModel && !userModels.includes(m)),
    ].filter(Boolean);

    // Fallback: if no models found, try with common model names
    if (models.length === 0) {
      models.push('gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo');
    }

    for (let mIdx = 0; mIdx < models.length; mIdx += 1) {
      const model = models[mIdx];
      for (let kIdx = 0; kIdx < keys.length; kIdx += 1) {
        const key = keys[kIdx];
        try {
          if (mIdx > 0 || kIdx > 0) await new Promise(r => setTimeout(r, 600));
          const response = await callProviderAPI(provId, model, key, base, promptText, maxTokens);
          const text = extractText(response);
          if (text) {
            console.log(`[AI] ${provId}/${model} succeeded`);
            return { success: true, text };
          }
          if (isRetryable(response)) continue;
          if (mIdx === models.length - 1 && kIdx === keys.length - 1) {
            return { success: false, reason: response.data?.error?.message || 'error' };
          }
          break;
        } catch (err) {
          console.warn(`[AI] ${provId}/${model} failed: ${err.message}`);
        }
      }
    }
    return { success: false, reason: 'all_models_and_keys_failed' };
  };

  const generateText = async (promptText, maxTokens = MAX_TOKENS.generate) => {
    checkRateLimit();
    const cur = stateRef.current;
    const activeProvider = getProviderFromState(cur, cur.provider);

    if (activeProvider?.type === 'devin') {
      const key = getEffectiveKey('devin');
      if (!key) throw new Error('AI API Key is not set. Please configure it in Settings > AI Assistants.');
      const url = joinEndpoint(getEffectiveBase('devin'), getEffectiveEndpoint('devin', 'sessions') || '/sessions');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Devin API Error');
      return `[Devin Session Created]\nCheck progress at: https://app.devin.ai/sessions/${data.session_id || data.id}`;
    }

    // Build cascade: active provider first, then defaults, then all text providers
    const allTextProviders = (cur.providers || []).filter(p => providerHas(p, 'text')).map(p => p.id);
    const activeId = providerHas(activeProvider, 'text') ? cur.provider : null;
    const cascade = Array.from(new Set([
      ...(activeId ? [activeId] : []),
      ...DEFAULT_TEXT_CASCADE,
      ...allTextProviders,
    ]));

    const tried = [];
    const errors = [];

    for (const provId of cascade) {
      if (!getEffectiveKey(provId)) continue;
      tried.push(provId);
      const result = await tryProvider(provId, promptText, maxTokens);
      if (result.success) return result.text;
      errors.push(`${provId}: ${result.reason}`);
    }

    if (tried.length === 0) throw new Error('No AI API keys configured. Please add at least one in Settings > AI Assistants.');
    throw new Error(`All providers failed:\n${errors.join('\n')}`);
  };

  const generateAllMeta = async ({ context, theme = '', category = '' } = {}) => {
    const cleanModel = sanitizeModel(stateRef.current.modelName);
    const cacheKey = getCacheKey('meta', stateRef.current.provider, cleanModel, context, theme, category);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const themeLine = theme ? `\nTheme/Mood: "${theme}"` : '';
    const categoryLine = category ? `\nYouTube Category: "${category}"` : '';
    const prompt = `You are a top-tier YouTube content strategist. Generate complete metadata for a video/live stream about: "${context}"${themeLine}${categoryLine}

Write the final output in American English, but strictly follow these instructions:
1. TITLE: Gabungan antara SEO + curiosity + emosi. Make it highly engaging, clickbait but honest. Max 70 characters. Match the theme/mood and category.
2. DESCRIPTION: Deskripsi YouTube yang SEO + natural + sedikit clickbait (gak kaku, terasa manusia). Tone harus sesuai tema. Include a hook, bullet points for value, and a natural call-to-action. Include 4-6 emojis naturally and 6-8 hashtags at the end.
3. TAGS: Generate tag sesuai judul + deskripsi + tema + category, maksimal 20 Tag. Make sure they are highly relevant search terms.

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
    const tags = tagsRaw
      .replace(/[\n\r]+/g, ', ')
      .replace(/^\s*[-*]\s*/gm, '')
      .replace(/^\s*\d+[\.)]\s*/gm, '')
      .split(',')
      .map(t => t.trim().replace(/^["']|["']$/g, ''))
      .filter(t => t.length > 0 && t.length < 60)
      .slice(0, 20);

    if (!title && !description && !tags.length) throw new Error('AI returned an unexpected format. Please try again.');

    const data = { title, description, tags };
    setToCache(cacheKey, data);
    return data;
  };

  return {
    config: state,
    updateConfig,
    addProvider,
    deleteProvider,
    updateProviderDetails,
    deleteApiKey,
    addApiKeys,
    generateText,
    generateAllMeta,
    fetchAvailableModels,
    testConnection,
    getEffectiveKey,
    getEffectiveBase,
    getEffectiveEndpoint,
    saveProviderModels,
    getRemainingRequests,
  };
}
