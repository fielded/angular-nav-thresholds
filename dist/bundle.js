!function(e){"use strict";e="default"in e?e.default:e;var t=function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")},n=function(){function e(e,t){for(var n=0;n<t.length;n++){var a=t[n];a.enumerable=a.enumerable||!1,a.configurable=!0,"value"in a&&(a.writable=!0),Object.defineProperty(e,a.key,a)}}return function(t,n,a){return n&&e(t.prototype,n),a&&e(t,a),t}}(),a=function(e,t){for(var n=0;n<e.length;n++)if(t(e[n]))return e[n]},r=function(e,t){return t.version===e},l=function(e,t){return t._id===e},i=function(){function e(n,a,r,l){t(this,e),this.$q=n,this.smartId=a,this.lgasService=r,this.statesService=l}return n(e,[{key:"calculateThresholds",value:function(e,t){if(e&&e.allocations&&e.plans&&t&&t.allocations&&t.allocations.version&&t.plans&&t.plans.version){var n=a(e.allocations,r.bind(null,t.allocations.version));if(n&&n.weeklyLevels){var l=a(e.plans,r.bind(null,t.plans.version));if(l&&l.weeksOfStock){var i=n.weeklyLevels,s=l.weeksOfStock,o=Object.keys(i).reduce(function(t,n){return t[n]=Object.keys(s).reduce(function(e,t){return e[t]=Math.round(i[n]*s[t]),e},{}),e.targetPopulation&&(t[n].targetPopulation=e.targetPopulation[n]),t},{});return o}}}}},{key:"getThresholdsFor",value:function(e){var t=this,n="zone:?state:?lga",r={},i={};r=e.reduce(function(e,a){var r=a.location;if(!r)return e;var l=t.smartId.idify(r,n),s=a.allocations||{version:1},o=a.plans||{version:1};return e[l]=angular.merge({},{allocations:s,plans:o}),r.lga?(i.lga||(i.lga=t.lgasService.list()),e[l].type="lga"):r.state&&(i.state||(i.state=t.statesService.list()),e[l].type="state"),e},{});var s=function(e){return Object.keys(r).forEach(function(n){var i=r[n],s=a(e[i.type],l.bind(null,n));i.thresholds=t.calculateThresholds(s,i),delete i.type}),r};return this.$q.all(i).then(s)}}]),e}();i.$inject=["$q","smartId","lgasService","statesService"],e.module("angularNavThresholds",["angularNavData","ngSmartId"]).service("thresholdsService",i)}(angular);