-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  package TEXT NOT NULL DEFAULT 'free',
  first_login BOOLEAN NOT NULL DEFAULT true,
  package_start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  package_end_date TIMESTAMP WITH TIME ZONE DEFAULT null,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can do anything" ON public.users
  FOR ALL
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT
  USING (auth.uid()::text = id::text OR role = 'admin');

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  USING (auth.uid()::text = id::text OR role = 'admin')
  WITH CHECK (auth.uid()::text = id::text OR role = 'admin');

-- Insert default admin user if it doesn't exist
INSERT INTO public.users (name, email, password, role, first_login)
SELECT 
  'Admin',
  'admin@crawlify.com',
  crypt('admin123', gen_salt('bf')),
  'admin',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE role = 'admin'
);