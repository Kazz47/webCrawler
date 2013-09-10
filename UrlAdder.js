/*
 * Script to add a list of URLs to the database for parsing.
 *
 *
 */

var jsURL = require("url");
var crypto = require("crypto");
var flr = require("./FileLineReader");

function UrlAdder() {
	this.DAO = require("./dao");
	this.addDAO = new this.DAO();
	this.pool = this.addDAO.pool;
}

UrlAdder.prototype.addUrls = function(urls) {
	if (!urls) return;
	var self = this;
	
	var running = 0;
	var limit = 10;
	function urlAddLauncher() {
		while (running < limit && urls.length > 0) {
			var url = urls.shift();
			self.addUrl(url, function() {
				running--;
				if (urls.length > 0) {
					urlAddLauncher();
				} else if (running === 0) {
					console.log("Done adding URLs.");
					self.addDAO.close();
				}
			});
			running++;
		}
	}
	urlAddLauncher();
}

// Add new url.
UrlAdder.prototype.addUrl = function(url, callback) {
	this.pool.getConnection(function(err, connection) {
		if (err) console.log("Add URL (Connection): " + err);
		else {
			hashIndex = url.indexOf("#");
			if (hashIndex > 0) url = url.substring(0, hashIndex);
			url = url.trim().replace(/\/+$/, "");
			var urlHash = crypto.createHash("md5").update(url).digest("hex");
			var urlObj = {Hash: urlHash, URL: url, DomainName: jsURL.parse(url).hostname};
			var query = connection.query("INSERT INTO URL SET ?", urlObj, function(err, result) {
				if(err && err.code != "ER_DUP_ENTRY") console.log("Add URL: " + err.code);
				connection.release();
				callback();
			});
			//console.log("Query: " + query.sql);
		}
	});
}

//var file = new flr.FileLineReader("sites.dat", 100);

var adder = new UrlAdder();
var cmdUrls = [];
for (var i=2; i<process.argv.length; i++) {
	cmdUrls.push(process.argv[i]);
}
adder.addUrls(cmdUrls);

module.exports = UrlAdder;