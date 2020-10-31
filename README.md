poly-parse
==========

Parses .poly files from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html).

> A .poly file represents a PSLG, as well as some additional information. PSLG stands for Planar Straight Line Graph, a term familiar to computational geometers. By definition, a PSLG is just a list of vertices and segments. A .poly file can also contain information about holes and concavities, as well as regional attributes and constraints on the areas of triangles.

Full description of the [.poly file format](https://www.cs.cmu.edu/~quake/triangle.poly.html).

It can also parse [.node files](https://www.cs.cmu.edu/~quake/triangle.node.html) since they represent a subset of .poly.

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
  numberofpoints: 29,
  numberofpointattributes: 1,
  pointlist: [[0.2, -0.7764], [0.22, -0.7732] ...],
  pointattributelist: [-0.57, -0.55, -0.51, -0.53 ...]
  ...
}
```

For convenience the property names in the output are the same as in `struct triangulateio` defined in `triangle.h` from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html).

Indices in a .poly file can be zero-based or one-based, but the parsed result is *always zero-based*.


## Usage

#### `polyparse(poly, options)`

- `poly` string with the content of the .poly file

- `options`
  - `flat` boolean to flatten nested arrays i.e. `[[x, y], [x, y]]` becomes `[x, y, x, y]`
  - all the [config options from Papa Parse](https://www.papaparse.com/docs#config)


## See Also

- [Triangle - A Two-Dimensional Quality Mesh Generator and Delaunay Triangulator](https://www.cs.cmu.edu/~quake/triangle.html) - Jonathan Shewchuk


## License

MIT, see [LICENSE](LICENSE) for details.
