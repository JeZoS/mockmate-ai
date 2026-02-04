const User = require('../models/User');
const Interview = require('../models/Interview');
const { getAudioUrl } = require('../services/s3Service');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalInterviews = await Interview.countDocuments({ isDeleted: false });
    
    const statusCounts = await Interview.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const tokenStats = await Interview.aggregate([
      { $match: { isDeleted: false } },
      { 
        $group: { 
          _id: null, 
          totalInputTokens: { $sum: '$tokenUsage.totalInputTokens' },
          totalOutputTokens: { $sum: '$tokenUsage.totalOutputTokens' },
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
          totalCost: { $sum: '$tokenUsage.estimatedCost' }
        } 
      }
    ]);

    // Get recent interviews with audio recording counts
    const recentInterviews = await Interview.find({ isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('user', 'name email');

    // Add audio count to each interview
    const interviewsWithAudioCount = recentInterviews.map(interview => ({
      ...interview.toObject(),
      audioCount: interview.audioRecordings?.length || 0
    }));

    res.json({
      totalUsers,
      totalInterviews,
      statusCounts,
      tokenStats: tokenStats[0] || { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalCost: 0 },
      recentInterviews: interviewsWithAudioCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInterviewDetails = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId)
      .populate('user', 'name email');
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Generate signed URLs for audio recordings
    const audioRecordings = await Promise.all(
      (interview.audioRecordings || []).map(async (recording) => {
        try {
          const url = await getAudioUrl(recording.s3Key, 3600);
          return {
            id: recording._id,
            questionIndex: recording.questionIndex,
            durationSeconds: recording.durationSeconds,
            mimeType: recording.mimeType,
            uploadedAt: recording.uploadedAt,
            url
          };
        } catch (err) {
          console.error('Error generating URL for recording:', err);
          return {
            id: recording._id,
            questionIndex: recording.questionIndex,
            durationSeconds: recording.durationSeconds,
            error: 'Could not generate playback URL'
          };
        }
      })
    );

    // Extract Q&A from history
    const qaHistory = [];
    let currentQuestion = null;
    
    for (const entry of interview.history || []) {
      if (entry.role === 'model') {
        currentQuestion = entry.parts?.[0]?.text || '';
      } else if (entry.role === 'user' && currentQuestion) {
        qaHistory.push({
          question: currentQuestion,
          answer: entry.parts?.[0]?.text || '[Audio Response]',
          hasAudioData: entry.parts?.some(p => p.inlineData)
        });
        currentQuestion = null;
      }
    }

    res.json({
      interview: {
        _id: interview._id,
        user: interview.user,
        role: interview.role,
        focusArea: interview.focusArea,
        level: interview.level,
        language: interview.language,
        status: interview.status,
        date: interview.date,
        updatedAt: interview.updatedAt,
        durationSeconds: interview.durationSeconds,
        feedback: interview.feedback,
        tokenUsage: interview.tokenUsage
      },
      qaHistory,
      audioRecordings
    });
  } catch (error) {
    console.error('Get interview details error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all interviews with pagination for admin
exports.getAllInterviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const search = req.query.search;

    let query = { isDeleted: false };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get interviews
    let interviews = await Interview.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email');

    // If search term provided, filter by user name/email
    if (search) {
      interviews = interviews.filter(i => 
        i.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        i.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
        i.role?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = await Interview.countDocuments(query);

    const interviewsWithMeta = interviews.map(interview => ({
      ...interview.toObject(),
      audioCount: interview.audioRecordings?.length || 0,
      questionCount: interview.history?.filter(h => h.role === 'model').length || 0
    }));

    res.json({
      interviews: interviewsWithMeta,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};