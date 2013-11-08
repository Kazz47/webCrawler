var restify = require('restify');
var config = require("./config.json");
var UrlAdder = require("./UrlAdder");
var $ = require("jquery");
var DAO = require("./dao");
var serviceDAO = new DAO();
var pool = serviceDAO.pool;

function getWebpageCount(req, res, next) {
    res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://people.cs.und.edu',
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
        'Access-Control-Allow-Origin': 'http://people.cs.und.edu',
        'Content-Type': 'text/plain'
    });
    res.write(config.settings.maxCrawlSize.toString());
    res.end();
}

function setMaxCrawlSize(req, res, next) {
    res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://people.cs.und.edu',
        'Content-Type': 'text/plain'
    });
    config.settings.maxCrawlSize = req.query.size;
    res.write(true.toString());
    res.end();
}

function getModal(req, res, next) {
    var modal;
    var webpageId = req.query.id;
    console.log(webpageId);
    res.header('Access-Control-Allow-Origin', 'htt://people.cs.und.edu');
    pool.getConnection(function(err, connection) {
        if (err) {
            console.log("Modal (connection): " + err);
        } else {
            connection.query("SELECT w.Id, w.Title, u.URL, u.Hash, s.URL as SeedURL, w.Description, w.Parsed AS Date FROM Webpage AS w JOIN URL AS u ON u.Id = w.URLId LEFT JOIN URL AS s ON u.SeedId = s.Id WHERE w.Id = ?", [webpageId], function(err, result) {
                if (err) {
                    console.log("Modal: " + err.code);
                } else {
                    console.log(result[0]);
                    modal = result[0];
                    console.log(modal);

		    connection.query("SELECT k.Word FROM Keyword AS k JOIN WebpageKeywordJoin AS w ON k.Id = w.KeywordId WHERE w.WebpageId = ?", [webpageId], function(err, rows) {
			connection.release();
			if (err) {
			    console.log("Keywords: " + err.code);
			} else {
			    var keywords = new Array();
			    for(var i=0; i<rows.length; i++) {
				keywords.push(rows[i].Word);
			    }
			    modal.Keywords = keywords;
			    res.send(modal);
			}
		    });
                }
            });
        }
    });
}

function getWebpages(req, res, next) {
    var webpages = [];
    var page = parseInt(req.query.page);
    var queryString = req.query.query;
    var displayMax = parseInt(req.query.dspmax);
    var keywords = req.query.keywords;
    if (!displayMax) displayMax = 20;

    res.header('Access-Control-Allow-Origin', 'http://people.cs.und.edu');

    pool.getConnection(function(err, connection) {
        if (err) {
            console.log("Webpages (connection): " + err);
        } else {
            var countQuery;
            var selectQuery;
            var numRows;
            var lastPage;
            var start = 0;
            var end = displayMax;
            if (!queryString) {
                countQuery = "SELECT COUNT(*) FROM Webpage LIMIT ?, ?";
                countQueryParams = [start, end];

                selectQuery = "SELECT w.Id, w.Title, u.URL FROM Webpage AS w JOIN URL AS u ON u.Id = w.URLId LIMIT ?, ?";
                selectQueryParams = [start, end];
            } else {
                queryString = queryString.trim();
                queryString = queryString.replace(" ", "|");

                countQuery = "SELECT COUNT(*) FROM Webpage AS w JOIN WebpageKeywordJoin AS wkj ON w.Id = wkj.WebpageId JOIN Keyword AS k ON wkj.KeywordId = k.Id WHERE k.Word REGEXP ?";
                //countQuery = "SELECT COUNT((SELECT (LN(wkj.Num+1) * (SELECT (SELECT COUNT(*) FROM Webpage)/(SELECT COUNT(*) FROM Webpage AS w LEFT JOIN WebpageKeywordJoin AS wkj ON w.Id = wkj.WebpageId LEFT JOIN Keyword AS k2 ON k2.Id = wkj.KeywordId WHERE k2.Word = k.Word) AS QUOTIENT)) AS sum) FROM WebpageKeywordJoin as wkj LEFT JOIN Keyword AS k ON wkj.KeywordId = k.Id WHERE wkj.WebpageId = w.Id AND k.Word REGEXP ?) AS sum FROM Webpage AS w JOIN URL AS u ON u.Id = w.URLId HAVING sum IS NOT NULL ORDER BY sum DESC LIMIT ?, ?";
                countQueryParams = [queryString, start, end];

                selectQuery = "SELECT w.Id, w.Title, u.URL FROM Webpage AS w JOIN WebpageKeywordJoin AS wkj ON w.Id = wkj.WebpageId JOIN Keyword AS k ON wkj.KeywordId = k.Id JOIN URL AS u ON u.Id = w.URLId WHERE k.Word REGEXP ? GROUP BY w.Id ORDER BY SUM(LN(DF)) DESC LIMIT ?, ?";
                //selectQuery = "SELECT w.Id, w.Title, u.URL, (SELECT (LN(wkj.Num+1) * (SELECT (SELECT COUNT(*) FROM Webpage)/(SELECT COUNT(*) FROM Webpage AS w LEFT JOIN WebpageKeywordJoin AS wkj ON w.Id = wkj.WebpageId LEFT JOIN Keyword AS k2 ON k2.Id = wkj.KeywordId WHERE k2.Word = k.Word) AS QUOTIENT)) AS sum FROM WebpageKeywordJoin as wkj LEFT JOIN Keyword AS k ON wkj.KeywordId = k.Id WHERE wkj.WebpageId = w.Id AND k.Word REGEXP ?) AS sum FROM Webpage AS w JOIN URL AS u ON u.Id = w.URLId HAVING sum IS NOT NULL ORDER BY sum DESC LIMIT ?, ?";
                selectQueryParams = [queryString, start, end];
            }
            connection.query(countQuery, countQueryParams, function(err, result) {
                if (err) {
                    console.log("CountWebpages: " + err);
                } else {
                    numRows = result[0].c;
                    lastPage = Math.ceil(numRows/displayMax);
                    if (page < 1) page = 1;
                    if (lastPage < 1) lastPage = 1;
                    else if (page > lastPage) page = lastPage;
                    start = (page-1)*displayMax;
                    end = displayMax;

                    connection.query(selectQuery, selectQueryParams, function(err, rows) {
                        connection.release();
                        if (err) {
                            console.log("SelectWebpages: " + err);
                        } else {
                            var index = start+1;
                            for(var i=0; i<rows.length; i++) {
                            webpages.push(rows[i]);
                            }
                            res.send(webpages);
                        }
                    });
                }
            });
        }
    });
}

function addSeed(req, res, next) {
    var seed = req.query.seed;
    var urlAdder = new UrlAdder();
    res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://people.cs.und.edu',
        'Content-Type': 'text/plain'
    });
    urlAdder.addSeed(seed, function(success) {
        res.write(success.toString());
        res.end();
    });
    $.post("http://people.cs.und.edu/~kgoehner/515/2/resources/library/addSeed.php", {count:config.settings.maxCrawlSize});
    console.log("Posted " + config.settings.maxCrawlSize + " to UND.");
}

function clearDB(req, res, next) {
    res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://people.cs.und.edu',
        'Content-Type': 'text/plain'
    });
    pool.getConnection(function(err, connection) {
        if (err) {
            res.write(false.toString());
        } else {
            connection.query("DELETE FROM Address");
            connection.query("DELETE FROM Keyword");
            connection.query("DELETE FROM URL");
            connection.query("DELETE FROM Webpage");
            connection.query("DELETE FROM WebpageAddresJoin");
            connection.query("DELETE FROM WebpageKeywordJoin");
            connection.release();
            res.write(true.toString());
            res.end();
        }
    });
}

var server = restify.createServer();
server.use(restify.queryParser());
server.get("/pageCount", getWebpageCount);
server.get("/crawlSize", getMaxCrawlSize);
server.get("/setCrawlSize", setMaxCrawlSize);
server.get("/modal", getModal);
server.get("/webpages", getWebpages);
server.get("/addSeed", addSeed);
server.get("/clear", clearDB);

server.listen(8080, function() {
        console.log('%s listening at %s', server.name, server.url);
});
