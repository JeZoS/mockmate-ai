const express = require("express");
const router = express.Router();
const {
  chatStream,
  generateFeedback,
  generateSpeechStream,
  analyzeResume,
  generateSpeechGemini,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

// Public or Protected? Protected usually, but for demo we can leave public or wrap with protect.
// For security, strictly speaking, should be protected.
router.post("/chat", protect, chatStream);
router.post("/feedback", protect, generateFeedback);
router.post("/tts", protect, generateSpeechStream);
router.post("/analyze-resume", protect, analyzeResume);
router.post("/tts-gemini-backup", protect, generateSpeechGemini);

module.exports = router;
