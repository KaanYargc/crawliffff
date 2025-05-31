import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/utils";

export async function POST(request: NextRequest) {
  // Check if user is authenticated
  const authorized = await isAuthorized(request);
  if (!authorized) {
    return NextResponse.json({ 
      success: false, 
      message: "Yetkisiz erişim. Lütfen giriş yapın." 
    }, { status: 401 });
  }

  try {
    // Parse the request body
    const body = await request.json();
    
    // Log the lead data (in a real application, you would save this to a database)
    console.log("Lead submitted:", body);
    
    // Here you would typically:
    // 1. Validate the data
    // 2. Store it in a database
    // 3. Send an email notification
    // 4. etc.
    
    // For now, we'll just return a success response
    return NextResponse.json({ 
      success: true, 
      message: "Lead başarıyla kaydedildi" 
    }, { status: 201 });
    
  } catch (error) {
    console.error("Error processing lead:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Lead işlenirken bir hata oluştu" 
    }, { status: 500 });
  }
}