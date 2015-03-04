var VG = (function(vg) {

  var DEFAULT_OPTIONS = {
    image_opacity: 1,
  };

  /**
   * Utility method to create a Raphael canvas inside a div, load an image to
   * to server as the background for the canvas, and manage conversions between
   * image coordinates and canavs coordinates.
   *
   * Usage:
   *
   * image_canvas = new VG.ImageCanvas(div, image_url, width, crop_params, callback);
   *
   * Inputs:
   * div - The div in which to create the canvas. Can be jQuery selector or
   *       HTML element.
   * image_url - The URL of the image to load
   * width - The desired width of the Raphael canvas, or an object with fields
   *         max_width and max_height giving the maximum size of the canvas.
   * callback - Function to call once the image has loaded
   *
   * An ImageCanvas has the following methods:
   *
   * getImage() - Get the loaded Raphael Image object.
   * getPaper() - Get the created Raphael canvas.
   * imageCoordsToPaperCoords(x), paperCoordsToImageCoords(x) - 
   *   Convert coordinates (width or height) from image space to canvas space
   *   or vice versa.
   */
  vg.ImageCanvas = function(div, image_url, width, crop_param, callback,
                            options) {
    var that = (this === vg ? {} : this);

    options = vg.merge_options(options, DEFAULT_OPTIONS);

    if (crop_param == null) {
      crop_param = {'x':0,
                    'y':0,
                    'size': width
      };
    } 

    // If div has a 'get' method then we assume it is a jQuery selector.
    if (typeof(div.get) === 'function') {
      div = div.get(0);
    }

    // Cache a jQuery selector for the div for computing mouse position.
    var div_selector = $(div);

    if (typeof(width) === 'object') {
      var paper = new Raphael(div, 0, 0);
      var scale = 1;
    } else {
      var paper = new Raphael(div, width, 0);
      var scale = 1;
    }
      var image = null;

    var true_width = null;
    var true_height = null;
    var mulitiplier = null;

    function loadImage() {
      var img = new Image();
      img.onload = function() {
        // actual size of loaded image
        var w = this.width;
        var h = this.height;
        true_width = w;
        true_height = h;
        if (typeof(width) === 'object') {
          scale = Math.min(width.max_width / w, width.max_height / h);
          h = h * scale;
          w = w * scale;
          multiplier = scale * width.max_width / crop_param.size;
        } else {
          scale = paper.width / w;
          h = h * scale;
          w = paper.width;
          multiplier = scale * width / crop_param.size;
        }
        paper.setSize(w, h);
        if (crop_param.x === 0 && crop_param.y === 0) {
          image = paper.image(image_url, 0, 0, w, h);
        } else {  
          // TODO: This is buggy.
          image = paper.image(image_url,
                              -crop_param.x * multiplier,
                              -crop_param.y * multiplier,
                              h * w / crop_param.size,
                              h * w /crop_param.size);
        }
        image.attr({'opacity': options.image_opacity});
        image.toBack();
        callback();
      }
      img.src = image_url;
    }
    loadImage();

    that.getImage = function() { return image; }

    that.getPaper = function() { return paper; }
    
    that.getHeight = function() { return scale * true_height; }

    that.getWidth = function() { return scale * true_width; }

    that.imageCoordsToPaperCoords = function(x, axis) {
      if (crop_param.x === 0 && crop_param.y === 0) {
        return x * scale;
      }

      if (axis === 'x')
        return (x - crop_param.x) * multiplier;
      if (axis === 'y')
        return (x - crop_param.y) * multiplier;
      else
        return x * multiplier;
    }

    that.paperCoordsToImageCoords = function(x) {
      if (crop_param.x === 0 && crop_param.y === 0) {
        return x / scale;
      }

      if (axis === 'x')
        return (x + crop_param.x) / scale;
      if (axis === 'y')
        return (x + crop_param.y) / scale;
      else
        return x / scale;
    }

    // Set a click handler for the underlying image.
    // A Raphael event will be passed to the handler.
    that.click = function(handler) {
      image.click(handler);
    }

    // Get the mouse position (in paper coordinates) from a Raphael event e.
    that.getMousePosition = function(e) {
      var x = e.pageX - div_selector.offset().left;
      var y = e.pageY - div_selector.offset().top;
      return {'x': x, 'y': y};
    }

    return that;
  }

  return vg;

}(VG || {}));
