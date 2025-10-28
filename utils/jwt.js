const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Gerar token
const generateToken = (id, email, role) => {
  return jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '1d' });
};

// Verificar token
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
