// src/lib/netlify-auth.ts
import { compare, hash } from 'bcrypt';

// Basit bellek-tabanlı kullanıcı yönetimi
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  created_at: string;
}

// Kullanıcıları bellekte tutacak dizi
const users: User[] = [];

// Varsayılan admin kullanıcısını ekle
async function initNetlifyAuth() {
  // Admin kullanıcısı var mı kontrol et
  const adminExists = users.some(user => user.role === 'admin');

  if (!adminExists) {
    // Admin kullanıcısı oluştur
    const hashedPassword = await hashPassword('admin123');
    users.push({
      id: '1',
      name: 'Admin',
      email: 'admin@crawlify.com',
      password: hashedPassword,
      role: 'admin',
      created_at: new Date().toISOString()
    });
    console.log('Varsayılan admin kullanıcısı oluşturuldu');
  }

  console.log('Netlify auth sistemi başlatıldı');
  return true;
}

// Kullanıcı bulma
export async function findUserByEmail(email: string): Promise<User | undefined> {
  return users.find(user => user.email === email);
}

// Kullanıcı oluşturma
export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  // Kullanıcı zaten var mı kontrol et
  const existingUser = await findUserByEmail(email);
  
  if (existingUser) {
    return null;
  }
  
  // Şifreyi hashle
  const hashedPassword = await hashPassword(password);
  
  // Yeni kullanıcı oluştur
  const newUser: User = {
    id: (users.length + 1).toString(),
    name,
    email,
    password: hashedPassword,
    role: 'user',
    created_at: new Date().toISOString()
  };
  
  // Kullanıcıyı diziye ekle
  users.push(newUser);
  
  return newUser;
}

// Şifreyi doğrula
export async function validatePassword(user: User, password: string): Promise<boolean> {
  return await compare(password, user.password);
}

// Şifreyi hashle
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 10);
}

// Sistemi başlat
initNetlifyAuth();

export { initNetlifyAuth };