const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // For hashing passwords
const jwt = require('jsonwebtoken'); // For user authentication

const cookieParser = require('cookie-parser'); // To handle cookies
const socketIo = require('socket.io'); // WebSocket for real-time chat
const http = require('http'); // Required to create an HTTP server
const Message = require('./models/Message'); // Message model for storing chat messages
require('dotenv').config(); // Load environment variables from .env file
const cors = require('cors');
app.use(cors());
const User = require('./models/User'); // User model for authentication
const Community = require('./models/Community'); // Community model (if needed)
const Job = require('./models/Jobs'); // Community model (if needed)
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(express.static('public')); // Serve static files like CSS/JS
app.use(cookieParser()); // Parse cookies for authentication
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false
}));
// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
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
app.get('/student-dashboard', (req, res) => {
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
    let { username, email, phone, password, accountType } = req.body;

    // Check if the user already exists
    const userExists = await User.findOne({ username });
    if (userExists) return res.send('User already exists');

    try {
        // Hash the password before saving it to the database
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Prepare user object
        const userData = {
            username,
            email,
            password: hashedPassword,
            phoneNumber: phone,
            accountType
        };

        // Handle additional fields for student or company
        if (accountType === 'student') {
            userData.studentDetails = {
                school: req.body.school,
                grade: req.body.grade,
                skills: req.body.skills.split(',').map(skill => skill.trim())
            };
        } else if (accountType === 'company') {
            userData.companyDetails = {
                companyName: req.body.companyName,
                website: req.body.website,
                description: req.body.description
            };
        }

        // Create new user in the database
        const user = await User.create(userData);

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
        // Generate JWT token with accountType
        const token = jwt.sign(
            { username: user.username, email: user.email, accountType: user.accountType }, 
            jwtSecret, 
            { expiresIn: "1h" }
        );

        console.log("Generated Token:", token); // Debugging
        res.cookie('token', token, { httpOnly: false }); // Store token in a cookie
        console.log(user.accountType);
        
        // Redirect based on account type
        if (user.accountType === 'student') {
            res.redirect('/student-dashboard');
        } else if (user.accountType === 'company') {
            res.redirect('/company-dashboard');
        } else {
            res.redirect('/');
        }
    } else {
        res.redirect('/login'); // Redirect back to login if password is incorrect
    }
});
app.get('/company-dashboard',(req,res)=>{
    res.render('companyDashboard');
})

// **Community Route**
app.get('/community-dashboard', async (req, res) => {
    try {
        // Fetch communities and populate members and admin details
        const communities = await Community.find().populate('members admin');
        
        // Make sure to pass the communities array to the EJS template
        res.render('community', { communities });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Middleware for Authentication Check
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');  // Redirect to login if not authenticated
}
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = await User.findOne({ username });
            if (!user) {
                return done(null, false, { message: 'Incorrect username.' });
            }

            // Compare password
            const isMatch = await user.comparePassword(password); // Assuming you have a method in your model
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});



// Create a New Community
app.post('/create-community', isAuthenticated, async (req, res) => {
    try {
        const { name, description } = req.body;
        const admin = req.user._id;

        // Check if community name already exists
        const existingCommunity = await Community.findOne({ name });
        if (existingCommunity) {
            req.flash('error', 'Community name already taken');
            return res.redirect('/community-dashboard');
        }

        // Create new community
        const newCommunity = new Community({
            name,
            description,
            admin,
            members: [admin]  // Admin is the first member
        });

        await newCommunity.save();
        res.redirect('/community-dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Server error while creating community');
        res.redirect('/community-dashboard');
    }
});

// Add Member to a Community
app.post('/add-member', isAuthenticated, async (req, res) => {
    try {
        const { communityId, userId } = req.body;

        // Check if community exists
        const community = await Community.findById(communityId);
        if (!community) {
            req.flash('error', 'Community not found');
            return res.redirect('/community-dashboard');
        }

        // Check if user is already a member
        if (community.members.includes(userId)) {
            req.flash('error', 'User is already a member');
            return res.redirect('/community-dashboard');
        }

        // Add member to community
        community.members.push(userId);
        await community.save();

        req.flash('success', 'User added successfully');
        res.redirect('/community-dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Server error while adding member');
        res.redirect('/community-dashboard');
    }
});

// Community Dashboard - Display All Communities
app.get('/community-dashboard', isAuthenticated, async (req, res) => {
    try {
        const communities = await Community.find().populate('members admin');
        res.render('community', { 
            communities,
            user: req.user,
            successMessage: req.flash('success'),
            errorMessage: req.flash('error')
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Server error while loading communities');
        res.redirect('/');
    }
});



// Route for posting a job
app.post('/post-job', async (req, res) => {
    const { title, company, location, description, type,link } = req.body;

    try {
        await Job.create({ title, company, location, description, type,link });
        res.redirect('/company-dashboard');
    } catch (error) {
        console.error("Error posting job:", error);
        res.status(500).send('Server error');
    }
});
// Route to display all jobs
app.get('/jobs', async (req, res) => {
    try {
        const jobs = await Job.find().sort({ postedDate: -1 }); // Display newest first
        res.render('jobs', { jobs });
    } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).send('Server error');
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

