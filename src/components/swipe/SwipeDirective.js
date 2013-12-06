(function() {
  goog.provide('ga_swipe_directive');

  goog.require('ga_browsersniffer_service');
  goog.require('ga_permalink_service');

  var module = angular.module('ga_swipe_directive', [
    'ga_browsersniffer_service',
    'ga_permalink_service',
    'pascalprecht.translate'
  ]);

  module.directive('gaSwipe',
    function($document, $translate, gaBrowserSniffer, gaPermalink) {
      return {
        restrict: 'A',
        templateUrl: function(element, attrs) {
          return 'components/swipe/partials/swipe.html';
        },
        scope: {
          map: '=gaSwipeMap',
          options: '=gaSwipeOptions',
          isActive: '=gaSwipeActive'
        },
        link: function(scope, elt, attrs, controller) {
          var draggableElt = elt.find('[ga-draggable]');
          var arrowsElt = elt.find('.ga-swipe-arrows');
          var layerLabelElt = elt.find('.ga-swipe-layer-label');
          var listenerKeys = [];
          var layerListenerKeys = [];
          var isDragging = false;
          var events = {
            mouse: {
              start: 'mousedown',
              move: 'mousemove',
              end: 'mouseup'
            },
            touch: {
              start: 'touchstart',
              move: 'touchmove',
              end: 'touchend'
            }
          };

          var eventKey = events.mouse;
          if (!gaBrowserSniffer.msie && gaBrowserSniffer.touchDevice) {
            eventKey = events.touch;
          }

          // Hide laye label on mouse over/out events
          elt.mouseover(function(evt) {
             if (!isDragging) {
              layerLabelElt.show();
            }
          }).mouseout(function(evt) {
            if (!isDragging) {
              layerLabelElt.hide();
            }
          });

          // Drag swipe element callbacks
          var dragStart = function(evt) {
            isDragging = true;
            arrowsElt.hide();
            $document.on(eventKey.move, drag);
            $document.on(eventKey.end, dragEnd);
          };
          var drag = function(evt) {
            scope.map.requestRenderFrame();
          };
          var dragEnd = function(evt) {
            isDragging = false;
            arrowsElt.show();
            $document.unbind(eventKey.move, drag);
            $document.unbind(eventKey.end, dragEnd);
            var ratio = draggableElt.offset().left / scope.map.getSize()[0];
            scope.$apply(function() {
              gaPermalink.updateParams({swipe_ratio: ratio.toFixed(2)});
            });
          };

          // Compose events
          var handlePreCompose = function(evt) {
            var ctx = evt.getContext();
            var width = draggableElt.offset().left + draggableElt.width() / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, ctx.canvas.height);
            ctx.clip();
          };

          var handlePostCompose = function(evt) {
            evt.getContext().restore();
          };

          // Get a valid layer to compare.
          // To have the swipe available we need at least 2 valid layers on
          // the map.
          var findLayerToCompare = function() {
            var olLayers = scope.map.getLayers();
            var validLayers = [];
            for (var i = olLayers.getLength() - 1; i >= 0; i--) {
              var olLayer = olLayers.getAt(i);
              if (!olLayer.highlight) {
                validLayers.push(olLayer);
              }
            }
            if (validLayers.length < 2) {
              return null;
            }
            return validLayers[0];
          };

          // Display swipe or not depends on the number of layers currently on
          // the map.
          var refreshComp = function() {

            // Unset the layer and remove its listeners
            if (scope.layer) {
              scope.layer.unByKey(layerListenerKeys[0]);
              scope.layer.unByKey(layerListenerKeys[1]);
              scope.layer = null;
              scope.map.requestRenderFrame();
            }

            scope.layer = findLayerToCompare();
            if (!scope.isActive || !scope.layer) {
              elt.hide();
              return;
            }

            layerListenerKeys = [
              scope.layer.on('precompose', handlePreCompose),
              scope.layer.on('postcompose', handlePostCompose)
            ];
            elt.show();
            scope.map.requestRenderFrame();
          };


          // Active the swipe adding events.
          var activate = function() {
            var olLayers = scope.map.getLayers();
            listenerKeys = [
              olLayers.on('add', refreshComp),
              olLayers.on('remove', refreshComp)
            ];
            elt.on(eventKey.start, dragStart);
            refreshComp();
          };


          // Deactive the swipe removing the events
          var deactivate = function() {
            elt.unbind(eventKey.start, dragStart);
            scope.map.getLayers().unByKey(listenerKeys[0]);
            scope.map.getLayers().unByKey(listenerKeys[1]);
            refreshComp();
            gaPermalink.deleteParam('swipe_ratio');
          };

          // Boolean determining if the swipe is activated from the permalink
          // parameter
          var fromPermalink = false;

          // Initalize component with permalink paraneter
          if (!angular.isDefined(scope.isActive) &&
             angular.isDefined(gaPermalink.getParams().swipe_ratio)) {
            var ratio = parseFloat(gaPermalink.getParams().swipe_ratio);
            draggableElt.css({left: scope.map.getSize()[0] * ratio});
            fromPermalink = true;
            scope.isActive = true;
            activate();
          }

          // Watchers
          scope.$watch('isActive', function(active) {
            if (active) {
              if (!fromPermalink && !findLayerToCompare()) {
                alert($translate('not_enough_layer_for_swipe'));
              }
              activate();
              fromPermalink = false;
            } else {
              deactivate();
            }
          });
        }
      };
    }
  );
})();
