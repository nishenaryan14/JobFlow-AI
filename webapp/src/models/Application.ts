import mongoose, { Schema, Document, Model } from "mongoose";

export interface IApplication extends Document {
  jobId: string;
  jobTitle: string;
  company: string;
  status: "interested" | "applied" | "interview" | "offer" | "rejected";
  atsScore?: number;
  enhancedResume?: string;
  appliedAt?: Date;
  notes: string;
  statusHistory: {
    status: string;
    changedAt: Date;
    note?: string;
  }[];
}

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: { type: String, required: true },
    jobTitle: { type: String, required: true },
    company: { type: String, required: true },
    status: {
      type: String,
      enum: ["interested", "applied", "interview", "offer", "rejected"],
      default: "interested",
    },
    atsScore: Number,
    enhancedResume: String,
    appliedAt: Date,
    notes: { type: String, default: "" },
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

export const Application: Model<IApplication> =
  mongoose.models.Application ||
  mongoose.model<IApplication>("Application", ApplicationSchema);
