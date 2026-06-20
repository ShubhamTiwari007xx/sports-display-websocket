import { WebSocket, WebSocketServer } from "ws"
import { wsArcjet } from "../arcjet.js"

const matchSubscribers = new Map()
const MAX_SUBSCRIPTIONS = 50

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set())
    }

    matchSubscribers.get(matchId).add(socket)
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId)
    if (!subscribers) return

    subscribers.delete(socket)

    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId)
    }
}

function cleanupSubs(socket) {
    for (const matchId of socket.subscriptions ?? []) {
        unsubscribe(matchId, socket)
    }
}

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(payload))
}

function broadcast(wss, payload) {
    const message = JSON.stringify(payload)

    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message)
        }
    }
}



function getMatchId(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return null
    }
    if (typeof value === 'string' && value.trim() === '') {
        return null
    }
    const matchId = Number(value)
    return Number.isInteger(matchId) ? matchId : null
}

function handleMessage(socket, data) {
    let message

    try {
        message = JSON.parse(data.toString())
    } catch {
        sendJson(socket, { type: 'error', message: 'invalid json' })
        return
    }

    if (!message || typeof message !== 'object' || Array.isArray(message)) {
        sendJson(socket, { type: 'error', message: 'invalid message structure' })
        return
    }

    if (typeof message.matchId !== 'string' && typeof message.matchId !== 'number') {
        sendJson(socket, { type: 'error', message: 'invalid or missing matchId' })
        return
    }

    const matchId = getMatchId(message.matchId)
    if (matchId === null) {
        sendJson(socket, { type: 'error', message: 'invalid matchId value' })
        return
    }

    if (message.type === 'subscribe') {
        if (socket.subscriptions.has(matchId)) {
            sendJson(socket, { type: 'error', message: 'already subscribed to this match' })
            return
        }
        if (socket.subscriptions.size >= MAX_SUBSCRIPTIONS) {
            sendJson(socket, { type: 'error', message: 'subscription limit reached' })
            return
        }
        subscribe(matchId, socket)
        socket.subscriptions.add(matchId)
        sendJson(socket, { type: 'subscribed', matchId })
        return
    }

    if (message.type === 'unsubscribe') {
        unsubscribe(matchId, socket)
        socket.subscriptions.delete(matchId)
        sendJson(socket, { type: 'unsubscribed', matchId })
        return
    }

    sendJson(socket, { type: 'error', message: 'unknown message type' })
}

function broadcastMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId)
    if (!subscribers || subscribers.size === 0) return

    const message = JSON.stringify(payload)

    for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message)
        }
    }
}

export function attachServer(server) {
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 1024 * 1024,
    })

    server.on('upgrade', async (req, socket, head) => {
        let pathname
        try {
            const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
            pathname = parsedUrl.pathname
        } catch (err) {
            console.error('WebSocket upgrade URL parsing failed:', err)
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
            socket.destroy()
            return
        }

        if (pathname !== '/ws') {
            socket.destroy()
            return
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req)
                if (decision.isDenied()) {
                    const code = decision.reason.isRateLimit() ? 1013 : 1080
                    const reason = decision.reason.isRateLimit() ? 'rate limited' : 'access denied'

                    socket.write(`HTTP/1.1 403 ${reason}\r\n\r\n`)
                    socket.destroy()
                    return
                }
            } catch (err) {
                console.log('ws connection err', err)
                socket.write('HTTP/1.1 500 server security error\r\n\r\n')
                socket.destroy()
                return
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req)
        })
    })

    wss.on('connection', (socket) => {
        socket.isAlive = true
        socket.subscriptions = new Set()

        
        socket.on('pong', () => {
            socket.isAlive = true
        })
        socket.on('message', (data) => handleMessage(socket, data))
        socket.on('close', () => cleanupSubs(socket))
        socket.on('error', (err) => {
            console.error('WebSocket error:', err)
        })

        sendJson(socket, { type: 'welcome' })
    })

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate()
            ws.isAlive = false
            ws.ping()
        })
    }, 30000)

    wss.on('close', () => clearInterval(interval))

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: 'match_created', data: match })
    }

    function broadcastCommentary(matchId, comment) {
        broadcastMatch(matchId, { type: 'commentary', data: comment })
    }

    return { broadcastMatchCreated, broadcastCommentary }
}