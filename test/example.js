"use strict";

var chai    = require('chai');
var expect  = chai.expect;
var Client  = require("./../index");
var Q       = require("q");

describe("[runtime]", function() {
    var client;
    var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyTmFtZSI6Iml0YWktY29kZWZyZXNoIiwicHJvdmlkZXIiOnsibmFtZSI6ImdpdGh1YiJ9LCJpYXQiOjE0MzkzODE0NDAsImV4cCI6MTQzOTQ2Nzg0MH0.FkSS4DIvrraY_FSpsH5VFiX-3MGztZV9hYTanAbGQaQ";

    beforeEach(function() {
        client = new Client({
            performValidationsOnClient: false,
            //file: path.resolve(__dirname, '../routes.json'),
            url: 'http://codefresh/api/swagger.json'
        });

        client.authenticate({
            type: "token",
            token: token
        });

        return client.getApi();

    });

    it('blah', function(){
        return client.user.get()
            .then(function(res){
                console.log(res);
            }, function(err){
                console.log(err);
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

        return client.repos.setSettings(
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
