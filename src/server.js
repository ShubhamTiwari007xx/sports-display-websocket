import express from "express"
const app = express()
const port = 8000
app.use(express.json())

app.get('/', (req, res)=>{
    res.send('helloo from express')
})
app.listen(port, ()=>{
    console.log(`server is listening to http://localhost:${port}`)
})