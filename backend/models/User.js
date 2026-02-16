const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isTestUser: {
    type: Boolean,
    default: false,
  },
  // Profile fields
  phone: {
    type: String,
    default: "",
  },
  experienceLevel: {
    type: String,
    enum: ["fresher", "junior", "mid", "senior", "lead", "manager", ""],
    default: "",
  },
  yearsOfExperience: {
    type: Number,
    default: 0,
  },
  currentRole: {
    type: String,
    default: "",
  },
  targetRole: {
    type: String,
    default: "",
  },
  skills: [
    {
      type: String,
    },
  ],
  linkedinUrl: {
    type: String,
    default: "",
  },
  githubUrl: {
    type: String,
    default: "",
  },
  portfolioUrl: {
    type: String,
    default: "",
  },
  roleType: {
    type: String,
    enum: ["tech", "non-tech", ""],
    default: "",
  },
  resumeUrl: {
    type: String,
    default: "",
  },
  resumeS3Key: {
    type: String,
    default: "",
  },
  resumeFileName: {
    type: String,
    default: "",
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailOtp: {
    type: String,
    default: "",
  },
  emailOtpExpiry: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.index({ name: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ isTestUser: 1 });
UserSchema.pre("save", async function () {
  this.updatedAt = Date.now();

  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
