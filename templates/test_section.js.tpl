"use strict";

var chai    = require('chai');
var expect  = chai.expect;
var Client  = require("./../index");
var Q       = require("q");

describe("[<%sectionName%>]", function() {
    var client;
    var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyTmFtZSI6Iml0YWktY29kZWZyZXNoIiwicHJvdmlkZXIiOnsibmFtZSI6ImdpdGh1YiJ9LCJpYXQiOjE0Mzg5NjYxODAsImV4cCI6MTQzOTA1MjU4MH0.Y1ANHZ4PVxLXNVjSXrAtCM_drcoxMiKrtDflb9aIkDg";

    beforeEach(function() {
        client = new Client();
        client.authenticate({
            type: "token",
            token: token,
            performValidationsOnClient: false
        });
    });

<%testBody%>
});
