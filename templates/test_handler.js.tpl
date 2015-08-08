    it("should successfully execute <%name%>",  function() {
        return client.<%funcName%>(
            <%params%>)
            .then(function(res){
                // validate result
            }, function(err){
                // validate error
            }, function(prog){
                // validate progress
            });
    });