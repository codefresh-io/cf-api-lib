"use strict";

var Fs = require("fs");
var Util = require("./../util");

var ClientHandler = module.exports = function(client) {
    this.client = client;
    this.routes = JSON.parse(Fs.readFileSync(__dirname + "/routes.json", "utf8"));
};

var proto = {};

[<%scripts%>].forEach(function(api) {
    Util.extend(proto, require("./" + api));
});

ClientHandler.prototype = proto;
