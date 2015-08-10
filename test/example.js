"use strict";

var chai    = require('chai');
var expect  = chai.expect;
var Client  = require("./../index");
var Q       = require("q");

describe("[runtime]", function() {
    var client;
    var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyTmFtZSI6Iml0YWktY29kZWZyZXNoIiwicHJvdmlkZXIiOnsibmFtZSI6ImdpdGh1YiJ9LCJpYXQiOjE0MzkxNTc3NzksImV4cCI6MTQzOTI0NDE3OX0.pzvEVXbW7I-IPaMgrQIyOD-OCk4qB90mPp6aM5gE4zY";

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

    it.only("should successfully execute settings",  function() {
        this.timeout(5000);

        return client.settings.update(
            {
                repoOwner: "itai-codefresh",
                repoName: "userrecstudy",
                settings: {}
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
