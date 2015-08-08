"use strict";

var Fs = require("fs");
var Util = require("./../util");

var GithubHandler = module.exports = function(client) {
    this.client = client;
    this.routes = JSON.parse(Fs.readFileSync(__dirname + "/routes.json", "utf8"));
};

var proto = {};

[<%scripts%>].forEach(function(api) {
    Util.extend(proto, require("./" + api));
});

GithubHandler.prototype = proto;
