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
const fs = require("fs"); // Only for writing JSON files. Use "require()" to read JSON.
const {VideoIndexer, ConvertTime} = require("./video-indexer");
// const cloneDeep = require("lodash/cloneDeep"); // For deep cloning json objects

/**
 * Variables declared outside the handler is cached to be reused between invocation.
 * fileContext object is preserved to use the write tokens when the proxy endpoint
 * calls the handler after video processing is done.
 */

module.exports.handler = async (event) => {
    const parsedBody = JSON.parse(event.body);
    console.debug(parsedBody);
    // If block after VideoIndexer finishes processing uploaded file.
    if (event && event.queryStringParameters && event.queryStringParameters.state === "Processed") {
        
        // How many json files are in tmp dir
        fs.readdir("/tmp", (err, items) => {
            if (err) throw err;
        
            items.forEach(item => {
                console.debug(item);
            });
        });

        console.debug(`VideoIndexer finished processing event received: ${JSON.stringify(event)}`);

        const videoId = event.queryStringParameters.id;
        const requestId = event.queryStringParameters.requestId;

        let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
        await videoIndexer.getToken(false);

        let fileContext = require(`/tmp/${requestId}.json`);
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

        fs.writeFile(`/tmp/${fileContext.requestId}.json`, JSON.stringify(fileContext), (err) => {
            if (err) throw err;
        });

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