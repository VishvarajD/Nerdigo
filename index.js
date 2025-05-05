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
const Community = require('./models/Community'); // Community model
const Job = require('./models/Jobs'); // Job model
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Roadmap = require('./models/Roadmap');
const { generateAIRoadmap } = require('./services/aiService');
const Analytics = require('./models/Analytics');
const path = require('path');

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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

// Add these lines after your require statements
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    res.cookie('token', '');
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

app.get('/company-dashboard', (req, res) => {
    res.render('companyDashboard');
});

// **Community Route**
app.get('/community-dashboard', async (req, res) => {
    try {
        const username = getUserFromToken(req);
        if (!username) {
            return res.redirect('/login');
        }

        const user = await User.findOne({ username });
        const communities = await Community.find()
            .populate('members', 'username')
            .populate('admin', 'username');
        
        res.render('community', { 
            communities,
            userId: user ? user._id.toString() : null,
            username: username
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// **Render Create Community Form**
app.get('/create-community', (req, res) => {
    res.render('createCommunity'); // Render the createCommunity.ejs file
});

// **Render Add Member Form**
app.get('/add-member', (req, res) => {
    res.render('addMember'); // Render the addMember.ejs file
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

// **Create a New Community**
app.post('/create-community', async (req, res) => {
    try {
        // Debug log
        console.log('Received request body:', req.body);

        const username = getUserFromToken(req);
        if (!username) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Explicitly check for name and description
        if (!req.body.name) {
            return res.status(400).json({ message: 'Community name is required' });
        }

        if (!req.body.description) {
            return res.status(400).json({ message: 'Community description is required' });
        }

        // Create new community with explicit values
        const newCommunity = new Community({
            name: req.body.name,
            description: req.body.description,
            admin: user._id,
            members: [user._id]
        });

        // Debug log
        console.log('Attempting to save community:', newCommunity);

        await newCommunity.save();

        res.status(201).json({ 
            message: 'Community created successfully',
            community: {
                id: newCommunity._id,
                name: newCommunity.name,
                description: newCommunity.description
            }
        });

    } catch (error) {
        console.error('Create community error:', error);
        
        // More detailed error response
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation Error',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }
        
        res.status(500).json({ 
            message: 'Error creating community',
            error: error.message 
        });
    }
});

// **Add Member to a Community**
app.post('/add-member', async (req, res) => {
    try {
        const { communityId, username } = req.body;
        
        // Find the user to add
        const userToAdd = await User.findOne({ username });
        if (!userToAdd) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Find the community
        const community = await Community.findById(communityId);
        if (!community) {
            return res.status(404).json({ message: 'Community not found' });
        }

        // Check if user is already a member
        if (community.members.includes(userToAdd._id)) {
            return res.status(400).json({ message: 'User is already a member' });
        }

        // Add the user to the community
        community.members.push(userToAdd._id);
        await community.save();

        res.status(200).json({ message: 'Member added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// **Route to display all jobs**
app.get('/jobs', async (req, res) => {
    try {
        const jobs = await Job.find().sort({ postedDate: -1 }); // Display newest first
        res.render('jobs', { jobs });
    } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).send('Server error');
    }
});

// **Search Routes**
app.get('/search', (req, res) => {
    res.render('search'); // Create a new search.ejs view
});

// Search Jobs API endpoint
app.get('/api/search/jobs', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.json([]);
        }

        const jobs = await Job.find({
            $or: [
                { title: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { company: { $regex: searchTerm, $options: 'i' } }
            ]
        }).limit(10);

        res.json(jobs);
    } catch (error) {
        console.error("Error searching jobs:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search Communities API endpoint
app.get('/api/search/communities', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.json([]);
        }

        const communities = await Community.find({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
            ]
        }).limit(10);

        res.json(communities);
    } catch (error) {
        console.error("Error searching communities:", error);
        res.status(500).json({ error: 'Server error' });
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
    const username = getUserFromToken({ cookies: { token } });

    if (username) {
        socket.username = username;
        console.log(`${username} connected to chat`);
    }

    // Handle joining community-specific rooms
    socket.on('joinCommunityRoom', async (communityId) => {
        console.log(`${socket.username} joining room: community_${communityId}`);
        socket.join(`community_${communityId}`);
    });

    socket.on('leaveCommunityRoom', (communityId) => {
        console.log(`${socket.username} leaving room: community_${communityId}`);
        socket.leave(`community_${communityId}`);
    });

    // Handle community messages
    socket.on('sendCommunityMessage', async (data) => {
        try {
            const { communityId, content } = data;
            
            const message = new Message({
                communityId,
                sender: socket.username,
                content,
                timestamp: new Date()
            });

            await message.save();

            // Broadcast to community room
            io.to(`community_${communityId}`).emit('communityMessage', {
                sender: socket.username,
                content,
                timestamp: message.timestamp
            });
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`${socket.username || "A user"} disconnected`);
    });
});

// **Start Server**

server.listen(3000, () => console.log('Server running on port 3000'));

// Add these new routes
app.get('/api/community-messages/:communityId', async (req, res) => {
    try {
        const messages = await Message.find({ 
            communityId: req.params.communityId 
        })
        .sort({ timestamp: -1 })
        .limit(50);
        
        res.json(messages.reverse());
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/send-community-message', async (req, res) => {
    try {
        const username = getUserFromToken(req);
        if (!username) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { communityId, content } = req.body;
        
        const message = new Message({
            communityId,
            sender: username,
            content,
            timestamp: new Date()
        });

        await message.save();

        // Broadcast to community room
        io.to(`community_${communityId}`).emit('communityMessage', {
            sender: username,
            content,
            timestamp: message.timestamp
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Update join community route
app.post('/join-community', async (req, res) => {
    try {
        const username = getUserFromToken(req);
        if (!username) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const { communityId } = req.body;
        const community = await Community.findById(communityId);
        
        if (!community) {
            return res.status(404).json({ message: 'Community not found' });
        }

        // Check if user is already a member or has a pending request
        if (community.members.includes(user._id)) {
            return res.status(400).json({ message: 'Already a member of this community' });
        }
        if (community.pendingMembers.includes(user._id)) {
            return res.status(400).json({ message: 'Join request already pending' });
        }

        // Add user to pending members
        community.pendingMembers.push(user._id);
        await community.save();

        res.status(200).json({ message: 'Join request sent. Waiting for admin approval.' });
    } catch (error) {
        console.error('Error joining community:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new route for handling join requests
app.post('/approve-join-request', async (req, res) => {
    try {
        const adminUsername = getUserFromToken(req);
        if (!adminUsername) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const { communityId, userId, approved } = req.body;
        
        const community = await Community.findById(communityId);
        if (!community) {
            return res.status(404).json({ message: 'Community not found' });
        }

        // Verify that the requester is the admin
        const admin = await User.findOne({ username: adminUsername });
        if (!admin || community.admin.toString() !== admin._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Remove user from pending members
        community.pendingMembers = community.pendingMembers.filter(
            memberId => memberId.toString() !== userId
        );

        if (approved) {
            // Add to members if approved
            community.members.push(userId);
        }

        await community.save();

        res.status(200).json({ 
            message: approved ? 'User approved and added to community' : 'Join request rejected' 
        });
    } catch (error) {
        console.error('Error handling join request:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// AI Roadmap Generation endpoint
app.post('/generate-roadmap', async (req, res) => {
    try {
        const username = getUserFromToken(req);
        if (!username) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const user = await User.findOne({ username });
        const { field, currentLevel, goals } = req.body;

        console.log('Generating roadmap for:', { field, currentLevel, goals });

        // Generate roadmap using AI
        const roadmapData = await generateAIRoadmap(field, currentLevel, goals);

        const newRoadmap = new Roadmap({
            ...roadmapData,
            field: field,
            difficulty: currentLevel,
            createdBy: user._id
        });

        await newRoadmap.save();
        await trackRoadmapGeneration(user._id, field, currentLevel);

        // Add flag to indicate if it was AI generated
        res.status(201).json({
            ...roadmapData,
            isAIGenerated: !roadmapData.isFallback // Add this flag
        });
    } catch (error) {
        console.error('Error generating roadmap:', error);
        res.status(500).json({ message: 'Error generating roadmap' });
    }
});

// Get user's roadmaps
app.get('/my-roadmaps', async (req, res) => {
    try {
        const username = getUserFromToken(req);
        if (!username) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const user = await User.findOne({ username });
        const roadmaps = await Roadmap.find({ createdBy: user._id });
        res.json(roadmaps);
    } catch (error) {
        console.error('Error fetching roadmaps:', error);
        res.status(500).json({ message: 'Error fetching roadmaps' });
    }
});

// Add analytics tracking
async function trackRoadmapGeneration(userId, field, level) {
    try {
        // You could create an Analytics model to track usage
        await Analytics.create({
            userId,
            action: 'roadmap_generation',
            field,
            level,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Analytics Error:', error);
    }
}

app.get('/roadmap-generator', (req, res) => {
    const username = getUserFromToken(req);
    if (!username) {
        return res.redirect('/login');
    }
    res.render('roadmap');
});

// Add this route to handle member removal
app.post('/remove-member', async (req, res) => {
    try {
        const adminUsername = getUserFromToken(req);
        if (!adminUsername) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const { communityId, memberId } = req.body;
        
        // Find the community
        const community = await Community.findById(communityId);
        if (!community) {
            return res.status(404).json({ message: 'Community not found' });
        }

        // Verify that the requester is the admin
        const admin = await User.findOne({ username: adminUsername });
        if (!admin || community.admin.toString() !== admin._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Don't allow removing the admin
        if (memberId === community.admin.toString()) {
            return res.status(400).json({ message: 'Cannot remove admin from community' });
        }

        // Remove member from the community
        community.members = community.members.filter(
            member => member.toString() !== memberId
        );

        await community.save();

        res.status(200).json({ 
            message: 'Member removed successfully' 
        });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Server error' });
    }
});