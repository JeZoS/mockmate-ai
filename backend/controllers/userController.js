const User = require('../models/User');
const { uploadFile, getAudioUrl, deleteAudio } = require('../services/s3Service');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' });

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
      githubUrl,
      portfolioUrl,
      roleType
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
    if (portfolioUrl !== undefined) user.portfolioUrl = portfolioUrl;
    if (roleType !== undefined) user.roleType = roleType;

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
      portfolioUrl: user.portfolioUrl,
      roleType: user.roleType,
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
    
    const s3Url = await uploadFile(req.file.buffer, s3Key, req.file.mimetype);

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

// Parse resume and extract details using AI
exports.parseResume = async (req, res) => {
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
    
    const s3Url = await uploadFile(req.file.buffer, s3Key, req.file.mimetype);

    // Update user with resume info
    user.resumeS3Key = s3Key;
    user.resumeUrl = s3Url;
    user.resumeFileName = req.file.originalname;
    await user.save();

    // Convert file to base64 for Gemini
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Use Gemini to parse the resume
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: `Analyze this resume and extract the following information in JSON format. Be precise and extract only what's clearly mentioned in the resume.

Return a JSON object with these fields:
{
  "name": "Full name of the candidate",
  "phone": "Phone number if found, otherwise empty string",
  "email": "Email address if found, otherwise empty string",
  "currentRole": "Current or most recent job title",
  "skills": ["Array of key skills mentioned"],
  "linkedinUrl": "LinkedIn URL if found, otherwise empty string",
  "githubUrl": "GitHub URL if found, otherwise empty string",
  "portfolioUrl": "Portfolio/personal website URL if found, otherwise empty string",
  "experienceLevel": "One of: fresher, junior, mid, senior, lead, manager - based on years of experience",
  "yearsOfExperience": "Number representing total years of experience",
  "education": "Highest education qualification",
  "summary": "A brief 1-2 sentence professional summary",
  "roleType": "tech or non-tech based on the resume content - tech includes software, engineering, data, IT roles; non-tech includes sales, marketing, HR, finance, operations, etc."
}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.`
            }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    });

    let extractedData = {};
    try {
      // Clean the response text and parse JSON
      let responseText = result.text.trim();
      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      extractedData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Error parsing AI response:', parseErr);
      console.error('Raw response:', result.text);
      // Return partial success - resume uploaded but parsing failed
      return res.json({
        message: 'Resume uploaded but parsing failed',
        resumeFileName: user.resumeFileName,
        extractedData: null
      });
    }

    // Generate signed URL for immediate use
    const signedUrl = await getAudioUrl(s3Key, 3600);

    res.json({
      message: 'Resume parsed successfully',
      resumeFileName: user.resumeFileName,
      resumeUrl: signedUrl,
      extractedData
    });
  } catch (error) {
    console.error('Parse resume error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Parse existing resume (already uploaded)
exports.parseExistingResume = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.resumeS3Key) {
      return res.status(400).json({ message: 'No resume found. Please upload a resume first.' });
    }

    // Get the resume from S3
    const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'mockmate-interviews',
      Key: user.resumeS3Key
    });

    const response = await s3Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    
    // Determine mime type from file extension
    const extension = user.resumeS3Key.split('.').pop().toLowerCase();
    let mimeType = 'application/pdf';
    if (extension === 'doc') mimeType = 'application/msword';
    if (extension === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Convert file to base64 for Gemini
    const base64Data = fileBuffer.toString('base64');

    // Use Gemini to parse the resume
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: `Analyze this resume and extract the following information in JSON format. Be precise and extract only what's clearly mentioned in the resume.

Return a JSON object with these fields:
{
  "name": "Full name of the candidate",
  "phone": "Phone number if found, otherwise empty string",
  "email": "Email address if found, otherwise empty string",
  "currentRole": "Current or most recent job title",
  "skills": ["Array of key skills mentioned"],
  "linkedinUrl": "LinkedIn URL if found, otherwise empty string",
  "githubUrl": "GitHub URL if found, otherwise empty string",
  "portfolioUrl": "Portfolio/personal website URL if found, otherwise empty string",
  "experienceLevel": "One of: fresher, junior, mid, senior, lead, manager - based on years of experience",
  "yearsOfExperience": "Number representing total years of experience",
  "education": "Highest education qualification",
  "summary": "A brief 1-2 sentence professional summary",
  "roleType": "tech or non-tech based on the resume content - tech includes software, engineering, data, IT roles; non-tech includes sales, marketing, HR, finance, operations, etc."
}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.`
            }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    });

    let extractedData = {};
    try {
      let responseText = result.text.trim();
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      extractedData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Error parsing AI response:', parseErr);
      console.error('Raw response:', result.text);
      return res.json({
        message: 'Resume parsing failed',
        resumeFileName: user.resumeFileName,
        extractedData: null
      });
    }

    res.json({
      message: 'Resume parsed successfully',
      resumeFileName: user.resumeFileName,
      extractedData
    });
  } catch (error) {
    console.error('Parse existing resume error:', error);
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
      githubUrl,
      portfolioUrl,
      roleType
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
    user.portfolioUrl = portfolioUrl || '';
    user.roleType = roleType || '';
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
      portfolioUrl: user.portfolioUrl,
      roleType: user.roleType,
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
