const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { authenticate, isAdmin, isPublisher } = require('../middlewares/auth.middleware');

// 🔒 Rotas públicas
router.get('/slug/:slug', postController.getPostBySlug);

// 🧠 Rotas que identificam usuário (precisam do token)
router.use(authenticate);

// 👥 Listagem dinâmica: depende do papel do usuário
router.get('/', postController.listPosts);

// ✍️ Rotas para PUBLISHER e ADMIN
router.post('/', isPublisher, postController.createPost);
router.get('/:id', postController.getPostById);
router.put('/:id', postController.updatePost);
router.delete('/:id', postController.deletePost);

// 👑 Rotas apenas para ADMIN
router.patch('/:id/approve', isAdmin, postController.approvePost);
router.patch('/:id/reject', isAdmin, postController.rejectPost);

module.exports = router;