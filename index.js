/* global require, process */

'use strict';

var lo = require('lodash');
var async = require('async');
var consulta = require('io-cep');

var lg = function(d) {
  process.stdout.write(d + '\n');
};

function getCEP(n, callback) {
  var cep = lo.padLeft(n, 5, '0') + '-001';
  consulta(cep, callback);
}

function getResult(el, idx, arr) {
  if (el.success) {
    lg(JSON.stringify(el)); // grava no db
  }
}

async.map(lo.range(4080, 4090), getCEP, function(err, results) {
  if(err){
    lg(err.message);
    process.exit(1);
  }
  results.forEach(getResult);
  process.exit();
});
