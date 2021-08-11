var pkg = require('./package.json');

if (typeof(nw) !== 'undefined') {
	nw.Window.open('./main.html', {
		'id': 'kissultragui',
		'title': 'KISS ULTRA GUI ' + pkg.version,
		'height': 600,
		'width': 1000,
		"min_width": 1000,
		"min_height": 600,
		'position': 'center',
		'resizable': true
	});
} else {
	console.log("Running on web");
}