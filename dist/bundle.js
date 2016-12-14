(function (angular$1) {
  'use strict';

  angular$1 = 'default' in angular$1 ? angular$1['default'] : angular$1;

  var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
  var zonePlans = {
    weeksOfStock: {
      min: 0,
      reOrder: 3,
      max: 6
    }
  };

  var getFactorVersion = function getFactorVersion(stockCount, factor, options) {
    if (options.version === 'last') {
      return options.version;
    }
    if (!(stockCount[factor] && stockCount[factor].version)) {
      return 1;
    }
    return stockCount[factor].version;
  };

  var getFactor = function getFactor(location, versions, version) {
    if (version === 'last') {
      return versions[versions.length - 1];
    }

    return find(versions, isVersion.bind(null, version));
  };

  var getFactors = function getFactors(stockCount, location, options) {
    // centralized for whenever we implement #16
    var somethingIsWrong = function somethingIsWrong() {
      return undefined;
    };

    var getWeeklyLevels = function getWeeklyLevels() {
      if (!(location.allocations && location.allocations.length)) {
        somethingIsWrong();
      }

      var allocationsVersion = getFactorVersion(stockCount, 'allocations', options);

      if (typeof allocationsVersion === 'undefined') {
        somethingIsWrong();
      }

      var allocations = getFactor(location, location.allocations, allocationsVersion);
      return allocations && allocations.weeklyLevels;
    };

    var getWeeksOfStock = function getWeeksOfStock() {
      if (location.level !== 'zone' && !(location.plans && location.plans.length)) {
        somethingIsWrong();
      }

      var plansVersion = getFactorVersion(stockCount, 'plans', options);

      if (typeof plansVersion === 'undefined') {
        somethingIsWrong();
      }

      var plans = zonePlans;
      if (location.level !== 'zone') {
        plans = getFactor(location, location.plans, plansVersion);
      }

      return plans && plans.weeksOfStock;
    };

    var getMonthlyTargetPopulations = function getMonthlyTargetPopulations() {
      var monthlyTargetPopulations = void 0;
      if (location.targetPopulations) {
        if (!location.targetPopulations.length) {
          somethingIsWrong();
        }
        var targetPopulationVersion = getFactorVersion(stockCount, 'targetPopulations', options);

        if (typeof targetPopulationVersion === 'undefined') {
          somethingIsWrong();
        }

        var targetPopulations = getFactor(location, location.targetPopulations, targetPopulationVersion);
        monthlyTargetPopulations = targetPopulations && targetPopulations.monthlyTargetPopulations;
      } else {
        // For backwards compatibility with the old style location docs,
        // since we have no control about when the dashboards are going
        // to replicate the new location docs
        if (!(location.targetPopulation && location.targetPopulation.length)) {
          somethingIsWrong();
        }
        monthlyTargetPopulations = location.targetPopulation;
      }
      return monthlyTargetPopulations;
    };

    return {
      weeksOfStock: getWeeksOfStock(),
      weeklyLevels: getWeeklyLevels(),
      targetPopulations: getMonthlyTargetPopulations()
    };
  };

  var ThresholdsService = function () {
    function ThresholdsService($q, smartId, lgasService, statesService) {
      _classCallCheck(this, ThresholdsService);

      this.$q = $q;
      this.smartId = smartId;
      this.lgasService = lgasService;
      this.statesService = statesService;
    }

    // For zones the thresholds are based on the state store required allocation for
    // the week, that information is passed as an optional param (`requiredStateStoresAllocation`).
    // That param is only used for zones.


    _createClass(ThresholdsService, [{
      key: 'calculateThresholds',
      value: function calculateThresholds(location, stockCount, products) {
        var requiredStateStoresAllocation = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

        if (!stockCount) {
          return;
        }

        if (!location && location.level) {
          return;
        }

        if (!products || !products.length) {
          return;
        }

        var _getFactors = getFactors(stockCount, location, options),
            weeklyLevels = _getFactors.weeklyLevels,
            weeksOfStock = _getFactors.weeksOfStock,
            targetPopulations = _getFactors.targetPopulations;

        if (!(weeklyLevels && weeksOfStock && targetPopulations)) {
          return;
        }

        return Object.keys(weeklyLevels).reduce(function (index, productId) {
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

          index[productId].targetPopulation = targetPopulations[productId];

          return index;
        }, {});
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
          var targetPopulations = stockCount.targetPopulations || { version: 1 };
          index[id] = angular.merge({}, {
            allocations: allocations,
            plans: plans,
            targetPopulations: targetPopulations
          });

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