/**
 * Samuel Moon
 * 
 * Notes:
 * 1. Environment variables are set on the lambda configuration page.
 *    API Gateway URL set on process.env.APIGATEWAY
 * 2. Timeout is set at 15 minutes (can be increased) or need to find
 *    a way to store FileContext object for stateless calls.
 *    One way would be to use S3 to store the object as a json.
 */

'use strict';
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require("./skills-kit-2.0");
const fs = require("fs");
const {VideoIndexer, ConvertTime} = require("./video-indexer");
// const cloneDeep = require("lodash/cloneDeep"); // For deep cloning json objects

/**
 * Variables declared outside the handler is cached to be reused between invocation.
 * fileContext object is preserved to use the write tokens when the proxy endpoint
 * calls the handler after video processing is done.
 */

module.exports.handler = async (event) => {
    // If block after VideoIndexer finishes processing uploaded file.
    if (event && event.queryStringParameters && event.queryStringParameters.state === "Processed") {
        console.debug(`VideoIndexer finished processing event received: ${JSON.stringify(event)}`);

        const videoId = event.queryStringParameters.id;
        const requestId = event.queryStringParameters.requestId;

        let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint

        let fileContext = JSON.parse(fs.readFile(`/tmp/${requestId}.json`));

        videoIndexer.accessToken = fileContext.indexerToken;
        let skillsWriter = new SkillsWriter(fileContext);

        const indexerData = await videoIndexer.getData(videoId); // Can create skill cards after data extraction
                                                                // This method also stores videoId for future use.

        const cards = [];

        let fileDuration = indexerData.summarizedInsights.duration.seconds;

        // Keywords
        let keywords = [];
        indexerData.summarizedInsights.keywords.forEach(kw => {
            keywords.push({
                text: kw.name,
                appears: kw.appearances.map(time => {
                    return {start: time.startSeconds, end: time.endSeconds};
                    // return {start: time.startSeconds, end: time.endSeconds};
                })
            })
        });
        console.log(keywords);
        cards.push(skillsWriter.createTopicsCard(keywords, fileDuration));

        // Transcripts
        let transcripts = [];
        indexerData.videos[0].insights.transcript.forEach(tr => {
            transcripts.push({
                text: tr.text,
                appears: tr.instances.map(time => {
                    return {start: ConvertTime(time.start), end: ConvertTime(time.end)};
                })
            })
        })
        console.log(transcripts);
        cards.push(skillsWriter.createTranscriptsCard(transcripts, fileDuration));

        // Faces
        let faces = [];
        indexerData.videos[0].insights.faces.forEach(fa => {
            faces.push({
                text: fa.name,
                image_url: videoIndexer.getFace(fa.thumbnailId)
            })
        });
        console.log(faces);
        cards.push(await skillsWriter.createFacesCard(faces));

        await skillsWriter.saveDataCards(cards);

        let response = {
            statusCode: 200,
            body: "Successfully extracted data from VideoIndexer and wrote to Box."
        }
        return response;
    }
    else {
        console.debug(`Box event received: ${JSON.stringify(event)}`);
        let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
        
        // instantiate your two skill development helper tools
        let filesReader = new FilesReader(event.body);
        let fileContext = filesReader.getFileContext();
        await videoIndexer.getToken();
        fileContext.indexerToken = videoIndexer.accessToken;

        fs.writeFile(`/tmp/${fileContext.requestId}.json`, JSON.stringify(fileContext), (err) => {
            if (err) throw err;
        });

        let skillsWriter = new SkillsWriter(fileContext);
        
        await skillsWriter.saveProcessingCard();
    
        await videoIndexer.upload(fileContext.fileName, fileContext.requestId, fileContext.fileDownloadURL); // Will POST a success when it's done indexing.

        let response = {
            statusCode: 200,
            body: "Box skill upload event processed."
        };

        return response;
    }
};