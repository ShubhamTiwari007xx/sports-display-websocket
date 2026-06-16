import express, { Router } from "express"
import  matchRouter  from '../routes/matches.js'
const app = express()
const port = 8000
app.use(express.json())

app.get('/', (req, res)=>{
    res.send('helloo from express')
})

app.use('/matches',matchRouter)


app.listen(port, ()=>{
    console.log(`server is listening to http://localhost:${port}`)
})


