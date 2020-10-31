const Papa = require('papaparse');

const polyparse = (poly, opt) => {
	return new Promise((resolve, reject) => {

		const { flat } = opt;
		const params = {
			dynamicTyping: true,
			skipEmptyLines: true,
			comments: true,
			delimiter: ' ',
			...opt
		};

		// async
		if (poly instanceof File || opt.download) {
			Papa.parse(poly, {
				complete: (results) => {
					if (results.errors.length) reject(results);
					else resolve(parse(results, flat));
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
			else resolve(parse(results, flat));
		}
	});
};

const getGroup = (arr, length, flat) => {
	if (flat || length < 2) return arr;
	
	const grup = [];
	arr.push(grup);
	return grup;
};

const parse = (results, flat = false) => {
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
	let group;

	const numberofpoints = data[index][0];
	const dimension = data[index][1];
	const numberofpointattributes = data[index][2];
	const numberofpointmarkers = data[index][3];
	const zeroBased = data[1][0] == 0;
	
	index++;

	for (let i = index; i < numberofpoints + index; i++) {
		const line = data[i];
		
		// group points in pairs (or dimension)
		group = getGroup(pointlist, dimension, flat);

		for (let j = 0; j < dimension; j++) {
			group.push(line[j + 1]);
		}

		// group point attributes if more than 1
		group = getGroup(pointattributelist, numberofpointattributes, flat);
		
		for (let j = 0; j < numberofpointattributes; j++) {
			group.push(line[dimension + j + 1]);
		}

		// only one marker per point, no grouping
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

		// group segments in pairs
		group = getGroup(segmentlist, 2, flat);

		for (let j = 0; j < 2; j++) {
			// convert to zero-based
			group.push(zeroBased ? line[j + 1] : line[j + 1] - 1);
		}

		// only one marker per segment, no grouping
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

		// group holes in pairs (or dimension)
		group = getGroup(holelist, dimension, flat);

		for (let j = 0; j < dimension; j++) {
			group.push(line[j + 1]);
		}
	}


	// regionlist
	index += numberofholes;

	const numberofregions = data[index] ? data[index][0] : 0;

	index++;

	for (let i = index; i < numberofregions + index; i++) {
		const line = data[i];

		// group regions (x, y, attribute, maximum area)
		group = getGroup(regionlist, dimension, flat);

		for (let j = 0; j < 4; j++) {
			group.push(line[j + 1]);
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