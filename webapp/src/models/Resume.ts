import mongoose, { Schema, Document, Model } from "mongoose";

export interface IResume extends Document {
  fileName: string;
  rawText: string;
  parsedData: {
    name: string;
    email: string;
    phone: string;
    skills: string[];
    strongSkills: string[];
    experience: { title: string; company: string; duration: string }[];
    education: string[];
    projects: string[];
  };
  analysis: {
    strengths: string[];
    weaknesses: string[];
    overallScore: number;
    summary: string;
  };
  uploadedAt: Date;
  updatedAt: Date;
}

const ResumeSchema = new Schema<IResume>(
  {
    fileName: { type: String, required: true },
    rawText: { type: String, required: true },
    parsedData: {
      name: String,
      email: String,
      phone: String,
      skills: [String],
      strongSkills: [String],
      experience: [
        {
          title: String,
          company: String,
          duration: String,
        },
      ],
      education: [String],
      projects: [String],
    },
    analysis: {
      strengths: [String],
      weaknesses: [String],
      overallScore: Number,
      summary: String,
    },
  },
  { timestamps: true }
);

export const Resume: Model<IResume> =
  mongoose.models.Resume || mongoose.model<IResume>("Resume", ResumeSchema);
