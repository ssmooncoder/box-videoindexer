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
    console.debug(`VideoIndexer finished processing event received: ${JSON.stringify(event)}`);
    videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
    filesReader = new FilesReader(event.body);
    fileContext = filesReader.getFileContext();
    skillsWriter = new SkillsWriter(fileContext);

    // const videoId = event.queryStringParameters.id;
    const videoId = "fca224947b";
    const indexerData = await videoIndexer.getData(videoId); // Can create skill cards after data extraction

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

    cards.push(skillsWriter.createTopicsCard(keywords, fileDuration));

    console.log(keywords);

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
            
        })
    });
    await skillsWriter.saveDataCards(cards);
    callback(null, { statusCode: 200, body: 'Box event was processed by skill' });
        // instantiate your two skill development helper tools
        
        // await skillsWriter.saveProcessingCard();
    
        // await videoIndexer.getToken();
        // await videoIndexer.upload(filesReader.fileName, filesReader.fileDownloadURL); // Will POST a success when it's done indexing.
    }
    try {
        // One of six ways of accessing file content from Box for ML processing with FilesReader
        // ML processing code not shown here, and will need to be added by the skill developer.
        const base64File = await filesReader.getContentBase64(); // eslint-disable-line no-unused-vars
        console.log(`printing simplified format file content in base64 encoding: ${base64File}`);

        


        const mockListOfDiscoveredKeywords = [{ text: 'testing' }, { text: 'senior' }, { text: 'design' }];
        const mockListOfDiscoveredTranscripts = [{ text: `This is a sentence/transcript card` }];
        const mockListOfDiscoveredFaceWithPublicImageURI = [
            {
                image_url: 'https://seeklogo.com/images/B/box-logo-646A3D8C91-seeklogo.com.png',
                text: `Image hover/placeholder text if image doesn't load`
            }
        ];
        const mockListOfTranscriptsWithAppearsAtForPlaybackFiles = [
            {
                text: 'Timeline data can be shown in any card type',
                appears: [{ start: 1, end: 2 }]
            },
            {
                text: "Just add 'appears' field besides any 'text', with start and end values in seconds",
                appears: [{ start: 3, end: 4 }]
            }
        ];
        
        // Turn your data into correctly formatted card jsons usking SkillsWriter.
        // The cards will appear in UI in same order as they are passed in a list.
        const cards = [];
        cards.push(await skillsWriter.createFacesCard(mockListOfDiscoveredFaceWithPublicImageURI, null, 'Icons')); // changing card title to non-default 'Icons'.
        cards.push(skillsWriter.createTopicsCard(mockListOfDiscoveredKeywords));
        cards.push(skillsWriter.createTranscriptsCard(mockListOfDiscoveredTranscripts));
        cards.push(skillsWriter.createTranscriptsCard(mockListOfTranscriptsWithAppearsAtForPlaybackFiles, 5)); // for timeline total playtime seconds of file also needs to be passed.
        
        // Save the cards to Box in a single calls to show in UI.
        // Incase the skill is invoked on a new version upload of the same file,
        // this call will override any existing skills cards, data or error, on Box file preview.
        await skillsWriter.saveDataCards(cards);
        console.debug("~~~ wtf man ~~~ 6 ~~~")
    } catch (error) {
        // Incase of error, write back an error card to UI.
        // Note: Skill developers may want to inspect the 'error' variable
        // and write back more specific errorCodes (@print SkillsWriter.error.keys())
        console.error(
            `Skill processing failed for file: ${filesReader.getFileContext().fileId} with error: ${error.message}`
        );
        await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN);
    } finally {
        // Skills engine requires a 200 response within 10 seconds of sending an event.
        // Please see different code architecture configurations in git docs,
        // that you can apply to make sure your service always responds within time.
        callback(null, { statusCode: 200, body: 'Box event was processed by skill' });
    }
};