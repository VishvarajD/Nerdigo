const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['roadmap_generation', 'roadmap_view', 'resource_click']
    },
    field: {
        type: String,
        required: true
    },
    level: {
        type: String,
        required: true,
        enum: ['Beginner', 'Intermediate', 'Advanced']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Map,
        of: String,
        default: {}
    }
});

// Add index for better query performance
analyticsSchema.index({ userId: 1, action: 1, timestamp: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema); 