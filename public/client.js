const socket = io("https://chat-application-btb2.onrender.com");

// ========================
// DOM ELEMENTS
// ========================
const joinScreen = document.getElementById("join-screen");
const joinForm = document.getElementById("join-form");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const roomNameDisplay = document.getElementById("room-name");
const msgInput = document.getElementById("msg");
const userList = document.getElementById("user-list");
const typingIndicator = document.getElementById("typing-indicator");
const replyPreview = document.getElementById("reply-preview");
const replyToUsername = document.getElementById("reply-to-username");
const replyToText = document.getElementById("reply-to-text");
const cancelReplyBtn = document.getElementById("cancel-reply");
const menuBtn = document.getElementById("menu-btn");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("overlay");

// Mobile Sidebar Toggle
if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
  });
}

if (overlay) {
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  });
}

// ========================
// STATE
// ========================
let currentUser = "";
let currentRoom = "";
let typingTimeout = null;
let isTyping = false;

// Reply state
let replyingTo = null; // { id, username, text }

// ========================
// SOUND EFFECTS
// ========================
const notificationSound = new Audio(
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJeunJ2Ej4NvaXCHqLOtl4eBdXF2hZ2vr5yMfHJzfImdp6OWinx0c3uGkpyblI2Df3t8g4uTl5SSjYeCf3+EiY2QkY+MiIWDgoOGiYuMi4qIhoWEg4SGh4iIh4aFhIODg4OEhYWFhYWEg4OCgoKCgoKCgoKBgYGBgQA="
);
notificationSound.volume = 0.3;

// ========================
// 1. JOIN ROOM
// ========================
joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value;
  if (!currentUser) return;

  socket.emit("joinRoom", { username: currentUser, room: currentRoom });
  joinScreen.style.display = "none";
  roomNameDisplay.innerText = currentRoom;
  msgInput.focus();
});

// ========================
// 2. RECEIVE MESSAGE
// ========================
socket.on("message", (message) => {
  outputMessage(message);

  if (message.username !== currentUser && message.username !== "Mio-System") {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {});
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ========================
// 3. SEND MESSAGE (with Reply support)
// ========================
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = msgInput.value.trim();
  if (!msg) return;

  // Send message with reply data if in reply mode
  socket.emit("chatMessage", {
    msg,
    room: currentRoom,
    username: currentUser,
    replyTo: replyingTo,
  });

  socket.emit("stopTyping", { room: currentRoom, username: currentUser });
  isTyping = false;

  // Clear reply mode
  cancelReply();

  msgInput.value = "";
  msgInput.focus();
});

// ========================
// 4. REPLY FUNCTIONS
// ========================
function startReply(messageId, username, text) {
  replyingTo = {
    id: messageId,
    username: username,
    text: text.length > 50 ? text.substring(0, 50) + "..." : text,
  };

  // Show preview bar
  replyPreview.style.display = "flex";
  replyToUsername.textContent = username;
  replyToText.textContent = `"${replyingTo.text}"`;

  // Focus input
  msgInput.focus();
  msgInput.placeholder = `Reply to ${username}...`;
}

function cancelReply() {
  replyingTo = null;
  replyPreview.style.display = "none";
  replyToUsername.textContent = "";
  replyToText.textContent = "";
  msgInput.placeholder = "iMessage";
}

// Cancel reply button listener
cancelReplyBtn.addEventListener("click", cancelReply);

// ========================
// 5. TYPING INDICATOR
// ========================
msgInput.addEventListener("input", () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", { room: currentRoom, username: currentUser });
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit("stopTyping", { room: currentRoom, username: currentUser });
  }, 3000);
});

let typingUsers = new Set();

socket.on("userTyping", ({ username }) => {
  typingUsers.add(username);
  updateTypingIndicator();
});

socket.on("userStopTyping", ({ username }) => {
  typingUsers.delete(username);
  updateTypingIndicator();
});

function updateTypingIndicator() {
  if (typingUsers.size === 0) {
    typingIndicator.style.display = "none";
  } else if (typingUsers.size === 1) {
    typingIndicator.style.display = "block";
    typingIndicator.innerText = `${[...typingUsers][0]} is typing...`;
  } else {
    typingIndicator.style.display = "block";
    typingIndicator.innerText = `${typingUsers.size} people are typing...`;
  }
}

// ========================
// 6. LIVE USER ROSTER
// ========================
socket.on("roomUsers", ({ room, users }) => {
  updateUserList(users);
});

function updateUserList(users) {
  if (!userList) return;
  userList.innerHTML = users
    .map(
      (user) => `
      <div class="user-item">
        <div class="user-avatar">${user.charAt(0).toUpperCase()}</div>
        <span class="user-name">${user}${
        user === currentUser ? " (You)" : ""
      }</span>
        <span class="online-dot"></span>
      </div>
    `
    )
    .join("");
}

// ========================
// 7. REACTIONS
// ========================
socket.on("receiveReaction", ({ messageId, reactions }) => {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;

  let reactionsContainer = messageEl.querySelector(".reactions-container");
  if (!reactionsContainer) {
    reactionsContainer = document.createElement("div");
    reactionsContainer.className = "reactions-container";
    messageEl.appendChild(reactionsContainer);
  }

  reactionsContainer.innerHTML = Object.entries(reactions)
    .filter(([emoji, data]) => data.count > 0)
    .map(
      ([emoji, data]) =>
        `<span class="reaction-badge" title="${data.users.join(
          ", "
        )}">${emoji} ${data.count}</span>`
    )
    .join("");
});

function sendReaction(messageId, emoji) {
  socket.emit("sendReaction", {
    messageId,
    emoji,
    room: currentRoom,
    username: currentUser,
  });
}

function copyMessage(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Message copied!");
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ========================
// OUTPUT MESSAGE (with Reply Block)
// ========================
function outputMessage(message) {
  const div = document.createElement("div");
  const isMe = message.username === currentUser;
  const isSystem = message.username === "Mio-System";

  div.classList.add("message", "pop-in");
  div.setAttribute("data-message-id", message.id);
  div.setAttribute("data-username", message.username);
  div.setAttribute("data-text", message.text);

  if (isSystem) {
    div.classList.add("system-message");
  } else if (isMe) {
    div.classList.add("outgoing");
  } else {
    div.classList.add("incoming");
  }

  // Format text
  let formattedText = message.text
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>");

  // Build reply quote block if this is a reply
  let replyBlock = "";
  if (message.replyTo) {
    const truncatedText =
      message.replyTo.text.length > 60
        ? message.replyTo.text.substring(0, 60) + "..."
        : message.replyTo.text;
    replyBlock = `
      <div class="reply-quote" onclick="scrollToMessage('${message.replyTo.id}')">
        <span class="reply-quote-user">${message.replyTo.username}</span>
        <span class="reply-quote-text">${truncatedText}</span>
      </div>
    `;
  }

  // Action menu for non-system messages (added Reply button)
  const actionMenu = !isSystem
    ? `
    <div class="action-menu">
      <button class="action-btn" onclick="startReply('${message.id}', '${
        message.username
      }', '${message.text.replace(/'/g, "\\'")}')" title="Reply">↩️</button>
      <button class="action-btn" onclick="sendReaction('${
        message.id
      }', '❤️')" title="Love">❤️</button>
      <button class="action-btn" onclick="sendReaction('${
        message.id
      }', '😂')" title="Laugh">😂</button>
      <button class="action-btn" onclick="sendReaction('${
        message.id
      }', '👍')" title="Like">👍</button>
      <button class="action-btn" onclick="copyMessage('${message.text.replace(
        /'/g,
        "\\'"
      )}')" title="Copy">📋</button>
    </div>
  `
    : "";

  div.innerHTML = `
    ${replyBlock}
    ${
      !isMe && !isSystem
        ? `<div class="meta">${message.username} • ${message.time}</div>`
        : ""
    }
    <p>${formattedText}</p>
    <div class="reactions-container"></div>
    ${actionMenu}
  `;

  chatMessages.appendChild(div);
}

// Scroll to quoted message
function scrollToMessage(messageId) {
  const targetMessage = document.querySelector(
    `[data-message-id="${messageId}"]`
  );
  if (targetMessage) {
    targetMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    targetMessage.classList.add("highlight");
    setTimeout(() => targetMessage.classList.remove("highlight"), 2000);
  }
}
