"use strict";

var Client = require("./../index");

var client = new Client({
    debug: true
});

client.authenticate({
    type: "token",
    token: "some_token"
});

client.user.get({}, function(err, res) {
    console.log("GOT ERR?", err);
    console.log("GOT RES?", res);
});
