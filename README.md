# poly-parse

Parses a .poly file from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html) and returns a JSON.

> A .poly file represents a PSLG, as well as some additional information. PSLG stands for Planar Straight Line Graph, a term familiar to computational geometers. By definition, a PSLG is just a list of vertices and segments. A .poly file can also contain information about holes and concavities, as well as regional attributes and constraints on the areas of triangles.

Full description of the [.poly file format](https://www.cs.cmu.edu/~quake/triangle.poly.html).

The file is parsed with [Papa Parse](https://www.npmjs.com/package/papaparse).

## Install
```
npm install poly-parse
```

## Example
```js
const polyparse = require('poly-parse');

polyparse('./A.poly', { download: true })
	.then(data => console.log(data))
	.catch(err => console.log(err))
```
Returns a `Promise` with the parsed object.

```js
{
  numberofpoints: 29,
  pointlist: [0.2, -0.7764, 0.22, -0.7732 ...],
  pointattributelist: [-0.57, -0.55, -0.51, -0.53 ...]
  ...
}
```

For convenience the property names in the output are the same as in `struct triangulateio` from [Triangle](https://www.cs.cmu.edu/~quake/triangle.html).
Indices in a .poly file can be zero-based or one-based, but the parsed result is always zero-based.

## Usage

#### `polyparse(poly, options)`

`poly` Can be either the content of the .poly file as a string, or a path / URL, or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File). 

`options`
- `download` set to `true` if the first argument is a path or a URL.
- All the other [config options from Papa Parse](https://www.papaparse.com/docs#config).


## See Also

- [Triangle - A Two-Dimensional Quality Mesh Generator and Delaunay Triangulator](https://www.cs.cmu.edu/~quake/triangle.html) - Jonathan Shewchuk

## License

MIT, see [LICENSE.md](LICENSE.md) for details.
