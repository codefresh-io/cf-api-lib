<%comment%>
    this.<%funcName%> = function(msg, block) {
        var self = this;

        return Q()
            .then(function(){
                return self.client.httpSend(msg, block)
                    .then(function(res){
                        var ret;
                        try {
                            ret = res.data;
                            var contentType = res.headers["content-type"];
                            if (contentType && contentType.indexOf("application/json") !== -1)
                                ret = JSON.parse(ret);
                        }
                        catch (ex) {
                            return Q.reject(new error.InternalServerError(ex.message), res);
                        }
<%afterRequest%>
                        return Q.resolve(ret);
                    }, function(err){
                        return Q.reject(self.sendError(err, null, msg));
                    }, function(prog){
                        //TODO handle progress just like success just delegate the progress and not resolve it
                    });
            });
    };
