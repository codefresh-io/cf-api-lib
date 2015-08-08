"use strict";

var CFError     = require('cf-errors');
var ErrorTypes  = CFError.errorTypes;
var Util        = require("./../util"); // jshint ignore:line
var Q           = require("q");

var <%sectionName%> = module.exports = {
    <%sectionName%>: {}
};

(function() {
<%sectionBody%>
}).call(<%sectionName%>.<%sectionName%>);
