import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import DB from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    // Zorunlu alanları kontrol et
    if (!name || !email || !password) {
      return new NextResponse(
        JSON.stringify({ error: "Name, email, and password are required" }),
        { status: 400 }
      );
    }

    // Email formatını kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400 }
      );
    }

    // Şifre uzunluğunu kontrol et
    if (password.length < 6) {
      return new NextResponse(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400 }
      );
    }

    // Email'in kullanımda olup olmadığını kontrol et
    const existingUser = await DB.get(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUser) {
      return new NextResponse(
        JSON.stringify({ error: "Email already in use" }),
        { status: 400 }
      );
    }

    // Şifreyi hashle
    const hashedPassword = await hash(password, 12);

    // Yeni kullanıcıyı kaydet
    await DB.run(
      `INSERT INTO users (name, email, password, role, package, first_login, package_start_date) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name, email, hashedPassword, 'user', 'free', true]
    );

    return new NextResponse(
      JSON.stringify({ message: "User registered successfully" }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering user:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}