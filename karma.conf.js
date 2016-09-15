module.exports = function (config) {
  config.set({
    files: [
      'node_modules/angular/angular.js',
      'node_modules/ng-smart-id/dist/bundle.js',
      'dist/bundle.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'test/*.spec.js'
    ],

    frameworks: ['jasmine'],

    plugins: [
      'karma-phantomjs-launcher',
      'karma-jasmine'
    ],

    reporters: ['progress'],

    logLevel: 'WARN',

    singleRun: true,

    autoWatch: false,

    browsers: ['PhantomJS']
  })
}
