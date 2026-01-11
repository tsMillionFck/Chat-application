const io = require("socket.io-client");

const socket = io("http://localhost:3000");
const TEST_ROOM = `DebugRoom_${Date.now()}`;

console.log(
  `Connecting to server to verify typing events in room: ${TEST_ROOM}...`
);

let typingReceived = false;

socket.on("connect", () => {
  console.log("Connected with ID:", socket.id);
  socket.emit("joinRoom", { username: "TypingVerifier", room: TEST_ROOM });

  // Trigger after join is likely processed
  setTimeout(() => {
    console.log("Triggering bot...");
    socket.emit("chatMessage", {
      msg: "@Comedian hello",
      room: TEST_ROOM,
      username: "TypingVerifier",
    });
  }, 1000);
});

// Remove standalone setTimeout trigger
/* 
setTimeout(() => {
  console.log("Triggering bot...");
  socket.emit("chatMessage", ...);
}, 1000); 
*/

socket.on("userTyping", ({ username }) => {
  console.log(`>>> RECEIVED TYPING EVENT from: ${username}`);
  if (username.includes("Bot")) {
    console.log(">>> SUCCESS: Bot typing indicator received!");
    typingReceived = true;
  }
});

socket.on("message", (msg) => {
  // Ignore system messages and our own join/chat messages (if reflected)
  if (msg.username === "Mio-System") return;
  if (msg.username === "TypingVerifier") return;

  console.log(`Received reply from ${msg.username}: ${msg.text}`);

  if (typingReceived) {
    console.log("Test PASSED: Typing indicator was received before message.");
    socket.disconnect();
    process.exit(0);
  } else {
    console.log(
      "Test FAILED: Message received but NO typing indicator was seen."
    );
    socket.disconnect();
    process.exit(1);
  }
});

// Trigger after a delay to ensure join is processed
setTimeout(() => {
  console.log("Triggering bot...");
  socket.emit("chatMessage", {
    msg: "@Comedian hello",
    room: TEST_ROOM,
    username: "TypingVerifier",
  });
}, 1000);

// Timeout
setTimeout(() => {
  console.log("Timeout waiting for response.");
  socket.disconnect();
  process.exit(1);
}, 10000);
