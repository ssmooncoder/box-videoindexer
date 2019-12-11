const express = require('express')
const app = express()
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const https = require('https');
app.use(awsServerlessExpressMiddleware.eventContext())
app.all('/', (req, res) => {
    console.log("huehue")
    res.json(req.apiGateway.event)


    https.get('https://api.videoindexer.ai/Trial/Accounts/83d244e8-13f2-4d39-acfe-dfa51111d4b9/Videos/cb348f55e5/Index', (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
        console.log(JSON.parse(data));
    });

    }).on("error", (err) => {
    console.log("Error: " + err.message);
    });
})

module.exports = app