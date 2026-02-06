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

// Log all requests
app.use((req, res, next) => {
  console.log("Received request:", req.method, req.url);
  next();
});

// Health check endpoint
app.get('/update/health', async (req, res) => {
  res.json({ status: 'healthy' });
});

//Test PUT
app.put('/test', (req, res) => {
  res.send('PUT works!');
});

app.put(['/update/api/hints/:id', '/api/hints/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const { question, reply } = req.body;

    if (!question || !reply) {
      return res.status(400).json({
        success: false,
        error: 'Question and reply are required'
      });
    }

    const [result] = await pool.query(
      'UPDATE chatbot_hints SET question = ?, reply = ? WHERE id = ?',
      [question, reply, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Hint not found'
      });
    }

    res.json({
      success: true,
      affectedRows: result.affectedRows,
      message: 'Hint updated successfully'
    });
  } catch (error) {
    console.error('Error updating hint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Create microservice running on port ${PORT}`);
});
