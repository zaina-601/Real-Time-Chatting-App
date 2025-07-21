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


app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("FATAL ERROR: MONGODB_URI environment variable is not set.");
} else {
  mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    bufferCommands: false,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch(err => {
    console.error("Initial MongoDB connection error.", err.message);
  });
}

mongoose.connection.on('error', (err) => console.error('MongoDB runtime error:', err));
mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected.'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true, maxLength: 1000, trim: true },
  sender: { type: String, required: true, maxLength: 50, trim: true },
  recipient: { type: String, required: true, maxLength: 50, trim: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [frontendURL, "http://localhost:3000"],
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

let users = new Map();

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.emit('connectionConfirmed', { 
    socketId: socket.id,
    dbConnected: isDatabaseConnected() 
  });

  socket.on('newUser', (username) => {
    if (!username) return;
    const cleanUsername = username.trim();
    const newUser = { id: socket.id, username: cleanUsername };
    users.set(socket.id, newUser);
    io.emit('userList', Array.from(users.values()));
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    if (!isDatabaseConnected()) {
      return socket.emit('error', { message: 'Server database connection issue' });
    }
    try {
      const messages = await Message.find({
        $or: [{ sender: user1, recipient: user2 }, { sender: user2, recipient: user1 }]
      }).sort({ timestamp: 1 }).limit(100);
      socket.emit('privateMessages', messages);
    } catch(err) {
      socket.emit('error', { message: 'Failed to fetch messages.' });
    }
  });

  socket.on('sendPrivateMessage', async (data) => {
    if (!isDatabaseConnected()) {
      return socket.emit('error', { message: 'Server database connection issue' });
    }
    try {
      const newMessage = new Message(data);
      const savedMessage = await newMessage.save();
      let recipientSocketId = null;
      for (let [socketId, userData] of users.entries()) {
        if (userData.username === data.recipient) {
          recipientSocketId = socketId;
          break;
        }
      }
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receivePrivateMessage', savedMessage);
      }
      socket.emit('receivePrivateMessage', savedMessage);
      socket.emit('messageSent', { success: true, messageId: savedMessage._id });
    } catch(err) {
      socket.emit('error', { message: 'Failed to send message.' });
    }
  });

  // --- WebRTC Signaling Events ---
  socket.on('call-user', ({ to, from, offer, callType }) => {
    console.log(`📞 ${callType} call attempt from ${from.username} to user ${to}`);
    let recipientSocketId = null;
    for (let [socketId, userData] of users.entries()) {
      if (userData.username === to) {
        recipientSocketId = socketId;
        break;
      }
    }

    if (recipientSocketId) {
      console.log(`Found recipient ${to} at socket ${recipientSocketId}. Sending 'incoming-call'...`);
      io.to(recipientSocketId).emit('incoming-call', { from, offer, callType });
    } else {
      socket.emit('call-error', { message: 'User is not online.' });
    }
  });

  socket.on('call-accepted', ({ to, answer }) => {
    console.log(`Call accepted by ${socket.id}. Sending answer back to ${to.id}`);
    io.to(to.id).emit('call-finalized', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('end-call', ({ to }) => {
    console.log(`Call ended by ${socket.id} for user ${to}`);
    let recipientSocketId = null;
    for (let [socketId, userData] of users.entries()) {
        if (userData.username === to) {
            recipientSocketId = socketId;
            break;
        }
    }
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('call-ended');
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users.delete(socket.id);
    io.emit('userList', Array.from(users.values()));
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});