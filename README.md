# poly-parse

Parses a .poly file from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html) and returns a JSON.

> A .poly file represents a PSLG, as well as some additional information. PSLG stands for Planar Straight Line Graph, a term familiar to computational geometers. By definition, a PSLG is just a list of vertices and segments. A .poly file can also contain information about holes and concavities, as well as regional attributes and constraints on the areas of triangles.

[.poly file format](https://www.cs.cmu.edu/~quake/triangle.poly.html)

The text file is parsed with [Papa Parse](https://www.npmjs.com/package/papaparse).

## Install
```
npm install poly-parse
```

## Example
```js
const polyparse = require('./index.js');

polyparse('./A.poly', { download: true })
	.then(data => console.log(data))
	.catch(err => console.log(err))

// outputs
// {
//   numberofpoints: 29,
//   pointlist: [0.2, -0.7764, 0.22, -0.7732 ...],
// 	 pointattributelist: [-0.57, -0.55, -0.51, -0.53 ...]
//   ...
// }
```

For convenience the property names in the output are the same as in `struct triangulateio` from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html).


## Usage

#### `polyparse(poly, options)`

Returns a `Promise` with the parsed object.

`poly` Can be either the content of the .poly file as a string, or a path / URL, or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File). 

`options`
- `download` set to `true` if the first argument is a path or a URL.

Other options are passed to Papa Parse. See all [config options](https://www.papaparse.com/docs#config).


## See Also

- [Triangle - A Two-Dimensional Quality Mesh Generator and Delaunay Triangulator](https://www.cs.cmu.edu/~quake/triangle.html) - Jonathan Shewchuk

