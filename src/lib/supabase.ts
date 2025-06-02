// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { hash } from 'bcryptjs';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Function to safely create Supabase client
const createSafeClient = (url: string | undefined, key: string | undefined) => {
  // If URL or key is missing and we're in a server environment during build
  if ((!url || !key) && !isBrowser && process.env.NODE_ENV === 'production') {
    // Return a mock client for build time
    return {
      from: () => ({
        select: () => ({ data: null, error: null }),
        insert: () => ({ data: null, error: null }),
        eq: () => ({ data: null, error: null }),
        single: () => ({ data: null, error: null }),
        limit: () => ({ data: null, error: null })
      }),
      auth: {
        signIn: () => Promise.resolve({ user: null, error: null }),
        signOut: () => Promise.resolve({ error: null })
      }
    } as any;
  }
  
  // Regular client creation
  return createClient(
    url || 'https://placeholder-during-build.supabase.co',
    key || 'placeholder-key-during-build'
  );
};

// Create Supabase client
export const supabase = createSafeClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Create admin client with service role
export const supabaseAdmin = createSafeClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// User table types
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  package: string;
  first_login: boolean;
  package_start_date?: Date;
  package_end_date?: Date | null;
  created_at?: string;
}

// Initialize database connection
export async function initSupabase() {
  try {
    // Skip initialization during build time
    if (process.env.NODE_ENV === 'production' && !isBrowser && 
        (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      console.log('Skipping Supabase initialization during build');
      return true;
    }
    
    // Simple health check using raw query
    const { error } = await supabaseAdmin.from('users').select('count').limit(0);
    
    if (error && error.code !== '42P01') { // Ignore table not found error
      console.error('Error connecting to Supabase:', error);
      return false;
    }

    console.log('Supabase connection verified');
    return true;
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    // Don't fail during build
    if (process.env.NODE_ENV === 'production' && !isBrowser) {
      console.log('Continuing build despite Supabase error');
      return true;
    }
    return false;
  }
}

// User operations
export async function findUserByEmail(email: string): Promise<User | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      // Handle "no rows" case gracefully
      if (error.code === 'PGRST116') {
        return undefined;
      }
      console.error('Error finding user:', error);
      return undefined;
    }

    return data as User;
  } catch (error) {
    console.error('Error in findUserByEmail:', error);
    return undefined;
  }
}

export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  try {
    // Check if user exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return null;
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        role: 'user',
        package: 'free',
        first_login: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    return data as User;
  } catch (error) {
    console.error('Error in createUser:', error);
    return null;
  }
}

export async function validatePassword(user: User, password: string): Promise<boolean> {
  try {
    const { compare } = await import('bcryptjs');
    return await compare(password, user.password);
  } catch (error) {
    console.error('Error validating password:', error);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 10);
}