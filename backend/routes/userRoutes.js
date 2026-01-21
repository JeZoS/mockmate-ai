const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  uploadResume,
  deleteResume,
  completeProfileSetup
} = require('../controllers/userController');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, DOC, DOCX
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'), false);
    }
  }
});

// Routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/profile/complete', protect, completeProfileSetup);
router.post('/resume', protect, upload.single('resume'), uploadResume);
router.delete('/resume', protect, deleteResume);

module.exports = router;
