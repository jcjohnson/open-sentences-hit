var VG = (function(vg, $) {

  var FONT_SIZE = 16;
  var PADDING = 2;

  function computeTextPosition(paper, position, name) {
    var ty = position.y;
    var tx = position.x;
    var dy = position.offset + FONT_SIZE / 2 + 2 * PADDING;
    if (position.location === 'top') {
      ty -= dy;
    } else if (position.location === 'bottom') {
      ty += dy;
    }

    var text = paper.text(tx, ty, name);
    text.attr({'font-size': FONT_SIZE});

    var bbox = text.getBBox();
    var tbx = bbox.x - PADDING;
    var tby = bbox.y - PADDING;
    var tbw = bbox.width + 2 * PADDING;
    var tbh = bbox.height + 2 * PADDING;
    text.remove();

    return {
      text: [tx, ty],
      box: [tbx, tby, tbw, tbh],
      null_box: (bbox.width === 0),
    };
  }

  /**
   * position should be an object of the form:
   * {
   *   x: x,
   *   y: y, 
   *   offset: number,
   *   location: 'top', 'bottom',
   * }
   */
   vg.TextBox = function(paper, position, name) {
    var that = (this === vg ? {} : this);

    var textBox = paper.rect(0, 0, 0, 0);
    textBox.attr({
      'stroke': '1px',
      'fill': '#fff',
      'opacity': 0
    });

    var text = paper.text(0, 0, name);
    text.attr({
      'opacity': 0,
      'font-size': FONT_SIZE,
      'flood-color': '#fff'
    });
    // Dirty css hacks to make the text unselectable
    $(text.node).css({
	    "-webkit-touch-callout": "none",
    	"-webkit-user-select": "none",
    	"-khtml-user-select": "none",
    	"-moz-user-select": "none",
    	"-ms-user-select": "none",
    	"user-select": "none",
    })

    moveTo(position.x, position.y);

    that.show = function() {
      text.animate({opacity: 1});
      textBox.animate({opacity: 1});
    }

    that.hide = function() {
      text.animate({opacity: 0});
      textBox.animate({opacity: 0});
    }

    that.remove = function() {
      text.remove();
      textBox.remove();
    }

    function moveTo(x, y) {
      position.x = x;
      position.y = y;

      textPos = computeTextPosition(paper, position, name);

      // TODO: THIS IS A DIRY DIRTY DIRTY HACK. IT OUGHT TO BE FIXED.
      if (textPos.null_box) {
        // If the bounding box calculation failed for some reason, just
        // try again in 100 ms.
        window.setTimeout(function() { moveTo(x, y); }, 100);
        return;
      }

      text.attr({'x': textPos.text[0], 'y': textPos.text[1]});
      textBox.attr({
        'x': textPos.box[0],
        'y': textPos.box[1],
        'width': textPos.box[2],
        'height': textPos.box[3]
      });
    }
    that.moveTo = moveTo;

    that.toBack = function() {
      text.toBack();
      textBox.toBack();
    }

    that.toFront = function() {
      textBox.toFront();
      text.toFront();
    }

    return that;
  }
  
  return vg;

}(VG || {}, jQuery));
