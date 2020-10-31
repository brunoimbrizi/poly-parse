(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const polyparse = require('../index.js');
const normalize = require('normalize-path-scale');

// init canvas
const canvas = document.querySelector('canvas');
canvas.width = 640;
canvas.height = 640;

const ctx = canvas.getContext('2d');

// init select
const select = document.querySelector('select');
select.addEventListener('change', (e) => {
	loadPoly(e.target.value);
});

const loadPoly = (poly) => {
	fetch(poly)
		.then(result => result.text())
		.then(result => {
			const data = polyparse(result);
			console.log(data);
			draw(data);
		});
};

const scale = (points, sx, sy) => {
	for (let i = 0; i < points.length; i++) {
		points[i][0] *= sx;
		points[i][1] *= sy;
	}
};

const draw = (data) => {
	const points = data.pointlist.concat();
	const segments = data.segmentlist;

	normalize(points);
	scale(points, canvas.width * 0.4, canvas.height * -0.4);

	ctx.fillStyle = '#eee';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.save();
	ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
	ctx.fillStyle = '#000';
	
	// draw points
  let x, y;
  for (let i = 0; i < points.length; i++) {
    x = points[i][0];
    y = points[i][1];
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }


  // draw segments
  if (segments) {
	  let a, b;
	  for (let i = 0; i < segments.length; i++) {
	  	a = segments[i][0];
	    b = segments[i][1];

		  ctx.beginPath();
		  ctx.moveTo(points[a][0], points[a][1]);
	    ctx.lineTo(points[b][0], points[b][1]);
	  	ctx.stroke();
	  }
	}

  ctx.restore();
};

loadPoly(select.value);

},{"../index.js":2,"normalize-path-scale":4}],2:[function(require,module,exports){
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
},{"papaparse":5}],3:[function(require,module,exports){
'use strict'

module.exports = findBounds

function findBounds(points) {
  var n = points.length
  if(n === 0) {
    return [[], []]
  }
  var d = points[0].length
  var lo = points[0].slice()
  var hi = points[0].slice()
  for(var i=1; i<n; ++i) {
    var p = points[i]
    for(var j=0; j<d; ++j) {
      var x = p[j]
      lo[j] = Math.min(lo[j], x)
      hi[j] = Math.max(hi[j], x)
    }
  }
  return [lo, hi]
}
},{}],4:[function(require,module,exports){
var getBounds = require('bound-points')
var unlerp = require('unlerp')

module.exports = normalizePathScale
function normalizePathScale (positions, bounds) {
  if (!Array.isArray(positions)) {
    throw new TypeError('must specify positions as first argument')
  }
  if (!Array.isArray(bounds)) {
    bounds = getBounds(positions)
  }

  var min = bounds[0]
  var max = bounds[1]

  var width = max[0] - min[0]
  var height = max[1] - min[1]

  var aspectX = width > height ? 1 : (height / width)
  var aspectY = width > height ? (width / height) : 1

  if (max[0] - min[0] === 0 || max[1] - min[1] === 0) {
    return positions // div by zero; leave positions unchanged
  }

  for (var i = 0; i < positions.length; i++) {
    var pos = positions[i]
    pos[0] = (unlerp(min[0], max[0], pos[0]) * 2 - 1) / aspectX
    pos[1] = (unlerp(min[1], max[1], pos[1]) * 2 - 1) / aspectY
  }
  return positions
}
},{"bound-points":3,"unlerp":6}],5:[function(require,module,exports){
/* @license
Papa Parse
v5.3.0
https://github.com/mholt/PapaParse
License: MIT
*/
!function(e,t){"function"==typeof define&&define.amd?define([],t):"object"==typeof module&&"undefined"!=typeof exports?module.exports=t():e.Papa=t()}(this,function s(){"use strict";var f="undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==f?f:{};var n=!f.document&&!!f.postMessage,o=n&&/blob:/i.test((f.location||{}).protocol),a={},h=0,b={parse:function(e,t){var i=(t=t||{}).dynamicTyping||!1;U(i)&&(t.dynamicTypingFunction=i,i={});if(t.dynamicTyping=i,t.transform=!!U(t.transform)&&t.transform,t.worker&&b.WORKERS_SUPPORTED){var r=function(){if(!b.WORKERS_SUPPORTED)return!1;var e=(i=f.URL||f.webkitURL||null,r=s.toString(),b.BLOB_URL||(b.BLOB_URL=i.createObjectURL(new Blob(["(",r,")();"],{type:"text/javascript"})))),t=new f.Worker(e);var i,r;return t.onmessage=m,t.id=h++,a[t.id]=t}();return r.userStep=t.step,r.userChunk=t.chunk,r.userComplete=t.complete,r.userError=t.error,t.step=U(t.step),t.chunk=U(t.chunk),t.complete=U(t.complete),t.error=U(t.error),delete t.worker,void r.postMessage({input:e,config:t,workerId:r.id})}var n=null;b.NODE_STREAM_INPUT,"string"==typeof e?n=t.download?new l(t):new p(t):!0===e.readable&&U(e.read)&&U(e.on)?n=new g(t):(f.File&&e instanceof File||e instanceof Object)&&(n=new c(t));return n.stream(e)},unparse:function(e,t){var n=!1,m=!0,_=",",v="\r\n",s='"',a=s+s,i=!1,r=null,o=!1;!function(){if("object"!=typeof t)return;"string"!=typeof t.delimiter||b.BAD_DELIMITERS.filter(function(e){return-1!==t.delimiter.indexOf(e)}).length||(_=t.delimiter);("boolean"==typeof t.quotes||"function"==typeof t.quotes||Array.isArray(t.quotes))&&(n=t.quotes);"boolean"!=typeof t.skipEmptyLines&&"string"!=typeof t.skipEmptyLines||(i=t.skipEmptyLines);"string"==typeof t.newline&&(v=t.newline);"string"==typeof t.quoteChar&&(s=t.quoteChar);"boolean"==typeof t.header&&(m=t.header);if(Array.isArray(t.columns)){if(0===t.columns.length)throw new Error("Option columns is empty");r=t.columns}void 0!==t.escapeChar&&(a=t.escapeChar+s);"boolean"==typeof t.escapeFormulae&&(o=t.escapeFormulae)}();var h=new RegExp(q(s),"g");"string"==typeof e&&(e=JSON.parse(e));if(Array.isArray(e)){if(!e.length||Array.isArray(e[0]))return f(null,e,i);if("object"==typeof e[0])return f(r||u(e[0]),e,i)}else if("object"==typeof e)return"string"==typeof e.data&&(e.data=JSON.parse(e.data)),Array.isArray(e.data)&&(e.fields||(e.fields=e.meta&&e.meta.fields),e.fields||(e.fields=Array.isArray(e.data[0])?e.fields:u(e.data[0])),Array.isArray(e.data[0])||"object"==typeof e.data[0]||(e.data=[e.data])),f(e.fields||[],e.data||[],i);throw new Error("Unable to serialize unrecognized input");function u(e){if("object"!=typeof e)return[];var t=[];for(var i in e)t.push(i);return t}function f(e,t,i){var r="";"string"==typeof e&&(e=JSON.parse(e)),"string"==typeof t&&(t=JSON.parse(t));var n=Array.isArray(e)&&0<e.length,s=!Array.isArray(t[0]);if(n&&m){for(var a=0;a<e.length;a++)0<a&&(r+=_),r+=y(e[a],a);0<t.length&&(r+=v)}for(var o=0;o<t.length;o++){var h=n?e.length:t[o].length,u=!1,f=n?0===Object.keys(t[o]).length:0===t[o].length;if(i&&!n&&(u="greedy"===i?""===t[o].join("").trim():1===t[o].length&&0===t[o][0].length),"greedy"===i&&n){for(var d=[],l=0;l<h;l++){var c=s?e[l]:l;d.push(t[o][c])}u=""===d.join("").trim()}if(!u){for(var p=0;p<h;p++){0<p&&!f&&(r+=_);var g=n&&s?e[p]:p;r+=y(t[o][g],p)}o<t.length-1&&(!i||0<h&&!f)&&(r+=v)}}return r}function y(e,t){if(null==e)return"";if(e.constructor===Date)return JSON.stringify(e).slice(1,25);!0===o&&"string"==typeof e&&null!==e.match(/^[=+\-@].*$/)&&(e="'"+e);var i=e.toString().replace(h,a),r="boolean"==typeof n&&n||"function"==typeof n&&n(e,t)||Array.isArray(n)&&n[t]||function(e,t){for(var i=0;i<t.length;i++)if(-1<e.indexOf(t[i]))return!0;return!1}(i,b.BAD_DELIMITERS)||-1<i.indexOf(_)||" "===i.charAt(0)||" "===i.charAt(i.length-1);return r?s+i+s:i}}};if(b.RECORD_SEP=String.fromCharCode(30),b.UNIT_SEP=String.fromCharCode(31),b.BYTE_ORDER_MARK="\ufeff",b.BAD_DELIMITERS=["\r","\n",'"',b.BYTE_ORDER_MARK],b.WORKERS_SUPPORTED=!n&&!!f.Worker,b.NODE_STREAM_INPUT=1,b.LocalChunkSize=10485760,b.RemoteChunkSize=5242880,b.DefaultDelimiter=",",b.Parser=w,b.ParserHandle=i,b.NetworkStreamer=l,b.FileStreamer=c,b.StringStreamer=p,b.ReadableStreamStreamer=g,f.jQuery){var d=f.jQuery;d.fn.parse=function(o){var i=o.config||{},h=[];return this.each(function(e){if(!("INPUT"===d(this).prop("tagName").toUpperCase()&&"file"===d(this).attr("type").toLowerCase()&&f.FileReader)||!this.files||0===this.files.length)return!0;for(var t=0;t<this.files.length;t++)h.push({file:this.files[t],inputElem:this,instanceConfig:d.extend({},i)})}),e(),this;function e(){if(0!==h.length){var e,t,i,r,n=h[0];if(U(o.before)){var s=o.before(n.file,n.inputElem);if("object"==typeof s){if("abort"===s.action)return e="AbortError",t=n.file,i=n.inputElem,r=s.reason,void(U(o.error)&&o.error({name:e},t,i,r));if("skip"===s.action)return void u();"object"==typeof s.config&&(n.instanceConfig=d.extend(n.instanceConfig,s.config))}else if("skip"===s)return void u()}var a=n.instanceConfig.complete;n.instanceConfig.complete=function(e){U(a)&&a(e,n.file,n.inputElem),u()},b.parse(n.file,n.instanceConfig)}else U(o.complete)&&o.complete()}function u(){h.splice(0,1),e()}}}function u(e){this._handle=null,this._finished=!1,this._completed=!1,this._halted=!1,this._input=null,this._baseIndex=0,this._partialLine="",this._rowCount=0,this._start=0,this._nextChunk=null,this.isFirstChunk=!0,this._completeResults={data:[],errors:[],meta:{}},function(e){var t=E(e);t.chunkSize=parseInt(t.chunkSize),e.step||e.chunk||(t.chunkSize=null);this._handle=new i(t),(this._handle.streamer=this)._config=t}.call(this,e),this.parseChunk=function(e,t){if(this.isFirstChunk&&U(this._config.beforeFirstChunk)){var i=this._config.beforeFirstChunk(e);void 0!==i&&(e=i)}this.isFirstChunk=!1,this._halted=!1;var r=this._partialLine+e;this._partialLine="";var n=this._handle.parse(r,this._baseIndex,!this._finished);if(!this._handle.paused()&&!this._handle.aborted()){var s=n.meta.cursor;this._finished||(this._partialLine=r.substring(s-this._baseIndex),this._baseIndex=s),n&&n.data&&(this._rowCount+=n.data.length);var a=this._finished||this._config.preview&&this._rowCount>=this._config.preview;if(o)f.postMessage({results:n,workerId:b.WORKER_ID,finished:a});else if(U(this._config.chunk)&&!t){if(this._config.chunk(n,this._handle),this._handle.paused()||this._handle.aborted())return void(this._halted=!0);n=void 0,this._completeResults=void 0}return this._config.step||this._config.chunk||(this._completeResults.data=this._completeResults.data.concat(n.data),this._completeResults.errors=this._completeResults.errors.concat(n.errors),this._completeResults.meta=n.meta),this._completed||!a||!U(this._config.complete)||n&&n.meta.aborted||(this._config.complete(this._completeResults,this._input),this._completed=!0),a||n&&n.meta.paused||this._nextChunk(),n}this._halted=!0},this._sendError=function(e){U(this._config.error)?this._config.error(e):o&&this._config.error&&f.postMessage({workerId:b.WORKER_ID,error:e,finished:!1})}}function l(e){var r;(e=e||{}).chunkSize||(e.chunkSize=b.RemoteChunkSize),u.call(this,e),this._nextChunk=n?function(){this._readChunk(),this._chunkLoaded()}:function(){this._readChunk()},this.stream=function(e){this._input=e,this._nextChunk()},this._readChunk=function(){if(this._finished)this._chunkLoaded();else{if(r=new XMLHttpRequest,this._config.withCredentials&&(r.withCredentials=this._config.withCredentials),n||(r.onload=y(this._chunkLoaded,this),r.onerror=y(this._chunkError,this)),r.open(this._config.downloadRequestBody?"POST":"GET",this._input,!n),this._config.downloadRequestHeaders){var e=this._config.downloadRequestHeaders;for(var t in e)r.setRequestHeader(t,e[t])}if(this._config.chunkSize){var i=this._start+this._config.chunkSize-1;r.setRequestHeader("Range","bytes="+this._start+"-"+i)}try{r.send(this._config.downloadRequestBody)}catch(e){this._chunkError(e.message)}n&&0===r.status&&this._chunkError()}},this._chunkLoaded=function(){4===r.readyState&&(r.status<200||400<=r.status?this._chunkError():(this._start+=this._config.chunkSize?this._config.chunkSize:r.responseText.length,this._finished=!this._config.chunkSize||this._start>=function(e){var t=e.getResponseHeader("Content-Range");if(null===t)return-1;return parseInt(t.substring(t.lastIndexOf("/")+1))}(r),this.parseChunk(r.responseText)))},this._chunkError=function(e){var t=r.statusText||e;this._sendError(new Error(t))}}function c(e){var r,n;(e=e||{}).chunkSize||(e.chunkSize=b.LocalChunkSize),u.call(this,e);var s="undefined"!=typeof FileReader;this.stream=function(e){this._input=e,n=e.slice||e.webkitSlice||e.mozSlice,s?((r=new FileReader).onload=y(this._chunkLoaded,this),r.onerror=y(this._chunkError,this)):r=new FileReaderSync,this._nextChunk()},this._nextChunk=function(){this._finished||this._config.preview&&!(this._rowCount<this._config.preview)||this._readChunk()},this._readChunk=function(){var e=this._input;if(this._config.chunkSize){var t=Math.min(this._start+this._config.chunkSize,this._input.size);e=n.call(e,this._start,t)}var i=r.readAsText(e,this._config.encoding);s||this._chunkLoaded({target:{result:i}})},this._chunkLoaded=function(e){this._start+=this._config.chunkSize,this._finished=!this._config.chunkSize||this._start>=this._input.size,this.parseChunk(e.target.result)},this._chunkError=function(){this._sendError(r.error)}}function p(e){var i;u.call(this,e=e||{}),this.stream=function(e){return i=e,this._nextChunk()},this._nextChunk=function(){if(!this._finished){var e,t=this._config.chunkSize;return t?(e=i.substring(0,t),i=i.substring(t)):(e=i,i=""),this._finished=!i,this.parseChunk(e)}}}function g(e){u.call(this,e=e||{});var t=[],i=!0,r=!1;this.pause=function(){u.prototype.pause.apply(this,arguments),this._input.pause()},this.resume=function(){u.prototype.resume.apply(this,arguments),this._input.resume()},this.stream=function(e){this._input=e,this._input.on("data",this._streamData),this._input.on("end",this._streamEnd),this._input.on("error",this._streamError)},this._checkIsFinished=function(){r&&1===t.length&&(this._finished=!0)},this._nextChunk=function(){this._checkIsFinished(),t.length?this.parseChunk(t.shift()):i=!0},this._streamData=y(function(e){try{t.push("string"==typeof e?e:e.toString(this._config.encoding)),i&&(i=!1,this._checkIsFinished(),this.parseChunk(t.shift()))}catch(e){this._streamError(e)}},this),this._streamError=y(function(e){this._streamCleanUp(),this._sendError(e)},this),this._streamEnd=y(function(){this._streamCleanUp(),r=!0,this._streamData("")},this),this._streamCleanUp=y(function(){this._input.removeListener("data",this._streamData),this._input.removeListener("end",this._streamEnd),this._input.removeListener("error",this._streamError)},this)}function i(_){var a,o,h,r=Math.pow(2,53),n=-r,s=/^\s*-?(\d+\.?|\.\d+|\d+\.\d+)(e[-+]?\d+)?\s*$/,u=/(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,t=this,i=0,f=0,d=!1,e=!1,l=[],c={data:[],errors:[],meta:{}};if(U(_.step)){var p=_.step;_.step=function(e){if(c=e,m())g();else{if(g(),0===c.data.length)return;i+=e.data.length,_.preview&&i>_.preview?o.abort():(c.data=c.data[0],p(c,t))}}}function v(e){return"greedy"===_.skipEmptyLines?""===e.join("").trim():1===e.length&&0===e[0].length}function g(){if(c&&h&&(k("Delimiter","UndetectableDelimiter","Unable to auto-detect delimiting character; defaulted to '"+b.DefaultDelimiter+"'"),h=!1),_.skipEmptyLines)for(var e=0;e<c.data.length;e++)v(c.data[e])&&c.data.splice(e--,1);return m()&&function(){if(!c)return;function e(e,t){U(_.transformHeader)&&(e=_.transformHeader(e,t)),l.push(e)}if(Array.isArray(c.data[0])){for(var t=0;m()&&t<c.data.length;t++)c.data[t].forEach(e);c.data.splice(0,1)}else c.data.forEach(e)}(),function(){if(!c||!_.header&&!_.dynamicTyping&&!_.transform)return c;function e(e,t){var i,r=_.header?{}:[];for(i=0;i<e.length;i++){var n=i,s=e[i];_.header&&(n=i>=l.length?"__parsed_extra":l[i]),_.transform&&(s=_.transform(s,n)),s=y(n,s),"__parsed_extra"===n?(r[n]=r[n]||[],r[n].push(s)):r[n]=s}return _.header&&(i>l.length?k("FieldMismatch","TooManyFields","Too many fields: expected "+l.length+" fields but parsed "+i,f+t):i<l.length&&k("FieldMismatch","TooFewFields","Too few fields: expected "+l.length+" fields but parsed "+i,f+t)),r}var t=1;!c.data.length||Array.isArray(c.data[0])?(c.data=c.data.map(e),t=c.data.length):c.data=e(c.data,0);_.header&&c.meta&&(c.meta.fields=l);return f+=t,c}()}function m(){return _.header&&0===l.length}function y(e,t){return i=e,_.dynamicTypingFunction&&void 0===_.dynamicTyping[i]&&(_.dynamicTyping[i]=_.dynamicTypingFunction(i)),!0===(_.dynamicTyping[i]||_.dynamicTyping)?"true"===t||"TRUE"===t||"false"!==t&&"FALSE"!==t&&(function(e){if(s.test(e)){var t=parseFloat(e);if(n<t&&t<r)return!0}return!1}(t)?parseFloat(t):u.test(t)?new Date(t):""===t?null:t):t;var i}function k(e,t,i,r){var n={type:e,code:t,message:i};void 0!==r&&(n.row=r),c.errors.push(n)}this.parse=function(e,t,i){var r=_.quoteChar||'"';if(_.newline||(_.newline=function(e,t){e=e.substring(0,1048576);var i=new RegExp(q(t)+"([^]*?)"+q(t),"gm"),r=(e=e.replace(i,"")).split("\r"),n=e.split("\n"),s=1<n.length&&n[0].length<r[0].length;if(1===r.length||s)return"\n";for(var a=0,o=0;o<r.length;o++)"\n"===r[o][0]&&a++;return a>=r.length/2?"\r\n":"\r"}(e,r)),h=!1,_.delimiter)U(_.delimiter)&&(_.delimiter=_.delimiter(e),c.meta.delimiter=_.delimiter);else{var n=function(e,t,i,r,n){var s,a,o,h;n=n||[",","\t","|",";",b.RECORD_SEP,b.UNIT_SEP];for(var u=0;u<n.length;u++){var f=n[u],d=0,l=0,c=0;o=void 0;for(var p=new w({comments:r,delimiter:f,newline:t,preview:10}).parse(e),g=0;g<p.data.length;g++)if(i&&v(p.data[g]))c++;else{var m=p.data[g].length;l+=m,void 0!==o?0<m&&(d+=Math.abs(m-o),o=m):o=m}0<p.data.length&&(l/=p.data.length-c),(void 0===a||d<=a)&&(void 0===h||h<l)&&1.99<l&&(a=d,s=f,h=l)}return{successful:!!(_.delimiter=s),bestDelimiter:s}}(e,_.newline,_.skipEmptyLines,_.comments,_.delimitersToGuess);n.successful?_.delimiter=n.bestDelimiter:(h=!0,_.delimiter=b.DefaultDelimiter),c.meta.delimiter=_.delimiter}var s=E(_);return _.preview&&_.header&&s.preview++,a=e,o=new w(s),c=o.parse(a,t,i),g(),d?{meta:{paused:!0}}:c||{meta:{paused:!1}}},this.paused=function(){return d},this.pause=function(){d=!0,o.abort(),a=U(_.chunk)?"":a.substring(o.getCharIndex())},this.resume=function(){t.streamer._halted?(d=!1,t.streamer.parseChunk(a,!0)):setTimeout(t.resume,3)},this.aborted=function(){return e},this.abort=function(){e=!0,o.abort(),c.meta.aborted=!0,U(_.complete)&&_.complete(c),a=""}}function q(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(e){var O,D=(e=e||{}).delimiter,I=e.newline,T=e.comments,A=e.step,L=e.preview,F=e.fastMode,z=O=void 0===e.quoteChar?'"':e.quoteChar;if(void 0!==e.escapeChar&&(z=e.escapeChar),("string"!=typeof D||-1<b.BAD_DELIMITERS.indexOf(D))&&(D=","),T===D)throw new Error("Comment character same as delimiter");!0===T?T="#":("string"!=typeof T||-1<b.BAD_DELIMITERS.indexOf(T))&&(T=!1),"\n"!==I&&"\r"!==I&&"\r\n"!==I&&(I="\n");var M=0,j=!1;this.parse=function(a,t,i){if("string"!=typeof a)throw new Error("Input must be a string");var r=a.length,e=D.length,n=I.length,s=T.length,o=U(A),h=[],u=[],f=[],d=M=0;if(!a)return R();if(F||!1!==F&&-1===a.indexOf(O)){for(var l=a.split(I),c=0;c<l.length;c++){if(f=l[c],M+=f.length,c!==l.length-1)M+=I.length;else if(i)return R();if(!T||f.substring(0,s)!==T){if(o){if(h=[],b(f.split(D)),S(),j)return R()}else b(f.split(D));if(L&&L<=c)return h=h.slice(0,L),R(!0)}}return R()}for(var p=a.indexOf(D,M),g=a.indexOf(I,M),m=new RegExp(q(z)+q(O),"g"),_=a.indexOf(O,M);;)if(a[M]!==O)if(T&&0===f.length&&a.substring(M,M+s)===T){if(-1===g)return R();M=g+n,g=a.indexOf(I,M),p=a.indexOf(D,M)}else{if(-1!==p&&(p<g||-1===g)){if(!(p<_)){f.push(a.substring(M,p)),M=p+e,p=a.indexOf(D,M);continue}var v=x(p,_,g);if(v&&void 0!==v.nextDelim){p=v.nextDelim,_=v.quoteSearch,f.push(a.substring(M,p)),M=p+e,p=a.indexOf(D,M);continue}}if(-1===g)break;if(f.push(a.substring(M,g)),C(g+n),o&&(S(),j))return R();if(L&&h.length>=L)return R(!0)}else for(_=M,M++;;){if(-1===(_=a.indexOf(O,_+1)))return i||u.push({type:"Quotes",code:"MissingQuotes",message:"Quoted field unterminated",row:h.length,index:M}),E();if(_===r-1)return E(a.substring(M,_).replace(m,O));if(O!==z||a[_+1]!==z){if(O===z||0===_||a[_-1]!==z){-1!==p&&p<_+1&&(p=a.indexOf(D,_+1)),-1!==g&&g<_+1&&(g=a.indexOf(I,_+1));var y=w(-1===g?p:Math.min(p,g));if(a[_+1+y]===D){f.push(a.substring(M,_).replace(m,O)),a[M=_+1+y+e]!==O&&(_=a.indexOf(O,M)),p=a.indexOf(D,M),g=a.indexOf(I,M);break}var k=w(g);if(a.substring(_+1+k,_+1+k+n)===I){if(f.push(a.substring(M,_).replace(m,O)),C(_+1+k+n),p=a.indexOf(D,M),_=a.indexOf(O,M),o&&(S(),j))return R();if(L&&h.length>=L)return R(!0);break}u.push({type:"Quotes",code:"InvalidQuotes",message:"Trailing quote on quoted field is malformed",row:h.length,index:M}),_++}}else _++}return E();function b(e){h.push(e),d=M}function w(e){var t=0;if(-1!==e){var i=a.substring(_+1,e);i&&""===i.trim()&&(t=i.length)}return t}function E(e){return i||(void 0===e&&(e=a.substring(M)),f.push(e),M=r,b(f),o&&S()),R()}function C(e){M=e,b(f),f=[],g=a.indexOf(I,M)}function R(e){return{data:h,errors:u,meta:{delimiter:D,linebreak:I,aborted:j,truncated:!!e,cursor:d+(t||0)}}}function S(){A(R()),h=[],u=[]}function x(e,t,i){var r={nextDelim:void 0,quoteSearch:void 0},n=a.indexOf(O,t+1);if(t<e&&e<n&&(n<i||-1===i)){var s=a.indexOf(D,n);if(-1===s)return r;n<s&&(n=a.indexOf(O,n+1)),r=x(s,n,i)}else r={nextDelim:e,quoteSearch:t};return r}},this.abort=function(){j=!0},this.getCharIndex=function(){return M}}function m(e){var t=e.data,i=a[t.workerId],r=!1;if(t.error)i.userError(t.error,t.file);else if(t.results&&t.results.data){var n={abort:function(){r=!0,_(t.workerId,{data:[],errors:[],meta:{aborted:!0}})},pause:v,resume:v};if(U(i.userStep)){for(var s=0;s<t.results.data.length&&(i.userStep({data:t.results.data[s],errors:t.results.errors,meta:t.results.meta},n),!r);s++);delete t.results}else U(i.userChunk)&&(i.userChunk(t.results,n,t.file),delete t.results)}t.finished&&!r&&_(t.workerId,t.results)}function _(e,t){var i=a[e];U(i.userComplete)&&i.userComplete(t),i.terminate(),delete a[e]}function v(){throw new Error("Not implemented.")}function E(e){if("object"!=typeof e||null===e)return e;var t=Array.isArray(e)?[]:{};for(var i in e)t[i]=E(e[i]);return t}function y(e,t){return function(){e.apply(t,arguments)}}function U(e){return"function"==typeof e}return o&&(f.onmessage=function(e){var t=e.data;void 0===b.WORKER_ID&&t&&(b.WORKER_ID=t.workerId);if("string"==typeof t.input)f.postMessage({workerId:b.WORKER_ID,results:b.parse(t.input,t.config),finished:!0});else if(f.File&&t.input instanceof File||t.input instanceof Object){var i=b.parse(t.input,t.config);i&&f.postMessage({workerId:b.WORKER_ID,results:i,finished:!0})}}),(l.prototype=Object.create(u.prototype)).constructor=l,(c.prototype=Object.create(u.prototype)).constructor=c,(p.prototype=Object.create(p.prototype)).constructor=p,(g.prototype=Object.create(u.prototype)).constructor=g,b});
},{}],6:[function(require,module,exports){
module.exports = function range(min, max, value) {
  return (value - min) / (max - min)
}
},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL2J1ZG8vbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImRlbW8uanMiLCIuLi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9ib3VuZC1wb2ludHMvYm91bmRzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL25vcm1hbGl6ZS1wYXRoLXNjYWxlL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3BhcGFwYXJzZS9wYXBhcGFyc2UubWluLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3VubGVycC9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IHBvbHlwYXJzZSA9IHJlcXVpcmUoJy4uL2luZGV4LmpzJyk7XHJcbmNvbnN0IG5vcm1hbGl6ZSA9IHJlcXVpcmUoJ25vcm1hbGl6ZS1wYXRoLXNjYWxlJyk7XHJcblxyXG4vLyBpbml0IGNhbnZhc1xyXG5jb25zdCBjYW52YXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKTtcclxuY2FudmFzLndpZHRoID0gNjQwO1xyXG5jYW52YXMuaGVpZ2h0ID0gNjQwO1xyXG5cclxuY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XHJcblxyXG4vLyBpbml0IHNlbGVjdFxyXG5jb25zdCBzZWxlY3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdzZWxlY3QnKTtcclxuc2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiB7XHJcblx0bG9hZFBvbHkoZS50YXJnZXQudmFsdWUpO1xyXG59KTtcclxuXHJcbmNvbnN0IGxvYWRQb2x5ID0gKHBvbHkpID0+IHtcclxuXHRmZXRjaChwb2x5KVxyXG5cdFx0LnRoZW4ocmVzdWx0ID0+IHJlc3VsdC50ZXh0KCkpXHJcblx0XHQudGhlbihyZXN1bHQgPT4ge1xyXG5cdFx0XHRjb25zdCBkYXRhID0gcG9seXBhcnNlKHJlc3VsdCk7XHJcblx0XHRcdGNvbnNvbGUubG9nKGRhdGEpO1xyXG5cdFx0XHRkcmF3KGRhdGEpO1xyXG5cdFx0fSk7XHJcbn07XHJcblxyXG5jb25zdCBzY2FsZSA9IChwb2ludHMsIHN4LCBzeSkgPT4ge1xyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRwb2ludHNbaV1bMF0gKj0gc3g7XHJcblx0XHRwb2ludHNbaV1bMV0gKj0gc3k7XHJcblx0fVxyXG59O1xyXG5cclxuY29uc3QgZHJhdyA9IChkYXRhKSA9PiB7XHJcblx0Y29uc3QgcG9pbnRzID0gZGF0YS5wb2ludGxpc3QuY29uY2F0KCk7XHJcblx0Y29uc3Qgc2VnbWVudHMgPSBkYXRhLnNlZ21lbnRsaXN0O1xyXG5cclxuXHRub3JtYWxpemUocG9pbnRzKTtcclxuXHRzY2FsZShwb2ludHMsIGNhbnZhcy53aWR0aCAqIDAuNCwgY2FudmFzLmhlaWdodCAqIC0wLjQpO1xyXG5cclxuXHRjdHguZmlsbFN0eWxlID0gJyNlZWUnO1xyXG5cdGN0eC5maWxsUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xyXG5cclxuXHRjdHguc2F2ZSgpO1xyXG5cdGN0eC50cmFuc2xhdGUoY2FudmFzLndpZHRoICogMC41LCBjYW52YXMuaGVpZ2h0ICogMC41KTtcclxuXHRjdHguZmlsbFN0eWxlID0gJyMwMDAnO1xyXG5cdFxyXG5cdC8vIGRyYXcgcG9pbnRzXHJcbiAgbGV0IHgsIHk7XHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcclxuICAgIHggPSBwb2ludHNbaV1bMF07XHJcbiAgICB5ID0gcG9pbnRzW2ldWzFdO1xyXG4gICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgY3R4LmFyYyh4LCB5LCAyLCAwLCBNYXRoLlBJICogMik7XHJcbiAgICBjdHguZmlsbCgpO1xyXG4gIH1cclxuXHJcblxyXG4gIC8vIGRyYXcgc2VnbWVudHNcclxuICBpZiAoc2VnbWVudHMpIHtcclxuXHQgIGxldCBhLCBiO1xyXG5cdCAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xyXG5cdCAgXHRhID0gc2VnbWVudHNbaV1bMF07XHJcblx0ICAgIGIgPSBzZWdtZW50c1tpXVsxXTtcclxuXHJcblx0XHQgIGN0eC5iZWdpblBhdGgoKTtcclxuXHRcdCAgY3R4Lm1vdmVUbyhwb2ludHNbYV1bMF0sIHBvaW50c1thXVsxXSk7XHJcblx0ICAgIGN0eC5saW5lVG8ocG9pbnRzW2JdWzBdLCBwb2ludHNbYl1bMV0pO1xyXG5cdCAgXHRjdHguc3Ryb2tlKCk7XHJcblx0ICB9XHJcblx0fVxyXG5cclxuICBjdHgucmVzdG9yZSgpO1xyXG59O1xyXG5cclxubG9hZFBvbHkoc2VsZWN0LnZhbHVlKTtcclxuIiwiY29uc3QgUGFwYSA9IHJlcXVpcmUoJ3BhcGFwYXJzZScpO1xyXG5cclxuY29uc3QgcG9seXBhcnNlID0gKHBvbHksIG9wdCA9IHt9KSA9PiB7XHJcblx0aWYgKHR5cGVvZiBwb2x5ICE9PSAnc3RyaW5nJykge1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncG9seS1wYXJzZSBmaXJzdCBwYXJhbWV0ZXIgbXVzdCBiZSBhIHN0cmluZycpXHJcbiAgfVxyXG5cclxuXHRjb25zdCBwYXJhbXMgPSB7XHJcblx0XHQuLi5vcHQsXHJcblx0XHRkeW5hbWljVHlwaW5nOiB0cnVlLFxyXG5cdFx0c2tpcEVtcHR5TGluZXM6IHRydWUsXHJcblx0XHRjb21tZW50czogdHJ1ZSxcclxuXHRcdGRlbGltaXRlcjogJyAnLFxyXG5cdFx0ZG93bmxvYWQ6IGZhbHNlLFxyXG5cdH07XHJcblxyXG5cdGNvbnN0IHRyaW1tZWQgPSByZW1vdmVXaGl0ZXNwYWNlcyhwb2x5KTtcclxuXHRjb25zdCByZXN1bHRzID0gUGFwYS5wYXJzZSh0cmltbWVkLCBwYXJhbXMpO1xyXG5cclxuXHRpZiAocmVzdWx0cy5lcnJvcnMubGVuZ3RoKSB7XHJcblx0XHRjb25zb2xlLmxvZyhyZXN1bHRzKTtcclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0aWYgKCFyZXN1bHRzLmRhdGEubGVuZ3RoKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ3BvbHktcGFyc2Ugbm90IGVub3VnaCBkYXRhIGluIHRoZSBwb2x5IGZpbGUnKVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHBhcnNlKHJlc3VsdHMsIG9wdC5mbGF0KTtcclxufTtcclxuXHJcbmNvbnN0IHJlbW92ZVdoaXRlc3BhY2VzID0gKHN0cikgPT4ge1xyXG5cdHJldHVybiBzdHIucmVwbGFjZSgvICt8ICskL2dtLCAnICcpLnJlcGxhY2UoL14gK3wgKyQvZ20sICcnKTtcclxufTtcclxuXHJcbmNvbnN0IGdldEdyb3VwID0gKGFyciwgbGVuZ3RoLCBmbGF0KSA9PiB7XHJcblx0aWYgKGZsYXQgfHwgbGVuZ3RoIDwgMikgcmV0dXJuIGFycjtcclxuXHRcclxuXHRjb25zdCBncnAgPSBbXTtcclxuXHRhcnIucHVzaChncnApO1xyXG5cdHJldHVybiBncnA7XHJcbn07XHJcblxyXG5jb25zdCBwYXJzZSA9IChyZXN1bHRzLCBmbGF0ID0gZmFsc2UpID0+IHtcclxuXHRjb25zdCBkYXRhID0gcmVzdWx0cy5kYXRhO1xyXG5cclxuXHRjb25zdCBwb2ludGxpc3QgPSBbXTtcclxuXHRjb25zdCBwb2ludGF0dHJpYnV0ZWxpc3QgPSBbXTtcclxuXHRjb25zdCBwb2ludG1hcmtlcmxpc3QgPSBbXTtcclxuXHRjb25zdCBzZWdtZW50bGlzdCA9IFtdO1xyXG5cdGNvbnN0IHNlZ21lbnRtYXJrZXJsaXN0ID0gW107XHJcblx0Y29uc3QgaG9sZWxpc3QgPSBbXTtcclxuXHRjb25zdCByZWdpb25saXN0ID0gW107XHJcblxyXG5cclxuXHQvLyBwb2ludGxpc3RcclxuXHRsZXQgaW5kZXggPSAwO1xyXG5cdGxldCBncm91cDtcclxuXHJcblx0Y29uc3QgbnVtYmVyb2Zwb2ludHMgPSBkYXRhW2luZGV4XVswXTtcclxuXHRjb25zdCBkaW1lbnNpb24gPSBkYXRhW2luZGV4XVsxXTtcclxuXHRjb25zdCBudW1iZXJvZnBvaW50YXR0cmlidXRlcyA9IGRhdGFbaW5kZXhdWzJdO1xyXG5cdGNvbnN0IG51bWJlcm9mcG9pbnRtYXJrZXJzID0gZGF0YVtpbmRleF1bM107XHJcblx0Y29uc3QgemVyb0Jhc2VkID0gZGF0YVsxXVswXSA9PSAwO1xyXG5cdFxyXG5cdGluZGV4Kys7XHJcblxyXG5cdGZvciAobGV0IGkgPSBpbmRleDsgaSA8IG51bWJlcm9mcG9pbnRzICsgaW5kZXg7IGkrKykge1xyXG5cdFx0Y29uc3QgbGluZSA9IGRhdGFbaV07XHJcblx0XHRcclxuXHRcdC8vIGdyb3VwIHBvaW50cyBpbiBwYWlycyAob3IgZGltZW5zaW9uKVxyXG5cdFx0Z3JvdXAgPSBnZXRHcm91cChwb2ludGxpc3QsIGRpbWVuc2lvbiwgZmxhdCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgaiA9IDA7IGogPCBkaW1lbnNpb247IGorKykge1xyXG5cdFx0XHRncm91cC5wdXNoKGxpbmVbaiArIDFdKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBncm91cCBwb2ludCBhdHRyaWJ1dGVzIGlmIG1vcmUgdGhhbiAxXHJcblx0XHRncm91cCA9IGdldEdyb3VwKHBvaW50YXR0cmlidXRlbGlzdCwgbnVtYmVyb2Zwb2ludGF0dHJpYnV0ZXMsIGZsYXQpO1xyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IG51bWJlcm9mcG9pbnRhdHRyaWJ1dGVzOyBqKyspIHtcclxuXHRcdFx0Z3JvdXAucHVzaChsaW5lW2RpbWVuc2lvbiArIGogKyAxXSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gb25seSBvbmUgbWFya2VyIHBlciBwb2ludCwgbm8gZ3JvdXBpbmdcclxuXHRcdGZvciAobGV0IGogPSAwOyBqIDwgbnVtYmVyb2Zwb2ludG1hcmtlcnM7IGorKykge1xyXG5cdFx0XHRwb2ludG1hcmtlcmxpc3QucHVzaChsaW5lW2RpbWVuc2lvbiArIG51bWJlcm9mcG9pbnRhdHRyaWJ1dGVzICsgaiArIDFdKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHQvLyAubm9kZSBmaWxlc1xyXG5cdC8vIHJldHVybiBlYXJseSBpZiBkYXRhIGVuZHMgaGVyZVxyXG5cdGlmIChkYXRhLmxlbmd0aCA8PSBpbmRleCArIG51bWJlcm9mcG9pbnRzKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRwb2ludGxpc3QsXHJcblx0XHRcdHBvaW50YXR0cmlidXRlbGlzdCxcclxuXHRcdFx0cG9pbnRtYXJrZXJsaXN0LFxyXG5cdFx0XHRudW1iZXJvZnBvaW50cyxcclxuXHRcdFx0bnVtYmVyb2Zwb2ludGF0dHJpYnV0ZXMsXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gc2VnbWVudGxpc3RcclxuXHRpbmRleCArPSBudW1iZXJvZnBvaW50cztcclxuXHJcblx0Y29uc3QgbnVtYmVyb2ZzZWdtZW50cyA9IGRhdGFbaW5kZXhdWzBdO1xyXG5cdGNvbnN0IG51bWJlcm9mc2VnbWVudG1hcmtlcnMgPSBkYXRhW2luZGV4XVsxXTtcclxuXHJcblx0aW5kZXgrKztcclxuXHJcblx0Zm9yIChsZXQgaSA9IGluZGV4OyBpIDwgbnVtYmVyb2ZzZWdtZW50cyArIGluZGV4OyBpKyspIHtcclxuXHRcdGNvbnN0IGxpbmUgPSBkYXRhW2ldO1xyXG5cclxuXHRcdC8vIGdyb3VwIHNlZ21lbnRzIGluIHBhaXJzXHJcblx0XHRncm91cCA9IGdldEdyb3VwKHNlZ21lbnRsaXN0LCAyLCBmbGF0KTtcclxuXHJcblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xyXG5cdFx0XHQvLyBjb252ZXJ0IHRvIHplcm8tYmFzZWRcclxuXHRcdFx0Z3JvdXAucHVzaCh6ZXJvQmFzZWQgPyBsaW5lW2ogKyAxXSA6IGxpbmVbaiArIDFdIC0gMSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gb25seSBvbmUgbWFya2VyIHBlciBzZWdtZW50LCBubyBncm91cGluZ1xyXG5cdFx0Zm9yIChsZXQgaiA9IDA7IGogPCBudW1iZXJvZnNlZ21lbnRtYXJrZXJzOyBqKyspIHtcclxuXHRcdFx0c2VnbWVudG1hcmtlcmxpc3QucHVzaChsaW5lWzIgKyBqXSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gaG9sZWxpc3RcclxuXHRpbmRleCArPSBudW1iZXJvZnNlZ21lbnRzO1xyXG5cclxuXHRjb25zdCBudW1iZXJvZmhvbGVzID0gZGF0YVtpbmRleF1bMF07XHJcblxyXG5cdGluZGV4Kys7XHJcblxyXG5cdGZvciAobGV0IGkgPSBpbmRleDsgaSA8IG51bWJlcm9maG9sZXMgKyBpbmRleDsgaSsrKSB7XHJcblx0XHRjb25zdCBsaW5lID0gZGF0YVtpXTtcclxuXHJcblx0XHQvLyBncm91cCBob2xlcyBpbiBwYWlycyAob3IgZGltZW5zaW9uKVxyXG5cdFx0Z3JvdXAgPSBnZXRHcm91cChob2xlbGlzdCwgZGltZW5zaW9uLCBmbGF0KTtcclxuXHJcblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGRpbWVuc2lvbjsgaisrKSB7XHJcblx0XHRcdGdyb3VwLnB1c2gobGluZVtqICsgMV0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8vIHJlZ2lvbmxpc3RcclxuXHRpbmRleCArPSBudW1iZXJvZmhvbGVzO1xyXG5cclxuXHRjb25zdCBudW1iZXJvZnJlZ2lvbnMgPSBkYXRhW2luZGV4XSA/IGRhdGFbaW5kZXhdWzBdIDogMDtcclxuXHJcblx0aW5kZXgrKztcclxuXHJcblx0Zm9yIChsZXQgaSA9IGluZGV4OyBpIDwgbnVtYmVyb2ZyZWdpb25zICsgaW5kZXg7IGkrKykge1xyXG5cdFx0Y29uc3QgbGluZSA9IGRhdGFbaV07XHJcblxyXG5cdFx0Ly8gZ3JvdXAgcmVnaW9ucyAoeCwgeSwgYXR0cmlidXRlLCBtYXhpbXVtIGFyZWEpXHJcblx0XHRncm91cCA9IGdldEdyb3VwKHJlZ2lvbmxpc3QsIGRpbWVuc2lvbiwgZmxhdCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgaiA9IDA7IGogPCA0OyBqKyspIHtcclxuXHRcdFx0Z3JvdXAucHVzaChsaW5lW2ogKyAxXSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHBvaW50bGlzdCxcclxuXHRcdHBvaW50YXR0cmlidXRlbGlzdCxcclxuXHRcdHBvaW50bWFya2VybGlzdCxcclxuXHRcdG51bWJlcm9mcG9pbnRzLFxyXG5cdFx0bnVtYmVyb2Zwb2ludGF0dHJpYnV0ZXMsXHJcblx0XHRzZWdtZW50bGlzdCxcclxuXHRcdHNlZ21lbnRtYXJrZXJsaXN0LFxyXG5cdFx0bnVtYmVyb2ZzZWdtZW50cyxcclxuXHRcdGhvbGVsaXN0LFxyXG5cdFx0bnVtYmVyb2Zob2xlcyxcclxuXHRcdHJlZ2lvbmxpc3QsXHJcblx0XHRudW1iZXJvZnJlZ2lvbnMsXHJcblx0fTtcclxuXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHBvbHlwYXJzZTsiLCIndXNlIHN0cmljdCdcblxubW9kdWxlLmV4cG9ydHMgPSBmaW5kQm91bmRzXG5cbmZ1bmN0aW9uIGZpbmRCb3VuZHMocG9pbnRzKSB7XG4gIHZhciBuID0gcG9pbnRzLmxlbmd0aFxuICBpZihuID09PSAwKSB7XG4gICAgcmV0dXJuIFtbXSwgW11dXG4gIH1cbiAgdmFyIGQgPSBwb2ludHNbMF0ubGVuZ3RoXG4gIHZhciBsbyA9IHBvaW50c1swXS5zbGljZSgpXG4gIHZhciBoaSA9IHBvaW50c1swXS5zbGljZSgpXG4gIGZvcih2YXIgaT0xOyBpPG47ICsraSkge1xuICAgIHZhciBwID0gcG9pbnRzW2ldXG4gICAgZm9yKHZhciBqPTA7IGo8ZDsgKytqKSB7XG4gICAgICB2YXIgeCA9IHBbal1cbiAgICAgIGxvW2pdID0gTWF0aC5taW4obG9bal0sIHgpXG4gICAgICBoaVtqXSA9IE1hdGgubWF4KGhpW2pdLCB4KVxuICAgIH1cbiAgfVxuICByZXR1cm4gW2xvLCBoaV1cbn0iLCJ2YXIgZ2V0Qm91bmRzID0gcmVxdWlyZSgnYm91bmQtcG9pbnRzJylcbnZhciB1bmxlcnAgPSByZXF1aXJlKCd1bmxlcnAnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5vcm1hbGl6ZVBhdGhTY2FsZVxuZnVuY3Rpb24gbm9ybWFsaXplUGF0aFNjYWxlIChwb3NpdGlvbnMsIGJvdW5kcykge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocG9zaXRpb25zKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3BlY2lmeSBwb3NpdGlvbnMgYXMgZmlyc3QgYXJndW1lbnQnKVxuICB9XG4gIGlmICghQXJyYXkuaXNBcnJheShib3VuZHMpKSB7XG4gICAgYm91bmRzID0gZ2V0Qm91bmRzKHBvc2l0aW9ucylcbiAgfVxuXG4gIHZhciBtaW4gPSBib3VuZHNbMF1cbiAgdmFyIG1heCA9IGJvdW5kc1sxXVxuXG4gIHZhciB3aWR0aCA9IG1heFswXSAtIG1pblswXVxuICB2YXIgaGVpZ2h0ID0gbWF4WzFdIC0gbWluWzFdXG5cbiAgdmFyIGFzcGVjdFggPSB3aWR0aCA+IGhlaWdodCA/IDEgOiAoaGVpZ2h0IC8gd2lkdGgpXG4gIHZhciBhc3BlY3RZID0gd2lkdGggPiBoZWlnaHQgPyAod2lkdGggLyBoZWlnaHQpIDogMVxuXG4gIGlmIChtYXhbMF0gLSBtaW5bMF0gPT09IDAgfHwgbWF4WzFdIC0gbWluWzFdID09PSAwKSB7XG4gICAgcmV0dXJuIHBvc2l0aW9ucyAvLyBkaXYgYnkgemVybzsgbGVhdmUgcG9zaXRpb25zIHVuY2hhbmdlZFxuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3NpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb25zW2ldXG4gICAgcG9zWzBdID0gKHVubGVycChtaW5bMF0sIG1heFswXSwgcG9zWzBdKSAqIDIgLSAxKSAvIGFzcGVjdFhcbiAgICBwb3NbMV0gPSAodW5sZXJwKG1pblsxXSwgbWF4WzFdLCBwb3NbMV0pICogMiAtIDEpIC8gYXNwZWN0WVxuICB9XG4gIHJldHVybiBwb3NpdGlvbnNcbn0iLCIvKiBAbGljZW5zZVxuUGFwYSBQYXJzZVxudjUuMy4wXG5odHRwczovL2dpdGh1Yi5jb20vbWhvbHQvUGFwYVBhcnNlXG5MaWNlbnNlOiBNSVRcbiovXG4hZnVuY3Rpb24oZSx0KXtcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKFtdLHQpOlwib2JqZWN0XCI9PXR5cGVvZiBtb2R1bGUmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBleHBvcnRzP21vZHVsZS5leHBvcnRzPXQoKTplLlBhcGE9dCgpfSh0aGlzLGZ1bmN0aW9uIHMoKXtcInVzZSBzdHJpY3RcIjt2YXIgZj1cInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZj9zZWxmOlwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/d2luZG93OnZvaWQgMCE9PWY/Zjp7fTt2YXIgbj0hZi5kb2N1bWVudCYmISFmLnBvc3RNZXNzYWdlLG89biYmL2Jsb2I6L2kudGVzdCgoZi5sb2NhdGlvbnx8e30pLnByb3RvY29sKSxhPXt9LGg9MCxiPXtwYXJzZTpmdW5jdGlvbihlLHQpe3ZhciBpPSh0PXR8fHt9KS5keW5hbWljVHlwaW5nfHwhMTtVKGkpJiYodC5keW5hbWljVHlwaW5nRnVuY3Rpb249aSxpPXt9KTtpZih0LmR5bmFtaWNUeXBpbmc9aSx0LnRyYW5zZm9ybT0hIVUodC50cmFuc2Zvcm0pJiZ0LnRyYW5zZm9ybSx0LndvcmtlciYmYi5XT1JLRVJTX1NVUFBPUlRFRCl7dmFyIHI9ZnVuY3Rpb24oKXtpZighYi5XT1JLRVJTX1NVUFBPUlRFRClyZXR1cm4hMTt2YXIgZT0oaT1mLlVSTHx8Zi53ZWJraXRVUkx8fG51bGwscj1zLnRvU3RyaW5nKCksYi5CTE9CX1VSTHx8KGIuQkxPQl9VUkw9aS5jcmVhdGVPYmplY3RVUkwobmV3IEJsb2IoW1wiKFwiLHIsXCIpKCk7XCJdLHt0eXBlOlwidGV4dC9qYXZhc2NyaXB0XCJ9KSkpKSx0PW5ldyBmLldvcmtlcihlKTt2YXIgaSxyO3JldHVybiB0Lm9ubWVzc2FnZT1tLHQuaWQ9aCsrLGFbdC5pZF09dH0oKTtyZXR1cm4gci51c2VyU3RlcD10LnN0ZXAsci51c2VyQ2h1bms9dC5jaHVuayxyLnVzZXJDb21wbGV0ZT10LmNvbXBsZXRlLHIudXNlckVycm9yPXQuZXJyb3IsdC5zdGVwPVUodC5zdGVwKSx0LmNodW5rPVUodC5jaHVuayksdC5jb21wbGV0ZT1VKHQuY29tcGxldGUpLHQuZXJyb3I9VSh0LmVycm9yKSxkZWxldGUgdC53b3JrZXIsdm9pZCByLnBvc3RNZXNzYWdlKHtpbnB1dDplLGNvbmZpZzp0LHdvcmtlcklkOnIuaWR9KX12YXIgbj1udWxsO2IuTk9ERV9TVFJFQU1fSU5QVVQsXCJzdHJpbmdcIj09dHlwZW9mIGU/bj10LmRvd25sb2FkP25ldyBsKHQpOm5ldyBwKHQpOiEwPT09ZS5yZWFkYWJsZSYmVShlLnJlYWQpJiZVKGUub24pP249bmV3IGcodCk6KGYuRmlsZSYmZSBpbnN0YW5jZW9mIEZpbGV8fGUgaW5zdGFuY2VvZiBPYmplY3QpJiYobj1uZXcgYyh0KSk7cmV0dXJuIG4uc3RyZWFtKGUpfSx1bnBhcnNlOmZ1bmN0aW9uKGUsdCl7dmFyIG49ITEsbT0hMCxfPVwiLFwiLHY9XCJcXHJcXG5cIixzPSdcIicsYT1zK3MsaT0hMSxyPW51bGwsbz0hMTshZnVuY3Rpb24oKXtpZihcIm9iamVjdFwiIT10eXBlb2YgdClyZXR1cm47XCJzdHJpbmdcIiE9dHlwZW9mIHQuZGVsaW1pdGVyfHxiLkJBRF9ERUxJTUlURVJTLmZpbHRlcihmdW5jdGlvbihlKXtyZXR1cm4tMSE9PXQuZGVsaW1pdGVyLmluZGV4T2YoZSl9KS5sZW5ndGh8fChfPXQuZGVsaW1pdGVyKTsoXCJib29sZWFuXCI9PXR5cGVvZiB0LnF1b3Rlc3x8XCJmdW5jdGlvblwiPT10eXBlb2YgdC5xdW90ZXN8fEFycmF5LmlzQXJyYXkodC5xdW90ZXMpKSYmKG49dC5xdW90ZXMpO1wiYm9vbGVhblwiIT10eXBlb2YgdC5za2lwRW1wdHlMaW5lcyYmXCJzdHJpbmdcIiE9dHlwZW9mIHQuc2tpcEVtcHR5TGluZXN8fChpPXQuc2tpcEVtcHR5TGluZXMpO1wic3RyaW5nXCI9PXR5cGVvZiB0Lm5ld2xpbmUmJih2PXQubmV3bGluZSk7XCJzdHJpbmdcIj09dHlwZW9mIHQucXVvdGVDaGFyJiYocz10LnF1b3RlQ2hhcik7XCJib29sZWFuXCI9PXR5cGVvZiB0LmhlYWRlciYmKG09dC5oZWFkZXIpO2lmKEFycmF5LmlzQXJyYXkodC5jb2x1bW5zKSl7aWYoMD09PXQuY29sdW1ucy5sZW5ndGgpdGhyb3cgbmV3IEVycm9yKFwiT3B0aW9uIGNvbHVtbnMgaXMgZW1wdHlcIik7cj10LmNvbHVtbnN9dm9pZCAwIT09dC5lc2NhcGVDaGFyJiYoYT10LmVzY2FwZUNoYXIrcyk7XCJib29sZWFuXCI9PXR5cGVvZiB0LmVzY2FwZUZvcm11bGFlJiYobz10LmVzY2FwZUZvcm11bGFlKX0oKTt2YXIgaD1uZXcgUmVnRXhwKHEocyksXCJnXCIpO1wic3RyaW5nXCI9PXR5cGVvZiBlJiYoZT1KU09OLnBhcnNlKGUpKTtpZihBcnJheS5pc0FycmF5KGUpKXtpZighZS5sZW5ndGh8fEFycmF5LmlzQXJyYXkoZVswXSkpcmV0dXJuIGYobnVsbCxlLGkpO2lmKFwib2JqZWN0XCI9PXR5cGVvZiBlWzBdKXJldHVybiBmKHJ8fHUoZVswXSksZSxpKX1lbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBlKXJldHVyblwic3RyaW5nXCI9PXR5cGVvZiBlLmRhdGEmJihlLmRhdGE9SlNPTi5wYXJzZShlLmRhdGEpKSxBcnJheS5pc0FycmF5KGUuZGF0YSkmJihlLmZpZWxkc3x8KGUuZmllbGRzPWUubWV0YSYmZS5tZXRhLmZpZWxkcyksZS5maWVsZHN8fChlLmZpZWxkcz1BcnJheS5pc0FycmF5KGUuZGF0YVswXSk/ZS5maWVsZHM6dShlLmRhdGFbMF0pKSxBcnJheS5pc0FycmF5KGUuZGF0YVswXSl8fFwib2JqZWN0XCI9PXR5cGVvZiBlLmRhdGFbMF18fChlLmRhdGE9W2UuZGF0YV0pKSxmKGUuZmllbGRzfHxbXSxlLmRhdGF8fFtdLGkpO3Rocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBzZXJpYWxpemUgdW5yZWNvZ25pemVkIGlucHV0XCIpO2Z1bmN0aW9uIHUoZSl7aWYoXCJvYmplY3RcIiE9dHlwZW9mIGUpcmV0dXJuW107dmFyIHQ9W107Zm9yKHZhciBpIGluIGUpdC5wdXNoKGkpO3JldHVybiB0fWZ1bmN0aW9uIGYoZSx0LGkpe3ZhciByPVwiXCI7XCJzdHJpbmdcIj09dHlwZW9mIGUmJihlPUpTT04ucGFyc2UoZSkpLFwic3RyaW5nXCI9PXR5cGVvZiB0JiYodD1KU09OLnBhcnNlKHQpKTt2YXIgbj1BcnJheS5pc0FycmF5KGUpJiYwPGUubGVuZ3RoLHM9IUFycmF5LmlzQXJyYXkodFswXSk7aWYobiYmbSl7Zm9yKHZhciBhPTA7YTxlLmxlbmd0aDthKyspMDxhJiYocis9Xykscis9eShlW2FdLGEpOzA8dC5sZW5ndGgmJihyKz12KX1mb3IodmFyIG89MDtvPHQubGVuZ3RoO28rKyl7dmFyIGg9bj9lLmxlbmd0aDp0W29dLmxlbmd0aCx1PSExLGY9bj8wPT09T2JqZWN0LmtleXModFtvXSkubGVuZ3RoOjA9PT10W29dLmxlbmd0aDtpZihpJiYhbiYmKHU9XCJncmVlZHlcIj09PWk/XCJcIj09PXRbb10uam9pbihcIlwiKS50cmltKCk6MT09PXRbb10ubGVuZ3RoJiYwPT09dFtvXVswXS5sZW5ndGgpLFwiZ3JlZWR5XCI9PT1pJiZuKXtmb3IodmFyIGQ9W10sbD0wO2w8aDtsKyspe3ZhciBjPXM/ZVtsXTpsO2QucHVzaCh0W29dW2NdKX11PVwiXCI9PT1kLmpvaW4oXCJcIikudHJpbSgpfWlmKCF1KXtmb3IodmFyIHA9MDtwPGg7cCsrKXswPHAmJiFmJiYocis9Xyk7dmFyIGc9biYmcz9lW3BdOnA7cis9eSh0W29dW2ddLHApfW88dC5sZW5ndGgtMSYmKCFpfHwwPGgmJiFmKSYmKHIrPXYpfX1yZXR1cm4gcn1mdW5jdGlvbiB5KGUsdCl7aWYobnVsbD09ZSlyZXR1cm5cIlwiO2lmKGUuY29uc3RydWN0b3I9PT1EYXRlKXJldHVybiBKU09OLnN0cmluZ2lmeShlKS5zbGljZSgxLDI1KTshMD09PW8mJlwic3RyaW5nXCI9PXR5cGVvZiBlJiZudWxsIT09ZS5tYXRjaCgvXls9K1xcLUBdLiokLykmJihlPVwiJ1wiK2UpO3ZhciBpPWUudG9TdHJpbmcoKS5yZXBsYWNlKGgsYSkscj1cImJvb2xlYW5cIj09dHlwZW9mIG4mJm58fFwiZnVuY3Rpb25cIj09dHlwZW9mIG4mJm4oZSx0KXx8QXJyYXkuaXNBcnJheShuKSYmblt0XXx8ZnVuY3Rpb24oZSx0KXtmb3IodmFyIGk9MDtpPHQubGVuZ3RoO2krKylpZigtMTxlLmluZGV4T2YodFtpXSkpcmV0dXJuITA7cmV0dXJuITF9KGksYi5CQURfREVMSU1JVEVSUyl8fC0xPGkuaW5kZXhPZihfKXx8XCIgXCI9PT1pLmNoYXJBdCgwKXx8XCIgXCI9PT1pLmNoYXJBdChpLmxlbmd0aC0xKTtyZXR1cm4gcj9zK2krczppfX19O2lmKGIuUkVDT1JEX1NFUD1TdHJpbmcuZnJvbUNoYXJDb2RlKDMwKSxiLlVOSVRfU0VQPVN0cmluZy5mcm9tQ2hhckNvZGUoMzEpLGIuQllURV9PUkRFUl9NQVJLPVwiXFx1ZmVmZlwiLGIuQkFEX0RFTElNSVRFUlM9W1wiXFxyXCIsXCJcXG5cIiwnXCInLGIuQllURV9PUkRFUl9NQVJLXSxiLldPUktFUlNfU1VQUE9SVEVEPSFuJiYhIWYuV29ya2VyLGIuTk9ERV9TVFJFQU1fSU5QVVQ9MSxiLkxvY2FsQ2h1bmtTaXplPTEwNDg1NzYwLGIuUmVtb3RlQ2h1bmtTaXplPTUyNDI4ODAsYi5EZWZhdWx0RGVsaW1pdGVyPVwiLFwiLGIuUGFyc2VyPXcsYi5QYXJzZXJIYW5kbGU9aSxiLk5ldHdvcmtTdHJlYW1lcj1sLGIuRmlsZVN0cmVhbWVyPWMsYi5TdHJpbmdTdHJlYW1lcj1wLGIuUmVhZGFibGVTdHJlYW1TdHJlYW1lcj1nLGYualF1ZXJ5KXt2YXIgZD1mLmpRdWVyeTtkLmZuLnBhcnNlPWZ1bmN0aW9uKG8pe3ZhciBpPW8uY29uZmlnfHx7fSxoPVtdO3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oZSl7aWYoIShcIklOUFVUXCI9PT1kKHRoaXMpLnByb3AoXCJ0YWdOYW1lXCIpLnRvVXBwZXJDYXNlKCkmJlwiZmlsZVwiPT09ZCh0aGlzKS5hdHRyKFwidHlwZVwiKS50b0xvd2VyQ2FzZSgpJiZmLkZpbGVSZWFkZXIpfHwhdGhpcy5maWxlc3x8MD09PXRoaXMuZmlsZXMubGVuZ3RoKXJldHVybiEwO2Zvcih2YXIgdD0wO3Q8dGhpcy5maWxlcy5sZW5ndGg7dCsrKWgucHVzaCh7ZmlsZTp0aGlzLmZpbGVzW3RdLGlucHV0RWxlbTp0aGlzLGluc3RhbmNlQ29uZmlnOmQuZXh0ZW5kKHt9LGkpfSl9KSxlKCksdGhpcztmdW5jdGlvbiBlKCl7aWYoMCE9PWgubGVuZ3RoKXt2YXIgZSx0LGkscixuPWhbMF07aWYoVShvLmJlZm9yZSkpe3ZhciBzPW8uYmVmb3JlKG4uZmlsZSxuLmlucHV0RWxlbSk7aWYoXCJvYmplY3RcIj09dHlwZW9mIHMpe2lmKFwiYWJvcnRcIj09PXMuYWN0aW9uKXJldHVybiBlPVwiQWJvcnRFcnJvclwiLHQ9bi5maWxlLGk9bi5pbnB1dEVsZW0scj1zLnJlYXNvbix2b2lkKFUoby5lcnJvcikmJm8uZXJyb3Ioe25hbWU6ZX0sdCxpLHIpKTtpZihcInNraXBcIj09PXMuYWN0aW9uKXJldHVybiB2b2lkIHUoKTtcIm9iamVjdFwiPT10eXBlb2Ygcy5jb25maWcmJihuLmluc3RhbmNlQ29uZmlnPWQuZXh0ZW5kKG4uaW5zdGFuY2VDb25maWcscy5jb25maWcpKX1lbHNlIGlmKFwic2tpcFwiPT09cylyZXR1cm4gdm9pZCB1KCl9dmFyIGE9bi5pbnN0YW5jZUNvbmZpZy5jb21wbGV0ZTtuLmluc3RhbmNlQ29uZmlnLmNvbXBsZXRlPWZ1bmN0aW9uKGUpe1UoYSkmJmEoZSxuLmZpbGUsbi5pbnB1dEVsZW0pLHUoKX0sYi5wYXJzZShuLmZpbGUsbi5pbnN0YW5jZUNvbmZpZyl9ZWxzZSBVKG8uY29tcGxldGUpJiZvLmNvbXBsZXRlKCl9ZnVuY3Rpb24gdSgpe2guc3BsaWNlKDAsMSksZSgpfX19ZnVuY3Rpb24gdShlKXt0aGlzLl9oYW5kbGU9bnVsbCx0aGlzLl9maW5pc2hlZD0hMSx0aGlzLl9jb21wbGV0ZWQ9ITEsdGhpcy5faGFsdGVkPSExLHRoaXMuX2lucHV0PW51bGwsdGhpcy5fYmFzZUluZGV4PTAsdGhpcy5fcGFydGlhbExpbmU9XCJcIix0aGlzLl9yb3dDb3VudD0wLHRoaXMuX3N0YXJ0PTAsdGhpcy5fbmV4dENodW5rPW51bGwsdGhpcy5pc0ZpcnN0Q2h1bms9ITAsdGhpcy5fY29tcGxldGVSZXN1bHRzPXtkYXRhOltdLGVycm9yczpbXSxtZXRhOnt9fSxmdW5jdGlvbihlKXt2YXIgdD1FKGUpO3QuY2h1bmtTaXplPXBhcnNlSW50KHQuY2h1bmtTaXplKSxlLnN0ZXB8fGUuY2h1bmt8fCh0LmNodW5rU2l6ZT1udWxsKTt0aGlzLl9oYW5kbGU9bmV3IGkodCksKHRoaXMuX2hhbmRsZS5zdHJlYW1lcj10aGlzKS5fY29uZmlnPXR9LmNhbGwodGhpcyxlKSx0aGlzLnBhcnNlQ2h1bms9ZnVuY3Rpb24oZSx0KXtpZih0aGlzLmlzRmlyc3RDaHVuayYmVSh0aGlzLl9jb25maWcuYmVmb3JlRmlyc3RDaHVuaykpe3ZhciBpPXRoaXMuX2NvbmZpZy5iZWZvcmVGaXJzdENodW5rKGUpO3ZvaWQgMCE9PWkmJihlPWkpfXRoaXMuaXNGaXJzdENodW5rPSExLHRoaXMuX2hhbHRlZD0hMTt2YXIgcj10aGlzLl9wYXJ0aWFsTGluZStlO3RoaXMuX3BhcnRpYWxMaW5lPVwiXCI7dmFyIG49dGhpcy5faGFuZGxlLnBhcnNlKHIsdGhpcy5fYmFzZUluZGV4LCF0aGlzLl9maW5pc2hlZCk7aWYoIXRoaXMuX2hhbmRsZS5wYXVzZWQoKSYmIXRoaXMuX2hhbmRsZS5hYm9ydGVkKCkpe3ZhciBzPW4ubWV0YS5jdXJzb3I7dGhpcy5fZmluaXNoZWR8fCh0aGlzLl9wYXJ0aWFsTGluZT1yLnN1YnN0cmluZyhzLXRoaXMuX2Jhc2VJbmRleCksdGhpcy5fYmFzZUluZGV4PXMpLG4mJm4uZGF0YSYmKHRoaXMuX3Jvd0NvdW50Kz1uLmRhdGEubGVuZ3RoKTt2YXIgYT10aGlzLl9maW5pc2hlZHx8dGhpcy5fY29uZmlnLnByZXZpZXcmJnRoaXMuX3Jvd0NvdW50Pj10aGlzLl9jb25maWcucHJldmlldztpZihvKWYucG9zdE1lc3NhZ2Uoe3Jlc3VsdHM6bix3b3JrZXJJZDpiLldPUktFUl9JRCxmaW5pc2hlZDphfSk7ZWxzZSBpZihVKHRoaXMuX2NvbmZpZy5jaHVuaykmJiF0KXtpZih0aGlzLl9jb25maWcuY2h1bmsobix0aGlzLl9oYW5kbGUpLHRoaXMuX2hhbmRsZS5wYXVzZWQoKXx8dGhpcy5faGFuZGxlLmFib3J0ZWQoKSlyZXR1cm4gdm9pZCh0aGlzLl9oYWx0ZWQ9ITApO249dm9pZCAwLHRoaXMuX2NvbXBsZXRlUmVzdWx0cz12b2lkIDB9cmV0dXJuIHRoaXMuX2NvbmZpZy5zdGVwfHx0aGlzLl9jb25maWcuY2h1bmt8fCh0aGlzLl9jb21wbGV0ZVJlc3VsdHMuZGF0YT10aGlzLl9jb21wbGV0ZVJlc3VsdHMuZGF0YS5jb25jYXQobi5kYXRhKSx0aGlzLl9jb21wbGV0ZVJlc3VsdHMuZXJyb3JzPXRoaXMuX2NvbXBsZXRlUmVzdWx0cy5lcnJvcnMuY29uY2F0KG4uZXJyb3JzKSx0aGlzLl9jb21wbGV0ZVJlc3VsdHMubWV0YT1uLm1ldGEpLHRoaXMuX2NvbXBsZXRlZHx8IWF8fCFVKHRoaXMuX2NvbmZpZy5jb21wbGV0ZSl8fG4mJm4ubWV0YS5hYm9ydGVkfHwodGhpcy5fY29uZmlnLmNvbXBsZXRlKHRoaXMuX2NvbXBsZXRlUmVzdWx0cyx0aGlzLl9pbnB1dCksdGhpcy5fY29tcGxldGVkPSEwKSxhfHxuJiZuLm1ldGEucGF1c2VkfHx0aGlzLl9uZXh0Q2h1bmsoKSxufXRoaXMuX2hhbHRlZD0hMH0sdGhpcy5fc2VuZEVycm9yPWZ1bmN0aW9uKGUpe1UodGhpcy5fY29uZmlnLmVycm9yKT90aGlzLl9jb25maWcuZXJyb3IoZSk6byYmdGhpcy5fY29uZmlnLmVycm9yJiZmLnBvc3RNZXNzYWdlKHt3b3JrZXJJZDpiLldPUktFUl9JRCxlcnJvcjplLGZpbmlzaGVkOiExfSl9fWZ1bmN0aW9uIGwoZSl7dmFyIHI7KGU9ZXx8e30pLmNodW5rU2l6ZXx8KGUuY2h1bmtTaXplPWIuUmVtb3RlQ2h1bmtTaXplKSx1LmNhbGwodGhpcyxlKSx0aGlzLl9uZXh0Q2h1bms9bj9mdW5jdGlvbigpe3RoaXMuX3JlYWRDaHVuaygpLHRoaXMuX2NodW5rTG9hZGVkKCl9OmZ1bmN0aW9uKCl7dGhpcy5fcmVhZENodW5rKCl9LHRoaXMuc3RyZWFtPWZ1bmN0aW9uKGUpe3RoaXMuX2lucHV0PWUsdGhpcy5fbmV4dENodW5rKCl9LHRoaXMuX3JlYWRDaHVuaz1mdW5jdGlvbigpe2lmKHRoaXMuX2ZpbmlzaGVkKXRoaXMuX2NodW5rTG9hZGVkKCk7ZWxzZXtpZihyPW5ldyBYTUxIdHRwUmVxdWVzdCx0aGlzLl9jb25maWcud2l0aENyZWRlbnRpYWxzJiYoci53aXRoQ3JlZGVudGlhbHM9dGhpcy5fY29uZmlnLndpdGhDcmVkZW50aWFscyksbnx8KHIub25sb2FkPXkodGhpcy5fY2h1bmtMb2FkZWQsdGhpcyksci5vbmVycm9yPXkodGhpcy5fY2h1bmtFcnJvcix0aGlzKSksci5vcGVuKHRoaXMuX2NvbmZpZy5kb3dubG9hZFJlcXVlc3RCb2R5P1wiUE9TVFwiOlwiR0VUXCIsdGhpcy5faW5wdXQsIW4pLHRoaXMuX2NvbmZpZy5kb3dubG9hZFJlcXVlc3RIZWFkZXJzKXt2YXIgZT10aGlzLl9jb25maWcuZG93bmxvYWRSZXF1ZXN0SGVhZGVycztmb3IodmFyIHQgaW4gZSlyLnNldFJlcXVlc3RIZWFkZXIodCxlW3RdKX1pZih0aGlzLl9jb25maWcuY2h1bmtTaXplKXt2YXIgaT10aGlzLl9zdGFydCt0aGlzLl9jb25maWcuY2h1bmtTaXplLTE7ci5zZXRSZXF1ZXN0SGVhZGVyKFwiUmFuZ2VcIixcImJ5dGVzPVwiK3RoaXMuX3N0YXJ0K1wiLVwiK2kpfXRyeXtyLnNlbmQodGhpcy5fY29uZmlnLmRvd25sb2FkUmVxdWVzdEJvZHkpfWNhdGNoKGUpe3RoaXMuX2NodW5rRXJyb3IoZS5tZXNzYWdlKX1uJiYwPT09ci5zdGF0dXMmJnRoaXMuX2NodW5rRXJyb3IoKX19LHRoaXMuX2NodW5rTG9hZGVkPWZ1bmN0aW9uKCl7ND09PXIucmVhZHlTdGF0ZSYmKHIuc3RhdHVzPDIwMHx8NDAwPD1yLnN0YXR1cz90aGlzLl9jaHVua0Vycm9yKCk6KHRoaXMuX3N0YXJ0Kz10aGlzLl9jb25maWcuY2h1bmtTaXplP3RoaXMuX2NvbmZpZy5jaHVua1NpemU6ci5yZXNwb25zZVRleHQubGVuZ3RoLHRoaXMuX2ZpbmlzaGVkPSF0aGlzLl9jb25maWcuY2h1bmtTaXplfHx0aGlzLl9zdGFydD49ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtUmFuZ2VcIik7aWYobnVsbD09PXQpcmV0dXJuLTE7cmV0dXJuIHBhcnNlSW50KHQuc3Vic3RyaW5nKHQubGFzdEluZGV4T2YoXCIvXCIpKzEpKX0ociksdGhpcy5wYXJzZUNodW5rKHIucmVzcG9uc2VUZXh0KSkpfSx0aGlzLl9jaHVua0Vycm9yPWZ1bmN0aW9uKGUpe3ZhciB0PXIuc3RhdHVzVGV4dHx8ZTt0aGlzLl9zZW5kRXJyb3IobmV3IEVycm9yKHQpKX19ZnVuY3Rpb24gYyhlKXt2YXIgcixuOyhlPWV8fHt9KS5jaHVua1NpemV8fChlLmNodW5rU2l6ZT1iLkxvY2FsQ2h1bmtTaXplKSx1LmNhbGwodGhpcyxlKTt2YXIgcz1cInVuZGVmaW5lZFwiIT10eXBlb2YgRmlsZVJlYWRlcjt0aGlzLnN0cmVhbT1mdW5jdGlvbihlKXt0aGlzLl9pbnB1dD1lLG49ZS5zbGljZXx8ZS53ZWJraXRTbGljZXx8ZS5tb3pTbGljZSxzPygocj1uZXcgRmlsZVJlYWRlcikub25sb2FkPXkodGhpcy5fY2h1bmtMb2FkZWQsdGhpcyksci5vbmVycm9yPXkodGhpcy5fY2h1bmtFcnJvcix0aGlzKSk6cj1uZXcgRmlsZVJlYWRlclN5bmMsdGhpcy5fbmV4dENodW5rKCl9LHRoaXMuX25leHRDaHVuaz1mdW5jdGlvbigpe3RoaXMuX2ZpbmlzaGVkfHx0aGlzLl9jb25maWcucHJldmlldyYmISh0aGlzLl9yb3dDb3VudDx0aGlzLl9jb25maWcucHJldmlldyl8fHRoaXMuX3JlYWRDaHVuaygpfSx0aGlzLl9yZWFkQ2h1bms9ZnVuY3Rpb24oKXt2YXIgZT10aGlzLl9pbnB1dDtpZih0aGlzLl9jb25maWcuY2h1bmtTaXplKXt2YXIgdD1NYXRoLm1pbih0aGlzLl9zdGFydCt0aGlzLl9jb25maWcuY2h1bmtTaXplLHRoaXMuX2lucHV0LnNpemUpO2U9bi5jYWxsKGUsdGhpcy5fc3RhcnQsdCl9dmFyIGk9ci5yZWFkQXNUZXh0KGUsdGhpcy5fY29uZmlnLmVuY29kaW5nKTtzfHx0aGlzLl9jaHVua0xvYWRlZCh7dGFyZ2V0OntyZXN1bHQ6aX19KX0sdGhpcy5fY2h1bmtMb2FkZWQ9ZnVuY3Rpb24oZSl7dGhpcy5fc3RhcnQrPXRoaXMuX2NvbmZpZy5jaHVua1NpemUsdGhpcy5fZmluaXNoZWQ9IXRoaXMuX2NvbmZpZy5jaHVua1NpemV8fHRoaXMuX3N0YXJ0Pj10aGlzLl9pbnB1dC5zaXplLHRoaXMucGFyc2VDaHVuayhlLnRhcmdldC5yZXN1bHQpfSx0aGlzLl9jaHVua0Vycm9yPWZ1bmN0aW9uKCl7dGhpcy5fc2VuZEVycm9yKHIuZXJyb3IpfX1mdW5jdGlvbiBwKGUpe3ZhciBpO3UuY2FsbCh0aGlzLGU9ZXx8e30pLHRoaXMuc3RyZWFtPWZ1bmN0aW9uKGUpe3JldHVybiBpPWUsdGhpcy5fbmV4dENodW5rKCl9LHRoaXMuX25leHRDaHVuaz1mdW5jdGlvbigpe2lmKCF0aGlzLl9maW5pc2hlZCl7dmFyIGUsdD10aGlzLl9jb25maWcuY2h1bmtTaXplO3JldHVybiB0PyhlPWkuc3Vic3RyaW5nKDAsdCksaT1pLnN1YnN0cmluZyh0KSk6KGU9aSxpPVwiXCIpLHRoaXMuX2ZpbmlzaGVkPSFpLHRoaXMucGFyc2VDaHVuayhlKX19fWZ1bmN0aW9uIGcoZSl7dS5jYWxsKHRoaXMsZT1lfHx7fSk7dmFyIHQ9W10saT0hMCxyPSExO3RoaXMucGF1c2U9ZnVuY3Rpb24oKXt1LnByb3RvdHlwZS5wYXVzZS5hcHBseSh0aGlzLGFyZ3VtZW50cyksdGhpcy5faW5wdXQucGF1c2UoKX0sdGhpcy5yZXN1bWU9ZnVuY3Rpb24oKXt1LnByb3RvdHlwZS5yZXN1bWUuYXBwbHkodGhpcyxhcmd1bWVudHMpLHRoaXMuX2lucHV0LnJlc3VtZSgpfSx0aGlzLnN0cmVhbT1mdW5jdGlvbihlKXt0aGlzLl9pbnB1dD1lLHRoaXMuX2lucHV0Lm9uKFwiZGF0YVwiLHRoaXMuX3N0cmVhbURhdGEpLHRoaXMuX2lucHV0Lm9uKFwiZW5kXCIsdGhpcy5fc3RyZWFtRW5kKSx0aGlzLl9pbnB1dC5vbihcImVycm9yXCIsdGhpcy5fc3RyZWFtRXJyb3IpfSx0aGlzLl9jaGVja0lzRmluaXNoZWQ9ZnVuY3Rpb24oKXtyJiYxPT09dC5sZW5ndGgmJih0aGlzLl9maW5pc2hlZD0hMCl9LHRoaXMuX25leHRDaHVuaz1mdW5jdGlvbigpe3RoaXMuX2NoZWNrSXNGaW5pc2hlZCgpLHQubGVuZ3RoP3RoaXMucGFyc2VDaHVuayh0LnNoaWZ0KCkpOmk9ITB9LHRoaXMuX3N0cmVhbURhdGE9eShmdW5jdGlvbihlKXt0cnl7dC5wdXNoKFwic3RyaW5nXCI9PXR5cGVvZiBlP2U6ZS50b1N0cmluZyh0aGlzLl9jb25maWcuZW5jb2RpbmcpKSxpJiYoaT0hMSx0aGlzLl9jaGVja0lzRmluaXNoZWQoKSx0aGlzLnBhcnNlQ2h1bmsodC5zaGlmdCgpKSl9Y2F0Y2goZSl7dGhpcy5fc3RyZWFtRXJyb3IoZSl9fSx0aGlzKSx0aGlzLl9zdHJlYW1FcnJvcj15KGZ1bmN0aW9uKGUpe3RoaXMuX3N0cmVhbUNsZWFuVXAoKSx0aGlzLl9zZW5kRXJyb3IoZSl9LHRoaXMpLHRoaXMuX3N0cmVhbUVuZD15KGZ1bmN0aW9uKCl7dGhpcy5fc3RyZWFtQ2xlYW5VcCgpLHI9ITAsdGhpcy5fc3RyZWFtRGF0YShcIlwiKX0sdGhpcyksdGhpcy5fc3RyZWFtQ2xlYW5VcD15KGZ1bmN0aW9uKCl7dGhpcy5faW5wdXQucmVtb3ZlTGlzdGVuZXIoXCJkYXRhXCIsdGhpcy5fc3RyZWFtRGF0YSksdGhpcy5faW5wdXQucmVtb3ZlTGlzdGVuZXIoXCJlbmRcIix0aGlzLl9zdHJlYW1FbmQpLHRoaXMuX2lucHV0LnJlbW92ZUxpc3RlbmVyKFwiZXJyb3JcIix0aGlzLl9zdHJlYW1FcnJvcil9LHRoaXMpfWZ1bmN0aW9uIGkoXyl7dmFyIGEsbyxoLHI9TWF0aC5wb3coMiw1Myksbj0tcixzPS9eXFxzKi0/KFxcZCtcXC4/fFxcLlxcZCt8XFxkK1xcLlxcZCspKGVbLStdP1xcZCspP1xccyokLyx1PS8oXFxkezR9LVswMV1cXGQtWzAtM11cXGRUWzAtMl1cXGQ6WzAtNV1cXGQ6WzAtNV1cXGRcXC5cXGQrKFsrLV1bMC0yXVxcZDpbMC01XVxcZHxaKSl8KFxcZHs0fS1bMDFdXFxkLVswLTNdXFxkVFswLTJdXFxkOlswLTVdXFxkOlswLTVdXFxkKFsrLV1bMC0yXVxcZDpbMC01XVxcZHxaKSl8KFxcZHs0fS1bMDFdXFxkLVswLTNdXFxkVFswLTJdXFxkOlswLTVdXFxkKFsrLV1bMC0yXVxcZDpbMC01XVxcZHxaKSkvLHQ9dGhpcyxpPTAsZj0wLGQ9ITEsZT0hMSxsPVtdLGM9e2RhdGE6W10sZXJyb3JzOltdLG1ldGE6e319O2lmKFUoXy5zdGVwKSl7dmFyIHA9Xy5zdGVwO18uc3RlcD1mdW5jdGlvbihlKXtpZihjPWUsbSgpKWcoKTtlbHNle2lmKGcoKSwwPT09Yy5kYXRhLmxlbmd0aClyZXR1cm47aSs9ZS5kYXRhLmxlbmd0aCxfLnByZXZpZXcmJmk+Xy5wcmV2aWV3P28uYWJvcnQoKTooYy5kYXRhPWMuZGF0YVswXSxwKGMsdCkpfX19ZnVuY3Rpb24gdihlKXtyZXR1cm5cImdyZWVkeVwiPT09Xy5za2lwRW1wdHlMaW5lcz9cIlwiPT09ZS5qb2luKFwiXCIpLnRyaW0oKToxPT09ZS5sZW5ndGgmJjA9PT1lWzBdLmxlbmd0aH1mdW5jdGlvbiBnKCl7aWYoYyYmaCYmKGsoXCJEZWxpbWl0ZXJcIixcIlVuZGV0ZWN0YWJsZURlbGltaXRlclwiLFwiVW5hYmxlIHRvIGF1dG8tZGV0ZWN0IGRlbGltaXRpbmcgY2hhcmFjdGVyOyBkZWZhdWx0ZWQgdG8gJ1wiK2IuRGVmYXVsdERlbGltaXRlcitcIidcIiksaD0hMSksXy5za2lwRW1wdHlMaW5lcylmb3IodmFyIGU9MDtlPGMuZGF0YS5sZW5ndGg7ZSsrKXYoYy5kYXRhW2VdKSYmYy5kYXRhLnNwbGljZShlLS0sMSk7cmV0dXJuIG0oKSYmZnVuY3Rpb24oKXtpZighYylyZXR1cm47ZnVuY3Rpb24gZShlLHQpe1UoXy50cmFuc2Zvcm1IZWFkZXIpJiYoZT1fLnRyYW5zZm9ybUhlYWRlcihlLHQpKSxsLnB1c2goZSl9aWYoQXJyYXkuaXNBcnJheShjLmRhdGFbMF0pKXtmb3IodmFyIHQ9MDttKCkmJnQ8Yy5kYXRhLmxlbmd0aDt0KyspYy5kYXRhW3RdLmZvckVhY2goZSk7Yy5kYXRhLnNwbGljZSgwLDEpfWVsc2UgYy5kYXRhLmZvckVhY2goZSl9KCksZnVuY3Rpb24oKXtpZighY3x8IV8uaGVhZGVyJiYhXy5keW5hbWljVHlwaW5nJiYhXy50cmFuc2Zvcm0pcmV0dXJuIGM7ZnVuY3Rpb24gZShlLHQpe3ZhciBpLHI9Xy5oZWFkZXI/e306W107Zm9yKGk9MDtpPGUubGVuZ3RoO2krKyl7dmFyIG49aSxzPWVbaV07Xy5oZWFkZXImJihuPWk+PWwubGVuZ3RoP1wiX19wYXJzZWRfZXh0cmFcIjpsW2ldKSxfLnRyYW5zZm9ybSYmKHM9Xy50cmFuc2Zvcm0ocyxuKSkscz15KG4scyksXCJfX3BhcnNlZF9leHRyYVwiPT09bj8ocltuXT1yW25dfHxbXSxyW25dLnB1c2gocykpOnJbbl09c31yZXR1cm4gXy5oZWFkZXImJihpPmwubGVuZ3RoP2soXCJGaWVsZE1pc21hdGNoXCIsXCJUb29NYW55RmllbGRzXCIsXCJUb28gbWFueSBmaWVsZHM6IGV4cGVjdGVkIFwiK2wubGVuZ3RoK1wiIGZpZWxkcyBidXQgcGFyc2VkIFwiK2ksZit0KTppPGwubGVuZ3RoJiZrKFwiRmllbGRNaXNtYXRjaFwiLFwiVG9vRmV3RmllbGRzXCIsXCJUb28gZmV3IGZpZWxkczogZXhwZWN0ZWQgXCIrbC5sZW5ndGgrXCIgZmllbGRzIGJ1dCBwYXJzZWQgXCIraSxmK3QpKSxyfXZhciB0PTE7IWMuZGF0YS5sZW5ndGh8fEFycmF5LmlzQXJyYXkoYy5kYXRhWzBdKT8oYy5kYXRhPWMuZGF0YS5tYXAoZSksdD1jLmRhdGEubGVuZ3RoKTpjLmRhdGE9ZShjLmRhdGEsMCk7Xy5oZWFkZXImJmMubWV0YSYmKGMubWV0YS5maWVsZHM9bCk7cmV0dXJuIGYrPXQsY30oKX1mdW5jdGlvbiBtKCl7cmV0dXJuIF8uaGVhZGVyJiYwPT09bC5sZW5ndGh9ZnVuY3Rpb24geShlLHQpe3JldHVybiBpPWUsXy5keW5hbWljVHlwaW5nRnVuY3Rpb24mJnZvaWQgMD09PV8uZHluYW1pY1R5cGluZ1tpXSYmKF8uZHluYW1pY1R5cGluZ1tpXT1fLmR5bmFtaWNUeXBpbmdGdW5jdGlvbihpKSksITA9PT0oXy5keW5hbWljVHlwaW5nW2ldfHxfLmR5bmFtaWNUeXBpbmcpP1widHJ1ZVwiPT09dHx8XCJUUlVFXCI9PT10fHxcImZhbHNlXCIhPT10JiZcIkZBTFNFXCIhPT10JiYoZnVuY3Rpb24oZSl7aWYocy50ZXN0KGUpKXt2YXIgdD1wYXJzZUZsb2F0KGUpO2lmKG48dCYmdDxyKXJldHVybiEwfXJldHVybiExfSh0KT9wYXJzZUZsb2F0KHQpOnUudGVzdCh0KT9uZXcgRGF0ZSh0KTpcIlwiPT09dD9udWxsOnQpOnQ7dmFyIGl9ZnVuY3Rpb24gayhlLHQsaSxyKXt2YXIgbj17dHlwZTplLGNvZGU6dCxtZXNzYWdlOml9O3ZvaWQgMCE9PXImJihuLnJvdz1yKSxjLmVycm9ycy5wdXNoKG4pfXRoaXMucGFyc2U9ZnVuY3Rpb24oZSx0LGkpe3ZhciByPV8ucXVvdGVDaGFyfHwnXCInO2lmKF8ubmV3bGluZXx8KF8ubmV3bGluZT1mdW5jdGlvbihlLHQpe2U9ZS5zdWJzdHJpbmcoMCwxMDQ4NTc2KTt2YXIgaT1uZXcgUmVnRXhwKHEodCkrXCIoW15dKj8pXCIrcSh0KSxcImdtXCIpLHI9KGU9ZS5yZXBsYWNlKGksXCJcIikpLnNwbGl0KFwiXFxyXCIpLG49ZS5zcGxpdChcIlxcblwiKSxzPTE8bi5sZW5ndGgmJm5bMF0ubGVuZ3RoPHJbMF0ubGVuZ3RoO2lmKDE9PT1yLmxlbmd0aHx8cylyZXR1cm5cIlxcblwiO2Zvcih2YXIgYT0wLG89MDtvPHIubGVuZ3RoO28rKylcIlxcblwiPT09cltvXVswXSYmYSsrO3JldHVybiBhPj1yLmxlbmd0aC8yP1wiXFxyXFxuXCI6XCJcXHJcIn0oZSxyKSksaD0hMSxfLmRlbGltaXRlcilVKF8uZGVsaW1pdGVyKSYmKF8uZGVsaW1pdGVyPV8uZGVsaW1pdGVyKGUpLGMubWV0YS5kZWxpbWl0ZXI9Xy5kZWxpbWl0ZXIpO2Vsc2V7dmFyIG49ZnVuY3Rpb24oZSx0LGkscixuKXt2YXIgcyxhLG8saDtuPW58fFtcIixcIixcIlxcdFwiLFwifFwiLFwiO1wiLGIuUkVDT1JEX1NFUCxiLlVOSVRfU0VQXTtmb3IodmFyIHU9MDt1PG4ubGVuZ3RoO3UrKyl7dmFyIGY9blt1XSxkPTAsbD0wLGM9MDtvPXZvaWQgMDtmb3IodmFyIHA9bmV3IHcoe2NvbW1lbnRzOnIsZGVsaW1pdGVyOmYsbmV3bGluZTp0LHByZXZpZXc6MTB9KS5wYXJzZShlKSxnPTA7ZzxwLmRhdGEubGVuZ3RoO2crKylpZihpJiZ2KHAuZGF0YVtnXSkpYysrO2Vsc2V7dmFyIG09cC5kYXRhW2ddLmxlbmd0aDtsKz1tLHZvaWQgMCE9PW8/MDxtJiYoZCs9TWF0aC5hYnMobS1vKSxvPW0pOm89bX0wPHAuZGF0YS5sZW5ndGgmJihsLz1wLmRhdGEubGVuZ3RoLWMpLCh2b2lkIDA9PT1hfHxkPD1hKSYmKHZvaWQgMD09PWh8fGg8bCkmJjEuOTk8bCYmKGE9ZCxzPWYsaD1sKX1yZXR1cm57c3VjY2Vzc2Z1bDohIShfLmRlbGltaXRlcj1zKSxiZXN0RGVsaW1pdGVyOnN9fShlLF8ubmV3bGluZSxfLnNraXBFbXB0eUxpbmVzLF8uY29tbWVudHMsXy5kZWxpbWl0ZXJzVG9HdWVzcyk7bi5zdWNjZXNzZnVsP18uZGVsaW1pdGVyPW4uYmVzdERlbGltaXRlcjooaD0hMCxfLmRlbGltaXRlcj1iLkRlZmF1bHREZWxpbWl0ZXIpLGMubWV0YS5kZWxpbWl0ZXI9Xy5kZWxpbWl0ZXJ9dmFyIHM9RShfKTtyZXR1cm4gXy5wcmV2aWV3JiZfLmhlYWRlciYmcy5wcmV2aWV3KyssYT1lLG89bmV3IHcocyksYz1vLnBhcnNlKGEsdCxpKSxnKCksZD97bWV0YTp7cGF1c2VkOiEwfX06Y3x8e21ldGE6e3BhdXNlZDohMX19fSx0aGlzLnBhdXNlZD1mdW5jdGlvbigpe3JldHVybiBkfSx0aGlzLnBhdXNlPWZ1bmN0aW9uKCl7ZD0hMCxvLmFib3J0KCksYT1VKF8uY2h1bmspP1wiXCI6YS5zdWJzdHJpbmcoby5nZXRDaGFySW5kZXgoKSl9LHRoaXMucmVzdW1lPWZ1bmN0aW9uKCl7dC5zdHJlYW1lci5faGFsdGVkPyhkPSExLHQuc3RyZWFtZXIucGFyc2VDaHVuayhhLCEwKSk6c2V0VGltZW91dCh0LnJlc3VtZSwzKX0sdGhpcy5hYm9ydGVkPWZ1bmN0aW9uKCl7cmV0dXJuIGV9LHRoaXMuYWJvcnQ9ZnVuY3Rpb24oKXtlPSEwLG8uYWJvcnQoKSxjLm1ldGEuYWJvcnRlZD0hMCxVKF8uY29tcGxldGUpJiZfLmNvbXBsZXRlKGMpLGE9XCJcIn19ZnVuY3Rpb24gcShlKXtyZXR1cm4gZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZyxcIlxcXFwkJlwiKX1mdW5jdGlvbiB3KGUpe3ZhciBPLEQ9KGU9ZXx8e30pLmRlbGltaXRlcixJPWUubmV3bGluZSxUPWUuY29tbWVudHMsQT1lLnN0ZXAsTD1lLnByZXZpZXcsRj1lLmZhc3RNb2RlLHo9Tz12b2lkIDA9PT1lLnF1b3RlQ2hhcj8nXCInOmUucXVvdGVDaGFyO2lmKHZvaWQgMCE9PWUuZXNjYXBlQ2hhciYmKHo9ZS5lc2NhcGVDaGFyKSwoXCJzdHJpbmdcIiE9dHlwZW9mIER8fC0xPGIuQkFEX0RFTElNSVRFUlMuaW5kZXhPZihEKSkmJihEPVwiLFwiKSxUPT09RCl0aHJvdyBuZXcgRXJyb3IoXCJDb21tZW50IGNoYXJhY3RlciBzYW1lIGFzIGRlbGltaXRlclwiKTshMD09PVQ/VD1cIiNcIjooXCJzdHJpbmdcIiE9dHlwZW9mIFR8fC0xPGIuQkFEX0RFTElNSVRFUlMuaW5kZXhPZihUKSkmJihUPSExKSxcIlxcblwiIT09SSYmXCJcXHJcIiE9PUkmJlwiXFxyXFxuXCIhPT1JJiYoST1cIlxcblwiKTt2YXIgTT0wLGo9ITE7dGhpcy5wYXJzZT1mdW5jdGlvbihhLHQsaSl7aWYoXCJzdHJpbmdcIiE9dHlwZW9mIGEpdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhIHN0cmluZ1wiKTt2YXIgcj1hLmxlbmd0aCxlPUQubGVuZ3RoLG49SS5sZW5ndGgscz1ULmxlbmd0aCxvPVUoQSksaD1bXSx1PVtdLGY9W10sZD1NPTA7aWYoIWEpcmV0dXJuIFIoKTtpZihGfHwhMSE9PUYmJi0xPT09YS5pbmRleE9mKE8pKXtmb3IodmFyIGw9YS5zcGxpdChJKSxjPTA7YzxsLmxlbmd0aDtjKyspe2lmKGY9bFtjXSxNKz1mLmxlbmd0aCxjIT09bC5sZW5ndGgtMSlNKz1JLmxlbmd0aDtlbHNlIGlmKGkpcmV0dXJuIFIoKTtpZighVHx8Zi5zdWJzdHJpbmcoMCxzKSE9PVQpe2lmKG8pe2lmKGg9W10sYihmLnNwbGl0KEQpKSxTKCksailyZXR1cm4gUigpfWVsc2UgYihmLnNwbGl0KEQpKTtpZihMJiZMPD1jKXJldHVybiBoPWguc2xpY2UoMCxMKSxSKCEwKX19cmV0dXJuIFIoKX1mb3IodmFyIHA9YS5pbmRleE9mKEQsTSksZz1hLmluZGV4T2YoSSxNKSxtPW5ldyBSZWdFeHAocSh6KStxKE8pLFwiZ1wiKSxfPWEuaW5kZXhPZihPLE0pOzspaWYoYVtNXSE9PU8paWYoVCYmMD09PWYubGVuZ3RoJiZhLnN1YnN0cmluZyhNLE0rcyk9PT1UKXtpZigtMT09PWcpcmV0dXJuIFIoKTtNPWcrbixnPWEuaW5kZXhPZihJLE0pLHA9YS5pbmRleE9mKEQsTSl9ZWxzZXtpZigtMSE9PXAmJihwPGd8fC0xPT09Zykpe2lmKCEocDxfKSl7Zi5wdXNoKGEuc3Vic3RyaW5nKE0scCkpLE09cCtlLHA9YS5pbmRleE9mKEQsTSk7Y29udGludWV9dmFyIHY9eChwLF8sZyk7aWYodiYmdm9pZCAwIT09di5uZXh0RGVsaW0pe3A9di5uZXh0RGVsaW0sXz12LnF1b3RlU2VhcmNoLGYucHVzaChhLnN1YnN0cmluZyhNLHApKSxNPXArZSxwPWEuaW5kZXhPZihELE0pO2NvbnRpbnVlfX1pZigtMT09PWcpYnJlYWs7aWYoZi5wdXNoKGEuc3Vic3RyaW5nKE0sZykpLEMoZytuKSxvJiYoUygpLGopKXJldHVybiBSKCk7aWYoTCYmaC5sZW5ndGg+PUwpcmV0dXJuIFIoITApfWVsc2UgZm9yKF89TSxNKys7Oyl7aWYoLTE9PT0oXz1hLmluZGV4T2YoTyxfKzEpKSlyZXR1cm4gaXx8dS5wdXNoKHt0eXBlOlwiUXVvdGVzXCIsY29kZTpcIk1pc3NpbmdRdW90ZXNcIixtZXNzYWdlOlwiUXVvdGVkIGZpZWxkIHVudGVybWluYXRlZFwiLHJvdzpoLmxlbmd0aCxpbmRleDpNfSksRSgpO2lmKF89PT1yLTEpcmV0dXJuIEUoYS5zdWJzdHJpbmcoTSxfKS5yZXBsYWNlKG0sTykpO2lmKE8hPT16fHxhW18rMV0hPT16KXtpZihPPT09enx8MD09PV98fGFbXy0xXSE9PXopey0xIT09cCYmcDxfKzEmJihwPWEuaW5kZXhPZihELF8rMSkpLC0xIT09ZyYmZzxfKzEmJihnPWEuaW5kZXhPZihJLF8rMSkpO3ZhciB5PXcoLTE9PT1nP3A6TWF0aC5taW4ocCxnKSk7aWYoYVtfKzEreV09PT1EKXtmLnB1c2goYS5zdWJzdHJpbmcoTSxfKS5yZXBsYWNlKG0sTykpLGFbTT1fKzEreStlXSE9PU8mJihfPWEuaW5kZXhPZihPLE0pKSxwPWEuaW5kZXhPZihELE0pLGc9YS5pbmRleE9mKEksTSk7YnJlYWt9dmFyIGs9dyhnKTtpZihhLnN1YnN0cmluZyhfKzErayxfKzEraytuKT09PUkpe2lmKGYucHVzaChhLnN1YnN0cmluZyhNLF8pLnJlcGxhY2UobSxPKSksQyhfKzEraytuKSxwPWEuaW5kZXhPZihELE0pLF89YS5pbmRleE9mKE8sTSksbyYmKFMoKSxqKSlyZXR1cm4gUigpO2lmKEwmJmgubGVuZ3RoPj1MKXJldHVybiBSKCEwKTticmVha311LnB1c2goe3R5cGU6XCJRdW90ZXNcIixjb2RlOlwiSW52YWxpZFF1b3Rlc1wiLG1lc3NhZ2U6XCJUcmFpbGluZyBxdW90ZSBvbiBxdW90ZWQgZmllbGQgaXMgbWFsZm9ybWVkXCIscm93OmgubGVuZ3RoLGluZGV4Ok19KSxfKyt9fWVsc2UgXysrfXJldHVybiBFKCk7ZnVuY3Rpb24gYihlKXtoLnB1c2goZSksZD1NfWZ1bmN0aW9uIHcoZSl7dmFyIHQ9MDtpZigtMSE9PWUpe3ZhciBpPWEuc3Vic3RyaW5nKF8rMSxlKTtpJiZcIlwiPT09aS50cmltKCkmJih0PWkubGVuZ3RoKX1yZXR1cm4gdH1mdW5jdGlvbiBFKGUpe3JldHVybiBpfHwodm9pZCAwPT09ZSYmKGU9YS5zdWJzdHJpbmcoTSkpLGYucHVzaChlKSxNPXIsYihmKSxvJiZTKCkpLFIoKX1mdW5jdGlvbiBDKGUpe009ZSxiKGYpLGY9W10sZz1hLmluZGV4T2YoSSxNKX1mdW5jdGlvbiBSKGUpe3JldHVybntkYXRhOmgsZXJyb3JzOnUsbWV0YTp7ZGVsaW1pdGVyOkQsbGluZWJyZWFrOkksYWJvcnRlZDpqLHRydW5jYXRlZDohIWUsY3Vyc29yOmQrKHR8fDApfX19ZnVuY3Rpb24gUygpe0EoUigpKSxoPVtdLHU9W119ZnVuY3Rpb24geChlLHQsaSl7dmFyIHI9e25leHREZWxpbTp2b2lkIDAscXVvdGVTZWFyY2g6dm9pZCAwfSxuPWEuaW5kZXhPZihPLHQrMSk7aWYodDxlJiZlPG4mJihuPGl8fC0xPT09aSkpe3ZhciBzPWEuaW5kZXhPZihELG4pO2lmKC0xPT09cylyZXR1cm4gcjtuPHMmJihuPWEuaW5kZXhPZihPLG4rMSkpLHI9eChzLG4saSl9ZWxzZSByPXtuZXh0RGVsaW06ZSxxdW90ZVNlYXJjaDp0fTtyZXR1cm4gcn19LHRoaXMuYWJvcnQ9ZnVuY3Rpb24oKXtqPSEwfSx0aGlzLmdldENoYXJJbmRleD1mdW5jdGlvbigpe3JldHVybiBNfX1mdW5jdGlvbiBtKGUpe3ZhciB0PWUuZGF0YSxpPWFbdC53b3JrZXJJZF0scj0hMTtpZih0LmVycm9yKWkudXNlckVycm9yKHQuZXJyb3IsdC5maWxlKTtlbHNlIGlmKHQucmVzdWx0cyYmdC5yZXN1bHRzLmRhdGEpe3ZhciBuPXthYm9ydDpmdW5jdGlvbigpe3I9ITAsXyh0LndvcmtlcklkLHtkYXRhOltdLGVycm9yczpbXSxtZXRhOnthYm9ydGVkOiEwfX0pfSxwYXVzZTp2LHJlc3VtZTp2fTtpZihVKGkudXNlclN0ZXApKXtmb3IodmFyIHM9MDtzPHQucmVzdWx0cy5kYXRhLmxlbmd0aCYmKGkudXNlclN0ZXAoe2RhdGE6dC5yZXN1bHRzLmRhdGFbc10sZXJyb3JzOnQucmVzdWx0cy5lcnJvcnMsbWV0YTp0LnJlc3VsdHMubWV0YX0sbiksIXIpO3MrKyk7ZGVsZXRlIHQucmVzdWx0c31lbHNlIFUoaS51c2VyQ2h1bmspJiYoaS51c2VyQ2h1bmsodC5yZXN1bHRzLG4sdC5maWxlKSxkZWxldGUgdC5yZXN1bHRzKX10LmZpbmlzaGVkJiYhciYmXyh0LndvcmtlcklkLHQucmVzdWx0cyl9ZnVuY3Rpb24gXyhlLHQpe3ZhciBpPWFbZV07VShpLnVzZXJDb21wbGV0ZSkmJmkudXNlckNvbXBsZXRlKHQpLGkudGVybWluYXRlKCksZGVsZXRlIGFbZV19ZnVuY3Rpb24gdigpe3Rocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZC5cIil9ZnVuY3Rpb24gRShlKXtpZihcIm9iamVjdFwiIT10eXBlb2YgZXx8bnVsbD09PWUpcmV0dXJuIGU7dmFyIHQ9QXJyYXkuaXNBcnJheShlKT9bXTp7fTtmb3IodmFyIGkgaW4gZSl0W2ldPUUoZVtpXSk7cmV0dXJuIHR9ZnVuY3Rpb24geShlLHQpe3JldHVybiBmdW5jdGlvbigpe2UuYXBwbHkodCxhcmd1bWVudHMpfX1mdW5jdGlvbiBVKGUpe3JldHVyblwiZnVuY3Rpb25cIj09dHlwZW9mIGV9cmV0dXJuIG8mJihmLm9ubWVzc2FnZT1mdW5jdGlvbihlKXt2YXIgdD1lLmRhdGE7dm9pZCAwPT09Yi5XT1JLRVJfSUQmJnQmJihiLldPUktFUl9JRD10LndvcmtlcklkKTtpZihcInN0cmluZ1wiPT10eXBlb2YgdC5pbnB1dClmLnBvc3RNZXNzYWdlKHt3b3JrZXJJZDpiLldPUktFUl9JRCxyZXN1bHRzOmIucGFyc2UodC5pbnB1dCx0LmNvbmZpZyksZmluaXNoZWQ6ITB9KTtlbHNlIGlmKGYuRmlsZSYmdC5pbnB1dCBpbnN0YW5jZW9mIEZpbGV8fHQuaW5wdXQgaW5zdGFuY2VvZiBPYmplY3Qpe3ZhciBpPWIucGFyc2UodC5pbnB1dCx0LmNvbmZpZyk7aSYmZi5wb3N0TWVzc2FnZSh7d29ya2VySWQ6Yi5XT1JLRVJfSUQscmVzdWx0czppLGZpbmlzaGVkOiEwfSl9fSksKGwucHJvdG90eXBlPU9iamVjdC5jcmVhdGUodS5wcm90b3R5cGUpKS5jb25zdHJ1Y3Rvcj1sLChjLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKHUucHJvdG90eXBlKSkuY29uc3RydWN0b3I9YywocC5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShwLnByb3RvdHlwZSkpLmNvbnN0cnVjdG9yPXAsKGcucHJvdG90eXBlPU9iamVjdC5jcmVhdGUodS5wcm90b3R5cGUpKS5jb25zdHJ1Y3Rvcj1nLGJ9KTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHJhbmdlKG1pbiwgbWF4LCB2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlIC0gbWluKSAvIChtYXggLSBtaW4pXG59Il19
