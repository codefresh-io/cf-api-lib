<%comment%>
    this.<%funcName%> = function(msg, block) {
        var deferred = Q.defer();

        var self = this;

        Q()
            .then(function(){
                return self.client.httpSend(msg, block)
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
<%afterRequest%>
                        if (ret.statusCode >= 400 && ret.statusCode < 600 || ret.statusCode < 10){
                            deferred.reject(ret);
                        }
                        else {
                            var progDef = block.progress;
                            if (progDef && progDef.section && progDef.route && progDef.allStates && progDef.successStates && progDef.failStates && progDef.finishStates && self.client[progDef.section] && self.client[progDef.section][progDef.route]){
                                var getProgress = function(progData){
                                    return self.client[progDef.section][progDef.route].call(self, progData)
                                        .then(function(res){
                                            deferred.notify(res);
                                            if (progDef.finishStates.indexOf(res.data.status) !== -1){
                                                if (progDef.failStates.indexOf(res.data.status) !== -1){
                                                    deferred.reject(res);
                                                }
                                                else {
                                                    deferred.resolve(res);
                                                }
                                            }
                                            else {
                                                return getProgress({id: progData.id, index:res.data.index});
                                            }
                                        },function(err){
                                            if (progDef.failStates.indexOf(err.data.status) !== -1){
                                                deferred.notify(err);
                                                deferred.reject(err);
                                            }
                                            else {
                                                deferred.reject(new CFError(ErrorTypes.Error, err, "Failed to return progress for progress id: " + progData.id + " at index: " + progData.index + ". this does not mean that the entire process has failed."));
                                            }
                                        });
                                };
                                getProgress({id: ret.data.id, index: 0});
                            }
                            else {
                                deferred.resolve(ret);
                            }
                        }
                    }, function(err){
                        deferred.reject(err);
                    });
            });
            return deferred.promise;
    };