"use strict";

var chai    = require('chai');
var expect  = chai.expect; // jshint ignore:line
var client  = require("./../index");
var Q       = require("q");

describe("[runtime]", function() {
    var api;
    var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyTmFtZSI6Iml0YWktY29kZWZyZXNoIiwicHJvdmlkZXIiOnsibmFtZSI6ImdpdGh1YiJ9LCJpYXQiOjE0Mzk4MDM0ODgsImV4cCI6MTQzOTg4OTg4OH0.Wh4t5_iWBQBveV5nR5xC2-An20Hr3NR71D1eK9OzRtw";

    beforeEach(function() {
        return client.create({
            //file: path.resolve(__dirname, '../swagger.json'),
            url: 'http://codefresh/api/swagger.json'
        })
            .then(function(res){
                api = res;
                api.authenticate({
                    type: "token",
                    token: token
                });
            });
    });

    it.only('blah', function(){
        return api.user.get()
            .then(function(res){
                console.log(res);
            }, function(err){
                console.log(err);
            });
    });

    it("should successfully execute POST /runtime/testit (launch)",  function() {
        this.timeout(70000);

        return api.runtime.launch(
            {
                repoOwner: "itai-codefresh",
                repoName: "userrecstudy",
                repoData: {
                    url:{
                        https: "https://github.com/itai-codefresh/recuserstudy.git"
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

    it("should successfully execute settings",  function() {
        this.timeout(5000);

        return api.repos.setSettings(
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

    it("should successfully get settings",  function() {
        this.timeout(5000);

        return api.repos.getSettings(
            {
                repoOwner: "itai-codefresh",
                repoName: "userrecstudy"
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
