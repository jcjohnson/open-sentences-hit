var VG = (function(vg, $) {

  /*
  var DOT_RADIUS_SMALL = 4;
  var DOT_RADIUS_BIG = 8;

  var EXTENT_MIN_RADIUS = 5;
  var EXTENT_START_RADIUS = 20;

  var CLICK_REGION_RADIUS = 10;
  var CLICK_REGION_BIG_RADIUS = 200;
  var CLICK_REGION_OPACITY = 0;
  */

  var DEFAULT_OPTIONS = {
    dot_radius_small: 4,
    dot_radius_big: 8,
    extent_min_radius: 5,
    extent_start_radius: 0,
    click_region_radius: 10,
    click_region_big_radius: 200,
    click_region_opacity: 0,
    passive: false,
  };

  // Z ordering is a little tricky. Here's the lowdown:
  // When no object is emphasized, we want to have the following z-order:
  //
  // all click regions
  // all dots
  // image
  // text boxes and extents
  //
  // When some circle-object becomes emphasized we want to hvae the following
  // z-order:
  //
  // current click region
  // current text box
  // current dot
  // current extent
  // all other click regions
  // all other dots
  // image
  // all other text boxes and extents
  //
  // To manage these constraints we keep a Raphael set per-paper for dots and
  // click regions.
  var sets = [];
  var nextIdx = 0;

  vg.CircleObject = function(paper, x, y, color, name, options) {
    var that = (this === window ? {} : this);

    options = vg.merge_options(options, DEFAULT_OPTIONS);

    if (typeof(options) === 'undefined') {
      options = {};
    }
    if (typeof(options.passive) === 'undefined') {
      options.passive = false;
    }

    // Insert an extra property on the paper to use as an index into the sets
    // variable.
    if (typeof(paper._circle_object_idx_) === 'undefined') {
      paper._circle_object_idx_ = (nextIdx++);
      sets[paper._circle_object_idx_] = {
        click_regions: paper.set(),
        dots: paper.set(),
      };
    }
    var paper_idx = paper._circle_object_idx_;

    var callbacks = {};
    var emphasized = false;
    var click_region_expanded = false;

    var dot = paper.circle(x, y, options.dot_radius_small);
    dot.attr('fill', color.hex);
    sets[paper_idx].dots.push(dot);
    
    var extent = paper.circle(x, y, options.extent_start_radius);
    extent.attr({
      'stroke': 'none',
      'fill': color.hex,
      'fill-opacity': 0,
    });
    extent.toBack();

    var text_box_position = {
      x: x,
      y: y,
      location: 'bottom',
      offset: options.dot_radius_big
    };
    var text_box = new vg.TextBox(paper, text_box_position, name);
    text_box.toBack();

    var click_region = null;
    if (!options.passive) {
      click_region = paper.circle(x, y, options.click_region_radius);
      click_region.attr({
        'stroke': 'none',
        'fill': '#fff',
        'fill-opacity': options.click_region_opacity,
        'cursor': 'nw-resize',
      });
      sets[paper_idx].click_regions.push(click_region);

      sets[paper_idx].dots.toFront();
      sets[paper_idx].click_regions.toFront();
    }


    /**
     * Move the circle object to a new position on the canvas.
     * If the desired position is outside the canvas then it does
     * nothing.
     */
    that.moveTo = function(new_x, new_y) {
      var bbox = paper.canvas.getBBox();
      var valid_x = (new_x >= 0 && new_x < bbox.width);
      var valid_y = (new_y >= 0 && new_y < bbox.height);
      // var valid_x = new_x >= 0 && new_x < paper.canvas.offsetWidth;
      // var valid_y = new_y >= 0 && new_y < paper.canvas.offsetHeight;
      if (!valid_x || !valid_y) return;
      x = new_x;
      y = new_y;
      text_box.moveTo(x, y);
      dot.attr({'cx': x, 'cy': y});
      if (click_region) click_region.attr({'cx': x, 'cy': y});
      extent.attr({'cx': x, 'cy': y});
    }

    that.setExtent = function(r) {
      if (!r || r < options.extent_min_radius) {
        r = options.extent_min_radius;
      }
      extent.animate({'r': r});
      setClickRegionSize();
    }

    that.getExtent = function() {
      return extent.attr('r');
    }

    function setClickRegionSize() {
      if (click_region === null) return;
      var click_radius = options.click_region_radius;
      if (click_region_expanded) {
        click_radius = options.click_region.big_radius;
      }
      if (emphasized) {
        click_radius += that.getExtent();
      }
      click_region.animate({'r': click_radius});
    }

    that.expandClickRegion = function() {
      click_region_expanded = true;
      setClickRegionSize();
    }

    that.shrinkClickRegion = function() {
      click_region_expanded = false;
      setClickRegionSize();
    }

    function emphasize() {
      emphasized = true;
      text_box.show();
      extent.animate({'fill-opacity': 0.5});
      dot.animate({'r': options.dot_radius_big});

      // When an element becomes emphasized we increase the size of its
      // click region to the size of its extent, plus some padding
      setClickRegionSize();

      // When an element becomes emphasized we need to adjust the
      // z-ordering of its elements
        extent.toFront();
        dot.toFront();
        text_box.toFront();
        sets[paper_idx].click_regions.toFront();
      if (!options.passive) {
        click_region.toFront();
      }
    }
    that.emphasize = emphasize;

    function deemphasize() {
      emphasized = false;
      text_box.hide();
      extent.animate({'fill-opacity': 0});
      dot.animate({'r': options.dot_radius_small});

      setClickRegionSize();
      // click_region.animate({'r': CLICK_REGION_RADIUS});

      extent.toBack();
      text_box.toBack();
      sets[paper_idx].dots.toFront();
      sets[paper_idx].click_regions.toFront();
    }
    that.deemphasize = deemphasize;

    that.toggle = function() {
      if (emphasized) {
        deemphasize();
      } else {
        emphasize();
      }
    }

    that.hide = function() {
      that.deemphasize();
      dot.attr({'opacity': 0});
    }

    that.show = function() {
      dot.attr({'opacity': 1});
    }

    function setCallbacks(callbacks) {
      if (click_region === null) {
        return;
      }
      if (typeof(callbacks.click === 'function')) {
        click_region.click(callbacks.click);
      }

      if (typeof(callbacks.dblclick === 'function')) {
        click_region.dblclick(callbacks.dblclick);
      }

      var has_onmove = (typeof(callbacks.onmove) === 'function');
      var has_onmovestart = (typeof(callbacks.onmovestart) === 'function');
      var has_onmoveend = (typeof(callbacks.onmoveend) === 'function');
      if (has_onmove && has_onmovestart && has_onmoveend) {
        click_region.drag(callbacks.onmove, callbacks.onmovestart, callbacks.onmoveend);
      } else if (has_onmove && has_onmovestart) {
        click_region.drag(callbacks.onmove, callbacks.onmovestart);
      } else if (has_onmove) {
        click_region.drag(callbacks.onmove);
      }

      if (typeof(callbacks.hover_in === 'function') &&
          typeof(callbacks.hover_out === 'function')) {
        click_region.hover(callbacks.hover_in, callbacks.hover_out);
      }

    }
    that.setCallbacks = setCallbacks;

    that.remove = function() {
      dot.remove();
      click_region.remove();
      extent.remove();
      text_box.remove();
    }

    that.getX = function() { return x; }
    that.getY = function() { return y; }
    that.getColor = function() { return color; }

    return that;
  }

  return vg;

}(VG || {}, jQuery));
