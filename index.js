const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // For hashing passwords
const jwt = require('jsonwebtoken'); // For user authentication
const passport = require('passport');
const cookieParser = require('cookie-parser'); // To handle cookies
const socketIo = require('socket.io'); // WebSocket for real-time chat
const http = require('http'); // Required to create an HTTP server
const Message = require('./models/Message'); // Message model for storing chat messages
require('dotenv').config(); // Load environment variables from .env file

const User = require('./models/User'); // User model for authentication
const Community = require('./models/Community'); // Community model (if needed)

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(express.static('public')); // Serve static files like CSS/JS
app.use(cookieParser()); // Parse cookies for authentication

const jwtSecret = process.env.JWT_SECRET || 'default_secret'; // Secret key for JWT

// Function to get username from JWT token stored in cookies
function getUserFromToken(req) {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, jwtSecret);
            return decoded.username; // Extract username from the token
        } catch (err) {
            console.error("Invalid token:", err);
        }
    }
    return null; // Return null if no valid token found
}
function isLoggedInorNot(req) {
    const token = req.cookies.token;

    if (token) {
        try {
            jwt.verify(token, 'default_secret');
            return true;
        } catch (err) {
            console.error("Invalid token:", err);
            return false;  // Add this line to explicitly return false
        }
    } else {
        return false;
    }
}

// **ROUTES**

app.get('/', (req, res) => {
    const check = isLoggedInorNot(req);
    res.render('index', { check });
});

// **Dashboard Route**
app.get('/dashboard', (req, res) => {
    const username = getUserFromToken(req); // Get username from token
    res.render('userDashboard', { username }); // Render dashboard with username
});

app.get('/logout', (req, res) => {
    res.cookie('token' , '');
    res.redirect('login');
});

// **Login and Signup Pages**
app.get('/login', (req, res) => res.render('login')); // Render login page
app.get('/signup', (req, res) => res.render('signup')); // Render signup page

// **Signup Route**
app.post('/signup', async (req, res) => {
    let { username, email, phone, password } = req.body;

    // Check if the user already exists
    const userExists = await User.findOne({ username });
    if (userExists) return res.send('User already exists');

    try {
        // Hash the password before saving it to the database
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user in the database
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            phoneNumber: phone
        });

        // Generate JWT token with username and email
        const token = jwt.sign({ username: user.username, email: user.email }, jwtSecret);
        res.cookie('token', token, { httpOnly: true }); // Store token in cookies
        res.redirect('/login'); // Redirect user to login page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error'); // Handle errors
    }
});

// **Login Route**
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) return res.render('signup'); // Redirect to signup if user not found

    // Compare provided password with hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
        // Generate JWT token with expiration time
        const token = jwt.sign({ username: user.username, email: user.email }, jwtSecret, { expiresIn: "0.1h" });

        console.log("Generated Token:", token); // Debugging
        res.cookie('token', token, { httpOnly: false }); // Store token in a cookie
        res.redirect('/community'); // Redirect to community page
    } else {
        res.redirect('/login'); // Redirect back to login if password is incorrect
    }
});

// **Community Route**
app.get('/community', async (req, res) => {
    try {
        const username = getUserFromToken(req); // Get username from token
        res.render('community', { username }); // Render community page with username
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching community discussions');
    }
});

// **WebSockets Setup**
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server); // Attach Socket.io to the server

// WebSocket connection event
io.on('connection', async (socket) => {
    console.log("A user is attempting to connect...");

    // Extract token from WebSocket authentication
    const token = socket.handshake.auth?.token;

    if (!token) {
        console.log("No token provided for WebSocket connection.");
        socket.emit("authError", "No token found. Please log in again.");
        return socket.disconnect(true); // Disconnect user if no token found
    }

    try {
        // Verify and decode the JWT token
        const decoded = jwt.verify(token, jwtSecret);
        socket.username = decoded.username; // Store username for messages
        console.log(`${socket.username} connected to chat`);

        // Send previous messages from DB to the user upon connection
        const previousMessages = await Message.find().sort({ timestamp: 1 });
        socket.emit('previousMessages', previousMessages); // Send stored messages to user

        // Notify other users when a new user joins
        socket.broadcast.emit('chatMessage', { sender: "System", message: `${socket.username} has joined the chat.` });

    } catch (err) {
        console.error('Invalid WebSocket token:', err);
        socket.emit("authError", "Invalid token. Please log in again.");
        return socket.disconnect(true); // Disconnect user if token is invalid
    }

    // Listen for incoming messages and store them in the database
    socket.on('chatMessage', async (msgData) => {
        if (!socket.username) return; // If no username, ignore the message

        const messageWithUser = {
            sender: socket.username, // Get sender's username
            message: msgData.message
        };

        console.log("Received message:", messageWithUser);

        try {
            // Save the message to the database
            const savedMessage = new Message(messageWithUser);
            await savedMessage.save();

            // Broadcast the message to all connected users
            io.emit('chatMessage', savedMessage);
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    // Handle user disconnect event
    socket.on('disconnect', () => {
        console.log(`${socket.username || "A user"} disconnected`);
        io.emit('chatMessage', { sender: "System", message: `${socket.username || "A user"} has left the chat.` });
    });
});

// **Start Server**
server.listen(3000, () => console.log('Server running on port 3000'));

