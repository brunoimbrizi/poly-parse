const polyparse = require('./index.js');

polyparse('./A.poly', { download: true })
	.then(data => console.log(data))
	.catch(err => console.log('ERROR', err))
