const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err.message);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database successfully!');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📊 Available tables:', tables.rows.map(row => row.table_name));
    client.release();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
};

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};