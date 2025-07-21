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
  credentials: true
}));

app.get('/', (req, res) => {
  res.status(200).send('<h1>Real-Time Chat Server is running.</h1>');
});

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("FATAL ERROR: MONGODB_URI environment variable is not set.");
} else {
  mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("Initial MongoDB connection error.", err.message));
}

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true, maxLength: 1000, trim: true },
  sender: { type: String, required: true, maxLength: 50, trim: true },
  recipient: { type: String, required: true, maxLength: 50, trim: true },
  timestamp: { type: Date, default: Date.now },
  eventType: { type: String, enum: ['call_started', 'call_ended'], required: false },
  duration: { type: String, required: false },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [frontendURL, "http://localhost:3000"],
    methods: ['GET', 'POST']
  }
});

let users = new Map();

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    if (!username) return;
    const newUser = { id: socket.id, username: username.trim() };
    users.set(socket.id, newUser);
    io.emit('userList', Array.from(users.values()));
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    if (!isDatabaseConnected()) return;
    const messages = await Message.find({
      $or: [{ sender: user1, recipient: user2 }, { sender: user2, recipient: user1 }]
    }).sort({ timestamp: 1 }).limit(100);
    socket.emit('privateMessages', messages);
  });

  socket.on('sendPrivateMessage', async (data) => {
    if (!isDatabaseConnected()) return;
    const newMessage = new Message(data);
    const savedMessage = await newMessage.save();
    const recipientSocket = Array.from(users.values()).find(u => u.username === data.recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('receivePrivateMessage', savedMessage);
    }
    socket.emit('receivePrivateMessage', savedMessage);
  });

  socket.on('typing', ({ sender, recipient }) => {
    const recipientSocket = Array.from(users.values()).find(u => u.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('userTyping', sender);
    }
  });

  socket.on('stopTyping', ({ sender, recipient }) => {
    const recipientSocket = Array.from(users.values()).find(u => u.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('userStoppedTyping', sender);
    }
  });
  
  socket.on('log-call-event', async (data) => {
    if (!isDatabaseConnected()) return;
    const { sender, recipient, eventType, duration, text } = data;
    if (!sender || !recipient || !eventType || !text) return;

    try {
      const callEventMessage = new Message({
        sender, recipient, eventType, text,
        duration: duration || null,
      });
      const savedMessage = await callEventMessage.save();
      const recipientSocket = Array.from(users.values()).find(u => u.username === recipient);
      if (recipientSocket) {
        io.to(recipientSocket.id).emit('receivePrivateMessage', savedMessage);
      }
      socket.emit('receivePrivateMessage', savedMessage);
    } catch (error) {
      console.error("Error logging call event:", error);
    }
  });

  socket.on('call-user', ({ to, from, offer, callType }) => {
    const recipientSocket = Array.from(users.values()).find(u => u.username === to);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('incoming-call', { from, offer, callType });
    }
  });

  socket.on('call-accepted', ({ to, answer }) => {
    io.to(to.id).emit('call-finalized', { answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const recipientSocket = Array.from(users.values()).find(u => u.id === to);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('ice-candidate', { candidate });
    }
  });

  socket.on('end-call', ({ to }) => {
    const recipientSocket = Array.from(users.values()).find(u => u.username === to);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('call-ended');
    }
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('userList', Array.from(users.values()));
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));