const Papa = require('papaparse');

const polyparse = (poly, opt) => {
	return new Promise((resolve, reject) => {

		const params = {
			dynamicTyping: true,
			delimiter: ' ',
			...opt
		};

		// async
		if (poly instanceof File || opt.download) {
			Papa.parse(poly, {
				complete: (results) => {
					if (results.errors.length) reject(results);
					else resolve(parse(results));
				},
				error: (results) => {
					reject(results);
				},
				...params
			});
		}

		// sync
		else {
			const results = Papa.parse(poly);

			if (results.errors.length) reject(results);
			else resolve(parse(results));
		}
	});
};

const parse = (results) => {
	const data = results.data;

	const pointlist = [];
	const pointattributelist = [];
	const pointmarkerlist = [];
	const segmentlist = [];
	const segmentmarkerlist = [];
	const holelist = [];
	const regionlist = [];


	// pointlist
	let index = 0;

	const numberofpoints = data[index][0];
	const dimension = data[index][1];
	const numberofpointattributes = data[index][2];
	const numberofpointmarkers = data[index][3];
	const zeroBased = data[1][0] == 0;
	
	index++;

	for (let i = index; i < numberofpoints + index; i++) {
		const line = data[i];
		
		for (let j = 0; j < dimension; j++) {
			pointlist.push(line[j + 1]);
		}
		
		for (let j = 0; j < numberofpointattributes; j++) {
			pointattributelist.push(line[dimension + j + 1]);
		}

		for (let j = 0; j < numberofpointmarkers; j++) {
			pointmarkerlist.push(line[dimension + numberofpointattributes + j + 1]);
		}
	}


	// segmentlist
	index += numberofpoints;

	const numberofsegments = data[index][0];
	const numberofsegmentmarkers = data[index][1];

	index++;

	for (let i = index; i < numberofsegments + index; i++) {
		const line = data[i];

		for (let j = 0; j < 2; j++) {
			// convert to zero-based
			segmentlist.push(zeroBased ? line[j + 1] : line[j + 1] - 1);
		}

		for (let j = 0; j < numberofsegmentmarkers; j++) {
			segmentmarkerlist.push(line[2 + j]);
		}
	}


	// holelist
	index += numberofsegments;

	const numberofholes = data[index][0];

	index++;

	for (let i = index; i < numberofholes + index; i++) {
		const line = data[i];

		for (let j = 0; j < dimension; j++) {
			holelist.push(line[j + 1]);
		}
	}


	// regionlist
	index += numberofholes;

	const numberofregions = data[index] ? data[index][0] : 0;

	index++;

	for (let i = index; i < numberofregions + index; i++) {
		const line = data[i];

		for (let j = 0; j < 4; j++) {
			regionlist.push(line[j + 1]);
		}
	}


	return {
		pointlist,
		pointattributelist,
		pointmarkerlist,
		numberofpoints,
		numberofpointattributes,
		segmentlist,
		segmentmarkerlist,
		numberofsegments,
		holelist,
		numberofholes,
		regionlist,
		numberofregions,
	};

};

module.exports = polyparse;