import { WebSocket, WebSocketServer } from "ws"
import { wsArcjet } from "../src/arcjet.js";
function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) return // also see note below!
        client.send(JSON.stringify(payload));
    }
}

export function attachServer(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024,
    })

    wss.on('connection',async (socket) => {
        if(Arcjet){
            try{
                const decision = await Arcjet.protect(req);
                if(decision.isDenied()){
                    const code = decision.reason.isRateLimit() ? 1013 : 1080;
                    const reason = decision.reason.isRateLimit() ? 'rate limited' : 'access denied'

                    socket.close(code,reason);
                    return
                }

            }catch(e){
                console.log('ws connection err', e)
                socket.close(1011, 'server security error')
            }
        }
        socket.isAlive = true;
        socket.on('pong', ()=>{ socket.isAlive = true;})
        sendJson(socket, { type: "welcome" })

        socket.on('error', console.error)
    })

   const interval = setInterval(() => {
      wss.clients.forEach((ws)=>{
        if(ws.isAlive === false ) return ws.terminate()
            ws.isAlive = false;
            ws.ping()
      });
   }, 30000);   

   wss.on('close', ()=> clearInterval(interval)) 

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: 'match_created', data: match })
    }

    return { broadcastMatchCreated }
}