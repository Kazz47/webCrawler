var jsdom = require("jsdom");
var jsURL = require("url");
var ziprip = require("./modules/ziprip");
var DAO = require("./dao");
var UrlAdder = require("./UrlAdder");

console.log("Starting...");
var crawlerDAO = new DAO();
var pool = crawlerDAO.pool;

crawlOutdatedPages();

function URL(id, url) {
	this.id = id;
	this.url = url;
}

function Webpage(urlId, title) {
	this.Id = null;
	this.Keywords = [];
	this.Description = null;
	this.Parsed = null;
	
	this.URLId = urlId;
	this.Title = title;
}

// Add a callback?

function crawlOutdatedPages(depth) {
	pool.getConnection(function(err, connection) {
		if (err) console.log(err);
		else {
			connection.query("SELECT u.Id, u.URL FROM URL AS u \
					LEFT JOIN Webpage AS w ON u.Id = w.URLId \
					WHERE w.URLId IS NULL", function(err, rows) {
				if (err) {
					console.log(err);
					crawlerDAO.close();
				} else {
					if (rows.length === 0) {
						setTimeout(crawlOutdatedPages, 2000);
						//crawlerDAO.close();
					} else {
						var running = 0;
						var limit = 5;
						function urlParseLauncher() {
							while (running < limit && rows.length > 0) {
								var next = rows.shift();
								var url = new URL(next.Id, next.URL);
								parseUrl(url, function() {
									running--;
									if (rows.length > 0) {
										urlParseLauncher();
									} else if (running == 0) {
										console.log("Done!");
										crawlOutdatedPages();
										//crawlerDAO.close();
									}
								});
								running++;
							}
						}
						urlParseLauncher();
					}
				}
				connection.release();
			});
		}
	});
}

function parseUrl(URL, callback) {
	try {
		console.log(URL.url);
		jsdom.env({
			url: URL.url,
			scripts: ["http://code.jquery.com/jquery.js"],
			done: function (errors, window) {
				getSiteHeaderInfo(window.document, URL, function() {
					callback();
				});
				//printSite(window.document, window.url);
			}
		});
	}
	catch (err) {
		console.log("Error: ", err);
		callback();
	}
}

function getSiteHeaderInfo(dom, url, callback) {
	var hostname = jsURL.parse(url.url).hostname;
	var keywordsTag;
	var descriptionTag;
	var links = [];
	var metaTags = dom.getElementsByTagName("meta");
	var linkTags = dom.links;
	
	for (var i=0; i<metaTags.length; i++) {
		if (metaTags[i].name) {
			if (metaTags[i].name.toLowerCase() == "keywords")
				keywordsTag = metaTags[i];
			if (metaTags[i].name.toLowerCase() == "description")
				descriptionTag = metaTags[i];
		}
	}
	
	var links = [];
	for (var i=0; i<linkTags.length; i++) {
		if (jsURL.parse(linkTags[i].href).hostname == hostname)
			links.push(linkTags[i].href);
	}
	var urlAdder = new UrlAdder();
	urlAdder.addUrls(links);
		
	var webpage = new Webpage(url.id, dom.title.trim());
	if (webpage.Title == "")
		webpage.Title = hostname;
	if (descriptionTag)
		webpage.Description = descriptionTag.content.trim();
	if (keywordsTag)
		webpage.Keywords = keywordsTag.content.toLowerCase().split(",");
		
	checkWebpage(webpage, function() {
		callback();
	});
}

function checkWebpage(webpage, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("CheckWebpage (Connection): " + err);
			callback();
		} else {
			var query = connection.query("SELECT w.Id FROM Webpage AS w \
					WHERE w.URLId = ?", [webpage.URLId], function(err, rows) {
				connection.release();
				if(err) {
					console.log("CheckWebpage: " + err);
					callback();
				} else {
					if (rows[0] == null) {
						addNewWebpage(webpage, function() {
							callback();
						});
					} else {
						updateWebpage(webpage, function() {
							callback();
						});
					}
				}
			});
		//console.log("Query: " + query.sql);
		}
	});
}

function addNewWebpage(webpage, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Add Webpage (Connection): " + err);
			callback();
		} else {
			connection.query("SELECT COUNT(*) AS c FROM Webpage", function(err , result) {
				connection.release();
				if (result[0].c > 494) {
					console.log("Too many pages!");
					callback();
				} else {
					var webpageSQL = {URLId: webpage.URLId, Title: webpage.Title, Description: webpage.Description};
					var query = connection.query("INSERT INTO Webpage SET ?", webpageSQL, function(err, result) {
						connection.release();
						if(err) {
							console.log("Add Webpage: " + err);
							callback();
						} else {
							//console.log("Result: " + result.insertId);
							if (webpage.Keywords.length === 0) callback();
							var running = 0;
							var limit = 10;
							function keywordCheckLauncher() {
								while (running < limit && webpage.Keywords.length > 0) {
									var next = webpage.Keywords.shift();
									var url = new URL(next.Id, next.URL);
									checkKeyword(next, result.insertId, function() {
										running--;
										if (webpage.Keywords.length > 0) {
											keywordCheckLauncher();
										} else if (running == 0) {
											console.log("Done checking keywords.");
											callback();
										}
									});
									running++;
								}
							}
							keywordCheckLauncher();
						}
					});
				}
			});
			//console.log("Query: " + query.sql);
		}
	});
}

function updateWebpage(webpage, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Update Webpage (Connection): " + err);
			callback();
		} else {
			var query = connection.query("UPDATE Webpage SET ?", webpage, function(err, result) {
				connection.release();
				if(err) {
					console.log("Update Webpage: " + err);
					callback();
				} else {
					//console.log("Result: " + result.insertId);
					if (webpage.Keywords.length === 0) callback();
					var running = 0;
					var limit = 10;
					function keywordCheckLauncher() {
						while (running < limit && webpage.Keywords.length > 0) {
							var next = webpage.Keywords.shift();
							var url = new URL(next.Id, next.URL);
							checkKeyword(next, result.insertId, function() {
								running--;
								if (webpage.Keywords.length > 0) {
									keywordCheckLauncher();
								} else if (running == 0) {
									console.log("Done checking keywords.");
									callback();
								}
							});
							running++;
						}
					}
					keywordCheckLauncher();
				}
			});
			//console.log("Query: " + query.sql);
		}
	});
}

function checkKeyword(keyword, webpageId, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Select keyword (Connection): " + err);
			callback();
		} else {
			var keywordSQL = {Phrase: keyword.toLowerCase().trim()};
			var query = connection.query("SELECT k.Id FROM Keyword AS k WHERE ?", keywordSQL, function(err, rows) {
				connection.release();
				if (err) {
					console.log("Select keyword: " + err);
					callback();
				} else {
					if (rows[0] == null || rows[0].Id == 0) {
						addKeyword(keyword, webpageId, function() {
							callback();
						});
					} else {
						addKeywordToWebpage(rows[0].Id, webpageId, function() {
							callback();
						});
					}
				}
			});
			//console.log("Query: " + query.sql);
		}
	});
}

function addKeyword(keyword, webpageId, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Add keyword (Connection): " + err);
			callback();
		} else {
			var keywordSQL = {Phrase: keyword.toLowerCase().trim()};
			var query = connection.query("INSERT INTO Keyword SET ?", keywordSQL, function(err, result) {
				connection.release();
				if(err) {
					console.log("Add keyword: " + err);
					callback();
				} else {
					addKeywordToWebpage(result.insertId, webpageId, function() {
						callback();
					});
				}
			});
			//console.log("Query: " + query.sql);
		}
	});
}

function addKeywordToWebpage(keywordId, webpageId, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Add keyword to webpage (Connection): " + err);
			callback();
		} else {
			var webpageKeywordSQL = {WebpageId: webpageId, KeywordId: keywordId};
			var query = connection.query("INSERT INTO WebpageKeywordJoin SET ?", webpageKeywordSQL, function(err, result) {
				connection.release();
				if (err) console.log("Add keyword to webpage: " + err);
				callback();
			});
			//console.log("Query: " + query.sql);
		}
	});
}

// Unnecessary.
function printSite(dom, url) {
	var addresses = ziprip.extract(dom, url);
	if (addresses.length > 0) {
		for (var i=0; i<addresses.length; i++) {
			// Write results to database.
			console.log(addresses[i].title + " : " + addresses[i].postcode);
		}
	}
	else
		throw new Error(url + " did not return any addresses.");
}
