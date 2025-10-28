const { verifyToken } = require('../../utils/jwt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Middleware para verificar se usuário está autenticado
const authenticate = async (req, res, next) => {
  try {
    // Pegar token do header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verificar token
    const decoded = verifyToken(token);
    
    // Buscar usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    // Adicionar usuário ao request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// Middleware para verificar se usuário é ADMIN
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Middleware para verificar se usuário é PUBLISHER ou ADMIN
const isPublisher = (req, res, next) => {
  if (req.user.role !== 'PUBLISHER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado. Apenas publicadores ou administradores.' });
  }
  next();
};

module.exports = {
  authenticate,
  isAdmin,
  isPublisher
};