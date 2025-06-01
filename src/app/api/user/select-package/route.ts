import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { packageId } = await req.json();
    if (!packageId) {
      return new NextResponse("Package ID is required", { status: 400 });
    }

    // Geçerli paket kontolü
    const validPackages = ['free', 'pro', 'enterprise'];
    if (!validPackages.includes(packageId)) {
      return new NextResponse("Invalid package", { status: 400 });
    }

    // Kullanıcının paketini ve first_login durumunu güncelle
    await db.run(
      `UPDATE users 
       SET package = ?, 
           first_login = false,
           package_start_date = CURRENT_TIMESTAMP,
           package_end_date = CASE 
             WHEN ? = 'free' THEN NULL 
             ELSE datetime('now', '+30 days')
           END
       WHERE email = ?`,
      [packageId, packageId, session.user.email]
    );

    return new NextResponse("Package selected successfully", { status: 200 });
  } catch (error) {
    console.error("Error selecting package:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}