const express = require('express')
const app = express()
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
app.use(awsServerlessExpressMiddleware.eventContext())
app.all('/', (req, res) => {
    console.log("huehue")
    res.json(req.apiGateway.event)
})

module.exports = app