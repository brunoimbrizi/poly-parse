poly-parse
==========

Parses .poly files from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html).

> A .poly file represents a PSLG, as well as some additional information. PSLG stands for Planar Straight Line Graph, a term familiar to computational geometers. By definition, a PSLG is just a list of vertices and segments. A .poly file can also contain information about holes and concavities, as well as regional attributes and constraints on the areas of triangles.

Full description of the [.poly file format](https://www.cs.cmu.edu/~quake/triangle.poly.html).

It can also parse [.node files](https://www.cs.cmu.edu/~quake/triangle.node.html) since they are a subset of .poly.

The file is parsed with [Papa Parse](https://www.npmjs.com/package/papaparse).

## Install
```
npm install poly-parse
```

## Example
```js
const polyparse = require('poly-parse');

fetch('./A.poly')
  .then(result => result.text())
  .then(result => {
    console.log(polyparse(result));
  });
```
Output:

```js
{
  pointlist: [[0.2, -0.7764], [0.22, -0.7732] ...],
  pointattributelist: [-0.57, -0.55, -0.51, -0.53 ...],
  pointmarkerlist: [],
  segmentlist: [[28, 0], [0, 1] ...],
  segmentmarkerlist: [],
  holelist: [[0.47, -0.5]],
  regionlist: [],
  numberofpoints: 29,
  numberofpointattributes: 1,
  numberofsegments: 29,
  numberofholes: 1,
  numberofregions: 0
}
```

## Demo

[poly-parse demo](https://brunoimbrizi.github.io/poly-parse/demo/)

## Usage

### `polyparse(poly, options)`

- `poly` string with the content of the .poly file

- `options`
  - `flat` (default `false`) flatten nested arrays i.e. `[[x, y], [x, y]]` into `[x, y, x, y]`
  - `normalize` (default `false`) normalizes path to its bounding box, returns points in the `-1.0 ... 1.0` range
  - all the [config options from Papa Parse](https://www.papaparse.com/docs#config)

**Returns** an object with the parsed properties.

For convenience the parsed output uses the same property names as  `struct triangulateio` defined in `triangle.h` from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html).

Indices in a .poly file can be zero-based or one-based, but the parsed result is *always zero-based*.


## See Also

- [Triangle - A Two-Dimensional Quality Mesh Generator and Delaunay Triangulator](https://www.cs.cmu.edu/~quake/triangle.html) - Jonathan Shewchuk
- [normalize-path-scale](https://github.com/mattdesl/normalize-path-scale)
- [bound-points](https://github.com/mikolalysenko/bound-points)

## License

MIT, see [LICENSE](LICENSE) for details.
