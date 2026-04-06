/**
 * blog.js (Routes)
 * -----------------
 * SEO Blog System for PropAgent.AI.
 * Each builder gets their own blog to publish property news, guides,
 * market updates — driving organic traffic to their AI chat widget.
 *
 * FILE: backend/src/routes/blog.js
 * STATUS: NEW
 *
 * PUBLIC routes (no auth):
 *   GET  /api/blog/:builderSlug              List published posts for a builder
 *   GET  /api/blog/:builderSlug/:postSlug    Get single published post
 *   GET  /api/blog/search?q=...&builder=...  Full-text search across posts
 *
 * BUILDER routes (auth required):
 *   POST   /api/blog/posts                  Create a post
 *   GET    /api/blog/posts                  List own posts (all statuses)
 *   GET    /api/blog/posts/:id              Get own post by ID
 *   PATCH  /api/blog/posts/:id             Update a post
 *   DELETE /api/blog/posts/:id             Delete a post
 *   PATCH  /api/blog/posts/:id/publish     Publish / unpublish
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGate');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a post title to a URL-safe slug.
 * E.g. "Top 5 Flats in Hyderabad 2024" → "top-5-flats-in-hyderabad-2024"
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

/**
 * Estimate reading time from markdown content.
 * @param {string} content
 * @returns {number} minutes
 */
function readingTime(content) {
  const words = content.replace(/[#*_\[\]`]/g, '').split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

// ─── PUBLIC: GET /api/blog/:builderSlug ───────────────────────────────────────
/**
 * List published blog posts for a builder.
 * Used by the builder's public-facing website or PropAgent landing page.
 * Supports: page, limit, tag filter.
 */
router.get('/public/:builderId', async (req, res) => {
  const { page = 1, limit = 10, tag } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const params = [req.params.builderId, parseInt(limit), offset];
    let tagFilter = '';

    if (tag) {
      tagFilter = `AND $4 = ANY(tags)`;
      params.push(tag);
    }

    const { rows } = await pool.query(`
      SELECT
        id, title, slug, excerpt, cover_image_url, author_name,
        tags, view_count, published_at, seo_title, seo_description
      FROM blog_posts bp
      JOIN builders b ON b.id = bp.builder_id
      WHERE b.mongo_id = $1 AND bp.status = 'published'
      ${tagFilter}
      ORDER BY published_at DESC
      LIMIT $2 OFFSET $3
    `, params);

    return res.json({ posts: rows, page: parseInt(page) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUBLIC: GET /api/blog/post/:id ──────────────────────────────────────────
/**
 * Get a single published post by ID. Increments view_count.
 */
router.get('/post/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT bp.*, b.brand_name, b.mongo_id AS builder_mongo_id
      FROM blog_posts bp
      JOIN builders b ON b.id = bp.builder_id
      WHERE bp.id = $1 AND bp.status = 'published'
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Post not found.' });

    // Async view count increment (fire and forget)
    pool.query('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);

    const post = rows[0];
    post.reading_time_mins = readingTime(post.content);
    return res.json({ post });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUBLIC: GET /api/blog/search ─────────────────────────────────────────────
/**
 * Full-text search across blog posts.
 * Uses PostgreSQL tsvector index for fast search.
 * Query: /api/blog/search?q=2BHK+Hyderabad&builderId=<mongo_id>
 */
router.get('/search', async (req, res) => {
  const { q, builderId, page = 1, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query (q) is required — min 2 characters.' });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const params = [q, parseInt(limit), offset];
    const builderFilter = builderId
      ? `AND b.mongo_id = $4`
      : '';
    if (builderId) params.push(builderId);

    const { rows } = await pool.query(`
      SELECT
        bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image_url,
        bp.published_at, bp.tags, bp.view_count,
        b.brand_name, b.mongo_id AS builder_id,
        ts_rank(bp.search_vector, plainto_tsquery('english', $1)) AS relevance,
        ts_headline('english', bp.excerpt, plainto_tsquery('english', $1),
          'MaxFragments=2, FragmentDelimiter= "...", StartSel=<mark>, StopSel=</mark>'
        ) AS excerpt_highlighted
      FROM blog_posts bp
      JOIN builders b ON b.id = bp.builder_id
      WHERE bp.status = 'published'
        AND bp.search_vector @@ plainto_tsquery('english', $1)
        ${builderFilter}
      ORDER BY relevance DESC, published_at DESC
      LIMIT $2 OFFSET $3
    `, params);

    return res.json({ results: rows, query: q, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── BUILDER routes — require auth ────────────────────────────────────────────
router.use(authMiddleware);

// ─── POST /api/blog/posts — Create ───────────────────────────────────────────
/**
 * Create a new blog post (starts as draft).
 * Body: { title, content, excerpt?, coverImageUrl?, tags?, seoTitle?, seoDescription?, authorName? }
 */
router.post('/posts', requirePlan('basic'), async (req, res) => {
  const {
    title, content, excerpt, coverImageUrl, tags = [],
    seoTitle, seoDescription, seoKeywords, authorName,
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required.' });
  }

  try {
    const builderRow = await pool.query(
      'SELECT id FROM builders WHERE mongo_id = $1',
      [req.user._id.toString()]
    );

    if (!builderRow.rows.length) {
      return res.status(404).json({ error: 'Builder not found in analytics DB.' });
    }

    const builderId = builderRow.rows[0].id;
    let slug = slugify(title);

    // Ensure unique slug within this builder's posts
    const existing = await pool.query(
      'SELECT COUNT(*) FROM blog_posts WHERE builder_id = $1 AND slug LIKE $2',
      [builderId, `${slug}%`]
    );
    const count = parseInt(existing.rows[0].count);
    if (count > 0) slug = `${slug}-${count + 1}`;

    const { rows } = await pool.query(`
      INSERT INTO blog_posts
        (builder_id, title, slug, content, excerpt, cover_image_url, tags,
         seo_title, seo_description, seo_keywords, author_name, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
      RETURNING id, title, slug, status, created_at
    `, [
      builderId, title, slug, content, excerpt || '',
      coverImageUrl, tags, seoTitle, seoDescription, seoKeywords, authorName,
    ]);

    return res.status(201).json({ post: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/blog/posts — List own posts ─────────────────────────────────────
router.get('/posts', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const statusFilter = status ? 'AND bp.status = $3' : '';
  const params = [req.user._id.toString(), parseInt(limit), offset];
  if (status) params.splice(2, 0, status); // insert at index 2, shift limit/offset

  try {
    const { rows } = await pool.query(`
      SELECT bp.id, bp.title, bp.slug, bp.status, bp.view_count,
             bp.published_at, bp.created_at, bp.tags, bp.excerpt
      FROM blog_posts bp
      JOIN builders b ON b.id = bp.builder_id
      WHERE b.mongo_id = $1 ${statusFilter}
      ORDER BY bp.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return res.json({ posts: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/blog/posts/:id — Update ──────────────────────────────────────
router.patch('/posts/:id', async (req, res) => {
  const fields = ['title', 'content', 'excerpt', 'cover_image_url', 'tags',
                  'seo_title', 'seo_description', 'seo_keywords', 'author_name'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const f of fields) {
    const bodyKey = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[bodyKey] !== undefined || req.body[f] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      values.push(req.body[bodyKey] ?? req.body[f]);
    }
  }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

  values.push(req.params.id, req.user._id.toString());

  try {
    const { rowCount } = await pool.query(`
      UPDATE blog_posts SET ${updates.join(', ')}
      WHERE id = $${idx} AND builder_id = (SELECT id FROM builders WHERE mongo_id = $${idx + 1})
    `, values);

    if (!rowCount) return res.status(404).json({ error: 'Post not found.' });
    return res.json({ message: 'Post updated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/blog/posts/:id/publish — Publish or unpublish ────────────────
router.patch('/posts/:id/publish', async (req, res) => {
  const { publish } = req.body; // true = publish, false = unpublish

  try {
    const { rowCount } = await pool.query(`
      UPDATE blog_posts
      SET status = $1, published_at = $2
      WHERE id = $3 AND builder_id = (SELECT id FROM builders WHERE mongo_id = $4)
    `, [
      publish ? 'published' : 'draft',
      publish ? new Date() : null,
      req.params.id,
      req.user._id.toString(),
    ]);

    if (!rowCount) return res.status(404).json({ error: 'Post not found.' });
    return res.json({ message: publish ? 'Post published!' : 'Post unpublished (set to draft).' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/blog/posts/:id ───────────────────────────────────────────────
router.delete('/posts/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM blog_posts
      WHERE id = $1 AND builder_id = (SELECT id FROM builders WHERE mongo_id = $2)
    `, [req.params.id, req.user._id.toString()]);

    if (!rowCount) return res.status(404).json({ error: 'Post not found.' });
    return res.json({ message: 'Post deleted.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;