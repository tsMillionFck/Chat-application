const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
let model;
if (apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
} else {
  console.warn(
    "WARNING: GEMINI_API_KEY is not set in .env file. Gemini features will not work."
  );
}

// BOT PERSONAS
const BOT_PERSONAS = {
  PWTeacher: {
    name: "PW Teacher Bot",
    prompt:
      "You are a sarcastic Physics Wallah teacher. Link everything to JEE preparation. Give a witty, sarcastic reply in 5-10 words to: ",
  },
  Comedian: {
    name: "Comedian Bot",
    prompt:
      "You are a stand-up comedian. Make a funny joke about this message in 10-15 words: ",
  },
  Motivator: {
    name: "Motivator Bot",
    prompt:
      "You are an inspirational life coach. Give positive, motivational advice in 10-15 words about: ",
  },
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// ========================
// STATE MANAGEMENT
// ========================
let users = {};
let messageHistory = {}; // { roomName: [messages] }
let messageReactions = {}; // { messageId: { emoji: count, users: [usernames] } }

// Helper: Get users in a specific room
function getUsersInRoom(room) {
  return Object.values(users)
    .filter((user) => user.room === room)
    .map((user) => user.username);
}

// Helper: Add user
function addUser(socketId, username, room) {
  users[socketId] = { username, room };
}

// Helper: Remove user
function removeUser(socketId) {
  const user = users[socketId];
  delete users[socketId];
  return user;
}

// Helper: Format message with unique ID
function formatMessage(username, text, replyTo = null) {
  return {
    id: uuidv4(),
    username,
    text,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    reactions: {},
    replyTo, // { id, username, text } or null
  };
}

// ========================
// SOCKET.IO EVENTS
// ========================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. JOIN ROOM
  socket.on("joinRoom", ({ username, room }) => {
    addUser(socket.id, username, room);
    socket.join(room);

    if (!messageHistory[room]) {
      messageHistory[room] = [];
    }

    // Send message history to joining user
    messageHistory[room].forEach((msg) => {
      socket.emit("message", msg);
    });

    // Welcome message
    const welcomeMsg = formatMessage(
      "Mio-System",
      `Welcome to ${room}, ${username}.`
    );
    socket.emit("message", welcomeMsg);

    // Broadcast join
    const joinMsg = formatMessage(
      "Mio-System",
      `${username} has joined the chat.`
    );
    socket.to(room).emit("message", joinMsg);

    // Send user list
    io.to(room).emit("roomUsers", { room, users: getUsersInRoom(room) });
  });

  // 2. CHAT MESSAGE
  socket.on("chatMessage", ({ msg, room, username, replyTo }) => {
    console.log(
      `[DEBUG] chatMessage received: "${msg}" from ${username} in ${room}`
    );
    const message = formatMessage(username, msg, replyTo);

    if (!messageHistory[room]) {
      messageHistory[room] = [];
    }
    messageHistory[room].push(message);
    if (messageHistory[room].length > 50) {
      messageHistory[room].shift();
    }

    io.to(room).emit("message", message);

    // BOT MENTION TRIGGER
    // Check for @BotName pattern
    // Check for @BotName pattern
    const mentionMatch = msg.match(/@(PWTeacher|Comedian|Motivator)/i);

    if (mentionMatch && model) {
      const botKey = mentionMatch[1];
      // Find the matching persona (case-insensitive)
      const personaKey = Object.keys(BOT_PERSONAS).find(
        (key) => key.toLowerCase() === botKey.toLowerCase()
      );

      if (personaKey) {
        const persona = BOT_PERSONAS[personaKey];

        (async () => {
          try {
            // Signal Bot Typing
            socket.to(room).emit("userTyping", { username: persona.name });

            const userMessage = msg.replace(/@\w+/g, "").trim(); // Remove @mention from prompt
            const prompt = persona.prompt + userMessage;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Stop Bot Typing
            socket.to(room).emit("userStopTyping", { username: persona.name });

            // Create bot message
            const botMessage = formatMessage(persona.name, text);

            // Add to history
            if (!messageHistory[room]) {
              messageHistory[room] = [];
            }
            messageHistory[room].push(botMessage);
            if (messageHistory[room].length > 50) {
              messageHistory[room].shift();
            }

            // Emit to room
            io.to(room).emit("message", botMessage);
          } catch (error) {
            console.error("Gemini Bot Error:", error);
            // Ensure typing stops even on error
            socket.to(room).emit("userStopTyping", { username: persona.name });
          }
        })();
      }
    }
  });

  // 3. SEND REACTION
  socket.on("sendReaction", ({ messageId, emoji, room, username }) => {
    // Initialize reaction storage
    if (!messageReactions[messageId]) {
      messageReactions[messageId] = {};
    }
    if (!messageReactions[messageId][emoji]) {
      messageReactions[messageId][emoji] = { count: 0, users: [] };
    }

    const reaction = messageReactions[messageId][emoji];

    // Toggle reaction (add if not present, remove if already reacted)
    if (reaction.users.includes(username)) {
      reaction.users = reaction.users.filter((u) => u !== username);
      reaction.count--;
      if (reaction.count <= 0) {
        delete messageReactions[messageId][emoji];
      }
    } else {
      reaction.users.push(username);
      reaction.count++;
    }

    // Broadcast updated reactions to room
    io.to(room).emit("receiveReaction", {
      messageId,
      reactions: messageReactions[messageId],
    });
  });

  // 4. TYPING INDICATOR
  socket.on("typing", ({ room, username }) => {
    socket.to(room).emit("userTyping", { username });
  });

  // 5. STOP TYPING
  socket.on("stopTyping", ({ room, username }) => {
    socket.to(room).emit("userStopTyping", { username });
  });

  // 6. DISCONNECT
  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      console.log(`${user.username} disconnected from ${user.room}`);
      io.to(user.room).emit(
        "message",
        formatMessage("Mio-System", `${user.username} has left the chat.`)
      );
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });

  // 7. GEMINI API REQUEST (Deprecated for this feature, but kept for future use if needed)
  /* socket.on("gemini-request", async ({ prompt, room }) => { ... }); */
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Core-Mind Active on port ${PORT}`));
