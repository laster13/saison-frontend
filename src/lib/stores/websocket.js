import { writable } from 'svelte/store';

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 1.5;
const MAX_RECONNECT_ATTEMPTS = 10;

let socket = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let reconnectDelay = INITIAL_RECONNECT_DELAY;
let isManuallyClosed = false;

const handlers = new Map(); // Map de type => [callbacks]

export const websocketStore = writable({
  connectionStatus: 'disconnected', // "connecting", "connected", "reconnecting", "error"
  lastMessage: null,
  reconnectAttempts: 0
});

function getReconnectDelay() {
  const delay = Math.min(
    reconnectDelay * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  return delay + Math.random() * 1000; // jitter
}

export function connectWebSocket(userId) {
  if (!userId || (socket && socket.readyState === WebSocket.OPEN)) {
    console.warn("⚠️ Tentative de connexion WebSocket ignorée (userId manquant ou socket déjà ouverte)");
    return;
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';

  let backendHost;
  if (import.meta.env.DEV) {
    backendHost = `${window.location.hostname}:8080`; // dev → backend local
  } else {
    backendHost = window.location.host; // prod → même domaine que le front
  }

  // ✅ On utilise les cookies HttpOnly (pas de token en query string)
  const url = `${protocol}://${backendHost}/api/v1/ws/${userId}`;

  // 🔍 DEBUG
  console.log("🌍 protocol =", protocol);
  console.log("🌍 backendHost =", backendHost);
  console.log("👤 userId =", userId);
  console.log("🔗 tentative connexion WebSocket vers:", url);

  websocketStore.update(s => ({ ...s, connectionStatus: 'connecting' }));

  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error("❌ Erreur lors de la création du WebSocket:", err);
    return;
  }

  socket.onopen = () => {
    console.log('✅ WebSocket ouvert');
    reconnectAttempts = 0;
    reconnectDelay = INITIAL_RECONNECT_DELAY;
    websocketStore.update(s => ({ ...s, connectionStatus: 'connected' }));
  };

  socket.onmessage = (event) => {
    console.log('📩 Message WS brut:', event.data);
    try {
      const data = JSON.parse(event.data);
      websocketStore.update(s => ({ ...s, lastMessage: data }));

      if (data.type === 'ping') {
        console.log("↔️ ping reçu, envoi pong");
        sendMessage({ type: 'pong', timestamp: data.timestamp });
        return;
      }

      const callbacks = handlers.get(data.type) || [];
      callbacks.forEach(cb => cb(data));
    } catch (err) {
      console.error('❌ WebSocket parse error:', err);
    }
  };

  socket.onclose = () => {
    console.warn('⚠️ WebSocket fermé');
    websocketStore.update(s => ({ ...s, connectionStatus: 'disconnected' }));

    if (!isManuallyClosed && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts += 1;
      websocketStore.update(s => ({
        ...s,
        connectionStatus: 'reconnecting',
        reconnectAttempts
      }));

      reconnectTimeout = setTimeout(() => {
        connectWebSocket(userId);
      }, getReconnectDelay());
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      websocketStore.update(s => ({ ...s, connectionStatus: 'error' }));
      console.error('❌ WebSocket: max reconnect attempts reached');
    }
  };

  socket.onerror = (err) => {
    console.error('❌ WebSocket error:', err);
    websocketStore.update(s => ({ ...s, connectionStatus: 'error' }));
  };
}

export function disconnectWebSocket() {
  isManuallyClosed = true;
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (socket) socket.close();
  socket = null;
  websocketStore.set({
    connectionStatus: 'disconnected',
    lastMessage: null,
    reconnectAttempts: 0
  });
}

export function sendMessage(msg) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("📤 Envoi message WS:", msg);
    socket.send(JSON.stringify(msg));
    return true;
  }
  console.warn('⚠️ WebSocket not connected');
  return false;
}

export function addMessageHandler(type, callback) {
  console.log("➕ Ajout handler WS pour type:", type);
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push(callback);

  return () => {
    console.log("➖ Suppression handler WS pour type:", type);
    const cbList = handlers.get(type) || [];
    handlers.set(type, cbList.filter(cb => cb !== callback));
  };
}
