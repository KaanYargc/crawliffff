// Safely import better-sqlite3 with build-time detection
let Database: any;
try {
  // Check if we're in a Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Try to import better-sqlite3, but handle any errors
    Database = require('better-sqlite3');
  } else {
    // Create a mock for non-Node environments or if import fails
    Database = class MockDatabase {
      static Database = class {
        constructor() { this.open = false; }
        prepare() { return { run: () => ({}), get: () => null, all: () => [] }; }
        exec() {}
        close() { this.open = false; }
      }
    };
  }
} catch (error) {
  console.warn('SQLite import failed, using mock implementation', error);
  // Create a mock implementation
  Database = class MockDatabase {
    static Database = class {
      constructor() { this.open = false; }
      prepare() { return { run: () => ({}), get: () => null, all: () => [] }; }
      exec() {}
      close() { this.open = false; }
    }
  };
}

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
  private static instance: any = null;
  private static dbPath = join(process.cwd(), 'data', 'crawlify.db');
  private static isBuildTime = process.env.NODE_ENV === 'production' && typeof window === 'undefined' && process.env.NETLIFY;

  static getInstance(): any {
    // Skip DB initialization during build time on Netlify
    if (this.isBuildTime) {
      console.log('Skipping SQLite initialization during build');
      return {
        prepare: () => ({ 
          run: () => ({}), 
          get: () => null, 
          all: () => [] 
        }),
        exec: () => {},
        close: () => {}
      };
    }

    if (!this.instance) {
      try {
        // Ensure data directory exists
        const dataDir = join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        this.instance = new Database(this.dbPath);
      } catch (error) {
        console.error('Failed to initialize SQLite database:', error);
        // Return a mock instance
        return {
          prepare: () => ({ 
            run: () => ({}), 
            get: () => null, 
            all: () => [] 
          }),
          exec: () => {},
          close: () => {}
        };
      }
    }
    return this.instance;
  }

  static init() {
    // Skip initialization during build time
    if (this.isBuildTime) {
      console.log('Skipping database initialization during build');
      return;
    }

    try {
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
    } catch (error) {
      console.error('Error during database initialization:', error);
    }
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