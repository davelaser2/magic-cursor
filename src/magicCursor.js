/**
 * @author David Rahn <https://github.com/lasernyc>
 */

var MagicCursor = (function() {
	var canvas, cursorSettings, ctx, LOOP, xDirection, yDirection;
	// Persistent animation state and particle collections
	var previousX = 0;
	var previousY = 0;
	var buffer = 0;
	var pointSet = [];
	var trailSet = [];
	var initialized = false;
	var canvasBuilt = false;
	var resizeHandler = null;

	function setupCursor(settings) {
		// Merge defaults with user-provided configuration
		// and normalize derived settings for the animation loop.
		cursorSettings = Object.assign({
			enableTrail: true,
			trailDensity: 6,
			trailGravity: -0.5,
			trailColor: '211, 5, 252',
			singlePointChar: '+',
			pointSize: 16,
			pointAmount: 70,
			pointGravity: 1,
			pointDissolveRate: 80,
			pointColors: ['4, 210, 218', '27, 55, 224', '211, 5, 252']
		}, settings || {});

		var amount = Math.min(Math.max(cursorSettings.pointAmount, 0), 99);
		cursorSettings.pointAmount = amount;
		cursorSettings.pointThrottle = Math.max(1, 100 - amount);
		cursorSettings.pointDissolveRate = Math.max(cursorSettings.pointDissolveRate, 0) / 1000;
	}

	/**
	 * A single cursor point
	 * @constructor
	 */
	function SinglePoint(e) {
		this.x = e.clientX;
		this.y = e.clientY;
		this.color = cursorSettings.pointColors[getRandomInt(0, cursorSettings.pointColors.length)];
		this.opacity = 1;
		this.xDirection = xDirection;
		this.fontSize = cursorSettings.pointSize;
		this.xModifier = getRandomFloat(0.1, 0.5);
		this.gravity = cursorSettings.pointGravity;
	}

	/**
	 * A single trail item
	 * @constructor
	 */
	function Trail(e) {
		this.x = e.clientX;
		this.y = e.clientY;
		this.size = cursorSettings.trailDensity;
		this.opacity = 1;
	}

	function getRandomFloat(min, max) {
		return Math.random() * (max - min) + min;
	}

	function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min) + min);
	}

	function debounce(fn, delay) {
		// Debounce repeated resize events to reduce layout thrash.
		var timeoutId;
		return function() {
			var args = arguments;
			clearTimeout(timeoutId);
			timeoutId = setTimeout(function() {
				fn.apply(null, args);
			}, delay);
		};
	}

	function setCanvasSize() {
		// Keep the canvas sized to the browser viewport.
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function setDirection(e) {
		// Track the cursor direction so new points can drift consistently.
		xDirection = e.clientX < previousX ? 'left' : 'right';
		yDirection = e.clientY < previousY ? 'up' : 'down';
		previousX = e.clientX;
		previousY = e.clientY;
	}

	function drawTrails() {
		var activeTrails = [];

		for (var j = 0; j < trailSet.length; j++) {
			var trail = trailSet[j];
			trail.opacity -= 0.06;
			trail.size -= 0.5;
			trail.y += cursorSettings.trailGravity - 1;
			ctx.fillStyle = 'rgba(' + cursorSettings.trailColor + ',' + trail.opacity + ')';
			ctx.fillRect(trail.x, trail.y - 5, trail.size, trail.size);

			if (trail.opacity > 0) {
				activeTrails.push(trail);
			}
		}

		trailSet = activeTrails;
	}

	function drawPoints() {
		var activePoints = [];

		for (var i = 0; i < pointSet.length; i++) {
			var point = pointSet[i];
			point.opacity -= 0.01;
			point.fontSize -= cursorSettings.pointDissolveRate;
			point.y += point.gravity;
			point.x += point.xDirection === 'left' ? -point.xModifier : point.xModifier;
			ctx.font = '100 ' + point.fontSize + 'px Courier';
			ctx.fillStyle = 'rgba(' + point.color + ',' + point.opacity + ')';
			ctx.fillText(cursorSettings.singlePointChar, point.x, point.y);

			if (point.opacity > 0.3) {
				activePoints.push(point);
			}
		}

		pointSet = activePoints;
	}

	function drawEverything() {
		// Main animation frame: clear, render particles, then request the next frame.
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		drawPoints();

		if (window.innerWidth < 767) {
			destroyCursor();
			return;
		}

		if (cursorSettings.trailDensity > 0 && cursorSettings.enableTrail) {
			drawTrails();
		}

		LOOP = requestAnimationFrame(drawEverything);
	}

	function mouseMoveEvent(e) {
		// Add trail fragments continuously, but only add full points at a reduced rate.
		trailSet.push(new Trail(e));
		buffer += 1;

		if (buffer >= cursorSettings.pointThrottle / 10) {
			buffer = 0;
			setDirection(e);
			pointSet.push(new SinglePoint(e));
		}
	}

	function destroyCursor() {
		// Stop the frame loop and remove all event listeners.
		if (LOOP) {
			cancelAnimationFrame(LOOP);
			LOOP = null;
		}

		initialized = false;

		if (resizeHandler) {
			window.removeEventListener('resize', resizeHandler);
			resizeHandler = null;
		}

		document.removeEventListener('mousemove', mouseMoveEvent);
		pointSet.length = 0;
		trailSet.length = 0;
	}

	return {
		// Creates the cursor effect if the viewport is large enough and it is not already running.
		init: function(settings) {
			if (window.innerWidth > 1025 && !initialized) {
				if (!canvasBuilt) {
					canvas = document.createElement('canvas');
					var canvasStyles = 'background-color: transparent; position: fixed; top: 0; left: 0; z-index: 12000; pointer-events: none;';
					canvas.id = 'mouse-trail';
					canvas.setAttribute('style', canvasStyles);
					document.body.insertBefore(canvas, document.body.firstChild);
					canvasBuilt = true;
				}

				setupCursor(settings);
				ctx = canvas.getContext('2d');
				setCanvasSize();
				resizeHandler = debounce(setCanvasSize, 100);
				window.addEventListener('resize', resizeHandler);
				document.addEventListener('mousemove', mouseMoveEvent);
				LOOP = requestAnimationFrame(drawEverything);
				initialized = true;
			}
		},
		destroy: destroyCursor
	};
})();
