const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const frontendURL = "https://real-time-chatting-app-alpha.vercel.app";
app.use(cors({ origin: frontendURL }));

app.get('/', (req, res) => {
  res.status(200).send('<h1>Real-Time Chat Server is running.</h1>');
});

const mongoURI = process.env.MONGODB_URI || "mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/chatApp?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch(err => {
    console.error("❌ MongoDB initial connection error:", err.message);
    process.exit(1);
});

mongoose.connection.on('error', err => console.error('❌ MongoDB runtime error:', err));
mongoose.connection.on('disconnected', () => console.log('❌ MongoDB disconnected'));

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  sender: { type: String, required: true, trim: true },
  recipient: { type: String, required: true, trim: true },
}, { timestamps: true });

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);

// --- YAHAN PAR AAKHRI AUR SABSE ZAROORI FIX HAI ---
const io = new Server(server, {
  cors: {
    origin: frontendURL,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'], // Pehle WebSocket try karega
  allowEIO3: true // Ye purane clients ke saath compatibility banata hai
});

let users = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    if (!username || typeof username !== 'string' || username.trim() === '') return;
    const cleanUsername = username.trim();
    users.set(socket.id, { id: socket.id, username: cleanUsername });
    io.emit('userList', Array.from(users.values()));
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    try {
      const messages = await Message.find({
        $or: [{ sender: user1, recipient: user2 }, { sender: user2, recipient: user1 }]
      }).sort({ createdAt: 1 }).limit(100).lean();
      socket.emit('privateMessages', messages);
    } catch (err) {
      socket.emit('error', { message: 'Failed to fetch messages' });
    }
  });

  socket.on('sendPrivateMessage', async ({ text, sender, recipient }) => {
    if (!text || !sender || !recipient) return;
    try {
      const newMessage = new Message({ text, sender, recipient });
      const savedMessage = await newMessage.save();
      const messagePayload = savedMessage.toObject();

      for (const [socketId, user] of users.entries()) {
        if (user.username === recipient) {
          io.to(socketId).emit('receivePrivateMessage', messagePayload);
          break;
        }
      }
      socket.emit('receivePrivateMessage', messagePayload);
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    if (users.has(socket.id)) {
      const user = users.get(socket.id);
      users.delete(socket.id);
      socket.broadcast.emit('userLeft', user);
      io.emit('userList', Array.from(users.values()));
      console.log(`❌ User disconnected: ${user.username}`);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));