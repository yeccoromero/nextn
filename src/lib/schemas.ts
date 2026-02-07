import { z } from 'zod';

/**
 * Zod schemas for validating Firestore data
 */

export const ProjectSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Project name cannot be empty"),
    ownerId: z.string(),
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
    schemaVersion: z.number().default(1),
});

export const MemberSchema = z.object({
    role: z.enum(['owner', 'editor', 'viewer']),
});

export const ProjectDocSchema = z.object({
    id: z.string(),
    data: z.record(z.any()), // Document data can be any shape
    createdAt: z.any(),
    updatedAt: z.any(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type ProjectDoc = z.infer<typeof ProjectDocSchema>;
