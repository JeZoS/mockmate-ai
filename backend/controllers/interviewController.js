const Interview = require('../models/Interview');

// Create new interview session
exports.createInterview = async (req, res) => {
  const { role, focusArea, level, language, history } = req.body;

  try {
    const interview = await Interview.create({
      user: req.user._id,
      role,
      focusArea,
      level,
      language: language || 'English',
      status: 'IN_PROGRESS',
      history: history || []
    });
    res.status(201).json(interview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all non-deleted interviews for user
exports.getMyInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ 
      user: req.user._id,
      isDeleted: false 
    }).sort({ updatedAt: -1 });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single interview details
exports.getInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false
    });
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update interview (Save progress or Complete)
exports.updateInterview = async (req, res) => {
  const { history, status, feedback, durationSeconds } = req.body;

  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (history) interview.history = history;
    if (status) interview.status = status;
    if (feedback) interview.feedback = feedback;
    if (durationSeconds) interview.durationSeconds = durationSeconds;

    await interview.save();
    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Soft delete
exports.deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    interview.isDeleted = true;
    await interview.save();
    res.json({ message: 'Interview deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};