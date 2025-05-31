import Database from 'better-sqlite3';
import { join } from 'path';
import { compare, hash } from 'bcrypt';
import fs from 'fs';

// Define User interface
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
  created_at?: string;
}

// Database path
const dbPath = join(process.cwd(), 'data', 'crawlify.db');

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
export function getDb() {
  return new Database(dbPath);
}

// Initialize database tables
export function initDb() {
  const db = getDb();
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if admin user exists, if not create one
  const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  
  if (!adminUser) {
    // Create default admin user
    const hashedPassword = hashPassword('admin123');
    db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run('Admin', 'admin@crawlify.com', hashedPassword, 'admin');
    console.log('Default admin user created');
  }

  db.close();
  console.log('Database initialized');
}

// Helper function to hash passwords synchronously
function hashPassword(password: string): string {
  // Using a sync version for simplicity in initialization
  return require('bcrypt').hashSync(password, 10);
}

// User authentication methods
export function findUserByEmail(email: string): User | undefined {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  db.close();
  return user;
}

export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  const db = getDb();
  
  // Check if user already exists
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existingUser) {
    db.close();
    return null;
  }
  
  // Hash password
  const hashedPassword = await hash(password, 10);
  
  // Create user
  const stmt = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  );
  
  const info = stmt.run(name, email, hashedPassword, 'user');
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as User;
  db.close();
  
  return user;
}

export async function validatePassword(user: User, password: string): Promise<boolean> {
  return await compare(password, user.password);
}