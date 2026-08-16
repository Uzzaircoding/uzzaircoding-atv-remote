const $ = selector => document.querySelector(selector);

const setup = $("#setup");
const remote = $("#remote");
const ipInput = $("#ip");
const scanButton = $("#scan");
const connectButton = $("#connect");
const devices = $("#devices");
const setupStatus = $("#setupStatus");
const pairing = $("#pairing");
const codeInput = $("#code");
const pairButton = $("#pair");
const disconnectButton = $("#disconnect");
const connection = $("#connection");
const remoteStatus = $("#remoteStatus");

function setStatus(el, text) {
  el.textContent = text || "";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function refreshStatus() {
  try {
    const data = await api("/api/status");

    if (data.connected) {
      setup.classList.add("hidden");
      remote.classList.remove("hidden");
      connection.textContent = `Connected to ${data.tv}`;
      setStatus(remoteStatus, "");
      return;
    }

    if (data.pairing) {
      pairing.classList.remove("hidden");
      setStatus(setupStatus, "The TV is waiting for the pairing code.");
    }
  } catch {}
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  devices.innerHTML = "";
  setStatus(setupStatus, "Scanning your local network for Android TV Remote devices...");

  try {
    const data = await api("/api/discover", { method: "POST" });

    if (!data.devices.length) {
      setStatus(setupStatus, "No TV found automatically. Enter its IP address manually.");
      return;
    }

    setStatus(setupStatus, "TV-like remote ports found:");
    data.devices.forEach(ip => {
      const button = document.createElement("button");
      button.className = "device";
      button.textContent = `Use ${ip}`;
      button.addEventListener("click", () => {
        ipInput.value = ip;
        connect();
      });
      devices.appendChild(button);
    });
  } catch (error) {
    setStatus(setupStatus, error.message);
  } finally {
    scanButton.disabled = false;
  }
});

async function connect() {
  const ip = ipInput.value.trim();

  if (!ip) {
    setStatus(setupStatus, "Enter a TV IP address first.");
    return;
  }

  connectButton.disabled = true;
  setStatus(setupStatus, "Connecting to TV...");
  pairing.classList.add("hidden");

  try {
    const data = await api("/api/connect", {
      method: "POST",
      body: JSON.stringify({ ip })
    });

    if (data.pairing) {
      pairing.classList.remove("hidden");
      setStatus(setupStatus, "Check your TV for the 6-character pairing code.");
      codeInput.focus();
    } else {
      await refreshStatus();
    }
  } catch (error) {
    setStatus(setupStatus, error.message);
  } finally {
    connectButton.disabled = false;
  }
}

connectButton.addEventListener("click", connect);

pairButton.addEventListener("click", async () => {
  const code = codeInput.value.trim().toUpperCase();

  if (!/^[0-9A-F]{6}$/.test(code)) {
    setStatus(setupStatus, "Enter exactly 6 characters using 0-9 or A-F.");
    return;
  }

  pairButton.disabled = true;
  setStatus(setupStatus, "Pairing...");

  try {
    await api("/api/pair", {
      method: "POST",
      body: JSON.stringify({ code })
    });

    await new Promise(resolve => setTimeout(resolve, 800));
    await refreshStatus();

    if (!remote.classList.contains("hidden")) {
      setStatus(remoteStatus, "Paired successfully.");
    }
  } catch (error) {
    setStatus(setupStatus, error.message);
  } finally {
    pairButton.disabled = false;
  }
});

codeInput.addEventListener("keydown", event => {
  if (event.key === "Enter") pairButton.click();
});

document.querySelectorAll("[data-key]").forEach(button => {
  button.addEventListener("click", async () => {
    const key = button.dataset.key;
    try {
      const data = await api("/api/key", {
        method: "POST",
        body: JSON.stringify({ key })
      });
      if (!data.success) throw new Error("Command failed");
      setStatus(remoteStatus, "");
    } catch (error) {
      setStatus(remoteStatus, error.message);
    }
  });
});

disconnectButton.addEventListener("click", async () => {
  try {
    await api("/api/disconnect", { method: "POST" });
  } finally {
    remote.classList.add("hidden");
    setup.classList.remove("hidden");
    pairing.classList.add("hidden");
    setStatus(setupStatus, "Disconnected.");
  }
});

setInterval(refreshStatus, 1500);
refreshStatus();
