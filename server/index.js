const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const frontendURL = "https://real-time-chatting-app-alpha.vercel.app";
app.use(cors({ 
  origin: [frontendURL, "http://localhost:3000"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (req, res) => {
  res.status(200).send('<h1>Real-Time Chat Server is running.</h1>');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
      status: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

// Test MongoDB connection endpoint
app.get('/test-db', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const dbInfo = {
      connected: isConnected,
      status: mongoose.connection.readyState,
      name: isConnected ? mongoose.connection.name : 'Not connected',
      host: isConnected ? mongoose.connection.host : 'Not connected',
      message: isConnected ? 'Database connected' : 'Database not connected'
    };
    res.json(dbInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use environment variable for MongoDB URI
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!process.env.MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI environment variable not set. Using hardcoded fallback URI.");
}

// Enhanced MongoDB connection with better error handling
mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  bufferCommands: false, // Important for handling connection issues
})
.then(() => {
  console.log("✅ MongoDB connected successfully");
})
.catch(err => {
  // ❌ CRITICAL FIX: Do not exit the process. Log the error instead.
  // The server will stay online, and mongoose will try to reconnect.
  console.error("❌ Initial MongoDB connection error:", err.message);
});

// Monitor MongoDB connection
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected. Trying to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true, maxLength: 1000, trim: true },
  sender: { type: String, required: true, maxLength: 50, trim: true },
  recipient: { type: String, required: true, maxLength: 50, trim: true },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read: { type: Boolean, default: false }
}, {
  timestamps: true
});

messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });

const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [frontendURL, "http://localhost:3000"],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket']
  // ❌ CRITICAL FIX: Removed allowEIO3: true. Ensure client is on Socket.IO v4.
});

let users = new Map();

function validateMessageData({ text, sender, recipient }) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return 'Message text is required';
  if (!sender || typeof sender !== 'string' || sender.trim().length === 0) return 'Sender is required';
  if (!recipient || typeof recipient !== 'string' || recipient.trim().length === 0) return 'Recipient is required';
  if (text.trim().length > 1000) return 'Message too long (max 1000 characters)';
  if (sender.trim().length > 50 || recipient.trim().length > 50) return 'Username too long (max 50 characters)';
  return null;
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Inform client immediately about database status
  socket.emit('connectionConfirmed', { 
    socketId: socket.id, 
    timestamp: new Date().toISOString(),
    dbConnected: isDatabaseConnected()
  });

  socket.on('newUser', (username) => {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      socket.emit('error', { message: 'Invalid username' });
      return;
    }
    const cleanUsername = username.trim();
    for (let [socketId, userData] of users.entries()) {
      if (userData.username === cleanUsername && socketId !== socket.id) {
        users.delete(socketId);
      }
    }
    const newUser = { id: socket.id, username: cleanUsername };
    users.set(socket.id, newUser);
    console.log(`✅ User added: ${cleanUsername}, Total users: ${users.size}`);
    const userArray = Array.from(users.values());
    socket.broadcast.emit('userJoined', newUser);
    io.emit('userList', userArray);
    socket.emit('userJoinConfirmed', { username: cleanUsername, users: userArray });
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    if (!isDatabaseConnected()) {
      socket.emit('error', { message: 'Server database connection issue' });
      return;
    }
    try {
      const messageDocs = await Message.find({
        $or: [{ sender: user1, recipient: user2 }, { sender: user2, recipient: user1 }]
      }).sort({ timestamp: 1 }).limit(100).lean();
      socket.emit('privateMessages', messageDocs);
    } catch (err) {
      console.error("⚠️ Error fetching messages:", err);
      socket.emit('error', { message: 'Failed to fetch messages' });
    }
  });

  socket.on('sendPrivateMessage', async (data) => {
    const validationError = validateMessageData(data);
    if (validationError) {
      socket.emit('error', { message: validationError });
      return;
    }
    if (!isDatabaseConnected()) {
      socket.emit('error', { message: 'Server database connection issue' });
      return;
    }
    try {
      const newMessage = new Message(data);
      const savedMessage = await newMessage.save();
      const messagePayload = savedMessage.toObject();
      let recipientSocketId = null;
      for (let [socketId, userData] of users.entries()) {
        if (userData.username === data.recipient) {
          recipientSocketId = socketId;
          break;
        }
      }
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receivePrivateMessage', messagePayload);
      }
      socket.emit('receivePrivateMessage', messagePayload);
      socket.emit('messageSent', { success: true, messageId: savedMessage._id });
    } catch (err) {
      console.error("⚠️ Error saving message:", err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', ({ sender, recipient }) => {
    let recipientSocketId = null;
    for (let [socketId, userData] of users.entries()) {
      if (userData.username === recipient) {
        recipientSocketId = socketId;
        break;
      }
    }
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('userTyping', sender);
    }
  });

  socket.on('stopTyping', ({ sender, recipient }) => {
    let recipientSocketId = null;
    for (let [socketId, userData] of users.entries()) {
      if (userData.username === recipient) {
        recipientSocketId = socketId;
        break;
      }
    }
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('userStoppedTyping', sender);
    }
  });

  socket.on('disconnect', (reason) => {
    const disconnectedUser = users.get(socket.id);
    if (disconnectedUser) {
      users.delete(socket.id);
      io.emit('userList', Array.from(users.values()));
      socket.broadcast.emit('userLeft', disconnectedUser);
      console.log(`❌ User disconnected: ${disconnectedUser.username} (${reason})`);
    }
  });

  socket.on('error', (error) => {
    console.error(`🔴 Socket error for ${socket.id}:`, error);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1); // Still exit on unknown exceptions, but not DB connection
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Initial MongoDB status: ${isDatabaseConnected() ? 'Connected' : 'Disconnected'}`);
});