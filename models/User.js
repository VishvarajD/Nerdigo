const mongoose = require('mongoose');
console.log("User DB");

require('dotenv').config();
try {
    mongoose.connect(process.env.MONGO_URL);
    console.log("DB connected");
} catch (error) {
    console.log(error + " bsdk");   
}




const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        enum: ['student', 'company'],
        required: true
    },
    companyDetails: {
        companyName: String,
        website: String,
        description: String
    },
    studentDetails: {
        school: String,
        grade: String,
        skills: [String]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);




