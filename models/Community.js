const mongoose = require('mongoose');
require('dotenv').config();
try {
    mongoose.connect(process.env.MONGO_URL);
    console.log("DB connected");
} catch (error) {
    console.log(error + " bsdk");   
}


const CommunitySchema = new mongoose.Schema({
    topic: String,
    content: String,
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Community', CommunitySchema);

