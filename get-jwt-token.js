async function getCustomToken() {
    const fs = require("fs");

    const config = JSON.parse(fs.readFileSync("./config.json"));

    let key = {
        key: config.boxAppSettings.appAuth.privateKey,
        passphrase: config.boxAppSettings.appAuth.passphrase
    };

    const crypto = require("crypto");

    const authenticationUrl = "https://api.box.com/oauth2/token";

    let claims = {
        iss: config.boxAppSettings.clientID,
        sub: config.enterpriseID,
        box_sub_type: "enterprise",
        aud: authenticationUrl,
        jti: crypto.randomBytes(64).toString("hex"),
//machine time need to match time with the box
//https://community.box.com/t5/Platform-and-Development-Forum/Current-date-time-MUST-be-before-the-expiration-date-time-listed/td-p/17871
        exp: Math.ceil(Date.now() / 1000) + 45 
    };

    const jwt = require('jsonwebtoken')

    let keyId = config.boxAppSettings.appAuth.publicKeyID

    let headers = {
    'algorithm': 'RS512',
    'keyid': keyId,
    }

    let assertion = jwt.sign(claims, key, headers)

    const axios = require('axios')
    const querystring = require('querystring');
    try{
        let accessToken = await axios.post(
            authenticationUrl,
            querystring.stringify({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: assertion,
                client_id: config.boxAppSettings.clientID,
                client_secret: config.boxAppSettings.clientSecret
            })
        );
        return accessToken.data.access_token;
            // )
            // .then(response => testToken = response.data.access_token)
            // .catch(error => { console.log(error) })
    // console.log("wtf????");
    }catch(e){
        console.log(e.response.status);
        throw new Error(e);
    }
    
};

// (async () => {
//     let lmao = await getCustomToken();
//     console.log(lmao);
// })();

module.exports.getCustomToken = getCustomToken;