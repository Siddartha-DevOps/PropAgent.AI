// backend/routes/properties.js
const express = require("express");
const router = express.Router();
const { pgPool } = require("../config/db");

// ─── REMOVED: the hardcoded array of 7 apartments ───

/**
 * GET /api/properties
 * Query params: city, type, minPrice, maxPrice, bedrooms, page, limit
 */
router.get("/", async (req, res) => {
  try {
    const {
      city,
      type,
      minPrice,
      maxPrice,
      bedrooms,
      page = 1,
      limit = 12,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const values = [];
    const conditions = [];

    if (city) {
      values.push(`%${city}%`);
      conditions.push(`city ILIKE $${values.length}`);
    }
    if (type) {
      values.push(type);
      conditions.push(`property_type = $${values.length}`);
    }
    if (minPrice) {
      values.push(parseFloat(minPrice));
      conditions.push(`price >= $${values.length}`);
    }
    if (maxPrice) {
      values.push(parseFloat(maxPrice));
      conditions.push(`price <= $${values.length}`);
    }
    if (bedrooms) {
      values.push(parseInt(bedrooms));
      conditions.push(`bedrooms = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Total count for pagination
    const countQuery = `SELECT COUNT(*) FROM properties ${whereClause}`;
    const countResult = await pgPool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Paginated results
    values.push(parseInt(limit), offset);
    const dataQuery = `
      SELECT
        id, title, description, price, city, locality,
        property_type, bedrooms, bathrooms, area_sqft,
        amenities, images, is_available, created_at
      FROM properties
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;
    const result = await pgPool.query(dataQuery, values);

    return res.json({
      properties: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("GET /properties error:", err);
    return res.status(500).json({ error: "Failed to fetch properties" });
  }
});

/**
 * GET /api/properties/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pgPool.query(
      `SELECT * FROM properties WHERE id = $1 AND is_available = true`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /properties/:id error:", err);
    return res.status(500).json({ error: "Failed to fetch property" });
  }
});

/**
 * POST /api/properties
 * Create a new property listing
 */
router.post("/", async (req, res) => {
  try {
    const {
      title, description, price, city, locality,
      property_type, bedrooms, bathrooms, area_sqft,
      amenities = [], images = [],
    } = req.body;

    const result = await pgPool.query(
      `INSERT INTO properties
        (title, description, price, city, locality, property_type,
         bedrooms, bathrooms, area_sqft, amenities, images, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       RETURNING *`,
      [title, description, price, city, locality, property_type,
       bedrooms, bathrooms, area_sqft, amenities, images]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /properties error:", err);
    return res.status(500).json({ error: "Failed to create property" });
  }
});

/**
 * PATCH /api/properties/:id
 */
router.patch("/:id", async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    values.push(req.params.id);

    const result = await pgPool.query(
      `UPDATE properties SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /properties/:id error:", err);
    return res.status(500).json({ error: "Failed to update property" });
  }
});

/**
 * DELETE /api/properties/:id  (soft delete)
 */
router.delete("/:id", async (req, res) => {
  try {
    const result = await pgPool.query(
      `UPDATE properties SET is_available = false, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }
    return res.json({ message: "Property removed", id: result.rows[0].id });
  } catch (err) {
    console.error("DELETE /properties/:id error:", err);
    return res.status(500).json({ error: "Failed to delete property" });
  }
});

module.exports = router;