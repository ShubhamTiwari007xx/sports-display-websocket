import { z } from 'zod';

// Schema for listing commentary with optional limit query parameter
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for creating a new commentary entry
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int().nonnegative(),
  period: z.string().trim().min(1, 'Period cannot be empty'),
  eventType: z.string().trim().min(1, 'Event type cannot be empty'),
  actor: z.string().trim().min(1, 'Actor cannot be empty'),
  team: z.string().trim().min(1, 'Team cannot be empty'),
  message: z.string().trim().min(1, 'Message is required'),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()),
});
