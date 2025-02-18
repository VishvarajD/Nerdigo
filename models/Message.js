const mongoose = require('mongoose');
require('dotenv').config();
try {
    mongoose.connect(process.env.MONGO_URL);
    console.log("DB connected");
} catch (error) {
    console.log(error + " bsdk");   
}
const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
