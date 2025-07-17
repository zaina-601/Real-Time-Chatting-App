Real-Time Chat Application

A full-stack, real-time messaging application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO. This project allows users to engage in private, one-on-one conversations with live user presence and persistent chat history.

Since this project is configured for local demonstration, the GIF below showcases its core real-time functionality.

![alt text](./chat-demo.gif)

(To make this work, replace this line with a real GIF of your application running!)

Features Overview:

Real-time Private Messaging: Engage in instant, one-on-one conversations with other online users without page reloads.

Live User Presence: A sidebar displays a list of all currently online users, updating instantly as users join or leave.

Typing Indicators: See a "User is typing..." notification in real-time to know when the other person is actively writing a message.

Persistent Chat History: Conversations are securely saved to a MongoDB database. When you re-open a chat, your previous message history is automatically loaded.

User-Friendly Notifications: The interface uses toast notifications to announce when a user joins or leaves the chat.

Tech Stack
Component	Technology
Frontend	React, Socket.IO Client, TailwindCSS, React Router
Backend	Node.js, Express.js, Socket.IO, Mongoose
Database	MongoDB Atlas
Getting Started & Local Setup Instructions

Follow these instructions to get the project running on your local machine for development and demonstration.

Prerequisites:

You will need the following tools installed on your computer:

1-Node.js (v16 or later recommended)

npm (comes with Node.js)

2-Git

A free MongoDB Atlas account for the database.

Installation

1. Clone the Repository

Generated bash
git clone https://github.com/your-username/your-repository-name.git
cd your-repository-name


2. Backend Setup

Navigate to the server directory, install dependencies, and create your environment file.

Generated bash
# Move into the server directory
cd server

# Install dependencies
npm install
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Create a new file named .env in the server directory and add the following, replacing the placeholder with your own MongoDB connection string.

File: server/.env

Generated code
DATABASE_URL=mongodb+srv://<username>:<password>@cluster-address...
FRONTEND_URL=http://localhost:3000
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

Now, you can start the backend server:

Generated bash
# Start the server (runs on http://localhost:4000)
npm start
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

3. Frontend Setup

Open a new terminal window, navigate to the client directory from the root folder, and install its dependencies.

Generated bash
# Move into the client directory from the root folder
cd client

# Install dependencies
npm install
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Create a .env file in the client directory to tell the frontend where the backend is running.

File: client/.env

Generated code
REACT_APP_SOCKET_URL=http://localhost:4000
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

Now, you can start the React development server:

Generated bash
# Start the client (opens in your browser at http://localhost:3000)
npm start
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

4. You're All Set!

The application is now running locally. Open http://localhost:3000 in two separate browser windows to log in as different users and test the chat functionality.