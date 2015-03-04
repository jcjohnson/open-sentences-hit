$(function() {

  // Import stuff
  var Entity = VG.OpenSentences.Backbone.Entity;
  var Entities = VG.OpenSentences.Backbone.Entities;
  var BinaryTriple = VG.OpenSentences.Backbone.BinaryTriple;
  var UnaryTriple = VG.OpenSentences.Backbone.UnaryTriple;
  var Triples = VG.OpenSentences.Backbone.Triples;
  var collectionsToJSON = VG.OpenSentences.Backbone.collectionsToJSON;
  var collectionsFromJSON = VG.OpenSentences.Backbone.collectionsFromJSON;
  var TripleListView = VG.OpenSentences.Backbone.TripleListView;
  var TripleListElemView = VG.OpenSentences.Backbone.TripleListElemView;
  var SvgView = VG.OpenSentences.Backbone.SvgView;
  var SvgElemView = VG.OpenSentences.Backbone.SvgElemView;
  var HideableView = VG.OpenSentences.Backbone.HideableView;
  var ReadOnlyView = VG.OpenSentences.Backbone.ReadOnlyView;
  var UNARY_PREDICATES = VG.OpenSentences.Backbone.UNARY_PREDICATES;

  var WriteTripleView = HideableView.extend({
    tagName: 'div',

    events: {
      'keyup input': function(e) { if (e.keyCode === 13) this.pressed_enter(); },
      'click button': 'button_clicked',
    },

    initialize: function(options) {
      var allowed_options = ['entities', 'triples', 'autocomplete'];
      if (options) _.extend(this, _.pick(options, allowed_options));

      this.render();
      this.inputs = this.$('input');
      this.button = this.$('button');

      if (this.autocomplete && this.entities && this.triples) {
        this.setup_typeahead();
      }
    },

    render: function() {
      var template = _.template($('#write-triple-template').html(), {});
      this.$el.html(template);
    },

    setup_typeahead: function() {
      var substring_matcher = function(strings, q, cb) {
        var matches = [];
        var regex = new RegExp(q, 'i');
        _.each(strings, function(s) {
          if (regex.test(s)) {
            matches.push({ value: s });
          }
        });
        cb(matches);
      };

      var entities = this.entities;
      var entity_name_matcher = function(q, cb) {
        var names = _.uniq(entities.pluck('name'));
        substring_matcher(names, q, cb);
      };

      var triples = this.triples;
      var predicate_matcher = function(q, cb) {
        var preds = _.uniq(triples.pluck('predicate'));
        substring_matcher(preds, q, cb);
      };

      var attribute_matcher = function(q, cb) {
        var unary_triples = triples.filter(function(t) {
          return t.type === 'unary'
        });
        var attrs = _.map(unary_triples, function(t) {
          return t.get('attribute');
        });
        attrs = _.uniq(attrs);
        substring_matcher(attrs, q, cb);
      };

      var pred_input = $(this.inputs[1]);
      var object_matcher = function(q, cb) {
        var pred = pred_input.val();
        if (_.indexOf(UNARY_PREDICATES, pred) === -1) {
          entity_name_matcher(q, cb);
        } else {
          attribute_matcher(q, cb);
        }
      };

      var typeahead_options = {
        hint: true,
        highlight: true,
        minLength: 1,
      };
      $(this.inputs[0]).typeahead(typeahead_options, {
        name: 'names',
        displayKey: 'value',
        source: entity_name_matcher,
      });

      $(this.inputs[1]).typeahead(typeahead_options, {
        name: 'names',
        displayKey: 'value',
        source: predicate_matcher,
      });

      $(this.inputs[2]).typeahead(typeahead_options, {
        name: 'names',
        displayKey: 'value',
        source: object_matcher,
      });
    },

    enable: function() {
      this.inputs.prop('disabled', false);
      this.button.prop('disabled', false);
    },
    
    disable: function() {
      this.inputs.prop('disabled', true);
      this.button.prop('disabeld', true);
    },

    // Put focus on either the first empty input or the button
    focus: function() {
      for (var i = 0; i < this.inputs.length; i++) {
        if (this.inputs[i].value.length === 0) {
          this.inputs[i].focus();
          return;
        }
      }
      this.button.focus();
    },

    pressed_enter: function() {
      if (_.all(this.inputs, function(i) { return i.value.length > 0 })) {
        this.button_clicked();
      } else {
        this.focus();
      }
    },
    
    button_clicked: function() {
      var text_triple = [];
      for (var i = 0; i < this.inputs.length; i++) {
        var s = this.inputs[i].value;
        if (s.length === 0) return;
        text_triple.push(s);
      }
      this.trigger('triple-written', text_triple);
    },

    clear: function() {
      // Hackity hackity hack hack: wait a bit before actually clearing
      var inputs = this.inputs;
      function clear_internal() {
        _.each(inputs, function(i) { i.value = '' });
      }
      setTimeout(clear_internal, 100);
    },
  });


  /**
   * Expects to be passed the following:
   * collection - A collection of Triples
   * min_binary, min_unary, min_phrases - integers
   */
  var ProgressView = Backbone.View.extend({
    initialize: function(options) {
      this.template = _.template($('#progress-template').html());

      _.extend(this, _.pick(options, 'min_binary', 'min_unary', 'min_phrases',
                                     'submit_button'));

      this.render();

      this.collection.bind('add', this.render, this);
      this.collection.bind('remove', this.render, this);
    },

    render: function() {
      this.$el.empty();

      var num_binary = this.collection.get_new_binary().length;
      var num_unary = this.collection.get_new_unary().length;
      var num_new = num_binary + num_unary;

      this.$el.html(this.template({
        binary_top: num_binary,
        binary_bottom: this.min_binary,
        unary_top: num_unary,
        unary_bottom: this.min_unary,
        all_top: num_new,
        all_bottom: this.min_phrases,
      }));

      var binary_done = (num_binary >= this.min_binary);
      var unary_done = (num_unary >= this.min_unary);
      var enough_phrases = (num_new >= this.min_phrases);

      function draw_glyph(glyph_selector, done) {
        var glyph = this.$(glyph_selector);
        if (done) {
          glyph.addClass('glyphicon-ok');
        } else {
          glyph.addClass('glyphicon-remove');
        }
      }
      draw_glyph('.binary-glyph', binary_done);
      draw_glyph('.unary-glyph', unary_done);
      draw_glyph('.all-glyph', enough_phrases);

      if (binary_done && unary_done && enough_phrases) {
        this.$('.my-progress').addClass('bg-success');
        if (this.submit_button) {
          this.submit_button.prop('disabled', false);
        }
      } else {
        this.$('.my-progress').addClass('bg-danger');
        if (this.submit_button) {
          this.submit_button.prop('disabled', true);
        }
      }

      return this;
    },
  });
  

  var LabelObjectView = Backbone.View.extend({
    initialize: function(options) {
      var valid_options = ['subject_name', 'predicate', 'object_name',
                           'target', 'svg_view'];
      _.extend(this, _.pick(options, valid_options));

      this.render();

      this.listenTo(this.svg_view, 'image-clicked',
                    _.bind(this.trigger, this, 'image-clicked'));

      this.listenTo(this.svg_view, 'dot-clicked',
                    function(model) {
                      this.trigger('entity-selected', model);
                    });
    },

    render: function() {
      var template = _.template($('#label-object-template').html());

      if (this.target === 'subject') {
        var target_name = this.subject_name;
      } else if (this.target === 'object') {
        var target_name = this.object_name;
      }
      var template_params = { target_name: target_name };
      _.extend(template_params,
               _.pick(this, 'subject_name', 'predicate', 'object_name'));
      this.$el.html(template(template_params));

      if (this.target === 'subject') {
        this.$('.subject').addClass('emph-target');
      } else if (this.target === 'object') {
        this.$('.object').addClass('emph-target');
      }

      // Manually attach a key handler for the back button
      // TODO: This eats 'q' key events, which isn't ideal but was the easiest
      // way to prevent an extra 'q' event being fired on the (hidden) 
      // WriteTripleView.
      this.keypress_event_name = _.uniqueId('keypress.');
      $('body').on(this.keypress_event_name, _.bind(function(e) {
        if (e.keyCode === 113 || e.keyCode === 81) {
          this.back_handler();
          e.preventDefault();
        }
      }, this));

      return this;
    },

    remove: function() {
      $('body').off(this.keypress_event_name);
      Backbone.View.prototype.remove.call(this);
    },

    events: {
      'click button.btn-danger': 'back_handler',
    },

    back_handler: function() {
      this.trigger('cancel-label');
    },
  });


  var VerifyObjectView = Backbone.View.extend({
    initialize: function(options) {
      var valid_options = ['text_triple', 'target'];
      _.extend(this, _.pick(options, valid_options));
      this.render();
    },

    render: function() {
      var template = _.template($('#verify-object-template').html());

      if (this.target === 'subject') {
        var target_name = this.text_triple[0];
      } else if (this.target === 'object') {
        var target_name = this.text_triple[2];
      }
      this.$el.html(template({
        subject_name: this.text_triple[0],
        predicate: this.text_triple[1],
        object_name: this.text_triple[2],
        target_name: target_name,
      }));

      if (this.target === 'subject') {
        this.$('.subject').addClass('emph-target');
      } else if (this.target === 'object') {
        this.$('.object').addClass('emph-target');
      }

      // TODO: This gobbles key events. Kinda gross.
      this.keypress_event_name = _.uniqueId('keypress.');
      $('body').on(this.keypress_event_name, _.bind(function(e) {
        if (e.keyCode === 121 || e.keyCode === 89) {
          this.handle_yes();
          e.preventDefault();
        } else if (e.keyCode === 110 || e.keyCode === 78) {
          this.handle_no();
          e.preventDefault();
        } else if (e.keyCode === 113 || e.keyCode === 81) {
          this.handle_cancel();
          e.preventDefault();
        }
      }, this));

      this.model.trigger('emphasize', {strong: true});
    },

    remove: function() {
      this.model.trigger('deemphasize', {strong: true});
      $('body').off(this.keypress_event_name);
      Backbone.View.prototype.remove.call(this);
    },

    events: {
      'click button.btn-success': 'handle_yes',
      'click button.btn-danger.btn-lg': 'handle_no',
      'click button.btn-sm': 'handle_cancel',
    },

    handle_yes: function() { this.trigger('yes-clicked'); },
    handle_no: function() { this.trigger('no-clicked'); },
    handle_cancel: function() { this.trigger('cancelled'); },
  });

  /*
   * If the draw is cancelled, fires a 'draw-cancelled' event.
   * 
   * When the draw is done, fires a 'draw-done' event, passing along the freshly
   * draw box.
   */
  var DrawBoxView = HideableView.extend({
    initialize: function(options) {
      var valid_options = ['subject_name', 'predicate', 'object_name',
                           'draw_target', 'image_url', 'image_width',
                           'image_height', 'image_opacity'];
      _.extend(this, _.pick(options, valid_options));

      this.render();
    },

    events: {
      'click button.btn-success': 'done_handler',
      'click button.btn-danger': 'back_handler',
    },

    render: function() {
      var template = _.template($('#draw-box-template').html());
      if (this.draw_target === 'subject') {
        var target_name = this.subject_name;
      } else if (this.draw_target === 'object') {
        var target_name = this.object_name;
      }
      var template_args = { target_name: target_name };
      _.extend(template_args,
               _.pick(this, 'subject_name', 'predicate', 'object_name'));
      this.$el.html(template(template_args));

      if (this.draw_target === 'subject') {
        this.$('.subject').addClass('emph-target');
      } else if (this.draw_target === 'object') {
        this.$('.object').addClass('emph-target');
      }

      var canvas_div = this.$('.canvas-div');
      var drawer_options = {
        'image_opacity': this.image_opacity,
        'max_height': this.image_height,
        'max_width': this.image_width,
      };
      this.drawer = new VG.BBoxDrawer(canvas_div, this.image_url,
                                      null, drawer_options);
      this.drawer.enable();

      // Manually set up a hotkey for the done button
      this.keypress_event_name = _.uniqueId('keypress.');
      $('body').on(this.keypress_event_name, _.bind(function(e) {
        if (e.keyCode === 113 || e.keyCode === 81) this.back_handler();
        if (e.keyCode === 13) this.done_handler();
      },this));
    },

    remove: function() {
      $('body').off(this.keypress_event_name);
      HideableView.prototype.remove.call(this);
    },

    back_handler: function() {
      this.trigger('draw-cancelled');
    },

    done_handler: function() {
      var bbox = this.drawer.getBoxPosition();
      if (bbox === null) {
        this.trigger('draw-cancelled');
      } else {
        this.trigger('draw-done', bbox);
      }
    },
  });

  
  var CheckDuplicatesView = HideableView.extend({
    events: {
      'click button.btn-success': 'same_handler',
      'click button.btn-danger': 'different_handler',
    },

    initialize: function(options) {
      var valid_options = ['existing_entity', 'new_entity', 'svg_view'];
      _.extend(this, _.pick(options, valid_options));
      this.render();

      // TODO: This gobbles key events. Kinda gross.
      this.keypress_event_name = _.uniqueId('keypress.');
      $('body').on(this.keypress_event_name, _.bind(function(e) {
        if (e.keyCode === 121 || e.keyCode === 89) {
          this.same_handler();
          e.preventDefault();
        } else if (e.keyCode === 110 || e.keyCode === 78) {
          this.different_handler();
          e.preventDefault();
        } 
      }, this));
    },

    render: function() {
      var template_vars = {
        existing_entity: this.existing_entity.get('name'),
        new_entity: this.new_entity.get('name'),
      };
      var html = _.template($('#check-duplicates-template').html(),
                            template_vars);
      this.$el.html(html);
      
      // We also need to actually draw the boxes.
      // This is kinda hacky and breaks like 2 layers of abstraction, but
      // we pass in an SvgView and draw boxes directly on the underlying
      // Raphael paper object. It should be fine as long as we clean up
      // properly.
      var paper = this.svg_view.image_canvas.getPaper();
      var f = this.svg_view.image_canvas.imageCoordsToPaperCoords;

      function draw_box(e) {
        var x = f(e.get('bbox_x'));
        var y = f(e.get('bbox_y'));
        var w = f(e.get('bbox_w'));
        var h = f(e.get('bbox_h'));
        var box = paper.rect(x, y, w, h);
        return box;
      }
      this.new_box = draw_box(this.new_entity);
      this.new_box.attr({'stroke': '#00F', 'stroke-width': 2});
      this.old_box = draw_box(this.existing_entity);
      this.old_box.attr({'stroke': '#F00', 'stroke-width': 2});

      return this;
    },
    
    same_handler: function() {
      this.trigger('same-objects');
    },

    different_handler: function() {
      this.trigger('different-objects');
    },
   
    remove: function() {
      this.new_box.remove();
      this.old_box.remove();
      $('body').off(this.keypress_event_name);      
      HideableView.prototype.remove.call(this);
    },
  });


  var AppView = Backbone.View.extend({

    initialize: function(options) {
      var valid_options = [
        'triples', 'entities',
        'min_binary', 'min_unary', 'min_sentences',
        'image_url', 'triple_list', 'svg_div', 'write_triple_div',
        'label_object_div', 'progress_div', 'draw_box_div', 'verify_object_div',
        'error_div', 'check_duplicates_div',
        'submit_button',
      ];
      _.extend(this, _.pick(options, valid_options));

      if (!this.triples || !this.entities) {
        this.triples = new Triples();
        this.entities = new Entities({triples: this.triples});
      }

      // For some reason entities gets initialized with an empty Entity;
      // insted of debugging I'm just going to call prune.
      this.entities.prune();

      this.triple_list_view = new TripleListView({el: this.triple_list,
                                                  collection: this.triples});
 
      this.write_triple_view = new WriteTripleView({
                                  el: this.write_triple_div,
                                  entities: this.entities,
                                  triples: this.triples,
                                  autocomplete: true,
                               });

      var VIEWPORT_HEIGHT = 900;
      this.max_image_width = this.svg_div.width();
      this.max_image_height = VIEWPORT_HEIGHT;
      this.max_image_height -= this.write_triple_view.$el.height();

      this.image_opacity = 0.8;

      this.current_triple = null;

      var progress_view = new ProgressView({
                            el: this.progress_div,
                            collection: this.triples,
                            submit_button: this.submit_button,
                            min_unary: this.min_unary,
                            min_binary: this.min_binary,
                            min_phrases: this.min_sentences,
                          });
      
      this.svg_view = new SvgView({
                            el: this.svg_div,
                            collection: this.entities,
                            image_width: this.max_image_width,
                            image_height: this.max_image_height,
                            image_opacity: this.image_opacity,
                            image_url: this.image_url,
                          });

      // This is a dirty little hack to make sure the list of triples doesn't
      // get taller than the image.
      this.listenToOnce(this.svg_view, 'got-height', function(h) {
        this.triple_list.css({
          'max-height': h,
          'overflow-y': 'auto',
        });
      });

      this.alerter = new VG.Alerter(this.error_div);
      this.state_transition();
    },

    enable: function() {
      this.write_triple_view.enable();
    },

    state_transition: function() {
      if (_.has(this, 'duplicates_to_check')) {
        this.setup_check_duplicates();
        return;
      }

      if (!this.current_triple) {
        this.setup_write_state();
        return;
      }

      var target = this.current_triple.get_target();
      if (target === null) {
        this.save_current_triple();
        return;
      }

      var current_name = this.current_triple.get(target).get('name');
      var possible_matches = this.entities.filter(function(e) {
        var same_name = e.get('name') === current_name;
        var already_seen = (this.non_matches && _.contains(this.non_matches, e));
        return same_name && !already_seen;
      }, this);

      var num_matches = possible_matches.length;
      if (num_matches === 0) {
        this.setup_draw_box();
        return;
      } else if (0 < num_matches && num_matches <= 3) {
        this.setup_verify_object(target, possible_matches[0]);
        return;
      }  

      this.setup_label_object(target);
    },

    setup_check_duplicates: function() {
      var existing_entity = this.duplicates_to_check.possible_duplicates[0];
      var new_entity = this.duplicates_to_check.new_entity;

      var div = $('<div>').appendTo(this.check_duplicates_div);
      var check_duplicates_view = new CheckDuplicatesView({
                                    el: div,
                                    new_entity: this.duplicates_to_check.new_entity,
                                    existing_entity: existing_entity,
                                    svg_view: this.svg_view,
                                  });

      
      this.listenToOnce(check_duplicates_view, 'same-objects', function() {
        // Swap the correct entity in the current triple for the existing entity
        var target = this.duplicates_to_check.target;
        var set_params = {};
        set_params[target] = existing_entity;
        this.current_triple.set(set_params);
        
        // Add the name of new_entity as an alternate name for existing_entity
        existing_entity.add_alternate_name(new_entity.get('name'));

        // Store the name from new_entity in the triple
        if (target === 'subject') {
          this.current_triple.set({'subject_text': new_entity.get('name')});
        } else if (target === 'object') {
          this.current_triple.set({'object_text': new_entity.get('name')});
        }

        delete this.duplicates_to_check;
        check_duplicates_view.remove();
        this.state_transition();
      });

      this.listenToOnce(check_duplicates_view, 'different-objects', function() {
        // Remove the first element from this.duplicates_to_check.possible_duplicates
        // If it is now empty, delete this.duplicates_to_check.possible_duplicates
        var new_duplicates = this.duplicates_to_check.possible_duplicates.slice(1);
        if (new_duplicates.length > 0) {
          // There are still other duplicates we need to check
          this.duplicates_to_check.possible_duplicates = new_duplicates;
        } else {
          // We have checked all possible duplicates, so just add the new_entity
          this.entities.add(this.duplicates_to_check.new_entity);
          delete this.duplicates_to_check;
        }
        check_duplicates_view.remove();
        this.state_transition();
      });
    },

    setup_write_state: function() {
      this.write_triple_view.show();
      this.write_triple_view.clear();
      this.svg_view.show();

      this.write_triple_view.focus();

      this.listenToOnce(this.write_triple_view, 'triple-written',
          function(text_triple) {
            // For some reason _.map(text_triple, _.str.trim) doesn't work.
            // Seems like a bug that isn't my fault.
            text_triple = _.map(text_triple, function(s) {
              return _.str.trim(s).toLowerCase();
            });

            var triple_attrs = {
              subject: new Entity({name: text_triple[0]}),
              predicate: text_triple[1],
            };
            if (_.indexOf(UNARY_PREDICATES, text_triple[1]) === -1) {
              triple_attrs.object = new Entity({name: text_triple[2]});
              this.current_triple = new BinaryTriple(triple_attrs);
            } else {
              triple_attrs.attribute = text_triple[2];
              this.current_triple = new UnaryTriple(triple_attrs);
            }
            this.write_triple_view.clear();
            this.write_triple_view.hide();

            this.state_transition();
          });
    },

    save_current_triple: function() {
      var triple_exists = this.triples.any(function(t) {
        return t.equals(this.current_triple);
      }, this);

      if (triple_exists) {
        var message = _.str.sprintf(
            'The phrase "%s" has already been written for these objects.',
            this.current_triple.text());
        this.alerter.alert(message);
      } else {
        this.triples.add(this.current_triple);
      }

      delete this.current_triple.get('subject').do_not_delete;
      delete this.current_triple;
      this.state_transition();
    },

    setup_label_object: function(target) {
      var div = $('<div>').appendTo(this.label_object_div);
      var text_triple = this.current_triple.text_triple();

      this.svg_view.show();
      this.label_object_view = new LabelObjectView({
                            el: div,
                            svg_view: this.svg_view,
                            subject_name: text_triple[0],
                            predicate: text_triple[1],
                            object_name: text_triple[2],
                            target: this.current_triple.get_target(),
                         });

      this.listenToOnce(this.label_object_view, 'cancel-label', function() {
        this.label_object_view.remove();
        this.go_back();
        this.state_transition();
      });

      this.listenToOnce(this.label_object_view, 'image-clicked', function() {
        this.label_object_view.remove();
        this.setup_draw_box();
      });

      this.listenToOnce(this.label_object_view, 'entity-selected',
        function(entity) {
          var name_written = this.current_triple.get(target).get('name');
          var name_clicked = entity.get('name');
          if (name_written !== name_clicked) {
            var message = _.str.sprintf(
              'You need to click on a "%s" but you clicked on a "%s". Try again.',
              name_written, name_clicked);
            this.alerter.alert(message);
          } else {
            this.set_grounding(target, entity);
          }

          this.label_object_view.remove();
          this.state_transition();
        });
    },

    // Set the target of the current triple to an entity.
    set_grounding: function(target, entity) {
      // We want to do this.current_triple[target] = entity, but doing so
      // using the Backbone API is a bit awkward.
      var set_args = {};
      set_args[target] = entity;
      this.current_triple.set(set_args);

      // We don't want the subject to be deleted out from under us if we
      // have grounded the subject of the current triple to an existing
      // entity and then remove all other references to that entity before
      // grounding the object of the current triple. To avoid this,
      // we set a flag on the entity.
      if (target === 'subject') entity.do_not_delete = true;

      delete this.non_matches;
    },

    // Go back from labeling the current part of the current triple.
    go_back: function() {
      var target = this.current_triple.get_target();
      delete this.non_matches;
      if (target == 'subject') {
        delete this.current_triple;
      } else if (target === 'object') {
        delete this.current_triple.get('subject').do_not_delete;
        var subject_clone = this.current_triple.get('subject').clone();
        subject_clone.clear_bbox();
        this.current_triple.set({subject: subject_clone});
        this.entities.prune();
      }
    },

    setup_verify_object: function(target, entity) {
      var div = $('<div>').appendTo(this.verify_object_div);
      var text_triple = this.current_triple.text_triple();
      this.verify_object_view = new VerifyObjectView({
                                  el: div,
                                  text_triple: text_triple,
                                  target: target,
                                  model: entity,
                                });

      this.listenToOnce(this.verify_object_view, 'yes-clicked', function() {
        this.set_grounding(target, entity);
        this.verify_object_view.remove();
        this.state_transition();
      });

      this.listenToOnce(this.verify_object_view, 'no-clicked', function() {
        if (!this.non_matches) this.non_matches = [];
        this.non_matches.push(entity);
        this.verify_object_view.remove();
        this.state_transition();
      });

      this.listenToOnce(this.verify_object_view, 'cancelled', function() {
        this.verify_object_view.remove();
        this.go_back();
        this.state_transition();        
      });
    },

    setup_draw_box: function() {
      var div = $('<div>').appendTo(this.draw_box_div);
      var text_triple = this.current_triple.text_triple();

      var target = this.current_triple.get_target();
      this.svg_view.hide();
      this.draw_box_view = new DrawBoxView({
                                el: div,
                                subject_name: text_triple[0],
                                predicate: text_triple[1],
                                object_name: text_triple[2],
                                draw_target: target,
                                image_width: this.max_image_width,
                                image_height: this.max_image_height,
                                image_opacity: this.image_opacity,
                                image_url: this.image_url,
                           });

      // A little bit of a hack to make sure we don't have to scroll
      $('html, body').animate({
        scrollTop: div.offset().top
      }, 1);

      this.listenToOnce(this.draw_box_view, 'draw-cancelled', function() {
        this.go_back();
        this.draw_box_view.remove();
        this.svg_view.show();

        this.state_transition();
      });

      this.listenToOnce(this.draw_box_view, 'draw-done', function(bbox) {
        var e = this.current_triple.get(target);
        e.set({bbox_x: bbox.x, bbox_y: bbox.y, bbox_w: bbox.w, bbox_h: bbox.h});

        var possible_duplicates = this.entities.filter(function(ee) {
          var iou = ee.overlap_over_union(e);
          return iou > 0.6;
        });
        if (possible_duplicates.length > 0) {
          this.duplicates_to_check = {
            new_entity: e,
            target: target,
            possible_duplicates: possible_duplicates,
          };
        } else {
          this.entities.add(e);
        }
        delete this.non_matches;
        this.draw_box_view.remove();
        this.svg_view.show();

        this.state_transition();
      });
    },

    toJSON: function() {
      return collectionsToJSON(this.entities, this.triples);
    },

  });

  function main() {
    // Set up the example
    /*
    var example_data = $.parseJSON($('#example_data').val());
    example_data = collectionsFromJSON(example_data, {removeable: false});
    var example_view = new ReadOnlyView({
                         triples: example_data.triples,
                         entities: example_data.entities,
                         image_url: $('#example_image_url').val(),
                         ul: $('#example-triple-list'),
                         svg_div: $('#example-svg-div'),
                       });

    var existing_data = $.parseJSON($('#existing_data').val());
    */
    var input = {
      image_url: 'http://assets.dogtime.com/asset/image/4f966ff0eadf725ead000482/column_dog-picture-photo-friends-play-stick.jpg',
      sentence: "A black dog and a white dog are carrying a stick",
    }
    if (!input.hasOwnProperty('existing_data')) {
      input.existing_data = {
        objects: [],
        unary_triples: [],
        binary_triples: [],
      };
    }
    var existing_data = collectionsFromJSON(input.existing_data, {removeable: false});
    var min_binary = 0;
    var min_unary = 0;
    var min_sentences = 0;
    var image_url = 'http://assets.dogtime.com/asset/image/4f966ff0eadf725ead000482/column_dog-picture-photo-friends-play-stick.jpg';
    
    // Set up the task
    var app = new AppView({
      entities: existing_data.entities,
      triples: existing_data.triples,
      min_binary: min_binary,
      min_unary: min_unary,
      min_sentences: min_sentences,
      image_url: image_url,
      triple_list: $('#triple-list'),
      svg_div: $('#svg-div'),
      write_triple_div: $('#write-triple-div'),
      verify_object_div: $('#verify-object-div'),
      label_object_div: $('#label-object-div'),
      progress_div: $('#progress-div'),
      draw_box_div: $('#draw-box-div'),
      error_div: $('#error-div'),
      check_duplicates_div: $('#check-duplicates-div'),
      submit_button: $('#submit_button'),
    });

    $('#sentence').text('"' + input.sentence + '"');

    function add_button(name, f) {
      $('<button>').click(f).text(name).addClass('btn btn-default')
                   .appendTo($('body'));
    }
    var is_test = true;
    if (is_test) {
      add_button('print data', function() {
        console.log(app.toJSON());
      });
    }
    app.enable();

    /*
    if (!TurkUtils.isPreview()) {
      app.enable();
      $('#submit_button').click(function(e) {
        $('#output').val($.toJSON(app.toJSON()));

        // Call census
        e.preventDefault();
        $('#submit_button').prop('disabled', true);
        census.submit('#census-div', '#mturk_form', 'visualgenome');

        return false;
      });
    }
    */

  }

  main();
                                                          
});


// TODO:
// - Draw arrow for binary triples
