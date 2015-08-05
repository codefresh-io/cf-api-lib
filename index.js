'use strict';
var Runtime = require('./api/runtime');


module.exports = function Api(host, accessToken) {
    var self  = this;
    self.host = host;
    self.accessToken = accessToken;

    self.runtime = new Runtime(host, accessToken);
};