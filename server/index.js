// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());

// --- MongoDB Connection ---
mongoose.connect('mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const messageSchema = new mongoose.Schema({
  text: String,
  username: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let users = [];

io.on('connection', async (socket) => {
  console.log(`A user connected: ${socket.id}`);

  // Send previous messages to the new user
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    socket.emit('previousMessages', messages);
  } catch (error) {
    console.error('Error fetching previous messages:', error);
  }

  socket.on('newUser', (username) => {
    users.push({ id: socket.id, username });
    io.emit('userList', users);
    socket.broadcast.emit('userJoined', `${username} has joined the chat`);
  });

  socket.on('sendMessage', async (data) => {
    const newMessage = new Message(data);
    try {
      await newMessage.save();
      io.emit('receiveMessage', newMessage);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`${disconnectedUser.username} disconnected`);
      users = users.filter(user => user.id !== socket.id);
      io.emit('userList', users);
      io.emit('userLeft', `${disconnectedUser.username} has left the chat`);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});