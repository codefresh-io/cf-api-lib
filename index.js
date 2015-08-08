"use strict";

var error = require("./error");
var fs = require("fs");
var mime = require("mime");
var Util = require("./util");
var Url = require("url");
var Q = require('q');

var Client = module.exports = function(config) {
    config = config || {};
    config.headers = config.headers || {};
    this.config = config;
    this.debug = Util.isTrue(config.debug);

    this.version = config.version;
    var cls = require("./api");
    this[this.version] = new cls(this);

    this.setupRoutes();
};

(function() {
    this.setupRoutes = function() {
        var self = this;
        var api = this[this.version];
        var routes = api.routes;
        var defines = routes.defines;
        this.constants = defines.constants;
        this.requestHeaders = defines["request-headers"].map(function(header) {
            return header.toLowerCase();
        });
        delete routes.defines;

        var pathPrefix = "";
        // Check if a prefix is passed in the config and strip any leading or trailing slashes from it.
        if (typeof this.constants.pathPrefix === "string") {
            pathPrefix = "/" + this.constants.pathPrefix.replace(/(^[\/]+|[\/]+$)/g, "");
            this.constants.pathPrefix = pathPrefix;
        }

        function trim(s) {
            if (typeof s !== "string")
                return s;
            return s.replace(/^[\s\t\r\n]+/, "").replace(/[\s\t\r\n]+$/, "");
        }

        function parseParams(msg, paramsStruct) {
            var params = Object.keys(paramsStruct);
            var paramName, def, value, type;
            for (var i = 0, l = params.length; i < l; ++i) {
                paramName = params[i];
                if (paramName.charAt(0) === "$") {
                    paramName = paramName.substr(1);
                    if (!defines.params[paramName]) {
                        throw new error.BadRequest("Invalid variable parameter name substitution; param '" +
                            paramName + "' not found in defines block", "fatal");
                    }
                    else {
                        def = paramsStruct[paramName] = defines.params[paramName];
                        delete paramsStruct["$" + paramName];
                    }
                }
                else
                    def = paramsStruct[paramName];

                value = trim(msg[paramName]);
                if (typeof value !== "boolean" && !value) {
                    // we don't need to validation for undefined parameter values
                    // that are not required.
                    if (!def.required || (def["allow-empty"] && value === ""))
                        continue;
                    throw new error.BadRequest("Empty value for parameter '" +
                        paramName + "': " + value);
                }

                // validate the value and type of parameter:
                if (def.validation) {
                    if (!new RegExp(def.validation).test(value)) {
                        throw new error.BadRequest("Invalid value for parameter '" +
                            paramName + "': " + value);
                    }
                }

                if (def.type) {
                    type = def.type.toLowerCase();
                    if (type === "number") {
                        value = parseInt(value, 10);
                        if (isNaN(value)) {
                            throw new error.BadRequest("Invalid value for parameter '" +
                                paramName + "': " + msg[paramName] + " is NaN");
                        }
                    }
                    else if (type === "float") {
                        value = parseFloat(value);
                        if (isNaN(value)) {
                            throw new error.BadRequest("Invalid value for parameter '" +
                                paramName + "': " + msg[paramName] + " is NaN");
                        }
                    }
                    else if (type === "json") {
                        if (typeof value === "string") {
                            try {
                                value = JSON.parse(value);
                            }
                            catch(ex) {
                                throw new error.BadRequest("JSON parse error of value for parameter '" +
                                    paramName + "': " + value);
                            }
                        }
                    }
                    else if (type === "date") {
                        value = new Date(value);
                    }
                }
                msg[paramName] = value;
            }
        }

        function prepareApi(struct, baseType) {
            if (!baseType)
                baseType = "";
            Object.keys(struct).forEach(function(routePart) {
                var block = struct[routePart];
                if (!block)
                    return;
                var messageType = baseType + "/" + routePart;
                if (block.url) {
                    // we ended up at an API definition part!
                    block.params = block.params || {};
                    var endPoint = messageType.replace(/^[\/]+/g, "");
                    var parts = messageType.split("/");
                    var section = Util.toCamelCase(parts[1].toLowerCase());
                    parts.splice(0, 2);
                    var funcName = Util.toCamelCase(parts.join("-"));

                    if (!api[section]) {
                        throw new Error("Unsupported route section, not implemented in version " +
                            self.version + " for route '" + endPoint + "' and block: " +
                            JSON.stringify(block));
                    }

                    if (!api[section][funcName]) {
                        if (self.debug)
                            Util.log("Tried to call " + funcName);
                        throw new Error("Unsupported route, not implemented in version " +
                            self.version + " for route '" + endPoint + "' and block: " +
                            JSON.stringify(block));
                    }

                    if (!self[section]) {
                        self[section] = {};
                        // add a utility function 'getFooApi()', which returns the
                        // section to which functions are attached.
                        self[Util.toCamelCase("get-" + section + "-api")] = function() {
                            return self[section];
                        };
                    }


                    // Support custom headers for specific route
                    block.requestHeaders = block['request-headers'] || [];
                    delete block['request-headers'];
                    block.requestHeaders = block.requestHeaders.map(function(header) {
                        return header.toLowerCase();
                    });
                    block.requestHeaders = block.requestHeaders.concat(self.requestHeaders);


                    self[section][funcName] = function(msg, callback) {
                        try {
                            parseParams(msg, block.params);
                        }
                        catch (ex) {
                            // when the message was sent to the client, we can
                            // reply with the error directly.
                            api.sendError(ex, block, msg, callback);
                            if (self.debug)
                                Util.log(ex.message, "fatal");
                            // on error, there's no need to continue.
                            return;
                        }

                        return api[section][funcName].call(api, msg, block);
                    };
                }
                else {
                    // recurse into this block next:
                    prepareApi(block, messageType);
                }
            });
        }

        prepareApi(routes);
    };

    this.authenticate = function(options) {
        if (!options) {
            this.auth = false;
            return;
        }
        if (!options.type || "basic|token".indexOf(options.type) === -1)
            throw new Error("Invalid authentication type, must be 'basic' or 'token'");
        if (options.type === "basic"){
            throw new Error("Basic authentication is not yet implemented");
        }
        if (options.type === "basic" && (!options.username || !options.password)){
            throw new Error("Basic authentication requires both a username and password to be set");
        }
        if (options.type === "token" && !options.token)
            throw new Error("Token authentication requires a token to be set");

        this.auth = options;
    };

    function getRequestFormat(hasBody, block) {
        if (hasBody)
            return block.requestFormat || this.constants.requestFormat; // jshint ignore:line

        return "query";
    }

    function getQueryAndUrl(msg, def, format, constants) {
        var url = def.url;
        if (constants.pathPrefix && url.indexOf(constants.pathPrefix) !== 0) {
            url = constants.pathPrefix + def.url;
        }
        var ret = {
            query: format === "json" ? {} : format === "raw" ? msg.data : []
        };
        if (!def || !def.params) {
            ret.url = url;
            return ret;
        }

        Object.keys(def.params).forEach(function(paramName) {
            paramName = paramName.replace(/^[$]+/, "");
            if (!(paramName in msg))
                return;

            var isUrlParam = url.indexOf(":" + paramName) !== -1;
            var valFormat = isUrlParam || format !== "json" ? "query" : format;
            var val;
            if (valFormat !== "json") {
                if (typeof msg[paramName] === "object") {
                    try {
                        msg[paramName] = JSON.stringify(msg[paramName]);
                        val = encodeURIComponent(msg[paramName]);
                    }
                    catch (ex) {
                        return Util.log("httpSend: Error while converting object to JSON: " +
                            (ex.message || ex), "error");
                    }
                }
                else if (def.params[paramName] && def.params[paramName].combined) {
                    // Check if this is a combined (search) string.
                    val = msg[paramName].split(/[\s\t\r\n]*\+[\s\t\r\n]*/)
                                        .map(function(part) {
                                            return encodeURIComponent(part);
                                        })
                                        .join("+");
                }
                else
                    val = encodeURIComponent(msg[paramName]);
            }
            else
                val = msg[paramName];

            if (isUrlParam) {
                url = url.replace(":" + paramName, val);
            }
            else {
                if (format === "json")
                    ret.query[paramName] = val;
                else if (format !== "raw")
                    ret.query.push(paramName + "=" + val);
            }
        });
        ret.url = url;
        return ret;
    }

    this.httpSend = function(msg, block) {

        var deferred = Q.defer();

        var self = this;

        Q()
            .then(function(){
                var method = block.method.toLowerCase();
                var hasFileBody = block.hasFileBody;
                var hasBody = !hasFileBody && ("head|get|delete".indexOf(method) === -1);
                var format = getRequestFormat.call(self, hasBody, block);
                var obj = getQueryAndUrl(msg, block, format, self.constants);
                var query = obj.query;
                var url = self.config.url ? self.config.url + obj.url : obj.url;

                var path = url;
                var protocol = self.config.protocol || self.constants.protocol || "http";
                var host = block.host || self.config.host || self.constants.host;
                var port = self.config.port || self.constants.port || (protocol === "https" ? 443 : 80);
                var proxyUrl;
                if (self.config.proxy !== undefined) {
                    proxyUrl = self.config.proxy;
                } else {
                    proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
                }
                if (proxyUrl) {
                    path = Url.format({
                        protocol: protocol,
                        hostname: host,
                        port: port,
                        pathname: path
                    });

                    if (!/^(http|https):\/\//.test(proxyUrl))
                        proxyUrl = "https://" + proxyUrl;

                    var parsedUrl = Url.parse(proxyUrl);
                    protocol = parsedUrl.protocol.replace(":", "");
                    host = parsedUrl.hostname;
                    port = parsedUrl.port || (protocol === "https" ? 443 : 80);
                }
                if (!hasBody && query.length)
                    path += "?" + query.join("&");

                var headers = {
                    "host": host,
                    "content-length": "0"
                };
                if (hasBody) {
                    if (format === "json")
                        query = JSON.stringify(query);
                    else if (format !== "raw")
                        query = query.join("&");
                    headers["content-length"] = Buffer.byteLength(query, "utf8");
                    headers["content-type"] = format === "json"
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
                    if (err){
                        deferred.reject(err);
                    }
                    else {
                        deferred.resolve(result);
                    }
                }

                function addCustomHeaders(customHeaders) {
                    Object.keys(customHeaders).forEach(function(header) {
                        var headerLC = header.toLowerCase();
                        if (block.requestHeaders.indexOf(headerLC) === -1)
                            return;
                        headers[headerLC] = customHeaders[header];
                    });
                }
                addCustomHeaders(Util.extend(msg.headers || {}, self.config.headers));

                if (!headers["user-agent"])
                    headers["user-agent"] = "NodeJS HTTP Client";

                if (!("accept" in headers))
                    headers.accept = self.config.requestMedia || self.constants.requestMedia;

                var options = {
                    host: host,
                    port: port,
                    path: path,
                    method: method,
                    headers: headers
                };

                if (self.config.rejectUnauthorized !== undefined)
                    options.rejectUnauthorized = self.config.rejectUnauthorized;

                if (self.debug)
                    console.log("REQUEST: ", options);

                function httpSendRequest() {
                    var req = require(protocol).request(options, function(res) {
                        if (self.debug) {
                            console.log("STATUS: " + res.statusCode);
                            console.log("HEADERS: " + JSON.stringify(res.headers));
                        }
                        res.setEncoding("utf8");
                        var data = "";
                        res.on("data", function(chunk) {
                            data += chunk;
                        });
                        res.on("error", function(err) {
                            callCallback(err);
                        });
                        res.on("end", function() {
                            if (res.statusCode >= 400 && res.statusCode < 600 || res.statusCode < 10) {
                                callCallback(new error.HttpError(data, res.statusCode));
                            } else {
                                res.data = data;
                                callCallback(null, res);
                            }
                        });
                    });

                    var timeout = (block.timeout !== undefined) ? block.timeout : self.config.timeout;
                    if (timeout) {
                        req.setTimeout(timeout);
                    }

                    req.on("error", function(e) {
                        if (self.debug)
                            console.log("problem with request: " + e.message);
                        callCallback(e.message);
                    });

                    req.on("timeout", function() {
                        if (self.debug)
                            console.log("problem with request: timed out");
                        callCallback(new error.GatewayTimeout());
                    });

                    // write data to request body
                    if (hasBody && query.length) {
                        if (self.debug)
                            console.log("REQUEST BODY: " + query + "\n");
                        req.write(query + "\n");
                    }

                    if (block.hasFileBody) {
                        var stream = fs.createReadStream(msg.filePath);
                        stream.pipe(req);
                    } else {
                        req.end();
                    }

                }

                if (hasFileBody) {
                    fs.stat(msg.filePath, function(err, stat) {
                        if (err) {
                            callCallback(err);
                        } else {
                            headers["content-length"] = stat.size;
                            headers["content-type"] = mime.lookup(msg.name);
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
