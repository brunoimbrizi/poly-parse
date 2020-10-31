const Papa = require('papaparse');

const polyparse = (poly, opt = {}) => {
	if (typeof poly !== 'string') {
    throw new TypeError('poly-parse first parameter must be a string')
  }

	const params = {
		...opt,
		dynamicTyping: true,
		skipEmptyLines: true,
		comments: true,
		delimiter: ' ',
		download: false,
	};

	const trimmed = removeWhitespaces(poly);
	const results = Papa.parse(trimmed, params);

	if (results.errors.length) {
		console.log(results);
		return null;
	}

	if (!results.data.length) {
		throw new Error('poly-parse not enough data in the poly file')
	}

	return parse(results, opt.flat);
};

const removeWhitespaces = (str) => {
	return str.replace(/ +| +$/gm, ' ').replace(/^ +| +$/gm, '');
};

const getGroup = (arr, length, flat) => {
	if (flat || length < 2) return arr;
	
	const grp = [];
	arr.push(grp);
	return grp;
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


	// .node files
	// return early if data ends here
	if (data.length <= index + numberofpoints) {
		return {
			pointlist,
			pointattributelist,
			pointmarkerlist,
			numberofpoints,
			numberofpointattributes,
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