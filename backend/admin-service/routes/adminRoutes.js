/**
 * adminRoutes.js
 * Purpose: Route definitions for admin endpoints.
 */
const express = require('express');
const router = express.Router();
const { createEvent } = require('../controllers/adminController');

// RESTful: POST /api/admin/events  (rubric)
router.post('/events', createEvent);

module.exports = router;
