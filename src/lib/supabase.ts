// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { hash } from 'bcryptjs';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Check if we're in the Netlify build environment
const isNetlifyBuild = process.env.NETLIFY === 'true' && !isBrowser;

// Function to create a complete mock Supabase client
const createMockClient = () => {
  console.log('Creating mock Supabase client for Netlify build');
  
  // Create mock methods that chain properly
  const createChainable = () => {
    const chainMethods = [
      'select', 'insert', 'update', 'delete', 'upsert',
      'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
      'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
      'rangeLt', 'rangeGt', 'rangeGte', 'rangeLte',
      'textSearch', 'filter', 'match', 'not',
      'or', 'and',
      'limit', 'order', 'range',
      'single', 'maybeSingle',
      'csv', 'count'
    ];
    
    // Create a chainable object with all methods returning itself
    const chainable: any = {};
    
    // Add all methods to the chainable object
    chainMethods.forEach(method => {
      chainable[method] = (..._args: any[]) => chainable;
    });
    
    // Add final resolution methods
    chainable.then = (callback: Function) => {
      // Return mock data
      if (callback) {
        callback({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    };
    
    // Add direct execution that returns mock response
    chainable.execute = () => Promise.resolve({ data: [], error: null });
    
    return chainable;
  };
  
  // Create the mock client with comprehensive mocking
  return {
    from: () => createChainable(),
    rpc: () => Promise.resolve({ data: [], error: null }),
    auth: {
      signIn: () => Promise.resolve({ user: null, session: null, error: null }),
      signUp: () => Promise.resolve({ user: null, session: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSessionFromUrl: () => Promise.resolve({ data: { session: null }, error: null }),
      setSession: () => Promise.resolve({ data: { session: null }, error: null }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
      updateUser: () => Promise.resolve({ data: { user: null }, error: null })
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    },
    // Override fetch completely to prevent any network requests
    fetch: () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
      type: 'basic',
      url: '',
      clone: () => ({} as Response)
    } as Response)
  } as any;
};

// Function to safely create Supabase client
const createSafeClient = (url: string | undefined, key: string | undefined) => {
  // If we're in Netlify build environment, always return a mock client
  if (isNetlifyBuild) {
    return createMockClient();
  }
  
  // Regular client creation with validation
  if (!url || !key) {
    console.warn('Supabase URL or key is missing, using placeholders');
  }
  
  try {
    return createClient(
      url || 'https://placeholder-during-build.supabase.co',
      key || 'placeholder-key-during-build',
      {
        // Add global fetch error handling for build environment
        global: {
          fetch: (...args) => {
            // If during build and not explicitly using a mock, log and return mock
            if (isNetlifyBuild) {
              console.log('Intercepted Supabase fetch during build - returning mock response');
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: [] }),
                status: 200
              } as Response);
            }
            // Otherwise use normal fetch
            return fetch(...args);
          }
        }
      }
    );
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    // Always return a mock client if creation fails
    return createMockClient();
  }
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
    // Always skip real initialization during Netlify build
    if (isNetlifyBuild) {
      console.log('Skipping database initialization during build');
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
    if (isNetlifyBuild) {
      console.log('Continuing build despite Supabase error');
      return true;
    }
    return false;
  }
}

// User operations
export async function findUserByEmail(email: string): Promise<User | undefined> {
  try {
    // During Netlify build, return mock data
    if (isNetlifyBuild) {
      return undefined;
    }
    
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