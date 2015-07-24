'use strict';

var consulta = require('io-cep');
var mysql = require('mysql');
var lo = require('lodash');
var async = require('async');
var moment = require('moment');

var pool = mysql.createPool({
  connectionLimit: 1,
  waitForConnections: true,
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'teleport'
});

// Tempo de Execução
var timeStart;
var timeEnd;

var total = 0;
var atualizado = 0;
var falha = [];

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
function build(total) {
  return new Promise(function(resolve, reject) {
    var arr = lo.range(0, total);
    var sql = arr.map(function(num) {
      return 'SELECT cep FROM cepbr LIMIT ' + (num * 100) + ', 100';
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
      callback(null, res);
    })
    .catch(function(err) {
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
      total++;
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
build(20)
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
    console.log('Total', total);
    console.log('Atualizado', atualizado);
    console.log('Falha', falha.length);
    console.log('-------------------');
    console.log('Tempo de execução:');
    console.log('-------------------');
    console.log('  Hora:', h);
    console.log('  Minuto:', i);
    console.log('  Segundo:', s);
    if (falha.length > 0) {
      console.log('-------------------');
      console.log('CEP fail list');
      console.log('-------------------');
      falha.forEach(function(el) {
        console.log(el);
      });
    }
    process.exit();
  })
  .catch(function(err) {
    console.log(err);
    process.exit(1);
  });
