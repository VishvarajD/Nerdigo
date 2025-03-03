const mongoose = require('mongoose');

// Define a separate schema for resources
const resourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['documentation', 'video', 'article', 'course', 'interactive', 'platform']
    }
});

const stepSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    resources: [resourceSchema], // Use the resource schema here
    timeEstimate: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        required: true
    }
});

const roadmapSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    field: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    steps: [stepSchema],
    difficulty: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Roadmap', roadmapSchema); 