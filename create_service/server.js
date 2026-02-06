const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// MariaDB connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection on startup
pool.query('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed:', err.message));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'create' });
});

// CREATE - Add new chatbot hint
app.post('/create', async (req, res) => {
  try {
    const { question, reply } = req.body;

    // Validate input
    if (!question || !reply) {
      return res.status(400).json({
        success: false,
        error: 'Both question and reply are required'
      });
    }

    // Validate field lengths (based on your table schema)
    if (question.length > 100 || reply.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Question and reply must be 100 characters or less'
      });
    }

    // Insert into database
    const [result] = await pool.query(
      'INSERT INTO chatbot_hints (question, reply) VALUES (?, ?)',
      [question, reply]
    );

    console.log(`Created hint: ID=${result.insertId}, Question="${question}"`);

    res.status(201).json({
      success: true,
      insertId: result.insertId,
      message: 'Chatbot hint created successfully',
      data: {
        id: result.insertId,
        question: question,
        reply: reply
      }
    });
  } catch (error) {
    console.error('Error creating hint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Create microservice running on port ${PORT}`);
});
