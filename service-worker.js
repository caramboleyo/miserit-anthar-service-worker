// dumb firefox cant do imports!

function planetHexasphere({ type, size }) {
	const radius = Math.ceil(size / 5);
	const numDivisions = type == 'GAS' ? Math.ceil(size / 5) : Math.ceil(size);
	const hexSize = 1;
	const hexasphere = new Hexasphere(radius, numDivisions, hexSize);
	return hexasphere;
}

var _faceCount = 0; // this just gives all faces uniquish ids

class Point {
	constructor(x, y, z, t) {
		if (x !== undefined && y !== undefined && z !== undefined) {
			this.x = x.toFixed(3);
			this.y = y.toFixed(3);
			this.z = z.toFixed(3);
			this.t = t;
		}

		this.faces = [];
	}
	subdivide(point, count, checkPoint) {
		var segments = [];
		segments.push(this);

		for (var i = 1; i < count; i++) {
			var np = new Point(
				this.x * (1 - i / count) + point.x * (i / count),
				this.y * (1 - i / count) + point.y * (i / count),
				this.z * (1 - i / count) + point.z * (i / count),
			);
			np = checkPoint(np);
			segments.push(np);
		}

		segments.push(point);

		return segments;
	}
	segment(point, percent) {
		percent = Math.max(0.01, Math.min(1, percent));

		var x = point.x * (1 - percent) + this.x * percent;
		var y = point.y * (1 - percent) + this.y * percent;
		var z = point.z * (1 - percent) + this.z * percent;

		var newPoint = new Point(x, y, z);
		return newPoint;
	}
	midpoint(point, location) {
		return this.segment(point, 0.5);
	}
	project(radius, percent) {
		if (percent == undefined) {
			percent = 1.0;
		}

		percent = Math.max(0, Math.min(1, percent));
		var yx = this.y / this.x;
		var zx = this.z / this.x;
		var yz = this.z / this.y;

		var mag = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2));
		var ratio = radius / mag;

		this.x = this.x * ratio * percent;
		this.y = this.y * ratio * percent;
		this.z = this.z * ratio * percent;
		return this;
	}
	registerFace(face) {
		this.faces.push(face);
	}
	getOrderedFaces() {
		const workingArray = this.faces.slice();
		const ret = [];

		for (let i = 0; i < this.faces.length; i++) {
			if (i == 0) {
				ret.push(workingArray[i]);
				workingArray.splice(i, 1);
			} else {
				var hit = false;
				for (let j = 0; j < workingArray.length && !hit; j++) {
					if (workingArray[j].isAdjacentTo(ret[i - 1])) {
						hit = true;
						ret.push(workingArray[j]);
						workingArray.splice(j, 1);
					}
				}
			}
		}
		return ret;
	}
	findCommonFace(other, notThisFace) {
		for (var i = 0; i < this.faces.length; i++) {
			for (var j = 0; j < other.faces.length; j++) {
				if (this.faces[i].id === other.faces[j].id && this.faces[i].id !== notThisFace.id) {
					return this.faces[i];
				}
			}
		}

		return null;
	}
	toJson() {
		return {
			x: this.x,
			y: this.y,
			z: this.z,
		};
	}
	toString() {
		return '' + this.x + ',' + this.y + ',' + this.z;
	}
}

class Face {
	constructor(point1, point2, point3, register) {
		this.id = _faceCount++;

		if (register == undefined) {
			register = true;
		}

		this.points = [point1, point2, point3];
		if (register) {
			point1.registerFace(this);
			point2.registerFace(this);
			point3.registerFace(this);
		}
		this.adjacentCache = {};
	}
	getOtherPoints(point1) {
		var other = [];
		for (var i = 0; i < this.points.length; i++) {
			if (this.points[i].toString() !== point1.toString()) {
				other.push(this.points[i]);
			}
		}
		return other;
	}
	findThirdPoint(point1, point2) {
		for (var i = 0; i < this.points.length; i++) {
			if (
				this.points[i].toString() !== point1.toString() &&
				this.points[i].toString() !== point2.toString()
			) {
				return this.points[i];
			}
		}
	}
	isAdjacentTo(face2) {
		if (this.adjacentCache[face2.id]) {
			return this.adjacentCache[face2.id];
		}
		// adjacent if 2 of the points are the same
		var count = 0;
		for (var i = 0; i < this.points.length; i++) {
			for (var j = 0; j < face2.points.length; j++) {
				if (this.points[i].toString() == face2.points[j].toString()) {
					count++;
				}
			}
		}
		return (this.adjacentCache[face2.id] = count == 2);
	}
	getCentroid(clear) {
		if (this.centroid && !clear) {
			return this.centroid;
		}

		var x = (this.points[0].x + this.points[1].x + this.points[2].x) / 3;
		var y = (this.points[0].y + this.points[1].y + this.points[2].y) / 3;
		var z = (this.points[0].z + this.points[1].z + this.points[2].z) / 3;

		var centroid = new Point(x, y, z);

		this.centroid = centroid;

		return centroid;
	}
}

class Tile {
	constructor(centerPoint, hexSize) {
		if (hexSize == undefined) {
			hexSize = 1;
		}

		hexSize = Math.max(0.01, Math.min(1.0, hexSize));

		this.centerPoint = centerPoint;
		this.faces = centerPoint.getOrderedFaces();
		//this.faces = centerPoint.faces;
		this.boundary = [];
		for (var f = 0; f < this.faces.length; f++) {
			const p = this.faces[f].getCentroid().segment(this.centerPoint, hexSize);
			// build boundary
			this.boundary.push(p);
		}
		//log('>>>this.boundary', this.boundary);

		// Some of the faces are pointing in the wrong direction
		// Fix this.  Should be a better way of handling it
		// than flipping them around afterwards
		//this.twisted = false;
		this.normal = calculateSurfaceNormal(this.boundary[1], this.boundary[2], this.boundary[3]);
		this.boundary.reverse();
		this.faces.reverse();

		if (!pointingAwayFromOrigin(this.centerPoint, this.normal)) {
			this.boundary.reverse();
			this.faces.reverse();
		}

		// get neighboring tiles
		this.neighborIds = []; // this holds the centerpoints, will resolve to references after
		this.neighbors = []; // this is filled in after all the tiles have been created
		const neighborHash = {};
		let prev = [];
		let first = null;
		for (var f = 0; f < this.faces.length; f++) {
			const otherPoints = this.faces[f].getOtherPoints(this.centerPoint);
			if (prev.includes(otherPoints[0])) {
				neighborHash[otherPoints[0]] = 1;
				if (first === null) {
					first = prev[prev.indexOf(otherPoints[0]) === 0 ? 1 : 0];
				}
			}
			if (prev.includes(otherPoints[1])) {
				neighborHash[otherPoints[1]] = 1;
				if (first === null) {
					first = prev[prev.indexOf(otherPoints[1]) === 0 ? 1 : 0];
				}
			}
			prev = otherPoints;
		}
		neighborHash[first] = 1;
		this.neighborIds = Object.keys(neighborHash);

		this.center = { x: 0, y: 0, z: 0 };
		for (const point of this.boundary) {
			this.center.x += Number(point.x);
			this.center.y += Number(point.y);
			this.center.z += Number(point.z);
		}
		if (this.boundary.length === 5) {
			this.center.x = this.center.x / 5;
			this.center.y = this.center.y / 5;
			this.center.z = this.center.z / 5;
		} else {
			this.center.x = this.center.x / 6;
			this.center.y = this.center.y / 6;
			this.center.z = this.center.z / 6;
		}
	}
	getLatLon(radius, boundaryNum) {
		var point = this.centerPoint;
		if (typeof boundaryNum == 'number' && boundaryNum < this.boundary.length) {
			point = this.boundary[boundaryNum];
		}
		//var phi = Math.acos(point.y / radius); //lat
		//var theta = (Math.atan2(point.x, point.z) + Math.PI + Math.PI / 2) % (Math.PI * 2) - Math.PI; // lon
		// we have z on top
		var phi = Math.acos(point.z / radius); //lat
		var theta =
			((Math.atan2(point.x, point.y) + Math.PI + Math.PI / 2) % (Math.PI * 2)) - Math.PI; // lon

		// theta is a hack, since I want to rotate by Math.PI/2 to start.  sorryyyyyyyyyyy
		return {
			lat: (180 * phi) / Math.PI - 90,
			lon: (180 * theta) / Math.PI,
		};
	}
	scaledBoundary(scale) {
		scale = Math.max(0, Math.min(1, scale));

		var ret = [];
		for (var i = 0; i < this.boundary.length; i++) {
			ret.push(this.centerPoint.segment(this.boundary[i], 1 - scale));
		}

		return ret;
	}
	toJson() {
		// this.centerPoint = centerPoint;
		// this.faces = centerPoint.getOrderedFaces();
		// this.boundary = [];
		return {
			centerPoint: this.centerPoint.toJson(),
			boundary: this.boundary.map(function (point) {
				return point.toJson();
			}),
		};
	}
	toString() {
		return this.centerPoint.toString();
	}
}

class Hexasphere {
	constructor(radius, numDivisions, hexSize) {
		const start = Date.now();

		this.radius = radius;
		var tao = 1.61803399;
		var corners = [
			new Point(1000, tao * 1000, 0, 'ppz'),
			new Point(-1000, tao * 1000, 0, 'npz'),
			new Point(1000, -tao * 1000, 0, 'pnz'),

			new Point(-1000, -tao * 1000, 0, 'nnz'),
			new Point(0, 1000, tao * 1000, 'zpp'),
			new Point(0, -1000, tao * 1000, 'znp'),

			new Point(0, 1000, -tao * 1000, 'zpn'),
			new Point(0, -1000, -tao * 1000, 'znn'),
			new Point(tao * 1000, 0, 1000, 'pzp'),

			new Point(-tao * 1000, 0, 1000, 'nzp'),
			new Point(tao * 1000, 0, -1000, 'pzn'),
			new Point(-tao * 1000, 0, -1000, 'nzn'),
		];

		var points = {};

		for (var i = 0, l = corners.length; i < l; i++) {
			points[corners[i]] = corners[i];
		}

		var faces = [
			new Face(corners[0], corners[1], corners[4], false),
			new Face(corners[1], corners[9], corners[4], false),
			new Face(corners[4], corners[9], corners[5], false),
			new Face(corners[5], corners[9], corners[3], false),
			new Face(corners[2], corners[3], corners[7], false),
			new Face(corners[3], corners[2], corners[5], false),
			new Face(corners[7], corners[10], corners[2], false),
			new Face(corners[0], corners[8], corners[10], false),
			new Face(corners[0], corners[4], corners[8], false),
			new Face(corners[8], corners[2], corners[10], false),
			new Face(corners[8], corners[4], corners[5], false),
			new Face(corners[8], corners[5], corners[2], false),
			new Face(corners[1], corners[0], corners[6], false),
			new Face(corners[11], corners[1], corners[6], false),
			new Face(corners[3], corners[9], corners[11], false),
			new Face(corners[6], corners[10], corners[7], false),
			new Face(corners[3], corners[11], corners[7], false),
			new Face(corners[11], corners[6], corners[7], false),
			new Face(corners[6], corners[0], corners[10], false),
			new Face(corners[9], corners[1], corners[11], false),
		];

		var getPointIfExists = function (point) {
			if (points[point]) {
				// log("EXISTING!");
				return points[point];
			} else {
				// log("NOT EXISTING!");
				points[point] = point;
				return point;
			}
		};

		var newFaces = [];

		for (var f = faces.length - 1; f >= 0; f--) {
			// log("-0---");
			var prev = null;
			var bottom = [faces[f].points[0]];
			var left = faces[f].points[0].subdivide(
				faces[f].points[1],
				numDivisions,
				getPointIfExists,
			);
			var right = faces[f].points[0].subdivide(
				faces[f].points[2],
				numDivisions,
				getPointIfExists,
			);
			for (var i = 1; i <= numDivisions; i++) {
				prev = bottom;
				bottom = left[i].subdivide(right[i], i, getPointIfExists);
				for (var j = 0; j < i; j++) {
					var nf = new Face(prev[j], bottom[j], bottom[j + 1]);
					newFaces.push(nf);

					if (j > 0) {
						nf = new Face(prev[j - 1], prev[j], bottom[j]);
						newFaces.push(nf);
					}
				}
			}
		}

		faces = newFaces;

		var newPoints = {};
		for (var p in points) {
			var np = points[p].project(radius);
			newPoints[np] = np;
		}

		points = newPoints;

		this.tiles = [];
		this.tileLookup = {};

		// create tiles and store in a lookup for references
		for (var p in points) {
			var newTile = new Tile(points[p], hexSize);
			newTile.index = this.tiles.push(newTile) - 1;
			this.tileLookup[newTile.toString()] = newTile;
		}

		// resolve neighbor references now that all have been created
		for (var t in this.tiles) {
			this.tiles[t].neighbors = this.tiles[t].neighborIds.map(item => {
				return this.tileLookup[item];
			});
		}
	}
	toJson() {
		return JSON.stringify({
			radius: this.radius,
			tiles: this.tiles.map(function (tile) {
				return tile.toJson();
			}),
		});
	}
	toObj() {
		var objV = [];
		var objF = [];
		var objText = '# vertices \n';
		var vertexIndexMap = {};

		for (var i = 0; i < this.tiles.length; i++) {
			var t = this.tiles[i];

			var F = [];
			for (var j = 0; j < t.boundary.length; j++) {
				var index = vertexIndexMap[t.boundary[j]];
				if (index == undefined) {
					objV.push(t.boundary[j]);
					index = objV.length;
					vertexIndexMap[t.boundary[j]] = index;
				}
				F.push(index);
			}

			objF.push(F);
		}

		for (var i = 0; i < objV.length; i++) {
			objText += 'v ' + objV[i].x + ' ' + objV[i].y + ' ' + objV[i].z + '\n';
		}

		objText += '\n# faces\n';
		for (var i = 0; i < objF.length; i++) {
			faceString = 'f';
			for (var j = 0; j < objF[i].length; j++) {
				faceString = faceString + ' ' + objF[i][j];
			}
			objText += faceString + '\n';
		}

		return objText;
	}
}

function vector(p1, p2) {
	return {
		x: p2.x - p1.x,
		y: p2.y - p1.y,
		z: p2.z - p1.z,
	};
}

// https://www.khronos.org/opengl/wiki/Calculating_a_Surface_Normal
// Set Vector U to (Triangle.p2 minus Triangle.p1)
// Set Vector V to (Triangle.p3 minus Triangle.p1)
// Set Normal.x to (multiply U.y by V.z) minus (multiply U.z by V.y)
// Set Normal.y to (multiply U.z by V.x) minus (multiply U.x by V.z)
// Set Normal.z to (multiply U.x by V.y) minus (multiply U.y by V.x)
function calculateSurfaceNormal(p1, p2, p3) {
	const U = vector(p1, p2);
	const V = vector(p1, p3);

	const N = {
		x: U.y * V.z - U.z * V.y,
		y: U.z * V.x - U.x * V.z,
		z: U.x * V.y - U.y * V.x,
	};

	return N;
}

function pointingAwayFromOrigin(p, v) {
	return p.x * v.x >= 0 && p.y * v.y >= 0 && p.z * v.z >= 0;
}

function normalizeVector(v) {
	var m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

	return {
		x: v.x / m,
		y: v.y / m,
		z: v.z / m,
	};
}

const start = Date.now();
const planetCache = {
	'gas': {},
	'any': {},
};
for (const type of ['gas', 'any']) {
	for (size = 1; size <= 20; size++) {
		planetCache[type][size] = planetHexasphere({ type, size });
	}
}

let planetSharedArrayBuffer;
if (typeof SharedArrayBuffer === 'object') {
	planetSharedArrayBuffer = new SharedArrayBuffer(1024);

} else {
	console.info('SharedArrayBuffer unavailable');
}

console.log('FINISHED SPHERE MATH in ms', Date.now() - start);


console.log('serviceWorkerContext', self);
console.log('serviceWorkerRegistration', registration);


self.addEventListener('install', (event) => {
	/*event.waitUntil(
		addResourcesToCache([
			"/",
			"/index.html",
			"/style.css",
			"/app.js",
			"/image-list.js",
			"/star-wars-logo.jpg",
			"/gallery/bountyHunters.jpg",
			"/gallery/myLittleVader.jpg",
			"/gallery/snowTroopers.jpg",
		]),
	);*/
});

self.addEventListener('activate', async (event) => {
	console.log('ACTIVATED');
	// claim clients so they dont have to reload
	event.waitUntil(self.clients.claim());
	console.log('CLAIMED ALL CLIENTS')
});

self.addEventListener('fetch', (event) => {
	//event.respondWith(/* custom content goes here */);
	//console.log('fetch', event);
	/*self.clients.matchAll().then(function (clients) {
		clients.forEach(function (client) {
			client.postMessage({
				msg: "Hey I just got a fetch from you!",
				url: event.request.url
			});
		});
	});*/
});

self.addEventListener('message', (event) => {
	console.log('>>>service worker message', event);
	responseHandlers[event.data.section](event.data.data, event, event.data.requestId);
});

const responseHandlers = {
	getPlanet(data, event, requestId) {
		const { type, size } = data;
		event.source.postMessage({
			time: Date.now(),
			data: planetCache[type][size],
			responseId: requestId,
		});
	},
	getPlanetSharedBuffer(data, event, requestId) {
		event.source.postMessage({
			time: Date.now(),
			responseId: requestId,
			buffer: planetSharedArrayBuffer,
		});
	},
	ping(data, event) {
		event.source.postMessage({
			section: 'pong',
			time: Date.now(),
		});
	},
};

console.log('>>>crossOriginIsolated', crossOriginIsolated);
