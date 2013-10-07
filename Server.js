var restify = require('restify');
var DAO = require("./dao");

function getWebpageCount(req, res, next) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    var newDAO = new DAO();
    var pool = newDAO.pool;
    pool.getConnection(function(err, connection) {
        if (err) {
            console.log("Page count (connection): " + err);
            //callback();
        } else {
            connection.query("SELECT COUNT(*) as c FROM Webpage", function(err, result) {
                connection.release();
                if (err) {
                    console.log("Page count: " + erro.code);
                    //callback();
                } else {
                    res.write(result[0].c.toString());
                    res.end();
                    //callback();
                }
            });
        }
    });
}


var server = restify.createServer();
server.get("/pagecount", getWebpageCount);
server.head("/pagecount", getWebpageCount);

server.listen(8080, function() {
        console.log('%s listening at %s', server.name, server.url);
});
