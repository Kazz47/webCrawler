var jsdom = require("jsdom");
var jsURL = require("url");
//var ziprip = require("./modules/ziprip");
var DAO = require("./dao");
var UrlAdder = require("./UrlAdder");
var WordAdder = require("./WordAdder");
var config = require("./config.json");

console.log("Starting...");
var crawlerDAO = new DAO();
var pool = crawlerDAO.pool;

if (process.argv[2]) {
    config.settings.maxCrawlSize = process.argv[2];
}
crawlOutdatedPages();

function URL(id, url, seed) {
	this.id = id;
	this.url = url;
	this.seed = seed;
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
	console.log(new Date());
	pool.getConnection(function(err, connection) {
		if (err) console.log(err);
		else {
			connection.query("SELECT COUNT(*) AS c FROM Webpage", function(err , result) {
				if (result[0].c < config.settings.maxCrawlSize) {
					connection.query("SELECT u.Id, u.URL FROM URL AS u LEFT JOIN Webpage AS w ON u.Id = w.URLId WHERE w.URLId IS NULL", function(err, rows) {
						if (err) {
							console.log(err);
							crawlerDAO.close();
						} else {
                            console.log("Rows: " + rows.length);
							if (rows.length === 0) {
								//delete require.cache[require.resolve("../../resources/config.json")]
								//config = require("../../resources/config.json");
								//setTimeout(crawlOutdatedPages, 2000);
								console.log("Exit (No webpages left)");
								crawlerDAO.close();
							} else {
								var running = 0;
								var limit = 2;
								function urlParseLauncher() {
									while (running < limit && rows.length > 0) {
										var next = rows.shift();
										var url = new URL(next.Id, next.URL);
										parseUrl(url, function(err) {
											running--;
											if (err) {
												rows = [];
											}
											if (rows.length > 0) {
												urlParseLauncher();
											} else if (running == 0) {
												console.log("Done!");
												setTimeout(crawlOutdatedPages, 2000);
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
				} else {
					//delete require.cache[require.resolve("../../resources/config.json")]
					//config = require("../../resources/config.json");
					//setTimeout(crawlOutdatedPages, 2000);
					console.log("Exit (Too many pages)");
					crawlerDAO.close();
				}
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
				getSiteHeaderInfo(window, URL, function(err) {
					callback(err);
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

function getSiteHeaderInfo(window, url, callback) {
    var dom = window.document;
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
	checkURLs(links);

	var webpage = new Webpage(url.id, dom.title.trim());
	if (webpage.Title == "")
		webpage.Title = hostname;
	if (descriptionTag)
		webpage.Description = descriptionTag.content.trim();
	if (keywordsTag)
        webpage.Keywords = webpage.Keywords.concat(keywordsTag.content.trim().split(' '));
    webpage.Keywords = webpage.Keywords.concat(window.$("body").text().trim().replace(/\s+/g,' ').split(' '));

	checkWebpage(webpage, function(err) {
		callback(err);
	});
}

// Make sure URL has a seed.
function checkURLs(urls, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("CheckURL (Connection): " + err);
			callback(err);
		} else {
			var query = connection.query("SELECT u.URL FROM URL AS u WHERE u.IsSeed IS TRUE", function(err, seeds) {
				connection.release();
				if(err) {
					console.log("CheckURL: " + err);
					callback(err);
				} else {
					var confirmedURLs = [];
					for (var i=0; i<urls.length; i++) {
						for (var j=0; j<seeds.length; j++) {
							if (urls[i].indexOf(seeds[j].URL) >= 0) {
								confirmedURLs.push(new UrlAdder.URL(urls[i], seeds[j].URL));
								break;
							}
						}
					}
					var urlAdder = new UrlAdder();
					urlAdder.addUrls(confirmedURLs);
				}
			});
		//console.log("Query: " + query.sql);
		}
	});
}

function checkWebpage(webpage, callback) {
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log("CheckWebpage (Connection): " + err);
			callback(err);
		} else {
			var query = connection.query("SELECT w.Id FROM Webpage AS w \
					WHERE w.URLId = ?", [webpage.URLId], function(err, rows) {
				connection.release();
				if(err) {
					console.log("CheckWebpage: " + err);
					callback();
				} else {
					if (rows[0] == null) {
						addNewWebpage(webpage, function(err) {
							callback(err);
						});
					} else {
						updateWebpage(webpage, function(err) {
							callback(err);
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
			callback(err);
		} else {
			connection.query("SELECT COUNT(*) AS c FROM Webpage", function(err , result) {
				connection.release();
				if (result[0].c > config.settings.maxCrawlSize) {
					console.log("Too many pages!");
					callback(new Error("Too many pages!"));
				} else {
					var webpageSQL = {URLId: webpage.URLId, Title: webpage.Title, Description: webpage.Description};
					var query = connection.query("INSERT INTO Webpage SET ?", webpageSQL, function(err, result) {
						connection.release();
						if(err) {
							console.log("Add Webpage: " + err);
							callback(err);
						} else {
							webpage.Id = result.insertId;
							if (webpage.Keywords.length === 0) callback();
							else {
								var keywordAdder = new WordAdder();
								keywordAdder.addWords(webpage.Keywords.join(' '), webpage.Id);
								var descriptionAdder = new WordAdder();
								descriptionAdder.addWords(webpage.Description, webpage.Id);
								callback();
							}
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
			callback(err);
		} else {
			connection.query("UPDATE Webpage SET ?", webpage, function(err, result) {
				connection.release();
				if(err) {
					console.log("Update Webpage: " + err);
					callback(err);
				} else {
					webpage.Id = result.insertId;
					if (webpage.Keywords.length === 0) callback();
					else {
						var keywordAdder = new WordAdder();
						keywordAdder.addWords(webpage.Keywords.join(' '), webpage.Id);
						var descriptionAdder = new WordAdder();
						descriptionAdder.addWords(webpage.Description, webpage.Id);
						callback();
					}
				}
			});
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
