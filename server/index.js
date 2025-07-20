// require('dotenv').config(); // Disabled for testing

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

const frontendURL = "https://real-time-chatting-app-alpha.vercel.app";
app.use(cors({ origin: frontendURL }));

app.get('/', (req, res) => {
  res.status(200).send('<h1>Real-Time Chat Server is running.</h1>');
});

const mongoURI = "mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB connected."))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const messageSchema = new mongoose.Schema({
  text: String,
  sender: String,
  recipient: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: frontendURL,
    methods: ['GET', 'POST']
  }
});

let users = [];

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    if (username && !users.some(u => u.username === username)) {
      const newUser = { id: socket.id, username };
      users.push(newUser);
      socket.broadcast.emit('userJoined', newUser);
    }
    io.emit('userList', users);
  });

  // --- FINAL FIX #1: Purane messages ko plain object mein convert karein ---
  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    try {
      const messageDocs = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ]
      }).sort({ timestamp: 1 });

      const messages = messageDocs.map(doc => doc.toObject()); // Convert each doc
      socket.emit('privateMessages', messages);
    } catch (err) {
      console.error("⚠️ Error fetching messages:", err);
    }
  });

  // --- FINAL FIX #2: Naye message ko plain object mein convert karein ---
  socket.on('sendPrivateMessage', async ({ text, sender, recipient }) => {
    if (!text || !sender || !recipient) return;

    try {
      const newMessage = new Message({ text, sender, recipient });
      const savedMessage = await newMessage.save();
      const messagePayload = savedMessage.toObject(); // Convert to plain object

      const recipientSocket = users.find(user => user.username === recipient);
      if (recipientSocket) {
        io.to(recipientSocket.id).emit('receivePrivateMessage', messagePayload);
      }
      socket.emit('receivePrivateMessage', messagePayload);
    } catch (err) {
      console.error("⚠️ Error saving message:", err);
    }
  });
  
  // Baaki ke events (typing, disconnect) theek hain
  socket.on('typing', ({ sender, recipient }) => {
    const recipientSocket = users.find(user => user.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('userTyping', sender);
    }
  });

  socket.on('stopTyping', ({ sender, recipient }) => {
    const recipientSocket = users.find(user => user.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('userStoppedTyping', sender);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(u => u.id === socket.id);
    if (disconnectedUser) {
      users = users.filter(u => u.id !== socket.id);
      io.emit('userList', users);
      console.log(`❌ User disconnected: ${disconnectedUser.username}`);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});