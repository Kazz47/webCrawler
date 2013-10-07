var restify = require('restify');
var DAO = require("./dao);

function respond(req, res, next) {
    res.send("hello " + req.params.name);
}

function getWebpageCount() {
    var newDAO = new DAO();
    var pool = newDAO.pool;
    pool.getConnection(function(err, connection) {
        if (err) {
            console.log("Page count (connection): " + err);
            //callback();
        } else {
            connection.query("SELECT COUNT(*) FROM Webpage", function(err, result) {
                if (err) {
                    console.log("Page count: " + erro.code);
                    connection.release();
                    //callback();
                } else {
                    res.send(result[0]);
                    //callback();
                }
            });
        }
    });
}


var server = restify.createServer();
server.get("/hello/:name", respond);
server.head("/hello/:name", respond);

server.listen(8080, function() {
        console.log('%s listening at %s', server.name, server.url);
});
