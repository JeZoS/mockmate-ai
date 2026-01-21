const User = require('../models/User');
const { uploadAudio, getAudioUrl, deleteAudio } = require('../services/s3Service');
const { v4: uuidv4 } = require('uuid');

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate signed URL for resume if exists
    let resumeSignedUrl = null;
    if (user.resumeS3Key) {
      try {
        resumeSignedUrl = await getAudioUrl(user.resumeS3Key, 3600);
      } catch (err) {
        console.error('Error generating resume URL:', err);
      }
    }

    res.json({
      ...user.toObject(),
      resumeSignedUrl
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      experienceLevel,
      yearsOfExperience,
      currentRole,
      targetRole,
      skills,
      linkedinUrl,
      githubUrl
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (experienceLevel !== undefined) user.experienceLevel = experienceLevel;
    if (yearsOfExperience !== undefined) user.yearsOfExperience = yearsOfExperience;
    if (currentRole !== undefined) user.currentRole = currentRole;
    if (targetRole !== undefined) user.targetRole = targetRole;
    if (skills !== undefined) user.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
    if (linkedinUrl !== undefined) user.linkedinUrl = linkedinUrl;
    if (githubUrl !== undefined) user.githubUrl = githubUrl;

    // Mark profile as completed if essential fields are filled
    if (user.name && user.experienceLevel) {
      user.profileCompleted = true;
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      experienceLevel: user.experienceLevel,
      yearsOfExperience: user.yearsOfExperience,
      currentRole: user.currentRole,
      targetRole: user.targetRole,
      skills: user.skills,
      linkedinUrl: user.linkedinUrl,
      githubUrl: user.githubUrl,
      resumeUrl: user.resumeUrl,
      resumeFileName: user.resumeFileName,
      profileCompleted: user.profileCompleted,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Upload resume
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old resume if exists
    if (user.resumeS3Key) {
      try {
        await deleteAudio(user.resumeS3Key);
      } catch (err) {
        console.error('Error deleting old resume:', err);
      }
    }

    // Upload new resume
    const fileExtension = req.file.originalname.split('.').pop();
    const s3Key = `mockmate/resumes/${user._id}/${uuidv4()}.${fileExtension}`;
    
    const s3Url = await uploadAudio(req.file.buffer, s3Key, req.file.mimetype);

    // Update user
    user.resumeS3Key = s3Key;
    user.resumeUrl = s3Url;
    user.resumeFileName = req.file.originalname;
    await user.save();

    // Generate signed URL for immediate use
    const signedUrl = await getAudioUrl(s3Key, 3600);

    res.json({
      message: 'Resume uploaded successfully',
      resumeFileName: user.resumeFileName,
      resumeUrl: signedUrl
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete resume
exports.deleteResume = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.resumeS3Key) {
      try {
        await deleteAudio(user.resumeS3Key);
      } catch (err) {
        console.error('Error deleting resume from S3:', err);
      }
    }

    user.resumeS3Key = '';
    user.resumeUrl = '';
    user.resumeFileName = '';
    await user.save();

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Complete profile setup (for first-time users)
exports.completeProfileSetup = async (req, res) => {
  try {
    const {
      name,
      phone,
      experienceLevel,
      yearsOfExperience,
      currentRole,
      targetRole,
      skills,
      linkedinUrl,
      githubUrl
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update all profile fields
    user.name = name || user.name;
    user.phone = phone || '';
    user.experienceLevel = experienceLevel || '';
    user.yearsOfExperience = yearsOfExperience || 0;
    user.currentRole = currentRole || '';
    user.targetRole = targetRole || '';
    user.skills = Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(Boolean);
    user.linkedinUrl = linkedinUrl || '';
    user.githubUrl = githubUrl || '';
    user.profileCompleted = true;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      experienceLevel: user.experienceLevel,
      yearsOfExperience: user.yearsOfExperience,
      currentRole: user.currentRole,
      targetRole: user.targetRole,
      skills: user.skills,
      linkedinUrl: user.linkedinUrl,
      githubUrl: user.githubUrl,
      resumeUrl: user.resumeUrl,
      resumeFileName: user.resumeFileName,
      profileCompleted: user.profileCompleted,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    console.error('Complete profile setup error:', error);
    res.status(500).json({ message: error.message });
  }
};
