#!/usr/bin/env node

'use strict';

var consulta = require('io-cep');
var mysql = require('mysql');
var lo = require('lodash');
var async = require('async');
var moment = require('moment');
var Table = require('cli-table');
var ProgressBar = require('progress');
var config = require('./mysql.json');

var pool = mysql.createPool({
  connectionLimit: 1,
  waitForConnections: true,
  host: config.host,
  user: config.user,
  password: '',
  database: config.db,
});

// Tempo de Execução
var timeStart;
var timeEnd;

var setBuild = 1;
var offset = 2;
var total = setBuild * offset;
var atualizado = 0;
var falha = [];

// ProgressBar
var bar = new ProgressBar(' consulta [:bar] :percent :etas', {
  complete: '=',
  incomplete: ' ',
  width: 20,
  total: total
});

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

// function parallel(param) {
//   return new Promise(function(resolve, reject) {
//     async.parallel(param, function(err, results) {
//       if (err) {
//         reject(err);
//       }
//       resolve(results);
//     });
//   });
// }

// Executa query
function q(sql, param) {
  param = param || null;
  return new Promise(function(resolve, reject) {
    pool.getConnection(function(errPool, conn) {
      if (errPool) {
        reject(errPool);
      } else {
        conn.query(sql, param, function(err, rows, fields) {
          if (err) {
            reject(err);
          } else {
            resolve(rows, fields);
            conn.release();
          }
        });
      }
    });
  });
}

// Monta query
function build(t) {
  return new Promise(function(resolve, reject) {
    var arr = lo.range(0, t);
    var sql = arr.map(function(num) {
      return 'SELECT cep FROM cepbr LIMIT ' + (num * 100) + ', ' + offset;
    });
    resolve(sql);
  });
}

// Executa todas as queries
function runAllQueries(res) {
  return Promise.all(res.map(function(sql) {
    return q(sql);
  }));
}

function getCEP(cep, callback) {
  consulta(cep)
    .then(function(res) {
      bar.tick();
      callback(null, res);
    })
    .catch(function(err) {
      bar.tick();
      callback(err, null);
    });
}

// Executa todos os ceps
function runAllCeps(res) {
  var ceps = res
    .reduce(function(a, b) {
      return a.concat(b);
    })
    .map(function(v) {
      // return function(callback) {
      //   getCEP(v.cep, callback);
      // };
      return v.cep;
    });
  // return parallel(ceps);
  return mapSeries(ceps, getCEP);
}

// Executa todas as queries
function updateCeps(res) {
  return Promise.all(res.map(function(dado) {
    if (dado.success && dado.hasOwnProperty('logradouro')) {
      return q(
        'UPDATE ?? SET ? WHERE ?', [
          'cepbr',
          {
            endereco: dado.logradouro
          },
          {
            cep: dado.cep
          }
        ]);
    } else {
      falha.push(dado);
      Promise.resolve();
    }
  }));
}

// Vai...
timeStart = Date.now();
build(setBuild)
  .then(runAllQueries)
  .then(runAllCeps)
  .then(updateCeps)
  .then(function(results) {
    timeEnd = Date.now();
    atualizado = lo.sum(results, 'affectedRows');
    var tempoExec = (timeEnd - timeStart);
    var s = moment.duration(tempoExec).asSeconds();
    var i = moment.duration(tempoExec).minutes();
    var h = moment.duration(tempoExec).hours();
    var tableTotals = new Table({
      head: ['Atualizado', 'Falha', 'Total']
    });
    tableTotals.push([atualizado, falha.length, total]);
    var tableTime = new Table({
      head: ['Hora', 'Minuto', 'Segundo']
    });
    tableTime.push([h, i, s]);
    process.stdout.write('Status' + '\n');
    process.stdout.write(tableTotals.toString() + '\n\n');
    process.stdout.write('Tempo de execução' + '\n');
    process.stdout.write(tableTime.toString() + '\n\n');
    if (falha.length > 0) {
      var headsFull = Object.keys(falha[0]);
      var heads = lo.remove(headsFull, function(n) {
        return n !== 'success';
      });
      var tableFail = new Table({
        head: heads
      });
      falha.map(function(item) {
        var row = heads.map(function(k) {
          return item[k];
        });
        tableFail.push(row);
      });
      process.stdout.write('CEP fail list' + '\n');
      process.stdout.write(tableFail.toString() + '\n');
    }
    process.exit();
  })
  .catch(function(err) {
    process.stdout.write(err + '\n');
    process.exit(1);
  });
