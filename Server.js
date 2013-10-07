var restify = require('restify');
var config = require("./config.json");
var DAO = require("./dao");
var serviceDAO = new DAO();
var pool = serviceDAO.pool;

function getWebpageCount(req, res, next) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    pool.getConnection(function(err, connection) {
        if (err) {
            console.log("Page count (connection): " + err);
        } else {
            connection.query("SELECT COUNT(*) as c FROM Webpage", function(err, result) {
                connection.release();
                if (err) {
                    console.log("Page count: " + erro.code);
                } else {
                    res.write(result[0].c.toString());
                    res.end();
                }
            });
        }
    });
}

function getMaxCrawlSize(req, res, next) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.write(config.settings.maxCrawlSize.toString());
    res.end();
}


var server = restify.createServer();
server.head("/pageCount", getWebpageCount);
server.head("/crawlSize", getMaxCrawlSize);

server.listen(8080, function() {
        console.log('%s listening at %s', server.name, server.url);
});
