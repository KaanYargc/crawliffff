import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";

// Add OPTIONS method to handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    // Log the request headers for debugging
    console.log("Request headers:", Object.fromEntries([...new Headers(req.headers)]));
    
    // Parse request body
    const rawBody = await req.text();
    console.log("Incoming request body:", rawBody);

    if (!rawBody || rawBody.trim() === "") {
      return NextResponse.json({
        message: "Request body is empty or invalid",
        success: false,
        error: "Empty or invalid request body",
      }, { status: 400 });
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (parseError) {
      return NextResponse.json({
        message: "Invalid JSON format",
        success: false,
        error: "Invalid JSON format",
      }, { status: 400 });
    }

    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({
        message: "Unauthorized",
        success: false,
        error: "No authenticated user found",
      }, { status: 401 });
    }

    // Validate package ID
    const { packageId } = parsedBody;
    if (!packageId) {
      return NextResponse.json({
        message: "Package ID is required",
        success: false,
        error: "Missing package ID",
      }, { status: 400 });
    }

    // Check valid package
    const validPackages = ['free', 'pro', 'enterprise'];
    if (!validPackages.includes(packageId)) {
      return NextResponse.json({
        message: "Invalid package",
        success: false,
        error: `Package '${packageId}' is not valid`,
      }, { status: 400 });
    }

    // Get user before update to confirm they exist
    const userBeforeUpdate = await db.get(
      'SELECT * FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!userBeforeUpdate) {
      return NextResponse.json({
        message: "User not found",
        success: false,
        error: "User does not exist in database",
      }, { status: 404 });
    }

    console.log("Found user:", userBeforeUpdate);
    console.log("Attempting to update package to:", packageId);

    // Always update the package in the database, even if it's the same as the current one
    // This ensures the selection is always recorded in the database
    try {
      // Check if the users table has the necessary columns
      const tableInfo = await db.all("PRAGMA table_info(users)");
      console.log("Table schema:", tableInfo);
      
      // Map column names to lowercase for case-insensitive comparison
      const columnNames = tableInfo.map((col: any) => col.name.toLowerCase());
      console.log("Available columns:", columnNames);
      
      // Check for package column
      const hasPackageColumn = columnNames.includes('package');
      if (!hasPackageColumn) {
        console.log("Adding package column to users table");
        await db.run(`ALTER TABLE users ADD COLUMN package TEXT DEFAULT 'free' NOT NULL`);
        console.log("Package column added successfully");
      }
      
      // Check for first_login column
      const hasFirstLoginColumn = columnNames.includes('first_login');
      if (!hasFirstLoginColumn) {
        console.log("Adding first_login column to users table");
        await db.run(`ALTER TABLE users ADD COLUMN first_login BOOLEAN DEFAULT true NOT NULL`);
        console.log("first_login column added successfully");
      }
      
      // Always update user with selected package
      console.log(`Updating user ${session.user.email} with package ${packageId}`);
      const result = await db.run(
        `UPDATE users 
         SET package = ?, 
             first_login = 0
         WHERE email = ?`,
        [packageId, session.user.email]
      );
      
      if (result.changes === 0) {
        console.error("Database update failed: No rows affected");
        return NextResponse.json({
          message: "Failed to update user package",
          success: false,
          error: "Database update did not affect any rows"
        }, { status: 500 });
      } else {
        console.log(`Successfully updated ${result.changes} user record(s)`);
      }
      
      console.log("Update result:", result);
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      return NextResponse.json({
        message: "Failed to update user package",
        success: false,
        error: dbError?.message || "Database operation failed",
        details: dbError
      }, { status: 500 });
    }

    // Get updated user data to confirm changes
    const updatedUser = await db.get(
      'SELECT * FROM users WHERE email = ?',
      [session.user.email]
    );

    if (!updatedUser) {
      return NextResponse.json({
        message: "Failed to retrieve updated user data",
        success: false,
        error: "User not found after update"
      }, { status: 500 });
    }

    // Create a safe version of user data to return (without password)
    const safeUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      package: updatedUser.package || packageId,
      first_login: updatedUser.first_login === 1 ? true : false
    };
    
    console.log("Package updated successfully for user:", safeUser);

    return NextResponse.json({
      message: "Package selected successfully",
      success: true,
      user: safeUser
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing package selection:", error);
    return NextResponse.json({
      message: "Internal Server Error",
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}