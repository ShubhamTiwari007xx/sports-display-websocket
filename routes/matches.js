import express from 'express';
import { Router } from 'express'
import { createMatchSchema, listMatchesQuerySchema } from '../src/validation/matches.js'
import { db } from '../src/db.js'
import { matches } from '../src/schema.js'
import { getMatchStatus } from '../src/utils/match-status.js'
import { desc } from 'drizzle-orm'

const matchRouter = Router()
const Max_LIMIT = 100

matchRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query)

    if (!parsed.success) {
        return res.status(400).json({ err: 'invalid', details: parsed.error.issues })
    }

    const limit = Math.min(parsed.data.limit ?? 50, Max_LIMIT)

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy(desc(matches.createdAt))
            .limit(limit)

        res.json({ data })
    } catch (err) {
        console.error(err)
        res.status(500).json({ err: 'failed' })
    }
})

matchRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body)

    console.log('body:', req.body)
    console.log('parsed:', parsed)

    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues })
    }

    const { data: { startTime, endTime, homeScore, awayScore } } = parsed

    try {
        const [event] = await db
            .insert(matches)
            .values({
                ...parsed.data,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                homeScore: homeScore ?? 0,
                awayScore: awayScore ?? 0,
                status: getMatchStatus(startTime, endTime)
            })
            .returning()
            
        res.status(201).json({ data: event })

               if (res.app.locals.broadcastMatchCreated) {
            try {
               res.app.locals.broadcastMatchCreated(event)
            } catch (broadcastErr) {
                console.error('broadcast failed:', broadcastErr)
            }
        }
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'internal server error' })
    }
})

export default matchRouter