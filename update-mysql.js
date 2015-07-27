#!/usr/bin/env node

'use strict';

var util = require('util');
var fs = require('fs');

var Log = require('log');
var consulta = require('io-cep');
var lo = require('lodash');
var moment = require('moment');
var Table = require('cli-table');

var my = require('./lib/my');
var utils = require('./lib/utils');
var log = new Log('info', fs.createWriteStream('./run.log'));

var timeStart;
var timeEnd;

var bar;
var total = 0;
var falha = [];

function getCEP(cep, callback) {
  consulta(cep)
    .then(function(res) {
      var m = (res.success) ? 'info' : 'warning';
      log[m](cep);
      bar.tick();
      callback(null, res);
    })
    .catch(function(err) {
      log.warning('fake result:' + cep);
      log.warning(err);
      bar.tick();
      callback(null, {success: false});
    });
}

function cep(v) {
  return v.cep;
}

// Executa todos os ceps
function runAllCeps(res) {
  log.info('>>>>> Iniciado a consulta de CEPs');
  var ceps;
  if (res.length > 0 && util.isArray(res[0])) {
    ceps = utils.reduce(res).map(cep);
  } else {
    ceps = res.map(cep);
  }
  total = ceps.length;
  bar = utils.barra('consulta', total);
  return utils.series(ceps, getCEP);
}

// Atualiza o banco
function updateCEP(dado, callback) {
  if (dado.success && dado.hasOwnProperty('logradouro')) {
    my.q('UPDATE ?? SET ? WHERE ?', [
      'cepbr',
      {endereco: dado.logradouro},
      {cep: dado.cep}
    ]).then(function(res) {
      log.info(dado.cep);
      callback(null, res);
    })
    .catch(function(err) {
      log.warning('falha na atualização do cep:' + dado.cep);
      log.warning(err);
      dado.message = 'Falha no update';
      falha.push(dado);
      callback(null, {affectedRows: 0});
    });
  } else {
    falha.push(dado);
    callback(null, {affectedRows: 0});
  }
}

// Executa todas as atualizações
function updateCeps(res) {
  log.info('>>>>> Atualizando a tabela de CEPs');
  return utils.series(res, updateCEP);
}

// Vai...
timeStart = Date.now();
my.q('SELECT cep FROM teleport.cepbr WHERE ? LIMIT 20', {
  uf: 'DF'
})
  .then(runAllCeps)
  .then(updateCeps)
  .then(function(results) {
    timeEnd = Date.now();
    var atualizado = lo.sum(results, 'affectedRows');
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
