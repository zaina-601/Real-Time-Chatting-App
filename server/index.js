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
      console.log(`User Joined: ${username}. Total users: ${users.length}`);
      socket.broadcast.emit('userJoined', newUser);
    }
    io.emit('userList', users);
  });

  socket.on('sendPrivateMessage', async (data) => {
    console.log("SERVER RECEIVED: 'sendPrivateMessage' with data:", data);

    const { text, sender, recipient } = data;
    if (!text || !sender || !recipient) {
      console.error("SERVER ERROR: Message data is incomplete.", data);
      return;
    }

    const recipientSocket = users.find(user => user.username === recipient);
    const newMessage = new Message({ text, sender, recipient });

    try {
      await newMessage.save();
      console.log("SERVER: Message saved to DB.");
      
      if (recipientSocket) {
        console.log(`SERVER: Found recipient ${recipient}. Sending message to socket ${recipientSocket.id}.`);
        io.to(recipientSocket.id).emit('receivePrivateMessage', newMessage);
      } else {
        console.log(`SERVER: Recipient ${recipient} is not online.`);
      }

      console.log(`SERVER: Sending message back to sender ${sender}.`);
      socket.emit('receivePrivateMessage', newMessage);

    } catch (error) {
      console.error('SERVER ERROR: Could not save/send message:', error);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`${disconnectedUser.username} disconnected.`);
      users = users.filter(user => user.id !== socket.id);
      io.emit('userList', users);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});