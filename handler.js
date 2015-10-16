var Q = require('q');
var CFError    = require('cf-errors');
var ErrorTypes = CFError.errorTypes;

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
                            var progDef = block.progress;
                            if (progDef && progDef.tag && progDef.operationId && progDef.allStates && progDef.successStates && progDef.failStates && progDef.finishStates && self[progDef.tag] && self[progDef.tag][progDef.operationId]){
                                var getProgress = function(progData){
                                    self[progDef.tag][progDef.operationId].call(self, progData)
                                        .then(function(res){
                                            deferred.notify({id: progData.id, res: res});
                                            if (progDef.finishStates.indexOf(res.data.status) !== -1){
                                                if (progDef.failStates.indexOf(res.data.status) !== -1){
                                                    progData.promise.reject(res);
                                                }
                                                else {
                                                    progData.promise.resolve(res);
                                                }
                                            }
                                            else {
                                                setTimeout(
                                                    function(){
                                                        getProgress({id: progData.id, index:res.data.index, promise: progData.promise});
                                                    },
                                                    2000);
                                            }
                                        },function(err){
                                            if (progDef.failStates.indexOf(err.data.status) !== -1){
                                                deferred.notify({id: progData.id, err: err});
                                                progData.promise.reject(new CFError(ErrorTypes.Error, err, "Progress id: " + progData.id + " at index: " + progData.index));
                                            }
                                            else {
                                                progData.promise.reject(new CFError(ErrorTypes.Error, err, "Failed to return progress for progress id: " + progData.id + " at index: " + progData.index + ". this does not mean that the entire process has failed."));
                                            }
                                        });
                                };
                                if (ret.data.id){
                                    ret.data.progressIds = [ret.data.id];
                                    delete ret.data.id;
                                }
                                if (!ret.data.progressIds){
                                    deferred.reject(new CFError(ErrorTypes.Error, "did not get a progress id in the response body although this api is marked as a progress api."));
                                }
                                else {
                                    var promises = ret.data.progressIds.map(function(id){
                                        var specificIdDeferred = Q.defer();
                                        getProgress({id: id, index: 0, promise: specificIdDeferred});
                                        return specificIdDeferred.promise;
                                    });
                                    return Q.all(promises)
                                        .then(deferred.resolve, deferred.reject);
                                }
                            }
                            else {
                                deferred.resolve(ret);
                            }
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