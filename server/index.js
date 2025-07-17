const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());

mongoose.connect('mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let users = [];

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    const newUser = { id: socket.id, username };
    let isNew = false;

    if (!users.some(u => u.username === username)) {
      users.push(newUser);
      isNew = true;
    }

    console.log(`${username} has joined the chat`);

    socket.emit('userList', users);

    if (isNew) {
      socket.broadcast.emit('userJoined', newUser);
    }
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    try {
      const messages = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ]
      }).sort({ timestamp: 1 });
      socket.emit('privateMessages', messages);
    } catch (error) {
      console.error("Error fetching private messages:", error);
    }
  });

  socket.on('sendPrivateMessage', async (data) => {
    const { text, sender, recipient } = data;
    const recipientSocket = users.find(user => user.username === recipient);
    const newMessage = new Message({ text, sender, recipient });

    try {
      await newMessage.save();
      if (recipientSocket) {
        io.to(recipientSocket.id).emit('receivePrivateMessage', newMessage);
      }
      socket.emit('receivePrivateMessage', newMessage);
    } catch (error) {
      console.error('Error saving or sending message:', error);
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
      console.log(`${disconnectedUser.username} disconnected`);
      users = users.filter(user => user.id !== socket.id);
      io.emit('userLeft', disconnectedUser.username);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});