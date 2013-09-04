var jsdom = require("jsdom");
var ziprip = require("./modules/ziprip");
var flr = require("./FileLineReader");

console.log("Starting...");

var file = new flr.FileLineReader("sites.dat", 100);

while (file.hasNextLine()) {
	try {
		jsdom.env({
			url: file.nextLine(),
			scripts: ["http://code.jquery.com/jquery.js"],
			done: function (errors, window) {
				printSite(window.document, window.url);
			}
		});
	}
	catch (err) {
		console.log("Error: ", err);
	}
}

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
