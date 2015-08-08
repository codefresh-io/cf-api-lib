"use strict";

var error = require("./../error");
var Util = require("./../util"); // jshint ignore:line

var <%sectionName%> = module.exports = {
    <%sectionName%>: {}
};

(function() {
<%sectionBody%>
}).call(<%sectionName%>.<%sectionName%>);
