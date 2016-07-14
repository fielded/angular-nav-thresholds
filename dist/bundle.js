!function(e){"use strict";e="default"in e?e.default:e;var t=function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")},n=function(){function e(e,t){for(var n=0;n<t.length;n++){var a=t[n];a.enumerable=a.enumerable||!1,a.configurable=!0,"value"in a&&(a.writable=!0),Object.defineProperty(e,a.key,a)}}return function(t,n,a){return n&&e(t.prototype,n),a&&e(t,a),t}}(),a=function(e,t){for(var n=0;n<e.length;n++)if(t(e[n]))return e[n]},r=function(e,t){return t.version===e},l=function(e,t){return t._id===e},s=function(){function e(n,a,r,l){t(this,e),this.$q=n,this.smartId=a,this.lgasService=r,this.statesService=l}return n(e,[{key:"calculateThresholds",value:function(e,t){if(e&&e.allocations&&e.plans&&t&&t.allocations&&t.allocations.version&&t.plans&&t.plans.version){var n=a(e.allocations,r.bind(null,t.allocations.version));if(n&&n.weeklyLevels){var l=a(e.plans,r.bind(null,t.plans.version));if(l&&l.weeksOfStock){var s=n.weeklyLevels,i=l.weeksOfStock,o=Object.keys(s).reduce(function(e,t){return e[t]=Object.keys(i).reduce(function(e,n){return e[n]=Math.round(s[t]*i[n]),e},{}),e},{});return o}}}}},{key:"getThresholdsFor",value:function(e){var t=this,n="zone:?state:?lga",r={},s={};r=e.reduce(function(e,a){var r=a.location;if(!r)return e;var l=t.smartId.idify(r,n),i=a.allocations||{version:1},o=a.plans||{version:1};return e[l]=angular.merge({},{allocations:i,plans:o}),r.lga&&!s.lga?(s.lga=t.lgasService.list(),e[l].type="lga"):r.state&&!s.state&&(s.state=t.statesService.list(),e[l].type="state"),e},{});var i=function(e){return Object.keys(r).forEach(function(n){var s=r[n],i=a(e[s.type],l.bind(null,n));s.thresholds=t.calculateThresholds(i,s),delete s.type}),r};return this.$q.all(s).then(i)}}]),e}();s.$inject=["$q","smartId","lgasService","statesService"],e.module("angularNavThresholds",["angularNavData","ngSmartId"]).service("thresholdsService",s)}(angular);