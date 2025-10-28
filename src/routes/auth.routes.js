const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Rotas públicas
router.post('/register', register);
router.post('/login', login);

// Rota privada (exige token)
router.get('/me', authenticate, getMe);

module.exports = router;
