-- Supabase SQL Editor'da çalıştırılacak SQL komutları

-- Kullanıcılar tablosunu oluşturan fonksiyon
CREATE OR REPLACE FUNCTION create_users_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Tablo var mı kontrol et
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    -- Kullanıcılar tablosunu oluştur
    CREATE TABLE public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- Yetkilendirme kuralları ekle
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Admin kullanıcıları tüm kayıtlara erişebilir
    CREATE POLICY "Admins can do anything" ON public.users
      USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
      WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
      
    -- Kullanıcılar sadece kendi kayıtlarına erişebilir
    CREATE POLICY "Users can view own data" ON public.users
      USING (auth.uid() = id);
      
    RAISE NOTICE 'Kullanıcılar tablosu oluşturuldu';
  ELSE
    RAISE NOTICE 'Kullanıcılar tablosu zaten var';
  END IF;
END;
$$ LANGUAGE plpgsql;