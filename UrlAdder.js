/*
 * Script to add a list of URLs to the database for parsing.
 *
 *
 */

var jsURL = require("url");
var crypto = require("crypto");
var flr = require("./FileLineReader");

var commonMediaFiles = ["zip", "pdf", "mp3", "jpg", "rar", "exe", "wvm", "doc", "avi", "ppt", "mpg", "tif", "wav", "mov", "psd", "wma", "sitx", "sit", "esp", "cdr", "ai", "xls", "mp4", "txt", "m4a", "rmvb", "bmp", "pps", "aif", "pub", "dwg", "gif", "qbb", "mpeg", "indd", "swf", "asf", "png", "dat", "rm", "mdb", "chm", "jar", "dvf", "dss", "dmg", "iso", "flv", "wpd", "cda", "m4b", "7z", "gz", "fla", "qxd", "rtf", "msi", "jpg", "jpeg", "m4v", "ogg", "torrent", "mp2", "bat", "sql"];
function UrlAdder() {
	this.DAO = require("./dao");
	this.addDAO = null;
	this.pool = null;
}

function URL(url, seed) {
	this.id;
	this.url = url;
	this.seed = seed;
}

UrlAdder.prototype.addUrls = function(urls) {
	if (urls.length <= 0) return;
	var self = this;

	this.addDAO = new this.DAO();
	this.pool = this.addDAO.pool;

	var running = 0;
	var limit = 2;
    console.log("Adding " + urls.length + " URLs");
	function urlAddLauncher() {
		while (running < limit && urls.length > 0) {
			var url = urls.shift();
			self.addUrl(url.url, url.seed, function() {
				running--;
				if (urls.length > 0) {
					urlAddLauncher();
				} else if (running === 0) {
					console.log("Done adding URLs");
					self.addDAO.close();
                    console.log("URL DAO closed");
				}
			});
			running++;
		}
	}
    urlAddLauncher();
}

// Add new url.
UrlAdder.prototype.addUrl = function(url, seed, callback) {
    var self = this;
    var time = 10000;
    function connectionLooper() {
        self.pool.getConnection(function(err, connection) {
            if (err) {
                console.log("Add URL (Connection): " + err);
                if (err.code == "ER_CON_COUNT_ERROR") {
                    console.log("Sleeping for " + time/1000 = " seconds");
                    setTimeout(connectionLooper(), time);
                } else {
                    callback();
                }
            }
            else {
                hashIndex = url.indexOf("#");
                if (hashIndex > 0) url = url.substring(0, hashIndex);
                url = url.trim().replace(/\/+$/, "");
                var regex = /.+\.([^?]+)(\?|$)/;
                var result = url.match(regex);
                if (commonMediaFiles.indexOf(result[1]) < 0) {
                    var seedHash = crypto.createHash("md5").update(seed).digest("hex");
                    connection.query("SELECT u.Id FROM URL AS u WHERE u.Hash = ?", [seedHash], function(err, result) {
                        if(err) {
                            connection.release();
                            console.log("Check URL: " + err.code);
                            callback();
                        } else {
                            var seedId = result[0].Id;
                            var urlHash = crypto.createHash("md5").update(url).digest("hex");
                            var urlObj = {Hash: urlHash, URL: url, SeedId: seedId, DomainName: jsURL.parse(url).hostname};
                            var time = 2000;
                            function urlAddLauncher() {
                                connection.query("INSERT INTO URL SET ?", urlObj, function(err, result) {
                                    if(err && err.code != "ER_DUP_ENTRY") console.log("Add URL: " + err.code);
                                    if(err && err.code == "ER_CON_COUNT_ERRhttp://people.cs.und.edu/~wenchen/course/515/OR") {
                                        time = time * 2;
                                        console.log("Sleep for " + time);
                                        setTimeout(urlAddLauncher(), time);
                                    }
                                    else {
                                        connection.release();
                                        callback();
                                    }
                                });
                            }
                            urlAddLauncher();
                        }
                    });
                } else {
                    connection.release();
                    callback();
                }
            }
        });
    }
    connectionLooper();
}

UrlAdder.prototype.addSeed = function(url, callback) {
	if (!url) return;
	var self = this;
	self.pool.getConnection(function(err, connection) {
		if (err) {
            console.log("Add Seed (Connection): " + err);
            callback(false);
        } else {
			hashIndex = url.indexOf("#");
			if (hashIndex > 0) url = url.substring(0, hashIndex);
			url = url.trim().replace(/\/+$/, "");
			var regex = /.+\.([^?]+)(\?|$)/;
			var result = url.match(regex);
			if (result && commonMediaFiles.indexOf(result[1]) < 0) {
				var urlHash = crypto.createHash("md5").update(url).digest("hex");
				var urlObj = {Hash: urlHash, URL: url, IsSeed: 1, DomainName: jsURL.parse(url).hostname};
				connection.query("INSERT INTO URL SET ?", urlObj, function(err, result) {
					if(err) {
                        console.log("Add Seed: " + err.code);
                        callback(false);
                    } else {
                        connection.release();
                        self.addDAO.close();
                        callback(true);
                    }
				});
			} else {
				connection.release();
				self.addDAO.close();
                callback(false);
			}
		}
	});
}

//var adder = new UrlAdder();
//if (process.argv[2]) adder.addSeed(process.argv[2]);

module.exports = UrlAdder;
module.exports.URL = URL;
