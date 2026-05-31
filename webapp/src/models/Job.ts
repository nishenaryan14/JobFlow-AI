import mongoose, { Schema, Document, Model } from "mongoose";

export interface IJob extends Document {
  title: string;
  company: string;
  location: string;
  remotePolicy: string;
  salaryRange: string;
  requiredSkills: string[];
  experienceLevel: string;
  description: string;
  applicationUrl: string;
  agenticRelevance: string;
  fitScore: number;
  matchingSkills: string[];
  skillGaps: string[];
  applicationTip: string;
  scrapedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: String,
    remotePolicy: String,
    salaryRange: String,
    requiredSkills: [String],
    experienceLevel: String,
    description: String,
    applicationUrl: String,
    agenticRelevance: String,
    fitScore: { type: Number, default: 0 },
    matchingSkills: [String],
    skillGaps: [String],
    applicationTip: String,
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Enforce uniqueness at DB level — prevents duplicate job entries
JobSchema.index({ title: 1, company: 1 }, { unique: true });

export const Job: Model<IJob> =
  mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);
