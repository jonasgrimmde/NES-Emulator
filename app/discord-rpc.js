const crypto = require("crypto");
const net = require("net");

function getDiscordClientId() {
  return String(process.env.DISCORD_CLIENT_ID || process.env.DISCORD_RPC_CLIENT_ID || process.env.NES_DISCORD_CLIENT_ID || "").trim();
}

function getDiscordIpcPath(index) {
  if (process.platform === "win32") {
    return "\\\\?\\pipe\\discord-ipc-" + index;
  }
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp";
  return base.replace(/\/$/, "") + "/discord-ipc-" + index;
}

function encodeDiscordPacket(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload || {}), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function createDiscordNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function shouldIgnoreDiscordRpcError(error) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  return message.includes("enoent")
    || message.includes("econnrefused")
    || message.includes("connection closed")
    || message.includes("could not connect")
    || message.includes("disconnected")
    || message.includes("no such file");
}

function createDiscordActivity(details, state, sessionStart) {
  return {
    details,
    state,
    timestamps: {
      start: Math.floor(sessionStart / 1000),
    },
    assets: {
      large_image: process.env.DISCORD_RPC_LARGE_IMAGE || "logo",
      large_text: process.env.DISCORD_RPC_LARGE_TEXT || "NES Emulator",
      small_image: process.env.DISCORD_RPC_SMALL_IMAGE || "jonasgrimm",
      small_text: process.env.DISCORD_RPC_SMALL_TEXT || "jonasgrimm.de",
    },
    instance: false,
  };
}

function createDiscordRpc() {
  const clientId = getDiscordClientId();
  const opcodes = {
    handshake: 0,
    frame: 1,
    ping: 3,
    pong: 4,
  };
  const state = {
    clientId,
    enabled: Boolean(clientId),
    connected: false,
    socket: null,
    buffer: Buffer.alloc(0),
    reconnectTimer: null,
    lastActivity: null,
    sessionStart: Date.now(),
  };

  function destroySocket() {
    state.connected = false;
    state.buffer = Buffer.alloc(0);
    if (state.socket) {
      const socket = state.socket;
      state.socket = null;
      socket.removeAllListeners();
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
  }

  function write(opcode, payload) {
    if (!state.socket || state.socket.destroyed) {
      return false;
    }
    try {
      state.socket.write(encodeDiscordPacket(opcode, payload));
      return true;
    } catch (error) {
      if (!shouldIgnoreDiscordRpcError(error)) {
        console.warn("Discord RPC write failed:", error.message || error);
      }
      return false;
    }
  }

  function setActivity(activity) {
    if (!state.enabled) {
      return;
    }
    state.lastActivity = activity;
    if (!state.connected) {
      return;
    }
    write(opcodes.frame, {
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity,
      },
      nonce: createDiscordNonce(),
    });
  }

  function setIdle() {
    setActivity(createDiscordActivity("Browsing library", "Ready to play", state.sessionStart));
  }

  function setGame(gameTitle, options = {}) {
    const title = String(gameTitle || "Unknown game").trim() || "Unknown game";
    setActivity(createDiscordActivity(title, options.paused ? "Paused" : "Playing now", state.sessionStart));
  }

  function clear() {
    state.lastActivity = null;
    if (!state.connected) {
      return;
    }
    write(opcodes.frame, {
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity: null,
      },
      nonce: createDiscordNonce(),
    });
  }

  function scheduleReconnect() {
    if (!state.enabled || state.reconnectTimer) {
      return;
    }
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      connect();
    }, 5000);
  }

  function handleData(chunk) {
    state.buffer = Buffer.concat([state.buffer, chunk]);
    while (state.buffer.length >= 8) {
      const packetOpcode = state.buffer.readInt32LE(0);
      const length = state.buffer.readInt32LE(4);
      if (state.buffer.length < 8 + length) {
        return;
      }
      const raw = state.buffer.slice(8, 8 + length).toString("utf8");
      state.buffer = state.buffer.slice(8 + length);
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch (error) {
        payload = {};
      }
      if (packetOpcode === opcodes.frame && payload.evt === "READY") {
        state.connected = true;
        if (state.lastActivity !== null) {
          setActivity(state.lastActivity);
        }
      } else if (packetOpcode === opcodes.ping) {
        write(opcodes.pong, payload);
      }
    }
  }

  function connect(index = 0) {
    if (!state.enabled || state.socket) {
      return;
    }
    if (index > 9) {
      scheduleReconnect();
      return;
    }
    const socket = net.createConnection(getDiscordIpcPath(index));
    state.socket = socket;
    socket.once("connect", () => {
      write(opcodes.handshake, {
        v: 1,
        client_id: state.clientId,
      });
    });
    socket.on("data", handleData);
    socket.on("error", (error) => {
      if (!shouldIgnoreDiscordRpcError(error)) {
        console.warn("Discord RPC error:", error.message || error);
      }
      destroySocket();
      connect(index + 1);
    });
    socket.on("close", () => {
      const wasConnected = state.connected;
      destroySocket();
      if (wasConnected) {
        scheduleReconnect();
      }
    });
  }

  function start() {
    if (!state.enabled) {
      return;
    }
    connect();
  }

  function stop() {
    state.enabled = false;
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    clear();
    destroySocket();
  }

  function getStatus() {
    return {
      configured: Boolean(state.clientId),
      enabled: state.enabled,
      connected: state.connected,
    };
  }

  return {
    start,
    stop,
    setIdle,
    setGame,
    clear,
    getStatus,
  };
}

module.exports = {
  createDiscordRpc,
};
