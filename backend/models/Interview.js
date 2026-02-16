const mongoose = require("mongoose");

const AudioRecordingSchema = new mongoose.Schema(
  {
    s3Key: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: "audio/webm",
    },
    questionIndex: {
      type: Number,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const InterviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  focusArea: String,
  level: String,
  language: {
    type: String,
    default: "English",
  },
  status: {
    type: String,
    enum: ["IN_PROGRESS", "COMPLETED", "ARCHIVED"],
    default: "IN_PROGRESS",
  },
  history: [
    {
      role: String,
      parts: [
        {
          text: String,
          inlineData: {
            mimeType: String,
            data: String,
          },
        },
      ],
    },
  ],
  audioRecordings: [AudioRecordingSchema],
  date: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  feedback: {
    overallScore: Number,
    communicationScore: Number,
    technicalScore: Number,
    strengths: [String],
    weaknesses: [String],
    suggestion: String,
  },
  tokenUsage: {
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 }, // in USD
    breakdown: [
      {
        timestamp: { type: Date, default: Date.now },
        operation: String, // 'chat', 'feedback', 'resume_analysis', 'tts'
        model: String,
        inputTokens: Number,
        outputTokens: Number,
        cost: Number,
      },
    ],
  },
});

InterviewSchema.index({ user: 1, date: -1 });
InterviewSchema.index({ status: 1, date: -1 });
InterviewSchema.index({ date: -1 });
InterviewSchema.index({ user: 1, isDeleted: 1, updatedAt: -1 });

InterviewSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("Interview", InterviewSchema);
