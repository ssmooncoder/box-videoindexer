// Samuel Moon
const https = require("https"); // Low level API for HTTPS request/response

/**
 * @param {*} apiGateway - Used for callback when uploaded video indexing is finished.
 * 
 * Methods are wrapped in promises for async implmentation.
 */

function VideoIndexer(apiGateway) {
    this.apiGateway = apiGateway;
    this.location = "trial"; // Trial VideoIndexer accounts has its own location.
    this.accountId = "83d244e8-13f2-4d39-acfe-dfa51111d4b9"; // Your VideoIndexer account ID
    this.authKey = "88a5565a8d44418d9f8ff87cc757da78"; // API key for VideoIndexer
    this.authKey2 = "b4e5b8b5df3b4e8c80f52b1fc8e8e9db"; // API key for VideoIndexer
    this.hostname = "api.videoindexer.ai";
    this.accessToken = "";
}

/**
 * Uploaded video is public for testing purposes. Change this flag to "Private" to use
 * authentication tokens.
 * https://api-portal.videoindexer.ai/docs/services/Operations/operations/Upload-Video?
 */
VideoIndexer.prototype.upload = async function (fileName, requestId, fileUrl) {
    let callback = this.apiGateway + "?requestId=" + requestId;
    const options = {
        host: this.hostname,
        path: `/${this.location}/Accounts/${this.accountId}/Videos?name=${fileName}&privacy=Private&callbackUrl=${callback}&language=multi&videoUrl=${fileUrl}`,
        method: "POST",
        headers: {
            "Authorization": `Bearer ${this.accessToken}`
        }
    };

    console.debug("before upload video:\n" + this.accessToken);
    return new Promise((resolve, reject) => {

        const request = https.request(options, (result) => {
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);

            if (result.statusCode === 200) {
                resolve("Success: Upload Video");
            }
        });

        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });
    
        request.end();
    });
        
};

/**
 * Access token will be required for private videos.
 */
VideoIndexer.prototype.getData = async function (videoId) {
    VideoIndexer.prototype.videoId = videoId; // Add as property for face thumbnail images
    const options = {
        host: this.hostname,
        path: `/${this.location}/Accounts/${this.accountId}/Videos/${videoId}/Index`,
        headers: {
            "Accept": "application/json"
        }
    }

    return new Promise((resolve, reject) => {
        const request = https.get(options, (result) => {
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);

            let data = []
            result.on("data", (d) => {
                data.push(d);
            });

            result.on("end", () => {
                data = JSON.parse(Buffer.concat(data));
                resolve(data);
            });

        });

        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });

        request.end();
    });
}

/**
 * Builds the URI for thumbnails stored on VideoIndexer
 * No async because we already have the thumbnail IDs locally.
 * Need to implement tokens for private videos
 */
VideoIndexer.prototype.getFace = function (id) {
    return `https://api.videoindexer.ai/${this.location}/Accounts/${this.accountId}/Videos/${this.videoId}/Thumbnails/${id}`;
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
            "Ocp-Apim-Subscription-Key": this.authKey,
            "Authorization": `Bearer ${this.accessToken}`
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.get(options, (result) => {
            console.log(result);
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);
    
            let data = [];
            result.on('data', (d) => {
                data.push(d)
            });
    
            result.on("end", () => {
                data = Buffer.concat(data).toString();
                data = data.substring(1, data.length-1); // Wasted like 6 hours on this because token is wrapped in "double quote" characters
                // Need to find out what's causing the encoding issue that inserts double quotes around the token
                this.accessToken = data;
                console.log(this.accessToken);
                resolve("Success: Authorization Token");
            });
    
        })
        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });

        request.end();
    });
};

function ConvertTime(hhmmss) {
    const time = hhmmss.split(":");
    return time[0] * 3600.0 + time[1] * 60.0 + time[2] * 1.0;
}

module.exports = {VideoIndexer, ConvertTime};