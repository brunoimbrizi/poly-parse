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
	ctx.lineWidth = 2;
	
	// draw points
  let x, y;
  for (let i = 0; i < points.length; i++) {
    x = points[i][0];
    y = points[i][1];
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
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
