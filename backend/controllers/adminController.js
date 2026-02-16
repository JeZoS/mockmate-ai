const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/User");
const Interview = require("../models/Interview");

// Filter to IDENTIFY test users (inverted logic for optimization)
const TEST_USER_REGEX = /(@riktamtech\.com$|test|example)/i;

// @desc    Get admin stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getStats = asyncHandler(async (req, res) => {
  const testUsers = await User.find({
    $or: [{ email: { $regex: TEST_USER_REGEX } }, { isTestUser: true }],
  })
    .select("_id")
    .lean();

  const testUserIds = testUsers.map((u) => u._id);

  const [validUserCount, interviewStats, tokenStats] = await Promise.all([
    User.countDocuments({
      email: { $not: { $regex: TEST_USER_REGEX } },
      isTestUser: { $ne: true },
    }),

    Interview.aggregate([
      { $match: { user: { $nin: testUserIds } } },
      {
        $facet: {
          totalInterviews: [{ $count: "count" }],
          interviewsByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],
          activeUsers: [{ $group: { _id: "$user" } }, { $count: "count" }],
        },
      },
    ]),
    Interview.aggregate([
      { $match: { user: { $nin: testUserIds } } },
      {
        $group: {
          _id: null,
          totalInputTokens: { $sum: "$tokenUsage.totalInputTokens" },
          totalOutputTokens: { $sum: "$tokenUsage.totalOutputTokens" },
          totalTokens: { $sum: "$tokenUsage.totalTokens" },
          totalCost: { $sum: "$tokenUsage.estimatedCost" },
        },
      },
    ]),
  ]);

  const stats = interviewStats[0] || {};
  const tokens = tokenStats[0] || {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
  };

  const interviewsByStatus = (stats.interviewsByStatus || []).reduce(
    (acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    },
    {},
  );

  res.json({
    totalUsers: validUserCount,
    totalInterviews: stats.totalInterviews?.[0]?.count || 0,
    activeUsersCount: stats.activeUsers?.[0]?.count || 0,
    interviewsByStatus,
    tokenStats: tokens,
  });
});

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.page) || 1;

  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const [count, users] = await Promise.all([
    User.countDocuments(keyword),
    User.aggregate([
      { $match: keyword },
      {
        $addFields: {
          isRegexMatch: {
            $regexMatch: {
              input: "$email",
              regex: TEST_USER_REGEX.source,
              options: "i",
            },
          },
        },
      },
      {
        $sort: {
          isTestUser: 1,
          isRegexMatch: 1,
          createdAt: -1,
        },
      },
      { $skip: pageSize * (page - 1) },
      { $limit: pageSize },
      { $project: { password: 0, isRegexMatch: 0 } },
    ]),
  ]);

  if (users.length > 0) {
    const userIds = users.map((u) => u._id);

    const interviewStats = await Interview.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: "$user",
          interviewCount: { $sum: 1 },
          lastInterviewDate: { $max: "$date" },
        },
      },
    ]);

    const statsMap = new Map(interviewStats.map((s) => [s._id.toString(), s]));

    for (const user of users) {
      const stat = statsMap.get(user._id.toString());
      user.interviewCount = stat?.interviewCount || 0;
      user.lastInterviewDate = stat?.lastInterviewDate || null;
    }
  }

  res.json({
    users,
    page,
    pages: Math.ceil(count / pageSize),
    totalUsers: count,
  });
});

// @desc    Get specific user details and interviews
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserDetails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password").lean();

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const interviews = await Interview.find({ user: user._id })
    .select("-history -audioRecordings -tokenUsage.breakdown") // Exclude blobs
    .sort({ date: -1 })
    .lean();

  res.json({ user, interviews });
});

// @desc    Get all interviews with pagination and filtering
// @route   GET /api/admin/interviews
// @access  Private/Admin
const getAllInterviews = asyncHandler(async (req, res) => {
  const pageSize = 20;
  const page = Number(req.query.page) || 1;
  const matchConditions = {};

  if (req.query.status && req.query.status !== "all") {
    matchConditions.status = req.query.status;
  }

  if (req.query.search) {
    const users = await User.find({
      $or: [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    if (users.length === 0) {
      return res.json({ interviews: [], page, pages: 0, totalInterviews: 0 });
    }

    matchConditions.user = { $in: users.map((u) => u._id) };
  }

  const [totalInterviews, interviews] = await Promise.all([
    Interview.countDocuments(matchConditions),
    Interview.find(matchConditions)
      .sort({ date: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize)
      .populate("user", "name email") // Populate is cleaner/faster here than $lookup pipeline
      .select("-history -audioRecordings -tokenUsage.breakdown")
      .lean(),
  ]);

  res.json({
    interviews,
    page,
    pages: Math.ceil(totalInterviews / pageSize),
    totalInterviews,
  });
});

// @desc    Get interview details by ID (Admin)
// @route   GET /api/admin/interviews/:id
// @access  Private/Admin
const getInterviewDetails = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate("user", "name email")
    .lean();

  if (!interview) {
    res.status(404);
    throw new Error("Interview not found");
  }

  res.json(interview);
});

// @desc    Get user growth data (last 7 days)
// @route   GET /api/admin/user-growth
// @access  Private/Admin
const getUserGrowth = asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); 
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyCounts = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        email: { $not: { $regex: TEST_USER_REGEX } },
        isTestUser: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);

  const countMap = new Map(
    dailyCounts.map((d) => [
      `${d._id.year}-${d._id.month}-${d._id.day}`,
      d.count,
    ]),
  );

  const result = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sevenDaysAgo);
    date.setDate(sevenDaysAgo.getDate() + i);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    result.push({ date: label, count: countMap.get(key) || 0 });
  }

  res.json(result);
});

module.exports = {
  getStats,
  getUsers,
  getUserDetails,
  getAllInterviews,
  getInterviewDetails,
  getUserGrowth,
};
