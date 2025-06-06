-- Supabase SQL Editor'da çalıştırılacak SQL komutları

-- Kullanıcılar tablosunu oluştur
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

-- Yetkilendirme kuralları ekle
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Var olan politikaları kaldır
DROP POLICY IF EXISTS "Admins can do anything" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Politika oluştur
CREATE POLICY "Admins can do anything" ON public.users
  FOR ALL
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT
  USING (id::text = auth.uid()::text OR role = 'admin');

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  USING (id::text = auth.uid()::text OR role = 'admin')
  WITH CHECK (id::text = auth.uid()::text OR role = 'admin');

-- Varsayılan admin kullanıcısını ekle
INSERT INTO public.users (name, email, password, role, first_login, package)
SELECT 
  'Admin',
  'admin@crawlify.com',
  crypt('admin123', gen_salt('bf')),
  'admin',
  false,
  'enterprise'
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE email = 'admin@crawlify.com'
);