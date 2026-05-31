import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Application } from "@/models/Application";

// GET: fetch all applications
export async function GET() {
  try {
    await connectDB();
    const applications = await Application.find().sort({ updatedAt: -1 });
    return NextResponse.json({ applications });
  } catch (err: any) {
    console.error("Applications fetch error:", err);
    return NextResponse.json({ applications: [] });
  }
}

// POST: create a new application
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, jobTitle, company, status, atsScore } = body;

    if (!jobTitle || !company) {
      return NextResponse.json(
        { error: "Job title and company required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check for duplicate
    const existing = await Application.findOne({ jobId });
    if (existing) {
      return NextResponse.json({ application: existing });
    }

    const application = await Application.create({
      jobId: jobId || `job_${Date.now()}`,
      jobTitle,
      company,
      status: status || "interested",
      atsScore,
      appliedAt: status === "applied" ? new Date() : undefined,
      statusHistory: [
        {
          status: status || "interested",
          changedAt: new Date(),
        },
      ],
    });

    return NextResponse.json({ application });
  } catch (err: any) {
    console.error("Application create error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create application" },
      { status: 500 }
    );
  }
}

// PATCH: update application status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, note } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "Application ID and status required" },
        { status: 400 }
      );
    }

    await connectDB();

    const application = await Application.findByIdAndUpdate(
      id,
      {
        status,
        ...(status === "applied" && { appliedAt: new Date() }),
        $push: {
          statusHistory: {
            status,
            changedAt: new Date(),
            note,
          },
        },
      },
      { new: true }
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ application });
  } catch (err: any) {
    console.error("Application update error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update application" },
      { status: 500 }
    );
  }
}

// DELETE: remove an application
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Application ID required" },
        { status: 400 }
      );
    }

    await connectDB();
    await Application.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Application delete error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete application" },
      { status: 500 }
    );
  }
}
