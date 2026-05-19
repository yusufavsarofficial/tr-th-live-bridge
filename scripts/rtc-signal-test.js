const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { io } = require("socket.io-client");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function once(socket, eventName, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function ack(socket, eventName, payload) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, (response) => resolve(response));
  });
}

function connect(serverUrl) {
  return io(serverUrl, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
}

async function testCallMode({ alice, bob, mode }) {
  const offerSeen = once(bob, "call:offer");
  const offerAck = await ack(alice, "call:offer", {
    mode,
    sdp: { type: "offer", sdp: `fake-${mode}-offer` },
  });
  if (!offerAck?.ok) {
    throw new Error(`${mode} offer ack failed: ${offerAck?.error || "unknown"}`);
  }

  const offer = await offerSeen;
  if (offer.mode !== mode || offer.from?.name !== "Alice") {
    throw new Error(`${mode} offer payload mismatch.`);
  }

  const answerSeen = once(alice, "call:answer");
  const answerAck = await ack(bob, "call:answer", {
    sdp: { type: "answer", sdp: `fake-${mode}-answer` },
  });
  if (!answerAck?.ok) {
    throw new Error(`${mode} answer ack failed: ${answerAck?.error || "unknown"}`);
  }

  const answer = await answerSeen;
  if (answer.from?.name !== "Bob") {
    throw new Error(`${mode} answer payload mismatch.`);
  }

  const iceSeen = once(alice, "call:ice-candidate");
  bob.emit("call:ice-candidate", {
    candidate: {
      candidate: `candidate:1 1 udp 1 127.0.0.1 9 typ host mode-${mode}`,
      sdpMid: "0",
      sdpMLineIndex: 0,
    },
  });
  const ice = await iceSeen;
  if (!String(ice.candidate?.candidate || "").includes(`mode-${mode}`)) {
    throw new Error(`${mode} ICE candidate payload mismatch.`);
  }

  const endedSeen = once(bob, "call:end");
  alice.emit("call:end", { reason: "ended" });
  const ended = await endedSeen;
  if (ended.reason !== "ended") {
    throw new Error(`${mode} call end payload mismatch.`);
  }
}

async function testQueuedOfflineCall({ alice, serverUrl }) {
  const queuedAck = await ack(alice, "call:offer", {
    mode: "voice",
    sdp: { type: "offer", sdp: "fake-offline-offer" },
  });
  if (!queuedAck?.ok || !queuedAck.queued) {
    throw new Error(`Offline call should be queued: ${queuedAck?.error || "not queued"}`);
  }

  const bobLate = connect(serverUrl);
  await once(bobLate, "connect");
  const queuedOfferSeen = once(bobLate, "call:offer");
  const bobJoin = await ack(bobLate, "join", { name: "Bob" });
  if (!bobJoin?.ok) {
    throw new Error(`Late Bob join failed: ${bobJoin?.error || "unknown"}`);
  }

  const queuedOffer = await queuedOfferSeen;
  if (queuedOffer.mode !== "voice" || queuedOffer.from?.name !== "Alice") {
    throw new Error("Queued offline call payload mismatch.");
  }

  const answerSeen = once(alice, "call:answer");
  const answerAck = await ack(bobLate, "call:answer", {
    sdp: { type: "answer", sdp: "fake-offline-answer" },
  });
  if (!answerAck?.ok) {
    throw new Error(`Queued call answer failed: ${answerAck?.error || "unknown"}`);
  }
  const answer = await answerSeen;
  if (answer.from?.name !== "Bob") {
    throw new Error("Queued call answer payload mismatch.");
  }

  bobLate.disconnect();
}

async function run() {
  const preferredPort = 3910;
  const dataFile = path.join(os.tmpdir(), `pingle-rtc-${Date.now()}.json`);
  const notificationFile = path.join(os.tmpdir(), `pingle-rtc-notifications-${Date.now()}.json`);
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(preferredPort),
      DATA_FILE: dataFile,
      NOTIFICATION_FILE: notificationFile,
      OPENAI_API_KEY: "",
      TRANSLATE_TIMEOUT_MS: "250",
      TRANSLATION_PROVIDER: "legacy",
    },
  });

  let serverReady = false;
  let serverUrl = "";

  server.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.includes("Pingle is running")) {
      serverReady = true;
      const match = text.match(/http:\/\/localhost:(\d+)/);
      serverUrl = match ? `http://localhost:${match[1]}` : `http://localhost:${preferredPort}`;
    }
  });

  server.stderr.on("data", (chunk) => process.stderr.write(chunk.toString()));

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
    for (let i = 0; i < 60 && !serverReady; i += 1) {
      await wait(100);
    }
    if (!serverReady) {
      throw new Error("Server did not start in time.");
    }

    const alice = connect(serverUrl);
    const bob = connect(serverUrl);
    await Promise.all([once(alice, "connect"), once(bob, "connect")]);

    const aliceJoin = await ack(alice, "join", { name: "Alice" });
    const bobJoin = await ack(bob, "join", { name: "Bob" });
    if (!aliceJoin?.ok || !bobJoin?.ok) {
      throw new Error(`Join failed: ${aliceJoin?.error || bobJoin?.error || "unknown"}`);
    }

    const messageSeen = once(bob, "message", 15000);
    const messageAck = await ack(alice, "message", "สวัสดีครับ 😀");
    if (!messageAck?.ok) {
      throw new Error(`Message ack failed: ${messageAck?.error || "unknown"}`);
    }
    const message = await messageSeen;
    if (message.from !== "Alice" || message.text !== "สวัสดีครับ 😀" || message.sourceLang !== "th") {
      throw new Error("Thai + emoji message payload mismatch.");
    }

    await testCallMode({ alice, bob, mode: "video" });
    await testCallMode({ alice, bob, mode: "voice" });

    bob.disconnect();
    await wait(200);
    await testQueuedOfflineCall({ alice, serverUrl });

    alice.disconnect();
    console.log("RTC signaling test passed: message, video call, voice call, queued offline call, answer, ICE, end.");
  } finally {
    cleanup();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
