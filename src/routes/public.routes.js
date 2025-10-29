const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// Para o site exibir posts
// ============================================

// Listar posts PUBLICADOS (para o blog público)
router.get('/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    // Filtro: apenas posts PUBLICADOS
    const where = {
      status: 'PUBLISHED'
    };

    // Busca por título ou conteúdo (opcional)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          excerpt: true,
          coverImage: true,
          slug: true,
          publishedAt: true,
          createdAt: true,
          author: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.post.count({ where })
    ]);

    res.json({
      posts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar posts públicos:', error);
    res.status(500).json({ error: 'Erro ao listar posts' });
  }
});

// Buscar post PUBLICADO por slug (para página individual)
router.get('/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await prisma.post.findFirst({
      where: { 
        slug,
        status: 'PUBLISHED' // Apenas publicados
      },
      select: {
        id: true,
        title: true,
        content: true,
        slug: true,
        publishedAt: true,
        createdAt: true,
        author: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    res.json({ post });
  } catch (error) {
    console.error('Erro ao buscar post público:', error);
    res.status(500).json({ error: 'Erro ao buscar post' });
  }
});

// Posts recentes (para sidebar, destaques, etc)
router.get('/posts/recent/:limit', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 5;

    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      take: limit,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true
      }
    });

    res.json({ posts });
  } catch (error) {
    console.error('Erro ao buscar posts recentes:', error);
    res.status(500).json({ error: 'Erro ao buscar posts' });
  }
});

module.exports = router;