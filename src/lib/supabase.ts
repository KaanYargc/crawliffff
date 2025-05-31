// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini oluştur
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Servis rolü ile istemci oluştur (yetki gerektiren işlemler için)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Kullanıcı tablosu tipleri
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  created_at?: string;
}

// Veritabanı şemasını başlat
export async function initSupabase() {
  try {
    // Kullanıcılar tablosunu oluştur (eğer yoksa)
    const { error } = await supabaseAdmin.rpc('create_users_table_if_not_exists');
    
    if (error && !error.message.includes('already exists')) {
      console.error('Kullanıcılar tablosu oluşturulurken hata:', error);
      throw error;
    }
    
    // Admin kullanıcısı var mı kontrol et
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .single();
    
    // Admin kullanıcısı yoksa oluştur
    if (!adminUser) {
      const { error: adminError } = await supabaseAdmin.from('users').insert({
        name: 'Admin',
        email: 'admin@crawlify.com',
        password: await hashPassword('admin123'), // Bu fonksiyon oluşturulacak
        role: 'admin'
      });
      
      if (adminError) {
        console.error('Admin kullanıcısı oluşturulurken hata:', adminError);
        throw adminError;
      }
      
      console.log('Varsayılan admin kullanıcısı oluşturuldu');
    }
    
    console.log('Supabase veritabanı başlatıldı');
    return true;
  } catch (error) {
    console.error('Supabase veritabanı başlatılırken hata:', error);
    return false;
  }
}

// Kullanıcı işlemleri
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error) {
    console.error('Kullanıcı aranırken hata:', error);
    return undefined;
  }
  
  return data as User;
}

export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  // Kullanıcı zaten var mı kontrol et
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return null;
  }
  
  // Şifreyi hashle
  const hashedPassword = await hashPassword(password);
  
  // Kullanıcıyı oluştur
  const { data, error } = await supabaseAdmin.from('users').insert({
    name,
    email,
    password: hashedPassword,
    role: 'user'
  }).select().single();
  
  if (error) {
    console.error('Kullanıcı oluşturulurken hata:', error);
    return null;
  }
  
  return data as User;
}

export async function validatePassword(user: User, password: string): Promise<boolean> {
  const { compare } = await import('bcrypt');
  return await compare(password, user.password);
}

export async function hashPassword(password: string): Promise<string> {
  const { hash } = await import('bcrypt');
  return await hash(password, 10);
}