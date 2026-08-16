const express = require("express");
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const {
  AndroidRemote,
  RemoteKeyCode,
  RemoteDirection
} = require("androidtv-remote");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CERT_FILE = path.join(__dirname, "tv-certificate.json");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

let remote = null;
let connected = false;
let pairing = false;
let pairingResolver = null;
let currentTV = null;
let lastError = null;

const keyMap = {
  up: RemoteKeyCode.KEYCODE_DPAD_UP,
  down: RemoteKeyCode.KEYCODE_DPAD_DOWN,
  left: RemoteKeyCode.KEYCODE_DPAD_LEFT,
  right: RemoteKeyCode.KEYCODE_DPAD_RIGHT,
  ok: RemoteKeyCode.KEYCODE_DPAD_CENTER,
  back: RemoteKeyCode.KEYCODE_BACK,
  home: RemoteKeyCode.KEYCODE_HOME,
  menu: RemoteKeyCode.KEYCODE_MENU,
  volup: RemoteKeyCode.KEYCODE_VOLUME_UP,
  voldown: RemoteKeyCode.KEYCODE_VOLUME_DOWN,
  mute: RemoteKeyCode.KEYCODE_VOLUME_MUTE,
  playpause: RemoteKeyCode.KEYCODE_MEDIA_PLAY_PAUSE,
  previous: RemoteKeyCode.KEYCODE_MEDIA_PREVIOUS,
  next: RemoteKeyCode.KEYCODE_MEDIA_NEXT,
  rewind: RemoteKeyCode.KEYCODE_MEDIA_REWIND,
  fastforward: RemoteKeyCode.KEYCODE_MEDIA_FAST_FORWARD,
  stop: RemoteKeyCode.KEYCODE_MEDIA_STOP,
  power: RemoteKeyCode.KEYCODE_POWER,
  settings: RemoteKeyCode.KEYCODE_SETTINGS,
  input: RemoteKeyCode.KEYCODE_TV_INPUT,
  info: RemoteKeyCode.KEYCODE_INFO,
  channelup: RemoteKeyCode.KEYCODE_CHANNEL_UP,
  channeldown: RemoteKeyCode.KEYCODE_CHANNEL_DOWN
};

function readCertificate() {
  try {
    return JSON.parse(fs.readFileSync(CERT_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCertificate(cert) {
  if (cert && cert.key && cert.cert) {
    fs.writeFileSync(CERT_FILE, JSON.stringify(cert, null, 2), { mode: 0o600 });
  }
}

function closeRemote() {
  if (!remote) return;
  try {
    if (typeof remote.stop === "function") remote.stop();
  } catch {}
  remote = null;
  connected = false;
}

function getLocalIPv4Networks() {
  const interfaces = os.networkInterfaces();
  const networks = [];

  for (const entries of Object.values(interfaces)) {
    for (const info of entries || []) {
      if (info.family === "IPv4" && !info.internal && info.address && info.netmask) {
        const ip = info.address.split(".").map(Number);
        const mask = info.netmask.split(".").map(Number);
        const network = ip.map((n, i) => n & mask[i]);
        const maskBits = mask.reduce((sum, n) => sum + n.toString(2).split("1").length - 1, 0);
        if (maskBits >= 24) {
          networks.push({
            base: network.join("."),
            prefix: maskBits
          });
        }
      }
    }
  }
  return networks;
}

function probePort(host, port, timeout = 250) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let done = false;

    const finish = result => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function scanNetwork() {
  const networks = getLocalIPv4Networks();
  const hosts = [];

  for (const network of networks) {
    const parts = network.base.split(".").map(Number);
    const count = network.prefix === 24 ? 254 : Math.min(254, 2 ** (32 - network.prefix) - 2);
    for (let i = 1; i <= count; i++) {
      hosts.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
    }
  }

  const found = [];
  const concurrency = 40;
  let index = 0;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= hosts.length) return;
      const host = hosts[i];
      if (await probePort(host, 6466)) {
        found.push(host);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return [...new Set(found)].sort();
}

function connectTV(ip, certOverride = null) {
  closeRemote();
  currentTV = ip;
  lastError = null;

  const cert = certOverride || readCertificate();
  pairing = !cert.key || !cert.cert;

  remote = new AndroidRemote(ip, {
    pairing_port: 6467,
    remote_port: 6466,
    name: "Android TV Web Remote",
    cert
  });

  remote.on("secret", () => {
    pairing = true;
    if (pairingResolver) pairingResolver();
  });

  remote.on("ready", () => {
    connected = true;
    pairing = false;
    lastError = null;
    try {
      saveCertificate(remote.getCertificate());
    } catch {}
  });

  remote.on("error", error => {
    lastError = error?.message || String(error);
    if (!connected) pairing = false;
  });

  remote.on("close", () => {
    connected = false;
  });

  return remote.start().catch(error => {
    lastError = error?.message || String(error);
    connected = false;
    throw error;
  });
}

app.get("/api/status", (req, res) => {
  res.json({
    connected,
    pairing,
    tv: currentTV,
    hasCertificate: (() => {
      const cert = readCertificate();
      return Boolean(cert.key && cert.cert);
    })(),
    error: lastError
  });
});

app.post("/api/discover", async (req, res) => {
  try {
    const devices = await scanNetwork();
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/connect", async (req, res) => {
  const ip = String(req.body.ip || "").trim();

  if (!net.isIP(ip)) {
    return res.status(400).json({ error: "Enter a valid IPv4 address." });
  }

  try {
    await connectTV(ip);
    res.json({
      success: true,
      pairing: !connected
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "Could not connect to the TV."
    });
  }
});

app.post("/api/pair", async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();

  if (!/^[0-9A-F]{6}$/.test(code)) {
    return res.status(400).json({
      error: "The pairing code must be exactly 6 hexadecimal characters."
    });
  }

  if (!remote || !pairing) {
    return res.status(400).json({
      error: "There is no active pairing session."
    });
  }

  try {
    remote.sendCode(code);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/key", (req, res) => {
  const key = String(req.body.key || "");

  if (!remote || !connected) {
    return res.status(503).json({
      success: false,
      error: "TV is not connected."
    });
  }

  const keyCode = keyMap[key];

  if (keyCode === undefined) {
    return res.status(400).json({
      success: false,
      error: `Unknown button: ${key}`
    });
  }

  try {
    remote.sendKey(keyCode, RemoteDirection.SHORT);
    res.json({ success: true, key });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/api/disconnect", (req, res) => {
  closeRemote();
  currentTV = null;
  res.json({ success: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Android TV Web Remote running on http://localhost:${PORT}`);
});
