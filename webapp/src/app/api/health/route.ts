import { NextResponse } from "next/server";

export async function GET() {
  const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
  let fastapiOk = false;

  try {
    const res = await fetch(`${fastapiUrl}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      fastapiOk = data.status === "ok";
    }
  } catch {
    fastapiOk = false;
  }

  return NextResponse.json({
    status: "ok",
    fastapi: fastapiOk,
    fastapiUrl,
    timestamp: new Date().toISOString(),
  });
}
