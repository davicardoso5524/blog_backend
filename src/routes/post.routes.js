const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { authenticate, isAdmin, isPublisher } = require('../middlewares/auth.middleware');

// Todas as rotas precisam de autenticação
router.use(authenticate);

// Rotas para PUBLISHER e ADMIN
router.get('/', postController.listPosts);
router.post('/', isPublisher, postController.createPost);
router.get('/slug/:slug', postController.getPostBySlug);
router.get('/:id', postController.getPostById);
router.put('/:id', postController.updatePost);
router.delete('/:id', postController.deletePost);

// Rotas apenas para ADMIN
router.patch('/:id/approve', isAdmin, postController.approvePost);
router.patch('/:id/reject', isAdmin, postController.rejectPost);

module.exports = router;