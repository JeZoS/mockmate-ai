const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    required: true
  },
  focusArea: String,
  level: String,
  language: {
    type: String,
    default: 'English'
  },
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
    default: 'IN_PROGRESS'
  },
  history: [{
    role: String,
    parts: [{
      text: String,
      inlineData: {
        mimeType: String,
        data: String
      }
    }]
  }],
  date: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  feedback: {
    overallScore: Number,
    communicationScore: Number,
    technicalScore: Number,
    strengths: [String],
    weaknesses: [String],
    suggestion: String
  }
});

InterviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Interview', InterviewSchema);