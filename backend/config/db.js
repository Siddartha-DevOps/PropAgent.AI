// backend/config/db.js
const mongoose = require("mongoose");
const { Pool } = require("pg");

// MongoDB — for chat sessions
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// PostgreSQL — for properties & analytics (matches your schema.sql)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pgPool
  .connect()
  .then((client) => {
    console.log("✅ PostgreSQL connected");
    client.release();
  })
  .catch((err) => console.error("❌ PostgreSQL connection error:", err.message));

module.exports = { connectMongo, pgPool };