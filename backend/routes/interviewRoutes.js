const express = require('express');
const router = express.Router();
const { 
  createInterview, 
  getMyInterviews, 
  getInterview, 
  updateInterview, 
  deleteInterview 
} = require('../controllers/interviewController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createInterview);
router.get('/', protect, getMyInterviews);
router.get('/:id', protect, getInterview);
router.put('/:id', protect, updateInterview);
router.delete('/:id', protect, deleteInterview);

module.exports = router;