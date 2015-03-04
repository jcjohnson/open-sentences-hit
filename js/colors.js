var VG = (function(vg) {

  /**
   * Generate evenly spaced colors in HSV space.
   * Returns an array of num Raphael color objects.
   */
  vg.getEvenlySpacedColors = function(num) {
    var space = 1.0 / num;
    var colors = [];
    for (var i = 0; i < num; i++) {
      var h = space * i;
      var s = 1;
      var l = 0.5;
      var colorString = Raphael.format('hsl({0},{1},{2})', h, s, l);
      colors[i] = Raphael.getRGB(colorString);
    }
    return colors;
  }

  /**
   * Creates a new ColorFactory object.
   *
   * A ColorFactory generates Raphael color objects such that all colors
   * generated so far are roughly spaced evenly in HSV space.
   *
   * Strange things may happen if you try to get more than 256 colors from a
   * single ColorFactory. TODO: fix this.
   *
   * nextColor(): Get a new color from this ColorFactory.
   */
  vg.ColorFactory = function() {
    var that = (this == vg ? {} : this);
    var MAX_COLORS = 256;

    var colors = vg.getEvenlySpacedColors(MAX_COLORS);
    var used = [];
    for (var i = 0; i < colors.length; i++) {
      used[i] = false;
    }

    var idx = 0;
    var step = colors.length / 2;

    that.nextColor = function() {
      var color = colors[idx];
      used[idx] = true;
      while (used[idx]) {
        idx += step;
        if (idx >= colors.length) {
          step /= 2;
          idx = step;
          break;
        }
      }    
      return color;
    }

    return that;
  }

  /**
   * A simple object that maintains a mapping from (string) keys to colors.
   *
   * It has just one method:
   *
   * getColor(key): Returns the color for this key. All calls to getColor with
   * the same key will return the same color.
   */
  vg.ColorMap = function() {
    var that = (this === vg ? {} : this);
    var key_to_color = {};
    var color_factory = new VG.ColorFactory();
    
    that.getColor = function(key) {
      if (!key_to_color.hasOwnProperty(key)) {
        key_to_color[key] = color_factory.nextColor();
      }
      return key_to_color[key];
    }
    
    return that;
  }

  return vg;

}(VG || {}));
