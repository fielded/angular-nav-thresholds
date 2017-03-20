(function (angular) {
	'use strict';

	angular = 'default' in angular ? angular['default'] : angular;

	var versions = [{ "version": 1, "date": "2016-01-01", "coefficients": { "product:2-reconst-syg": { "wastage": 1.1, "coverage": 0.87 }, "product:5-reconst-syg": { "wastage": 1.1, "coverage": 0.87 }, "product:ad-syg": { "wastage": 1.05, "coverage": 0.87 }, "product:bcg": { "wastage": 2, "coverage": 0.9, "doses": 1 }, "product:bcg-syg": { "coverage": 0.87 }, "product:diluent-bcg": {}, "product:diluent-mv": {}, "product:diluent-yf": {}, "product:hep-b": { "wastage": 1.3333333333333333, "coverage": 0.9, "doses": 1 }, "product:hpv": { "wastage": 1.1, "coverage": 0.9, "doses": 2 }, "product:ipv": { "wastage": 1.05, "coverage": 0.87, "doses": 1 }, "product:mv": { "wastage": 1.4285714285714286, "coverage": 0.9, "doses": 1 }, "product:opv": { "wastage": 1.3333333333333333, "coverage": 0.9, "doses": 4 }, "product:pcv": { "wastage": 1.05, "coverage": 0.87, "doses": 3 }, "product:penta": { "wastage": 1.3333333333333333, "coverage": 0.87, "doses": 3 }, "product:rota": { "wastage": 1.05, "coverage": 0.87, "doses": 3 }, "product:safety-boxes": { "wastage": 1.05 }, "product:td": { "wastage": 1.3333333333333333, "coverage": 0.87, "doses": 2 }, "product:yf": { "wastage": 1.4285714285714286, "coverage": 0.9, "doses": 1 } } }, { "version": 2, "date": "2017-01-01", "coefficients": { "product:2-reconst-syg": { "wastage": 1.1, "coverage": 0.87 }, "product:5-reconst-syg": { "wastage": 1.1, "coverage": 0.87 }, "product:ad-syg": { "wastage": 1.05, "coverage": 0.87 }, "product:bcg": { "wastage": 2, "coverage": 0.94, "doses": 1 }, "product:bcg-syg": { "coverage": 0.87 }, "product:diluent-bcg": {}, "product:diluent-mv": {}, "product:diluent-yf": {}, "product:hep-b": { "wastage": 1.3333333333, "coverage": 0.82, "doses": 1 }, "product:hpv": { "wastage": 1.1, "coverage": 0.9, "doses": 2 }, "product:ipv": { "wastage": 1.25, "coverage": 0.94, "doses": 1 }, "product:mv": { "wastage": 1.4285714285714286, "coverage": 0.9, "doses": 1 }, "product:opv": { "wastage": 1.3333333333333333, "coverage": 0.9, "doses": 4 }, "product:pcv": { "wastage": 1.0526315789, "coverage": 0.94, "doses": 3 }, "product:penta": { "wastage": 1.3333333333333333, "coverage": 0.87, "doses": 3 }, "product:rota": { "wastage": 1.05, "coverage": 0.87, "doses": 3 }, "product:safety-boxes": { "wastage": 1.05 }, "product:td": { "wastage": 1.3333333333333333, "coverage": 0.85, "doses": 2 }, "product:yf": { "wastage": 1.4285714285714286, "coverage": 0.95, "doses": 1 } } }];
	var defaultCoefficients = {
		versions: versions
	};

	// TODO: replace with Array#find ponyfill
	function find(list, match) {
	  for (var i = 0; i < list.length; i++) {
	    if (match(list[i])) {
	      return list[i];
	    }
	  }
	  return undefined;
	}

	function somethingIsWrong(msg) {
	  if (console) {
	    console.warn("angular-nav-thresholds: " + msg);
	  }
	  // TODO: log it to Google Analytics (#28)
	}

	var versionDateFormat = "YYYY-MM-DD";
	var config = {
		versionDateFormat: versionDateFormat
	};

	var formulae = {
	  'product:bcg': 'regular',
	  'product:mv': 'regular',
	  'product:yf': 'regular',
	  'product:opv': 'regular',
	  'product:td': 'regular',
	  'product:penta': 'regular',
	  'product:hep-b': 'regular',
	  'product:pcv': 'regular',
	  'product:ipv': 'regular',
	  'product:rota': 'regular',
	  'product:hpv': 'regular',
	  'product:ad-syg': 'adSyg',
	  'product:bcg-syg': 'bcg',
	  'product:5-reconst-syg': 'fiveReconst',
	  'product:2-reconst-syg': 'twoReconst',
	  'product:safety-boxes': 'safetyBoxes',
	  'product:diluent-bcg': 'diluentBcg',
	  'product:diluent-yf': 'diluentYf',
	  'product:diluent-mv': 'diluentMv'
	};

	var calculator = {};
	calculator.regular = function (allocations, coefficient, targetPopulation) {
	  return targetPopulation * coefficient.doses * coefficient.coverage * coefficient.wastage;
	};

	calculator.adSyg = function (allocations) {
	  return allocations['product:penta'] + allocations['product:mv'] + allocations['product:yf'] + allocations['product:hep-b'] + allocations['product:td'] + allocations['product:pcv'] + allocations['product:ipv'] + allocations['product:hpv'];
	};

	calculator.bcg = function (allocations) {
	  return allocations['product:bcg'];
	};

	calculator.fiveReconst = function (allocations, coefficient) {
	  return (allocations['product:mv'] + allocations['product:yf']) / 10 * coefficient.wastage;
	};

	calculator.twoReconst = function (allocations, coefficient) {
	  return allocations['product:bcg'] / 20 * coefficient.wastage;
	};

	calculator.safetyBoxes = function (allocations, coefficient) {
	  return (allocations['product:ad-syg'] + allocations['product:bcg-syg'] + allocations['product:5-reconst-syg'] + allocations['product:2-reconst-syg']) / 100 * coefficient.wastage;
	};

	calculator.diluentBcg = function (allocations) {
	  return allocations['product:bcg'];
	};
	calculator.diluentYf = function (allocations) {
	  return allocations['product:yf'];
	};
	calculator.diluentMv = function (allocations) {
	  return allocations['product:mv'];
	};

	var calculateForProduct = function calculateForProduct(monthlyTargetPopulations, coefficients, allocations, productId) {
	  var coefficient = coefficients[productId];
	  var monthlyTargetPopulation = monthlyTargetPopulations[productId];

	  allocations[productId] = 0;
	  if (typeof monthlyTargetPopulation !== 'undefined' && coefficient) {
	    allocations[productId] = calculator[formulae[productId]](allocations, coefficient, monthlyTargetPopulation / 4);
	  }
	  return allocations;
	};

	var calculateWeeklyLevels = (function (monthlyTargetPopulations, coefficients) {
	  return Object.keys(formulae).reduce(calculateForProduct.bind(null, monthlyTargetPopulations, coefficients), {});
	});

	var isVersion = function isVersion(date, version) {
	  var momentDate = moment().isoWeekYear(date.year).isoWeek(date.week).isoWeekday(1).startOf('day');
	  var momentVersionStartDate = moment(version.date, config.versionDateFormat).startOf('isoWeek').startOf('day');
	  return momentDate.isSameOrAfter(momentVersionStartDate);
	};

	var getFactor = function getFactor(versions, date) {
	  var reverseVersions = versions.slice(0).reverse();
	  var factor = find(reverseVersions, isVersion.bind(null, date));
	  // If the doc is too old to have a matching version, default to the oldest one
	  if (!factor) {
	    return versions[0];
	  }
	  return factor;
	};

	var getCoefficients = function getCoefficients(productCoefficients, date) {
	  if (!(productCoefficients && productCoefficients.versions && productCoefficients.versions.length)) {
	    throw new Error('missing productCoefficients or productCoefficients.versions');
	  }

	  var version = getFactor(productCoefficients.versions, date);
	  if (!(version && version.coefficients)) {
	    throw new Error('cannot find version of coefficients for date ' + date);
	  }
	  return version.coefficients;
	};

	var getWeeksOfStock = function getWeeksOfStock(location, date) {
	  if (!(location.plans && location.plans.length)) {
	    throw new Error('missing plans on location ' + location._id);
	  }

	  var plans = getFactor(location.plans, date);
	  if (!(plans && plans.weeksOfStock)) {
	    throw new Error('cannot find version of weeksOfStock for location ' + location._id + ' and date ' + date);
	  }
	  return plans.weeksOfStock;
	};

	var getTargetPopulations = function getTargetPopulations(location, date) {
	  if (location.targetPopulations && location.targetPopulations.length) {
	    var targetPopulations = getFactor(location.targetPopulations, date);

	    return {
	      version: targetPopulations.version,
	      monthlyTargetPopulations: targetPopulations && targetPopulations.monthlyTargetPopulations
	    };
	  }

	  // For backwards compatibility to version before introducing `targetPopulations`,
	  // since we have no control about when the dashboards are going
	  // to replicate the new location docs
	  if (!(location.targetPopulation && Object.keys(location.targetPopulation).length)) {
	    return {
	      version: 1
	    };
	  }

	  return {
	    version: 1,
	    monthlyTargetPopulations: location.targetPopulation
	  };
	};

	var getWeeklyLevels = function getWeeklyLevels(location, date) {
	  if (!(location.allocations && location.allocations.length)) {
	    throw new Error('missing allocations on location ' + location._id);
	  }

	  var allocations = getFactor(location.allocations, date);
	  if (!(allocations && allocations.weeklyLevels)) {
	    throw new Error('cannot find version of weeklyLevels for location ' + location._id + ' and date ' + date);
	  }
	  return allocations.weeklyLevels;
	};

	var getFactors = (function (location, productCoefficients, date) {
	  var weeksOfStock = getWeeksOfStock(location, date);

	  var _getTargetPopulations = getTargetPopulations(location, date),
	      version = _getTargetPopulations.version,
	      monthlyTargetPopulations = _getTargetPopulations.monthlyTargetPopulations;

	  // For backwards compatibility to version before introducing `targetPopulations`,
	  // since for that version `weeklyAllocations` were not always calculated
	  // based on target population


	  if (version === 1) {
	    return {
	      weeklyLevels: getWeeklyLevels(location, date),
	      weeksOfStock: weeksOfStock,
	      monthlyTargetPopulations: monthlyTargetPopulations
	    };
	  }

	  var coefficients = getCoefficients(productCoefficients, date);
	  var weeklyLevels = calculateWeeklyLevels(monthlyTargetPopulations, coefficients);

	  return {
	    weeklyLevels: weeklyLevels,
	    weeksOfStock: weeksOfStock,
	    monthlyTargetPopulations: monthlyTargetPopulations
	  };
	});

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
	  //
	  // Passing the coefficientVersions as a param so that it can be adapted later to use the database doc


	  _createClass(ThresholdsService, [{
	    key: 'calculateThresholds',
	    value: function calculateThresholds(location, stockCount, products) {
	      var requiredStateStoresAllocation = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
	      var productCoefficients = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : defaultCoefficients;

	      if (!stockCount) {
	        var locationId = location && location._id ? location._id : 'with unknown id';
	        return somethingIsWrong('missing mandatory param stock count for location ' + locationId);
	      }
	      if (!stockCount.date) {
	        return somethingIsWrong('missing date on stock count ' + stockCount._id);
	      }

	      if (!location) {
	        var stockCountId = stockCount && stockCount._id ? stockCount._id : 'with unknown id';
	        return somethingIsWrong('missing mandatory param location for stock count ' + stockCountId);
	      }
	      if (!location.level) {
	        return somethingIsWrong('missing level on location ' + location._id);
	      }

	      if (!(products && products.length)) {
	        return somethingIsWrong('missing mandatory param products');
	      }

	      var locationFactors = void 0;
	      try {
	        locationFactors = getFactors(location, productCoefficients, stockCount.date);
	      } catch (e) {
	        somethingIsWrong(e.message);
	        return;
	      }

	      var _locationFactors = locationFactors,
	          weeksOfStock = _locationFactors.weeksOfStock,
	          weeklyLevels = _locationFactors.weeklyLevels,
	          monthlyTargetPopulations = _locationFactors.monthlyTargetPopulations;


	      return products.reduce(function (index, product) {
	        var productId = product._id;
	        var weeklyLevel = weeklyLevels[productId];

	        // Default rounding used in VSPMD and highest possible presentation
	        var presentation = 20;

	        if (product && product.presentation) {
	          // TODO: product presentations should be ints, not strings
	          presentation = parseInt(product.presentation, 10);
	        }

	        index[productId] = Object.keys(weeksOfStock).reduce(function (productThresholds, threshold) {
	          var level = weeklyLevel * weeksOfStock[threshold];
	          var roundedLevel = Math.ceil(level / presentation) * presentation;
	          productThresholds[threshold] = roundedLevel;

	          if (location.level === 'zone' && requiredStateStoresAllocation[productId]) {
	            productThresholds[threshold] += requiredStateStoresAllocation[productId];
	          }

	          return productThresholds;
	        }, {});

	        index[productId].weeklyLevel = weeklyLevel;

	        if (monthlyTargetPopulations) {
	          // old zone docs have no target population
	          index[productId].targetPopulation = monthlyTargetPopulations[productId];
	        }

	        return index;
	      }, {});
	    }
	  }, {
	    key: 'getThresholdsFor',
	    value: function getThresholdsFor(stockCounts, products) {
	      var _this = this;

	      var productCoefficients = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultCoefficients;

	      var isId = function isId(id, item) {
	        return item._id === id;
	      };

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
	        index[id] = { date: stockCount.date };

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
	          item.thresholds = _this.calculateThresholds(location, item, products, null, productCoefficients);
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

	angular.module('angularNavThresholds', ['angularNavData', 'ngSmartId']).service('thresholdsService', ThresholdsService);

}(angular));