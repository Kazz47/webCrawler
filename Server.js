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
                    console.log("Page count: " + err.code);
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

function getModal(req, res, next) {
    var modal;
    var webpageId;
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    pool.getConnection(function(err, connection) {
        if (err) {
            console.log("Modal (connection): " + err);
        } else {
            connection.query("SELECT w.Id, w.Title, u.URL, u.Hash, s.URL as SeedURL, w.Description, w.Parsed AS Date FROM Webpage AS w JOIN URL AS u ON u.Id = w.URLId LEFT JOIN URL AS s ON u.SeedId = s.Id WHERE w.Id = ?", webpageId, function(err, rows) {
                if (err) {
                    console.log("Modal: " + err.code);
                } else {
                    modal = result[0];
                }
            });
            connection.query("SELECT k.Word FROM Keyword AS k JOIN WebpageKeywordJoin AS w ON k.Id = w.Keyword WHERE w.WebpageId = ?", webpageId, function(err, rows) {
                if (err) {
                    console.log("Keywords: " + err.code);
                } else {
                    var keywords = new Array();
                    for(int i=0; i<rows.length; i++) {
                        keywords.push(rows[i].Word);
                    }
                    modal.Keywords = keywords;
                    res.send(modal);
                }
            });
        }
    });
}


var server = restify.createServer();
server.get("/pageCount", getWebpageCount);
server.get("/crawlSize", getMaxCrawlSize);
server.get("/modal", getModal);

server.listen(8080, function() {
        console.log('%s listening at %s', server.name, server.url);
});
