"use strict";

var fs         = require("fs");
var mime       = require("mime");
var Util       = require("./util");
var Q          = require('q');
var request    = require('request');
var _          = require('lodash');
var CFError    = require('cf-errors');
var ErrorTypes = CFError.errorTypes;
var Fs         = require("fs");
var Handler    = require("./handler.js");


var Client = function (config) {
    config         = config || {};
    config.headers = config.headers || {};
    this.config    = config;
    this.debug     = Util.isTrue(config.debug);
};

var Factory = function(config) {
    var client;
    return Q()
        .then(function(){
            client = new Client(config);
            return client.getApi();
        })
        .then(function(){
            return client;
        });
};

module.exports.create = Factory;

(function () {

    this.getApi = function () {
        var self     = this;
        var deferred = Q.defer();

        if (self.config.url) {
            request(self.config.url, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    self.api = JSON.parse(body);
                    self.setupRoutes();
                    deferred.resolve();
                }
                else {
                    deferred.reject(new CFError(ErrorTypes.Error, "failed to retrieve api metadata"));
                }
            });
        }
        else if (self.config.file) {
            self.api = {routes: JSON.parse(Fs.readFileSync(self.config.file, "utf8"))};
            self.setupRoutes();
            deferred.resolve();
        }
        else {
            deferred.reject(new CFError(ErrorTypes.Error, "Missing file or url for retreiving api"));
        }

        return deferred.promise;
    };

    this.setupRoutes = function () {
        var self    = this;
        var api     = this.api;
        var routes  = api.paths;
        var headers = [];

        var basePath = "";
        // Check if a basePath is passed in the data and strip any leading or trailing slashes from it.
        if (typeof api.basePath === "string") {
            basePath     = "/" + api.basePath.replace(/(^[\/]+|[\/]+$)/g, "");
            api.basePath = basePath;
        }


        function prepareApi(struct) {
            Object.keys(struct).forEach(function (routePart) {
                Object.keys(struct[routePart]).forEach(function (methodPart) {
                    var block = struct[routePart][methodPart];

                    block.parameters = block.parameters || [];


                    //get global parameters and replace them with the reference
                    block.parameters.forEach(function (param, index) {
                        if (param["$ref"]) {
                            var paramName           = param["$ref"].split('/')[2];
                            block.parameters[index] = _.cloneDeep(api.parameters[paramName]);
                        }
                    });


                    block.method = methodPart;
                    block.url    = routePart;
                    var section  = block.tags[0];

                    // add the handler to the sections
                    if (!api[section]) {
                        self[section] = {};
                        api[section]  = {};
                    }

                    api[section][block.operationId] = new Handler(headers);

                    self[section][block.operationId] = function (msg) {
                        return api[section][block.operationId].call(self, msg, block);
                    };
                });
            });
        }

        prepareApi(routes);
    };

    this.authenticate = function (options) {
        if (!options) {
            this.auth = false;
            return;
        }
        if (!options.type || "basic|token".indexOf(options.type) === -1)
            throw new CFError(ErrorTypes.Error, "Invalid authentication type, must be 'basic' or 'token'");
        if (options.type === "basic") {
            throw new CFError(ErrorTypes.Error, "Basic authentication is not yet implemented");
        }
        if (options.type === "basic" && (!options.username || !options.password)) {
            throw new CFError(ErrorTypes.Error, "Basic authentication requires both a username and password to be set");
        }
        if (options.type === "token" && !options.token)
            throw new CFError(ErrorTypes.Error, "Token authentication requires a token to be set");
        this.auth = options;
    };

    this.removeCredentials = function () {
        this.auth = null;
    };

    function getQueryAndUrl(msg, def, format, api) {
        var ret = {
            payload: format === "json" ? {} : [],
            url: api.basePath + def.url
        };

        if (!def.parameters){
            return ret;
        }

        Object.keys(msg).forEach(function (key) {
            var value = msg[key];
            // TODO handler 'header' case
            var valueIn; // 'path' || 'query' || 'body' || 'header'
            var paramDefinition = def.parameters.filter(function(paramDef){
                if (paramDef.name === key) return true;
            });

            if(paramDefinition.length){
                valueIn = paramDefinition[0].in;
            }
            else {
                valueIn = format === "json" ? 'body' : 'query';
            }

            var val;
            if (valueIn === 'path' || format === 'query') {
                if (typeof value === "object") {
                    try {
                        value = JSON.stringify(value);
                        val   = encodeURIComponent(value);
                    }
                    catch (ex) {
                        return Util.log("httpSend: Error while converting object to JSON: " +
                            (ex.message || ex), "error");
                    }
                }
                else {
                    val = encodeURIComponent(value);
                }
            }
            else {
                val = value;
            }

            if (valueIn === 'path') {
                ret.url = ret.url.replace("{" + key + "}", val);
            }
            else if (valueIn === 'query') {
                if (format === "json")
                    ret.payload[key] = val;
                else if (format === "query")
                    ret.payload.push(key + "=" + val);
            }
            else if (valueIn === 'body'){
                ret.payload[key] = val;
            }
            else if (valueIn === 'header'){
                msg.headers[key] = val;
            }

        });

        return ret;
    }

    this.httpSend = function (msg, block) {

        if (!msg)
            msg = {};

        msg.headers = {};

        var deferred = Q.defer();

        var self = this;

        Q()
            .then(function () {
                var method      = block.method.toLowerCase();
                var hasFileBody = block.hasFileBody;
                var hasBody     = !hasFileBody && ("head|get|delete".indexOf(method) === -1);
                var format      = hasBody ? 'json' : 'query';
                var obj         = getQueryAndUrl(msg, block, format, self.api);
                var payload     = obj.payload;
                delete payload.headers;
                var url         = obj.url;

                var path     = url;
                var protocol = self.api.schemes[0];
                var host     = self.api.host;
                var port     = protocol === "https" ? 443 : 80;

                if (!hasBody && payload.length)
                    path += "?" + payload.join("&");

                var headers = {
                    "host": host,
                    "content-length": "0"
                };
                if (hasBody) {
                    if (format === "json")
                        payload = JSON.stringify(payload);
                    else if (format !== "raw")
                        payload = payload.join("&");
                    headers["content-length"] = Buffer.byteLength(payload, "utf8");
                    headers["content-type"]   = format === "json"
                        ? "application/json; charset=utf-8" // jshint ignore:line
                        : format === "raw"
                        ? "text/plain; charset=utf-8" // jshint ignore:line
                        : "application/x-www-form-urlencoded; charset=utf-8";
                }
                if (self.auth) {
                    var basic;
                    switch (self.auth.type) {
                        case "token":
                            headers['x-access-token'] = self.auth.token;
                            break;
                        case "basic":
                            throw new Error("Basic Authentication is not yet implemented");
                            basic = new Buffer(self.auth.username + ":" + self.auth.password, "ascii").toString("base64"); // jshint ignore:line
                            headers.authorization = "Basic " + basic;
                            break;
                        default:
                            break;
                    }
                }

                function callCallback(err, result) {
                    if (err) {
                        deferred.reject(err);
                    }
                    else {
                        deferred.resolve(result);
                    }
                }

                /*               function addCustomHeaders(customHeaders) {
                 Object.keys(customHeaders).forEach(function (header) {
                 var headerLC = header.toLowerCase();
                 if (block.requestHeaders.indexOf(headerLC) === -1)
                 return;
                 headers[headerLC] = customHeaders[header];
                 });
                 }*/

                //addCustomHeaders(Util.extend(msg.headers, self.config.headers));

                Util.extend(headers, msg.headers);

                if (!headers["user-agent"])
                    headers["user-agent"] = "NodeJS HTTP Client";

                if (!("accept" in headers))
                    headers.accept = self.api.consumes[0];

                var options = {
                    host: host,
                    port: port,
                    path: path,
                    method: method,
                    headers: headers
                };


                if (self.debug)
                    console.log("REQUEST: ", options);

                function httpSendRequest() {
                    var req = require(protocol).request(options, function (res) {
                        if (self.debug) {
                            console.log("STATUS: " + res.statusCode);
                            console.log("HEADERS: " + JSON.stringify(res.headers));
                        }
                        res.setEncoding("utf8");
                        var data = "";
                        res.on("data", function (chunk) {
                            data += chunk;
                        });
                        res.on("error", function (err) {
                            callCallback(err);
                        });
                        res.on("end", function () {
                            res.data = data;
                            callCallback(null, res);
                        });
                    });

                    var timeout = (block.timeout !== undefined) ? block.timeout : self.config.timeout;
                    if (timeout) {
                        req.setTimeout(timeout);
                    }

                    req.on("error", function (e) {
                        if (self.debug)
                            console.log("problem with request: " + e.message);
                        callCallback(new CFError(ErrorTypes.Error, e, "Problem with request"));
                    });

                    req.on("timeout", function () {
                        if (self.debug)
                            console.log("problem with request: timed out");
                        callCallback(new CFError(ErrorTypes.Error, "Request timed out"));
                    });

                    // write data to request body
                    if (hasBody && payload.length) {
                        if (self.debug)
                            console.log("REQUEST BODY: " + payload + "\n");
                        req.write(payload + "\n");
                    }

                    if (block.hasFileBody) {
                        var stream = fs.createReadStream(msg.filePath);
                        stream.pipe(req);
                    } else {
                        req.end();
                    }

                }

                if (hasFileBody) {
                    fs.stat(msg.filePath, function (err, stat) {
                        if (err) {
                            callCallback(err);
                        } else {
                            headers["content-length"] = stat.size;
                            headers["content-type"]   = mime.lookup(msg.name);
                            httpSendRequest();
                        }
                    });
                } else {
                    httpSendRequest();
                }
            })
            .done();

        return deferred.promise;
    };

}).call(Client.prototype);
