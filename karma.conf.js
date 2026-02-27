// Karma 配置 —— 浏览器端测试（test:browser）
// 注意：日常 CI 建议使用 test:node（Node + fake-indexeddb），无需真实浏览器。
// 如需浏览器真机测试，执行：npm run test:browser

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha'],
    files: [
      // 仅加载浏览器兼容的占位测试；集成测试使用 test:node 执行
      'test/test.js',
    ],
    exclude: [],
    preprocessors: {},
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    // 可选：ChromeHeadless 适合 CI 环境
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadless: {
        base: 'Chrome',
        flags: ['--headless', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9222'],
      },
    },
    singleRun: true,
    concurrency: Infinity,
  });
};
