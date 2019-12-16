// Samuel Moon
const https = require("https"); // Low level API for HTTPS request/response

/**
 * @param {*} apiGateway - Used for callback when uploaded video indexing is finished.
 */

function VideoIndexer(apiGateway) {
    this.apiGateway = apiGateway;
    this.location = "trial"; // Trial VideoIndexer accounts has its own location.
    this.accountId = "83d244e8-13f2-4d39-acfe-dfa51111d4b9"; // Your VideoIndexer account ID
    this.authKey = "88a5565a8d44418d9f8ff87cc757da78"; // API key for VideoIndexer
    this.hostname = "api.videoindexer.ai";
    this.accessToken = "";
}

/**
 * Uploaded video is public for testing purposes. Change this flag to "Private" to use
 * authentication tokens.
 * https://api-portal.videoindexer.ai/docs/services/Operations/operations/Upload-Video?
 */
VideoIndexer.prototype.upload = async function (fileName, fileUrl) {
    console.log(this.accessToken);
    const options = {
        host: this.hostname,
        path: `/${this.location}/Accounts/${this.accountId}/Videos?name=${fileName}?privacy=Public&callbackUrl=${this.apiGateway}&videoUrl=${fileUrl}`,
        method: "POST",
        headers: {
            "Authorization": `Bearer ${this.accessToken}`
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.request(options, (result) => {
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);
            resolve("Success: Upload Video");
        });
        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });
    
        request.end();
    });
        
};

/**
 * 
 */
VideoIndexer.prototype.getMetadata = function () {

}

/**
 * If the uploaded video is listed "private", then you'll need a subscription key
 * to request an authorization token.
 */
VideoIndexer.prototype.getToken = async function () {
    const options = {
        host: this.hostname,
        path: `/auth/${this.location}/Accounts/${this.accountId}/AccessToken?allowEdit=true`,
        headers: {
            "Ocp-Apim-Subscription-Key": this.authKey
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.get(options, (result) => {
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);
    
            let data = [];
            result.on('data', (d) => {
                data.push(d)
            });
    
            result.on("end", () => {
                data = Buffer.concat(data).toString();
                this.accessToken = data;
                console.log(this.accessToken);
                resolve("Success: Authorization Token");
            });
    
        })
        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });
    });
};

module.exports = VideoIndexer;