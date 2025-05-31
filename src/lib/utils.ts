import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function isAuthorized(req: NextRequest, adminOnly = false) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "crawlify-nextauth-secret",
  });

  if (!token) {
    return false;
  }

  // If adminOnly is true, check if user is admin
  if (adminOnly && token.role !== "admin") {
    return false;
  }

  return true;
}
