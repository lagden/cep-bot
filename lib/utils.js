'use strict';

var async = require('async');
var ProgressBar = require('progress');

// Serie
function mapSeries(param, fn) {
  return new Promise(function(resolve, reject) {
    async.mapSeries(param, fn, function(err, results) {
      if (err) {
        reject(err);
      }
      resolve(results);
    });
  });
}

// Paralelo
function parallel(param) {
  return new Promise(function(resolve, reject) {
    async.parallel(param, function(err, results) {
      if (err) {
        reject(err);
      }
      resolve(results);
    });
  });
}

function reduceCallback(previous, current) {
  return previous.concat(current);
}

function reduce(param, cb) {
  cb = cb || reduceCallback;
  return param.reduce(cb);
}

function barra(label, len) {
  return new ProgressBar(' ' + label + ' [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: len
  });
}

module.exports = {
  'series': mapSeries,
  'parallel': parallel,
  'reduce': reduce,
  'barra': barra
};
