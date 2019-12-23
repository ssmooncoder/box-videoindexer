/**
 * Samuel Moon
 * 
 * Notes (update 12/23/19):
 * 1. Environment variables are set on the lambda configuration page.
 *    API Gateway URL set on process.env.APIGATEWAY
 * 2. Timeout is set at 15 minutes. Storing JSON outside handler or in
 *    the /tmp/ directory is unreliable, as they are reliant on Lambda's
 *    execution context.
 * 3. Execution context is garbage collected on videos that take a long
 *    time to process. Will need to use S3 to store fileContext JSON.
 */

'use strict';
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require("./skills-kit-2.0");
const {VideoIndexer, ConvertTime} = require("./video-indexer");
const AWS = require("aws-sdk");

var s3 = new AWS.S3();
// const cloneDeep = require("lodash/cloneDeep"); // For deep cloning json objects

module.exports.handler = async (event) => {
    const parsedBody = JSON.parse(event.body);
    console.debug(parsedBody);
    // VideoIndexer event
    if (event && event.queryStringParameters && event.queryStringParameters.state === "Processed") {
        
        console.debug(`VideoIndexer finished processing event received: ${JSON.stringify(event)}`);

        const videoId = event.queryStringParameters.id;
        const requestId = event.queryStringParameters.requestId;

        let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
        await videoIndexer.getToken(false);

        let params = {
            Bucket: "box-json-s3",
            Key: requestId
        }

        let bucketData = await s3.getObject(params).promise();
        console.log(bucketData);

        // "Body" is capital "B", not lowercase like "body".
        let fileContext = bucketData.Body.toString();
        console.log(fileContext);

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

        // Faces (sometimes there are no faces detected)
        if (indexerData.videos[0].insights.faces) {
            let faces = [];
            indexerData.videos[0].insights.faces.forEach(fa => {
                faces.push({
                    text: fa.name,
                    image_url: videoIndexer.getFace(fa.thumbnailId)
                })
            });
            console.log(faces);
            cards.push(await skillsWriter.createFacesCard(faces));
        }

        await skillsWriter.saveDataCards(cards);

        return;
    }
    if (parsedBody.hasOwnProperty("type") && parsedBody.type == "skill_invocation") {
        console.debug(`Box event received: ${JSON.stringify(event)}`);
        let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
        await videoIndexer.getToken(true);
        
        // instantiate your two skill development helper tools
        let filesReader = new FilesReader(event.body);
        let fileContext = filesReader.getFileContext();

        // S3 write fileContext JSON to save tokens for later use.
        let params = {
            Bucket: "box-json-s3",
            Key: fileContext.requestId,
            Body: JSON.stringify(fileContext)
        }
        let s3Response = await s3.upload(params).promise()
        console.log(s3Response);

        let skillsWriter = new SkillsWriter(fileContext);
        
        await skillsWriter.saveProcessingCard();
    
        console.debug("sending video to VI");
        await videoIndexer.upload(fileContext.fileName, fileContext.requestId, fileContext.fileDownloadURL); // Will POST a success when it's done indexing.
        console.debug("video sent to VI");

        console.debug("returning response to box");
        return {statusCode: 200};
    }
    else {
        console.debug("Unknown request");
        console.debug(event);

        return {statusCode: 400, body: "Unknown Request"};
    }
};