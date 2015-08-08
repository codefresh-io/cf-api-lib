"use strict";

var chai    = require('chai');
var expect  = chai.expect;
var Client  = require("./../index");
var Q       = require("q");

describe("[<%sectionName%>]", function() {
    var client;
    var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyTmFtZSI6Iml0YWktY29kZWZyZXNoIiwicHJvdmlkZXIiOnsibmFtZSI6ImdpdGh1YiJ9LCJpYXQiOjE0MzkwNTQ0OTQsImV4cCI6MTQzOTE0MDg5NH0.CGBoxTipo4YbzAvUdo1bRwIM0mwdWRCOrmUr0f34tgw";

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
