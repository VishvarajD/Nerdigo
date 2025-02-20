// models/Job.js
const mongoose = require('mongoose');
require('dotenv').config();
try {
    mongoose.connect(process.env.MONGO_URL);
    console.log("DB connected");
} catch (error) {
    console.log(error + " bsdk");   
}

const jobSchema = new mongoose.Schema({
    title: String,
    company: String,
    location: String,
    description: String,
    type: String,
    link:String, 
    postedDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
