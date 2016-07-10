module.exports = function (config) {
  config.set({
    files: [
      'node_modules/angular/angular.js',
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

    // This block is needed to execute Chrome on Travis
    // If you ever plan to use Chrome and Travis, you can keep it
    // If not, you can safely remove it
    // https://github.com/karma-runner/karma/issues/1144#issuecomment-53633076
    // if (configuration.browsers[0] === 'Chrome' && process.env.TRAVIS) {
      // configuration.customLaunchers = {
        // 'chrome-travis-ci': {
          // base: 'Chrome',
          // flags: ['--no-sandbox']
        // }
      // }
      // configuration.browsers = ['chrome-travis-ci']
    // }
  })
}
