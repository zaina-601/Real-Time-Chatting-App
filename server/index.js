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
      name: mongoose.connection.name || 'Not connected',
      host: mongoose.connection.host || 'Not connected',
      message: isConnected ? 'Database connected' : 'Database not connected'
    };
    res.json(dbInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use environment variable for MongoDB URI
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/chatApp?retryWrites=true&w=majority&appName=Cluster0";

// Enhanced MongoDB connection with better error handling
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  bufferCommands: false,
  bufferMaxEntries: 0
})
.then(() => {
  console.log("✅ MongoDB connected successfully");
  console.log("Database:", mongoose.connection.name);
  console.log("Host:", mongoose.connection.host);
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  console.error("Full error:", err);
  process.exit(1);
});

// Monitor MongoDB connection
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected');
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

// Add indexes for better query performance
messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });

const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [frontendURL, "http://localhost:3000"],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

let users = new Map(); // Use Map for better performance

// Helper function to validate message data
function validateMessageData({ text, sender, recipient }) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 'Message text is required';
  }
  if (!sender || typeof sender !== 'string' || sender.trim().length === 0) {
    return 'Sender is required';
  }
  if (!recipient || typeof recipient !== 'string' || recipient.trim().length === 0) {
    return 'Recipient is required';
  }
  if (text.trim().length > 1000) {
    return 'Message too long (max 1000 characters)';
  }
  if (sender.trim().length > 50 || recipient.trim().length > 50) {
    return 'Username too long (max 50 characters)';
  }
  return null;
}

// Helper function to check database connection
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    console.log(`👤 New user attempting to join: ${username}`);
    
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      socket.emit('error', { message: 'Invalid username' });
      return;
    }

    const cleanUsername = username.trim();
    
    // Remove any existing user with the same username
    for (let [socketId, userData] of users.entries()) {
      if (userData.username === cleanUsername && socketId !== socket.id) {
        users.delete(socketId);
      }
    }
    
    // Add the new user
    const newUser = { id: socket.id, username: cleanUsername };
    users.set(socket.id, newUser);
    
    console.log(`✅ User added: ${cleanUsername}, Total users: ${users.size}`);
    
    // Convert Map to Array for sending
    const userArray = Array.from(users.values());
    
    // Notify other users
    socket.broadcast.emit('userJoined', newUser);
    
    // Send updated user list to all clients
    io.emit('userList', userArray);
    
    // Send confirmation back to the joining user
    socket.emit('userJoinConfirmed', { username: cleanUsername, users: userArray });
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    console.log(`📨 Fetching messages between ${user1} and ${user2}`);
    
    // Validate inputs
    if (!user1 || !user2 || typeof user1 !== 'string' || typeof user2 !== 'string') {
      console.log('❌ Invalid user parameters');
      socket.emit('error', { message: 'Invalid user parameters' });
      return;
    }

    // Check if MongoDB is connected
    if (!isDatabaseConnected()) {
      console.log('❌ Database not connected');
      socket.emit('error', { message: 'Database connection error' });
      return;
    }
    
    try {
      const messageDocs = await Message.find({
        $or: [
          { sender: user1.trim(), recipient: user2.trim() },
          { sender: user2.trim(), recipient: user1.trim() }
        ]
      })
      .sort({ timestamp: 1 })
      .limit(100)
      .lean()
      .maxTimeMS(5000);

      console.log(`📤 Sending ${messageDocs.length} messages to ${socket.id}`);
      socket.emit('privateMessages', messageDocs);
      
    } catch (err) {
      console.error("⚠️ Error fetching messages:", err.message);
      console.error("Full error:", err);
      
      let errorMessage = 'Failed to fetch messages';
      if (err.name === 'MongoTimeoutError') {
        errorMessage = 'Database timeout error';
      } else if (err.name === 'MongoNetworkError') {
        errorMessage = 'Database network error';
      }
      
      socket.emit('error', { 
        message: errorMessage,
        details: err.message 
      });
    }
  });

  socket.on('sendPrivateMessage', async ({ text, sender, recipient }) => {
    console.log(`💬 Message from ${sender} to ${recipient}: ${text?.substring(0, 50)}...`);
    
    // Validate message data
    const validationError = validateMessageData({ text, sender, recipient });
    if (validationError) {
      console.log(`❌ Validation error: ${validationError}`);
      socket.emit('error', { message: validationError });
      return;
    }

    // Check if MongoDB is connected
    if (!isDatabaseConnected()) {
      console.log('❌ Database not connected');
      socket.emit('error', { message: 'Database connection error' });
      return;
    }

    const cleanData = {
      text: text.trim(),
      sender: sender.trim(),
      recipient: recipient.trim()
    };

    try {
      const newMessage = new Message(cleanData);
      const savedMessage = await newMessage.save();
      const messagePayload = savedMessage.toObject();
      
      console.log(`✅ Message saved with ID: ${savedMessage._id}`);

      // Find recipient socket
      let recipientSocketId = null;
      for (let [socketId, userData] of users.entries()) {
        if (userData.username === cleanData.recipient) {
          recipientSocketId = socketId;
          break;
        }
      }
      
      if (recipientSocketId) {
        console.log(`📤 Sending to recipient ${cleanData.recipient} (${recipientSocketId})`);
        io.to(recipientSocketId).emit('receivePrivateMessage', messagePayload);
      } else {
        console.log(`⚠️ Recipient ${cleanData.recipient} not found online`);
      }
      
      // Always send back to sender for confirmation
      console.log(`📤 Confirming message to sender ${cleanData.sender}`);
      socket.emit('receivePrivateMessage', messagePayload);
      socket.emit('messageSent', { success: true, messageId: savedMessage._id });
      
    } catch (err) {
      console.error("⚠️ Error saving message:", err.message);
      console.error("Full error:", err);
      
      let errorMessage = 'Failed to send message';
      if (err.name === 'ValidationError') {
        errorMessage = 'Invalid message data';
      } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        errorMessage = 'Database error';
      } else if (err.name === 'MongoTimeoutError') {
        errorMessage = 'Database timeout error';
      }
      
      socket.emit('error', { 
        message: errorMessage,
        details: err.message 
      });
    }
  });
  
  socket.on('typing', ({ sender, recipient }) => {
    if (!sender || !recipient) return;
    
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
    if (!sender || !recipient) return;
    
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
      const userArray = Array.from(users.values());
      io.emit('userList', userArray);
      socket.broadcast.emit('userLeft', disconnectedUser);
      console.log(`❌ User disconnected: ${disconnectedUser.username} (${reason})`);
    } else {
      console.log(`❌ Unknown user disconnected: ${socket.id} (${reason})`);
    }
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`🔴 Socket error for ${socket.id}:`, error);
  });

  // Send connection confirmation
  socket.emit('connectionConfirmed', { 
    socketId: socket.id, 
    timestamp: new Date().toISOString(),
    dbConnected: isDatabaseConnected()
  });
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 MongoDB status: ${isDatabaseConnected() ? 'Connected' : 'Disconnected'}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});