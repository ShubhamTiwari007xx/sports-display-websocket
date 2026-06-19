import express from 'express';
import { Router } from 'express';
import { db } from '../src/db.js';
import { commentary, commentary as commentaryTable } from '../src/schema.js';
import { matchIdParamSchema } from '../src/validation/matches.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../src/validation/commentary.js';
import { desc, eq } from 'drizzle-orm';
const commentaryRouter = express.Router({ mergeParams: true });

const MAX_LIMIT = 100
commentaryRouter.get('/', async (req, res) => {
  const paramResult = matchIdParamSchema.safeParse(req.params);

  if (!paramResult.success) {
    return res.status(400).json({
      error: 'invalid params',
      issues: paramResult.error.issues,
    });
  }

  const queryResult = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({
      error: 'invalid query',
      issues: queryResult.error.issues,
    });
  }

  try {
    const { id: matchId } = paramResult.data;
    const { limit = 10 } = queryResult.data;
    const safeLimit = Math.min(limit, MAX_LIMIT);

    const rows = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(safeLimit);

    res.status(200).json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch commentary' });
  }
});

commentaryRouter.post('/', async (req, res) => {

  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      error: 'invalid params',
      issues: parsedParams.error.issues,
    });
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: 'invalid payload',
      issues: parsedBody.error.issues,
    });
  }
  try {

    const [entry] = await db
      .insert(commentaryTable)
      .values({
        matchId: parsedParams.data.id, // this is the matchId from the URL params
        ...parsedBody.data,
      })

      .returning();

    res.status(201).json({ data: entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default commentaryRouter;
