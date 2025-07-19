// require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
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
  .then(() => console.log("MongoDB connected successfully."))
  .catch(err => console.error("MongoDB connection error:", err));

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
    methods: ["GET", "POST"],
  },
});

let users = [];

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    if (username && !users.some(u => u.username === username)) {
      const newUser = { id: socket.id, username };
      users.push(newUser);
      socket.broadcast.emit('userJoined', newUser);
    }
    io.emit('userList', users);
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    try {
      const messageDocs = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ]
      }).sort({ timestamp: 1 });

      const messages = messageDocs.map(doc => doc.toObject());
      socket.emit('privateMessages', messages);
    } catch (error) {
      console.error("Error fetching private messages:", error);
    }
  });

  socket.on('sendPrivateMessage', async (data) => {
    const { text, sender, recipient } = data;
    if (!text || !sender || !recipient) return;

    const newMessage = new Message({ text, sender, recipient });

    try {
      const savedMessage = await newMessage.save();
      const messagePayload = savedMessage.toObject();

      const recipientSocket = users.find(user => user.username === recipient);

      if (recipientSocket) {
        io.to(recipientSocket.id).emit('receivePrivateMessage', messagePayload);
      }

      socket.emit('receivePrivateMessage', messagePayload);
    } catch (error) {
      console.error('SERVER ERROR:', error);
    }
  });

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
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      users = users.filter(user => user.id !== socket.id);
      io.emit('userList', users);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
