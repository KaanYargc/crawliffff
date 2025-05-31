// This file initializes the SQLite database and creates the necessary directories
import fs from 'fs';
import path from 'path';
import { initDb } from './db';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory');
}

// Initialize the database with tables and default admin user
export async function initDatabase() {
  try {
    initDb(); // This is now synchronous
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Export the init function to be called during startup
export default initDatabase;