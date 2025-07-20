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
    console.log(`👤 New user joining: ${username}`);
    
    if (username && !users.some(u => u.username === username)) {
      const newUser = { id: socket.id, username };
      users.push(newUser);
      console.log(`✅ User added: ${username}, Total users: ${users.length}`);
      socket.broadcast.emit('userJoined', newUser);
    } else if (username) {
      // Update existing user's socket ID
      const existingUser = users.find(u => u.username === username);
      if (existingUser) {
        existingUser.id = socket.id;
        console.log(`🔄 Updated socket ID for user: ${username}`);
      }
    }
    
    // Send updated user list to all clients
    io.emit('userList', users);
    
    // Send confirmation back to the joining user
    socket.emit('userJoinConfirmed', { username, users });
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    console.log(`📨 Fetching messages between ${user1} and ${user2}`);
    
    try {
      const messageDocs = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ]
      }).sort({ timestamp: 1 });

      const messages = messageDocs.map(doc => doc.toObject());
      console.log(`📤 Sending ${messages.length} messages to ${socket.id}`);
      socket.emit('privateMessages', messages);
    } catch (err) {
      console.error("⚠️ Error fetching messages:", err);
      socket.emit('error', { message: 'Failed to fetch messages' });
    }
  });

  socket.on('sendPrivateMessage', async ({ text, sender, recipient }) => {
    console.log(`💬 Message from ${sender} to ${recipient}: ${text}`);
    
    if (!text || !sender || !recipient) {
      console.log("❌ Invalid message data");
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }

    try {
      const newMessage = new Message({ text, sender, recipient });
      const savedMessage = await newMessage.save();
      const messagePayload = savedMessage.toObject();
      
      console.log(`✅ Message saved with ID: ${savedMessage._id}`);

      // Find recipient socket
      const recipientSocket = users.find(user => user.username === recipient);
      
      if (recipientSocket) {
        console.log(`📤 Sending to recipient ${recipient} (${recipientSocket.id})`);
        io.to(recipientSocket.id).emit('receivePrivateMessage', messagePayload);
      } else {
        console.log(`⚠️ Recipient ${recipient} not found online`);
      }
      
      // Always send back to sender for confirmation
      console.log(`📤 Confirming message to sender ${sender}`);
      socket.emit('receivePrivateMessage', messagePayload);
      
    } catch (err) {
      console.error("⚠️ Error saving message:", err);
      socket.emit('error', { message: 'Failed to send message' });
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
    const disconnectedUser = users.find(u => u.id === socket.id);
    if (disconnectedUser) {
      users = users.filter(u => u.id !== socket.id);
      io.emit('userList', users);
      console.log(`❌ User disconnected: ${disconnectedUser.username}`);
      socket.broadcast.emit('userLeft', disconnectedUser);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});