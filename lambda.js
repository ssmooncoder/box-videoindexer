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
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.0');
const {VideoIndexer, ConvertTime} = require("./video-indexer");
// const cloneDeep = require("lodash/cloneDeep"); // For deep cloning json objects

/**
 * Variables declared outside the handler is cached to be reused between invocation.
 * fileContext object is preserved to use the write tokens when the proxy endpoint
 * calls the handler after video processing is done.
 */
let fileContext;
let filesReader;
let skillsWriter;
let videoIndexer;

module.exports.handler = async (event, context, callback) => {
    // If block after VideoIndexer finishes processing uploaded file.
    if (event && event.queryStringParameters && event.queryStringParameters.state === "Processed") {
        console.debug(`VideoIndexer finished processing event received: ${JSON.stringify(event)}`);

        const videoId = event.queryStringParameters.id;
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
        callback(null, { statusCode: 200, body: "Box skill metadata finished writing." });
    }
    else {
        console.debug(`Box event received: ${JSON.stringify(event)}`);
        videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
    
        // instantiate your two skill development helper tools
        filesReader = new FilesReader(event.body);
        fileContext = filesReader.getFileContext();
        skillsWriter = new SkillsWriter(fileContext);
        
        await skillsWriter.saveProcessingCard();
    
        await videoIndexer.getToken();
        await videoIndexer.upload(filesReader.fileName, filesReader.fileDownloadURL); // Will POST a success when it's done indexing.
    }
};