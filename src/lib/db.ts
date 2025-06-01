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
  package?: string;
  first_login?: boolean;
  created_at?: string;
}

class DB {
  private static instance: Database.Database | null = null;
  private static dbPath = join(process.cwd(), 'data', 'crawlify.db');

  static getInstance(): Database.Database {
    if (!this.instance) {
      // Ensure data directory exists
      const dataDir = join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.instance = new Database(this.dbPath);
    }
    return this.instance;
  }

  static init() {
    const db = this.getInstance();
    
    // Create users table with new package-related fields
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        package TEXT NOT NULL DEFAULT 'free',
        first_login BOOLEAN NOT NULL DEFAULT true,
        package_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        package_end_date TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if admin user exists, if not create one
    const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
    
    if (!adminUser) {
      // Create default admin user
      const hashedPassword = this.hashPassword('admin123');
      db.prepare(
        'INSERT INTO users (name, email, password, role, first_login) VALUES (?, ?, ?, ?, ?)'
      ).run('Admin', 'admin@crawlify.com', hashedPassword, 'admin', false);
      console.log('Default admin user created');
    }

    console.log('Database initialized');
  }

  static async get(query: string, params?: any[]): Promise<any> {
    const db = this.getInstance();
    return db.prepare(query).get(...(params || []));
  }

  static async all(query: string, params?: any[]): Promise<any[]> {
    const db = this.getInstance();
    return db.prepare(query).all(...(params || []));
  }

  static async run(query: string, params?: any[]): Promise<Database.RunResult> {
    const db = this.getInstance();
    return db.prepare(query).run(...(params || []));
  }

  static close() {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }

  private static hashPassword(password: string): string {
    return require('bcrypt').hashSync(password, 10);
  }

  static async createUser(name: string, email: string, password: string): Promise<User | null> {
    // Check if user already exists
    const existingUser = await this.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return null;
    }
    
    // Hash password
    const hashedPassword = await hash(password, 10);
    
    // Create user
    const info = await this.run(
      'INSERT INTO users (name, email, password, role, package, first_login) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'user', 'free', true]
    );
    
    return this.get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);
  }

  static async validatePassword(user: User, password: string): Promise<boolean> {
    return await compare(password, user.password);
  }

  static async findUserByEmail(email: string): Promise<User | undefined> {
    return this.get('SELECT * FROM users WHERE email = ?', [email]);
  }
}

export default DB;