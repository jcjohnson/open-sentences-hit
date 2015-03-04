var VG = (function(vg, $) {

  var DEFAULT_OPTIONS = {
    auto_dismiss: false,
    auto_dismiss_time: 3000,
    type: 'alert-warning'
  };

  vg.Alerter = function(div, obj_options) {
    var that = (this === vg ? {} : this);

    obj_options = vg.merge_options(obj_options, DEFAULT_OPTIONS);

    that.alert = function(message, options) {
      options = vg.merge_options(options, obj_options);

      var alert_div = $('<div>').addClass('alert fade in h3')
                                .addClass(options.type)
                                .text(message)
                                .appendTo(div);

      var btn = $('<button>').attr({
                               'type': 'button',
                               'data-dismiss': 'alert',
                               'aria-hidden': true})
                             .addClass('close')
                             .appendTo(alert_div);

      var glyph = $('<span>').addClass('glyphicon glyphicon-remove')
                             .appendTo(btn);

      if (options.auto_dismiss) {
        window.setTimeout(function() {
          alert_div.alert('close'); }, options.auto_dismiss_time);
      }
    }

    return that;
  }

  return vg;

}(VG || {}, jQuery));
