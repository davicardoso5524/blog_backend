const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Função auxiliar para gerar slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens duplicados
    .trim();
};

// Criar novo post (PUBLISHER ou ADMIN)
const createPost = async (req, res) => {
  try {
    const { title, content, excerpt, coverImage } = req.body;
    const authorId = req.user.id;

    // Validações
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    // Validar URL da imagem (se fornecida)
    if (coverImage) {
      try {
        new URL(coverImage);
      } catch (e) {
        return res.status(400).json({ error: 'URL da imagem inválida' });
      }
    }

    // Gerar slug único
    let slug = generateSlug(title);
    const existingSlug = await prisma.post.findUnique({ where: { slug } });
    
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Criar post com status PENDING (aguardando aprovação)
    const post = await prisma.post.create({
      data: {
        title,
        content,
        excerpt: excerpt || null,
        coverImage: coverImage || null,
        slug,
        status: 'PENDING',
        authorId
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    res.status(201).json({
      message: 'Post criado com sucesso e enviado para aprovação',
      post
    });
  } catch (error) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({ error: 'Erro ao criar post' });
  }
};

const listPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let where = {};

    // ============================================
    // 👑 ADMIN: vê todos os posts
    // ============================================
    if (req.user && req.user.role === 'ADMIN') {
      console.log('👑 Admin visualizando todos os posts');
    } 
    // ============================================
    // ✍️ PUBLISHER: vê apenas os próprios posts
    // ============================================
    else if (req.user && req.user.role === 'PUBLISHER') {
      where.authorId = req.user.id;
      console.log('✍️ Publisher visualizando seus posts (todos os status)');
    } 
    // ============================================
    // 👤 VISITANTE: vê apenas posts publicados
    // ============================================
    else {
      where.status = 'PUBLISHED';
      console.log('👤 Visitante visualizando apenas publicados');
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          },
          approver: {
            select: { id: true, name: true }
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
    console.error('❌ Erro ao listar posts:', error);
    res.status(500).json({ error: 'Erro ao listar posts' });
  }
};

// Buscar post por ID
const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    // Verificar permissões
    if (
      req.user.role !== 'ADMIN' && 
      post.authorId !== req.user.id && 
      post.status !== 'PUBLISHED'
    ) {
      return res.status(403).json({ error: 'Sem permissão para visualizar este post' });
    }

    res.json({ post });
  } catch (error) {
    console.error('Erro ao buscar post:', error);
    res.status(500).json({ error: 'Erro ao buscar post' });
  }
};

const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    // Verificar permissões
    if (
      (!req.user || req.user.role !== 'ADMIN') && // não logado ou não admin
      post.status !== 'PUBLISHED' &&             // post não publicado
      (!req.user || post.authorId !== req.user.id) // não é autor logado
    ) {
      return res.status(403).json({ error: 'Sem permissão para visualizar este post' });
    }
    res.json({ post });
  } catch (error) {
    console.error('Erro ao buscar post:', error);
    res.status(500).json({ error: 'Erro ao buscar post' });
  }
};

// Atualizar post (PUBLISHER só pode editar próprios posts em DRAFT ou REJECTED)
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    // Verificar permissões
    if (req.user.role !== 'ADMIN' && post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Sem permissão para editar este post' });
    }

    // PUBLISHER só pode editar DRAFT ou REJECTED
    if (
      req.user.role !== 'ADMIN' && 
      !['DRAFT', 'REJECTED'].includes(post.status)
    ) {
      return res.status(403).json({ 
        error: 'Você só pode editar posts em rascunho ou rejeitados' 
      });
    }

    // Atualizar
    const updatedData = {};
    if (title) {
      updatedData.title = title;
      updatedData.slug = generateSlug(title);
    }
    if (content) updatedData.content = content;

    const updatedPost = await prisma.post.update({
      where: { id },
      data: updatedData,
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      message: 'Post atualizado com sucesso',
      post: updatedPost
    });
  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    res.status(500).json({ error: 'Erro ao atualizar post' });
  }
};

// Aprovar post (ADMIN)
const approvePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    if (post.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Apenas posts pendentes podem ser aprovados' 
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        approvedBy: req.user.id,
        publishedAt: new Date()
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      message: 'Post aprovado e publicado com sucesso',
      post: updatedPost
    });
  } catch (error) {
    console.error('Erro ao aprovar post:', error);
    res.status(500).json({ error: 'Erro ao aprovar post' });
  }
};

// Rejeitar post (ADMIN)
const rejectPost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    if (post.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Apenas posts pendentes podem ser rejeitados' 
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user.id
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      message: 'Post rejeitado',
      post: updatedPost
    });
  } catch (error) {
    console.error('Erro ao rejeitar post:', error);
    res.status(500).json({ error: 'Erro ao rejeitar post' });
  }
};

// Deletar post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }

    // Verificar permissões
    if (req.user.role !== 'ADMIN' && post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Sem permissão para deletar este post' });
    }

    await prisma.post.delete({ where: { id } });

    res.json({ message: 'Post deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar post:', error);
    res.status(500).json({ error: 'Erro ao deletar post' });
  }
};

module.exports = {
  createPost,
  listPosts,
  getPostById,
  getPostBySlug,
  updatePost,
  approvePost,
  rejectPost,
  deletePost
};