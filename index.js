const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const socketIo = require('socket.io');
const http = require('http');
const Message = require('./models/Message'); 
require('dotenv').config();

const User = require('./models/User');
const Community = require('./models/Community');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

const jwtSecret = process.env.JWT_SECRET || 'default_secret';

// Function to get username from JWT
function getUserFromToken(req) {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, jwtSecret);
            return decoded.username; // Extract username
        } catch (err) {
            console.error("Invalid token:", err);
        }
    }
    return null;
}

// **ROUTES**
app.get('/dashboard', (req, res) => {
    const username = getUserFromToken(req);
    res.render('userDashboard', { username });
});

app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));

// **Signup Route**
app.post('/signup', async (req, res) => {
    let { username, email, phone, password } = req.body;

    const userExists = await User.findOne({ username });
    if (userExists) return res.send('User already exists');

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            phoneNumber: phone
        });

        const token = jwt.sign({ username: user.username, email: user.email }, jwtSecret);
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// **Login Route**
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) return res.render('signupError');

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
        const token = jwt.sign({ username: user.username, email: user.email }, jwtSecret, { expiresIn: "1h" });

        console.log("Generated Token:", token); // Debugging
        res.cookie('token', token, { httpOnly: false }); // Make cookie accessible in frontend
        res.redirect('/community');
    } else {
        res.redirect('/login');
    }
});

// **Community Route**
app.get('/community', async (req, res) => {
    try {
        const username = getUserFromToken(req);
        res.render('community', { username });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching community discussions');
    }
});

// **WebSockets**
const server = http.createServer(app);
const io = socketIo(server);


io.on('connection', async (socket) => {
    console.log("A user is attempting to connect...");

    // Extract token from WebSocket authentication
    const token = socket.handshake.auth?.token;

    if (!token) {
        console.log("No token provided for WebSocket connection.");
        socket.emit("authError", "No token found. Please log in again.");
        return socket.disconnect(true);
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        socket.username = decoded.username; // Store username for messages
        console.log(`${socket.username} connected to chat`);

        // Send previous messages from DB to the user
        const previousMessages = await Message.find().sort({ timestamp: 1 });
        socket.emit('previousMessages', previousMessages);

        // Notify others about the new user
        socket.broadcast.emit('chatMessage', { sender: "System", message: `${socket.username} has joined the chat.` });

    } catch (err) {
        console.error('Invalid WebSocket token:', err);
        socket.emit("authError", "Invalid token. Please log in again.");
        return socket.disconnect(true);
    }

    // Listen for incoming messages and store them in the database
    socket.on('chatMessage', async (msgData) => {
        if (!socket.username) return;

        const messageWithUser = {
            sender: socket.username,
            message: msgData.message
        };

        console.log("Received message:", messageWithUser);

        try {
            // Save message to database
            const savedMessage = new Message(messageWithUser);
            await savedMessage.save();

            // Broadcast message to all clients
            io.emit('chatMessage', savedMessage);
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log(`${socket.username || "A user"} disconnected`);
        io.emit('chatMessage', { sender: "System", message: `${socket.username || "A user"} has left the chat.` });
    });
});


// **Start Server**
server.listen(3000, () => console.log('Server running on port 3000'));
