const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { io } = require("socket.io-client");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent(socket, eventName, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connectClient(serverUrl) {
  return io(serverUrl, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
}

function join(socket, payload) {
  return new Promise((resolve) => {
    socket.emit("join", payload, (response) => resolve(response));
  });
}

function sendMessage(socket, message) {
  return new Promise((resolve) => {
    socket.emit("message", message, (response) => resolve(response));
  });
}

async function run() {
  const preferredPort = 3900;
  const dataFile = path.join(os.tmpdir(), `pingle-smoke-${Date.now()}.json`);
  const notificationFile = path.join(os.tmpdir(), `pingle-smoke-notifications-${Date.now()}.json`);
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(preferredPort), DATA_FILE: dataFile, NOTIFICATION_FILE: notificationFile },
  });

  let serverReady = false;
  let serverUrl = "";

  server.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.includes("Pingle is running")) {
      serverReady = true;
      const match = text.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        serverUrl = `http://localhost:${match[1]}`;
      }
    }
  });

  server.stderr.on("data", (chunk) => {
    process.stderr.write(chunk.toString());
  });

  const cleanup = () => {
    if (!server.killed) {
      server.kill();
    }
    try {
      fs.rmSync(dataFile, { force: true });
      fs.rmSync(notificationFile, { force: true });
    } catch {}
  };

  try {
    for (let i = 0; i < 50 && !serverReady; i += 1) {
      await wait(100);
    }

    if (!serverReady) {
      throw new Error("Server did not start in time.");
    }

    if (!serverUrl) {
      serverUrl = `http://localhost:${preferredPort}`;
    }

    const pushConfigResponse = await fetch(`${serverUrl}/api/notifications/config`);
    const pushConfig = await pushConfigResponse.json();
    if (!pushConfig?.ok || !pushConfig.publicKey) {
      throw new Error("Push notification config was not exposed.");
    }

    const alice = connectClient(serverUrl);
    const bob = connectClient(serverUrl);
    const eve = connectClient(serverUrl);

    await Promise.all([
      waitForEvent(alice, "connect"),
      waitForEvent(bob, "connect"),
      waitForEvent(eve, "connect"),
    ]);

    const aliceJoin = await join(alice, { name: "Alice" });
    if (!aliceJoin?.ok) {
      throw new Error(`Alice join failed: ${aliceJoin?.error || "unknown"}`);
    }

    const bobJoin = await join(bob, { name: "Bob" });
    if (!bobJoin?.ok) {
      throw new Error(`Bob join failed: ${bobJoin?.error || "unknown"}`);
    }

    const eveJoin = await join(eve, { name: "Eve" });
    if (eveJoin?.ok) {
      throw new Error("Third user should not be able to join a 2-user room.");
    }

    const messagePromise = waitForEvent(bob, "message", 6000);
    const sendAck = await sendMessage(alice, "😀");

    if (!sendAck?.ok) {
      throw new Error(`Message send ack failed: ${sendAck?.error || "unknown"}`);
    }

    const incoming = await messagePromise;
    if (incoming?.text !== "😀" || incoming?.from !== "Alice") {
      throw new Error("Received message content does not match expected payload.");
    }

    alice.disconnect();
    bob.disconnect();
    eve.disconnect();

    console.log("Smoke test passed.");
  } finally {
    cleanup();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
