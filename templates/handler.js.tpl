<%comment%>
    this.<%funcName%> = function(msg, block) {
        var self = this;

        return Q()
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
                            return Q.reject(new CFError(ErrorTypes.Error, "failed to parse response as a json object: " + res.data));
                        }
<%afterRequest%>
                        if (ret.statusCode >= 400 && ret.statusCode < 600 || ret.statusCode < 10){
                            return Q.reject(ret);
                        }
                        else {
                            return Q.resolve(ret);
                        }
                    }, function(err){
                        return Q.reject(err);
                    }, function(prog){
                        //TODO handle progress just like success just delegate the progress and not resolve it
                    });
            });
    };