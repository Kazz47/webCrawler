var stemmer = require("porter-stemmer").stemmer;

function WordAdder() {
	this.DAO = require("./dao");
	this.addDAO = null;
	this.pool = null;
}

WordAdder.prototype.removeSpecialCharacters = function(string) {
	var cleanString = string.replace(/[^a-zA-Z0-9 ']/g, "");
	return cleanString;
}

WordAdder.prototype.wordSplitter = function(string) {
	var words = this.removeSpecialCharacters(string).split(" ");
	for (var i=0; i<words.length; i++) {
		words[i] = stemmer(words[i].replace(/^[']|[']$/, "").toLowerCase());
        if (words[i].trim() === "") {
            words.splice(i, 1);
            i--;
        }
	}
	return words
}

WordAdder.prototype.addWords = function(string, webpageId) {
	if (!string) {
		return;
	}
	var self = this;

	var words = this.wordSplitter(string.toLowerCase());

	if (words.length <= 0) return;

	this.addDAO = new this.DAO();
	this.pool = this.addDAO.pool;

	var running = 0;
	var limit = 2;
    var index = 0;

    console.log("Adding " + words.length + " words");
	function wordAddLauncher() {
		while (running < limit && words.length > 0) {
            var word = words.shift();
            index++;
            self.addWord(word, index, webpageId, function() {
                running--;
                if (words.length > 0) {
                    wordAddLauncher();
                } else if (running <= 0) {
                    console.log("Done adding words");
                    self.addDAO.close();
                    console.log("Word DAO closed");
                }
            });
            running++;
		}
	}
    wordAddLauncher();
}

// Add new word.
WordAdder.prototype.addWord = function(word, index, webpageId, callback) {
	var self = this;
    var time = 2000;
    function addWordLooper() {
        self.pool.getconnection(function(err, connection) {
            if (err) {
                console.log("add word (connection): " + err);
                if (err.code == "ER_CON_COUNT_ERROR") {
                    time = time * 2;
                    console.log("Sleeping for " + time/1000 + " seconds");
                    setTimeout(addWordLooper(), time);
                } else {
                    callback();
                }
            } else {
                connection.query("select id from stopword where word = ?", [word], function(err, result) {
                    if (err) {
                        connection.release();
                        console.log("check stopword: " + err.code);
                        callback();
                    } else if (result[0]) {
                        connection.release();
                        callback();
                    } else {
                        connection.query("select id from keyword where word = ?", [word], function(err, result) {
                            if (err) {
                                connection.release();
                                console.log("check word existance: " + err.code);
                                callback();
                            } else if (result[0]) {
                                connection.release();
                                var wordid = result[0].id;
                                self.addwordtopage(wordid, index, webpageid, function() {
                                    callback();
                                });
                            } else {
                                var wordobj = {word: word};
                                connection.query("insert into keyword set ?", wordobj, function(err, result) {
                                    connection.release();
                                    if (err) {
                                        console.log("add word: " + err.code);
                                        callback();
                                    } else {
                                        var wordid = result.insertid;
                                        self.addwordtopage(wordid, index, webpageid, function() {
                                            callback();
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }
    addWordLooper();
}

WordAdder.prototype.addWordToPage = function(wordId, index, webpageId, callback) {
    var self = this;
	this.pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Add word to page (Connection): " + err);
			callback();
		} else {
			var wkjObj = {WebpageId: webpageId, KeywordId: wordId};
			connection.query("INSERT INTO WebpageKeywordJoin SET ? ON DUPLICATE KEY UPDATE Num=Num+1", wkjObj, function(err, result) {
				if (err) {
					connection.release();
					console.log("Add wkj: " + err.code);
					callback();
				} else {
                    var wpObj = {WebpageId: webpageId, KeywordId: wordId, Position: index};
                    connection.query("INSERT INTO WebpagePosition SET ?", wpObj, function(err, result) {
                        connection.release();
                        if (err) {
                            console.log("Add wp: " + err.code);
                            callback();
                        } else {
                            self.updateKeywordDF(wordId, function() {
                                callback();
                            });
                        }
                    });
				}
			});
		}
	});
}

WordAdder.prototype.updateKeywordDF = function(wordId, callback) {
	this.pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Increment DF (Connection): " + err);
			callback();
		} else {
            connection.query("UPDATE Keyword SET DF = DF + 1 WHERE Id = ?", [wordId], function(err, result) {
                connection.release();
				if (err) {
					console.log("Increment DF: " + err.code);
					callback();
				} else {
					callback();
				}
            });
		}
	});
}

//var adder = new WordAdder();
//adder.addWords("… Author's name: …", 1);

module.exports = WordAdder;
