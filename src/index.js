import AgentApi from "apminsight" 
AgentApi.config();

import express, { Router } from "express"
import http from 'http'
import  matchRouter  from '../routes/matches.js'
import { attachServer } from "./ws/file.js"
import { url } from "inspector"
import { securityMiddleware } from "./arcjet.js"
import commentaryRouter from "../routes/commentary.js"
const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 8000
const HOST = process.env.HOST || '0.0.0.0'

app.use(express.json())



app.get('/', (req, res)=>{
    res.send('helloo from express')
});


app.use(securityMiddleware())
app.use('/matches',matchRouter)
app.use('/matches/:id/commentary',commentaryRouter)

const { broadcastMatchCreated, broadcastCommentary } = attachServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated
app.locals.broadcastCommentary = broadcastCommentary

server.listen(PORT,HOST, ()=>{
    const BaseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` :  `http://${HOST}:${PORT}`
    console.log(`server is listening to ${BaseUrl}`)
    console.log( `websocket server is running on ${BaseUrl.replace('http', 'ws')}/ws`)
})



