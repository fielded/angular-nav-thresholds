import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from 'rollup-plugin-node-resolve'

export default {
  entry: 'src/index.js',
  dest: 'dist/bundle.js',
  external: ['angular'],
  format: 'iife',
  plugins: [
    babel({
      exclude: ['node_modules/**']
    }),
    nodeResolve({
      main: true,
      jsnext: true,
      browser: true
    }),
    commonjs()
  ],
  globals: {
    angular: 'angular'
  }
}
