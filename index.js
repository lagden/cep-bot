/* global require, process */

'use strict';

var lo = require('lodash');
var async = require('async');
var consulta = require('io-cep');

function lg(d) {
  process.stdout.write(d + '\n');
}

function getCEP(n, callback) {
  var cep = lo.padLeft(n, 5, '0') + '-001';
  consulta(cep)
    .then(function(res) {
      callback(null, res);
    })
    .catch(function(err) {
      callback(err, null);
    });
}

function getResult(el, idx, arr) {
  if (el.success) {
    lg(JSON.stringify(el)); // grava no db
  }
}

function bot(init, end) {
  //... code
}

async.map(lo.range(4080, 4090), getCEP, function(err, results) {
  if(err){
    lg(err.message);
    process.exit(1);
  }
  results.forEach(getResult);
  process.exit();
});

module.exports = bot;
