L.Projection.Proj4js = L.Class.extend({
	initialize: function(code, def) {
		if (typeof(def) !== 'undefined') {
			Proj4js.defs[code] = def;
		}

		this._proj = new Proj4js.Proj(code);
	},

	project: function (latlng) {
		var point = new L.Point(latlng.lng, latlng.lat);
		return Proj4js.transform(Proj4js.WGS84, this._proj, point);
	},

	unproject: function (point, unbounded) {
		var point2 = Proj4js.transform(this._proj, Proj4js.WGS84, point.clone());
		return new L.LatLng(point2.y, point2.x, unbounded);
	}
});

L.CRS.Proj4js = L.Class.extend({
	includes: L.CRS,

	initialize: function(code, def,
		/*L.Transformation*/ transformation, options) {
		this.code = code;
		this.transformation =
			transformation ? transformation : new Transformation(1, 0, -1, 0);
		this.projection = new L.Projection.Proj4js(code, def);

		if (options) {
			if (options.scales) {
				this.scale = function(zoom) {
					return options.scales[zoom];
				}
			} else if (options.resolutions) {
				this.scale = function(zoom) {
					return 1 / options.resolutions[zoom];
				}
			}
		}
	},
});

L.CRS.Proj4jsTMS = L.CRS.Proj4js.extend({
	initialize: function(code, def, projectedBounds, options) {
		L.CRS.Proj4js.prototype.initialize(code, def,
			new L.Transformation(1, -projectedBounds[0], -1, projectedBounds[3]),
			options);
		this.projectedBounds = projectedBounds;
	},
});

// This is left here for backwards compatibility
L.CRS.proj4js = (function () {
	return function (code, def, transformation) {
		return new L.CRS.Proj4js(code, def, transformation);
	};
}());

L.TileLayer.Proj4TMS = L.TileLayer.extend({
	options: {
		tms: true,
		continuousWorld: true,
	},

	initialize: function(urlTemplate, crs, options) {
		if (!(crs instanceof L.CRS.Proj4jsTMS)) {
			throw new Error("CRS is not L.CRS.Proj4jsTMS.");
		}

		L.TileLayer.prototype.initialize.call(this, urlTemplate, options);
		this.crs = crs;

		// Verify grid alignment
		for (var i = this.options.minZoom; i < this.options.maxZoom; i++) {
			var gridHeight = (this.crs.projectedBounds[3] - this.crs.projectedBounds[1]) /
				this._projectedTileSize(i);
			if (Math.abs(gridHeight - Math.round(gridHeight)) > 1e-3) {
				throw new Error("Projected bounds does not match grid at zoom " + i);
			}
		}
	},

	getTileUrl: function(tilePoint) {
		var gridHeight =
			Math.round((this.crs.projectedBounds[3] - this.crs.projectedBounds[1]) /
			this._projectedTileSize(this._map.getZoom()));

		// TODO: relies on some of TileLayer's internals
		return L.Util.template(this._url, L.Util.extend({
			s: this._getSubdomain(tilePoint),
			z: this._getZoomForUrl(),
			x: tilePoint.x,
			y: gridHeight - tilePoint.y - 1
		}, this.options));
	},

	_projectedTileSize: function(zoom) {
		return (this.options.tileSize / this.crs.scale(zoom));
	}
});