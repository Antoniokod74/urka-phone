const express = require('express');
const router = express.Router();

// Временные роуты без БД
router.get('/', (req, res) => {
  res.json({ 
    message: 'Get all users endpoint - will be implemented with DB',
    status: 'TODO'
  });
});

router.get('/:id', (req, res) => {
  res.json({ 
    message: `Get user by ID ${req.params.id} - will be implemented with DB`,
    status: 'TODO'
  });
});

router.put('/:id/stats', (req, res) => {
  res.json({ 
    message: `Update user stats ${req.params.id} - will be implemented with DB`,
    status: 'TODO'
  });
});

module.exports = router;