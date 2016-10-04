(function (angular$1) {
  'use strict';

  angular$1 = 'default' in angular$1 ? angular$1['default'] : angular$1;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  // TODO: replace with Array#find ponyfill
  var find = function find(list, match) {
    for (var i = 0; i < list.length; i++) {
      if (match(list[i])) {
        return list[i];
      }
    }
    return undefined;
  };

  var isVersion = function isVersion(version, item) {
    return item.version === version;
  };

  var isId = function isId(id, item) {
    return item._id === id;
  };

  // Zones config
  var zonesPlan = {
    min: 0,
    reOrder: 3,
    max: 6
  };

  var ThresholdsService = function () {
    function ThresholdsService($q, smartId, lgasService, statesService) {
      classCallCheck(this, ThresholdsService);

      this.$q = $q;
      this.smartId = smartId;
      this.lgasService = lgasService;
      this.statesService = statesService;
    }

    // For zones the thresholds are based on the state store required allocation for
    // the week, that information is passed as an optional param (`requiredStateStoresAllocation`).
    // That param is only used for zones.


    createClass(ThresholdsService, [{
      key: 'calculateThresholds',
      value: function calculateThresholds(location, stockCount, products) {
        var requiredStateStoresAllocation = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
        var options = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];

        if (!location || !location.allocations || !location.allocations.length || !location.plans || !location.plans.length || !location.level) {
          return;
        }

        if (!stockCount) {
          return;
        }

        if (options.version !== 'last' && !(stockCount.allocations && _typeof(stockCount.allocations.version) !== undefined && stockCount.plans && _typeof(stockCount.plans.version) !== undefined)) {
          return;
        }

        if (!products || !products.length) {
          return;
        }

        var allocation = void 0;
        if (options.version === 'last') {
          allocation = location.allocations[location.allocations.length - 1];
        } else {
          allocation = find(location.allocations, isVersion.bind(null, stockCount.allocations.version));
        }

        if (!(allocation && allocation.weeklyLevels)) {
          return;
        }

        var weeklyLevels = allocation.weeklyLevels;

        var weeksOfStock = zonesPlan;

        if (location.level !== 'zone') {
          var plan = void 0;
          if (options.version === 'last') {
            plan = location.plans[location.plans.length - 1];
          } else {
            plan = find(location.plans, isVersion.bind(null, stockCount.plans.version));
          }

          if (!(plan && plan.weeksOfStock)) {
            return;
          }
          weeksOfStock = plan.weeksOfStock;
        }

        var thresholds = Object.keys(weeklyLevels).reduce(function (index, productId) {
          index[productId] = Object.keys(weeksOfStock).reduce(function (productThresholds, threshold) {
            var level = weeklyLevels[productId] * weeksOfStock[threshold];
            var product = find(products, isId.bind(null, productId));

            // Default rounding used in VSPMD and highest possible presentation
            var presentation = 20;

            if (product && product.presentation) {
              // TODO: product presentations should be ints, not strings
              presentation = parseInt(product.presentation, 10);
            }

            var roundedLevel = Math.ceil(level / presentation) * presentation;
            productThresholds[threshold] = roundedLevel;

            if (location.level === 'zone' && requiredStateStoresAllocation[productId]) {
              productThresholds[threshold] += requiredStateStoresAllocation[productId];
            }

            return productThresholds;
          }, {});

          if (location.targetPopulation) {
            index[productId].targetPopulation = location.targetPopulation[productId];
          }

          return index;
        }, {});

        return thresholds;
      }
    }, {
      key: 'getThresholdsFor',
      value: function getThresholdsFor(stockCounts, products) {
        var _this = this;

        // TODO: make it work for zones too.
        // For making it work with zones, we need to take into account the amount of stock
        // to be allocated to the zone state stores in a particular week
        var locationIdPattern = 'zone:?state:?lga';
        var index = {};
        var promises = {};

        index = stockCounts.reduce(function (index, stockCount) {
          var scLocation = stockCount.location;
          if (!scLocation) {
            return index;
          }

          var id = _this.smartId.idify(scLocation, locationIdPattern);
          var allocations = stockCount.allocations || { version: 1 };
          var plans = stockCount.plans || { version: 1 };
          index[id] = angular.merge({}, { allocations: allocations, plans: plans });

          if (scLocation.lga) {
            if (!promises.lga) {
              promises.lga = _this.lgasService.list();
            }
            index[id].type = 'lga';
          } else if (scLocation.state) {
            if (!promises.state) {
              promises.state = _this.statesService.list();
            }
            index[id].type = 'state';
          }

          return index;
        }, {});

        var addThresholds = function addThresholds(promisesRes) {
          Object.keys(index).forEach(function (key) {
            var item = index[key];
            var location = find(promisesRes[item.type], isId.bind(null, key));
            item.thresholds = _this.calculateThresholds(location, item, products);
            delete item.type;
          });

          return index;
        };

        return this.$q.all(promises).then(addThresholds);
      }
    }]);
    return ThresholdsService;
  }();

  ThresholdsService.$inject = ['$q', 'smartId', 'lgasService', 'statesService'];

  angular$1.module('angularNavThresholds', ['angularNavData', 'ngSmartId']).service('thresholdsService', ThresholdsService);

}(angular));