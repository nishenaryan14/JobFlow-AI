import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const apiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${apiUrl}/auto-apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    if (!res.ok) {
        return NextResponse.json({ success: false, error: data.error || "RPA Agent failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("AutoApply proxy error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to trigger auto apply" },
      { status: 500 }
    );
  }
}
