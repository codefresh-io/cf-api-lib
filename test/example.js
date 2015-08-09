"use strict";

var chai    = require('chai');
var expect  = chai.expect;
var Client  = require("./../index");
var Q       = require("q");

describe("[runtime]", function() {
    var client;
    var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyTmFtZSI6Iml0YWktY29kZWZyZXNoIiwicHJvdmlkZXIiOnsibmFtZSI6ImdpdGh1YiJ9LCJpYXQiOjE0MzkwNTQ0OTQsImV4cCI6MTQzOTE0MDg5NH0.CGBoxTipo4YbzAvUdo1bRwIM0mwdWRCOrmUr0f34tgw";

    beforeEach(function() {
        client = new Client({
            performValidationsOnClient: false
        });
        client.authenticate({
            type: "token",
            token: token
        });
    });

    it("should successfully execute POST /runtime/testit (launch)",  function() {
        this.timeout(70000);

        return client.runtime.launch(
            {
                repoOwner: "itai-codefresh",
                repoName: "userrecstudy",
                repoData: {
                    url:{
                        https: "https://github.com/codefresh-io/recuserstudy"
                    }
                },
                sha: "",
                branch: "master"
            })
            .then(function(res){
                console.log(res);
            }, function(err){
                return Q.reject(err);
            }, function(prog){
                console.log(prog);
            });
    });
});
