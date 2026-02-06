const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Environment Variables (from Kubernetes)
const PORT = process.env.PORT || 3000;

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

// Confirm DB connection on startup
pool.query('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed:', err.message));

// Health check
app.get('/delete/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// DELETE endpoint
app.delete('/delete/api/hints/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[DELETE] Request received for ID: ${id}');

    if (!Number.isInteger(+id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format, must be an integer'
      });
    }

    const [result] = await pool.query(
      'DELETE FROM chatbot_hints WHERE id = ?',
      [id]
    );

    console.log("[DELETE] DB result:", result);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Hint not found'
      });
    }

    res.json({
      success: true,
      message: 'Hint deleted successfully',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error deleting hint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('Delete microservice running on port ${PORT}');
});
