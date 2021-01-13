var Q = require('q');
var CFError    = require('cf-errors');
var ErrorTypes = CFError.Errors;

var Handler = function (headers) {

    var newHandler = function(msg, block){
        var deferred = Q.defer();

        var self = this;

        Q()
            .then(function(){
                return self.httpSend(msg, block)
                    .then(function(res){
                        var ret = {};
                        ret.statusCode = res.statusCode;

                        try {
                            ret.data = res.data;
                            var contentType = res.headers["content-type"];
                            if (contentType && contentType.indexOf("application/json") !== -1)
                                ret.data = JSON.parse(res.data);
                        }
                        catch (ex) {
                            deferred.reject(new CFError(ErrorTypes.Error, "failed to parse response as a json object: " + res.data));
                        }

                        if (headers && headers.length){
                            if (!ret.meta)
                                ret.meta = {};
                            headers.forEach(function(header) {
                                if (res.headers[header])
                                    ret.meta[header] = res.headers[header];
                            });
                        }

                        if (ret.statusCode >= 400 && ret.statusCode < 600 || ret.statusCode < 10){
                            deferred.reject(ret);
                        }
                        else {
                            deferred.resolve(ret);
                        }
                    }, function(err){
                        deferred.reject(err);
                    });
            })
            .done();
        return deferred.promise;
    };

    return newHandler;
};

module.exports = Handler;
