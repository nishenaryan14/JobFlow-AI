import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error No type definitions available for html-to-docx
import HTMLtoDOCX from "html-to-docx";

export async function POST(req: NextRequest) {
  try {
    const { htmlString } = await req.json();

    if (!htmlString) {
      return NextResponse.json(
        { error: "No HTML content provided" },
        { status: 400 }
      );
    }

    const fileBuffer = await HTMLtoDOCX(htmlString, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      margins: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch margins
    });

    return new NextResponse(fileBuffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="optimized_resume.docx"',
      },
    });
  } catch (error: any) {
    console.error("DOCX generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate DOCX" },
      { status: 500 }
    );
  }
}
