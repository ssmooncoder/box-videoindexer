const express = require('express')
const app = express()
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

const { FilesReader } = require("./skills-kit-2.0");
const { SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.0')

const https = require('https')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(awsServerlessExpressMiddleware.eventContext())

app.all('/', (req, res) => {
    console.log(req.body)
    res.send("huehauehuaeh")
    const reader = new FilesReader(req.body);
    // the ID of the file
    const fileId = reader.getFileContext().fileId;
    // the read-only download URL of the file
    const fileURL = reader.getFileContext().fileDownloadURL;

    const writer = new SkillsWriter(reader.getFileContext());
    writer.saveProcessingCard();

    console.log("huehue")
    // res.json(req.apiGateway.event)


    https.get('https://api.videoindexer.ai/Trial/Accounts/83d244e8-13f2-4d39-acfe-dfa51111d4b9/Videos/cb348f55e5/Index', (ms_res) => {
        let data = '';


    // A chunk of data has been recieved.
        ms_res.on('data', (chunk) => {
            data += chunk;
        });

    // The whole ms_resonse has been received. Print out the result.
        ms_res.on('end', () => {
            data = JSON.parse(data);
            console.log(data)
        });

    let entries = [];
    data.forEach(entry => {
        entries.push({
            type: 'text',
            text: entry.keyword
        })
    });
    console.log(entries)
    const card = writer.createTopicsCard(entries);

    // Write the card as metadata to the file
    writer.saveDataCards([card]);

    }).on("error", (err) => {
    console.log("Error: " + err.message);
    });
    res.status(200).send("Event request processed");
})

module.exports = app