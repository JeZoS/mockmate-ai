const User = require('../models/User');
const Interview = require('../models/Interview');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalInterviews = await Interview.countDocuments({ isDeleted: false });
    
    // Aggregate status counts
    const statusCounts = await Interview.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Get recent interviews
    const recentInterviews = await Interview.find({ isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('user', 'name email');

    res.json({
      totalUsers,
      totalInterviews,
      statusCounts,
      recentInterviews
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