const nodemailer = require("nodemailer");

function sendErrorEmail(e) {
    let transporter = nodemailer.createTransport({
        service: 'outlook',
        auth: {
            user: 'smoon2@calstatela.edu',
            pass: 'Zmkozmko2'
        }
    });
    
    let mailOptions = {
        from: 'smoon2@calstatela.edu',
        to: 'samuelmoon0712@gmail.com',
        subject: `${e}`,
        text: `An error occurred during the transcription attempt.\n\n${JSON.stringify(e)}`
    };
    
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports.sendErrorEmail = sendErrorEmail;