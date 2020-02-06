var BoxSDK = require('box-node-sdk');
var config = require('./config.json');
var sdk = BoxSDK.getPreconfiguredInstance(config);


// var client = sdk.getAppAuthClient("enterprise", "248886525");
var client = sdk.getAppAuthClient("enterprise");
// var client = sdk.getAppAuthClient("user", "9950630925");

console.log(client);
console.log(client._session);

// client.enterprise.getUsers()
// 	.then(users => { console.log(users)});

// client.users.get(client.CURRENT_USER_ID)
// 	.then(user => { console.log(user) });

client.folders.get('87498223834')
    .then(folder => { console.log(folder) });
	
// client.folders.getItems('87498223834')
//     .then(folder => { console.log(folder) });
    

