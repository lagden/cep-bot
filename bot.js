'use strict';

import _ from 'lodash';
import fs from 'fs';
import co from 'co';
import series from 'co-series';
import program  from 'commander';
import consulta from 'io-cep';
import moment from 'moment';
import Log from 'log';
import {q as queryExec} from './lib/my';

let log = new Log('info', fs.createWriteStream('./log/consulta.log'));
let logIn = new Log('info', fs.createWriteStream('./log/insert.log'));

function buildInsert(d) {
  return [
    'INSERT INTO `teleport`.`cepbr`',
    '(`CEP`, `Bairro`, `Logradouro`, `Municipio`, `UF`, `Endereco`)',
    `values ('${d.cep}', '${d.bairro}', '${d.logradouro}',`,
    `'${d.localidade}', '${d.uf}', '${d.logradouro}');`
  ].join(' ');
}

function getAll(res, v) {
  if(res.hasOwnProperty('success')) {
    if(res.success) {
      log.info(`${res.cep}`);
      if(res.cep !== res.reqCep) {
        logIn.info(buildInsert(res));
      }
    } else {
      log.error(`${res.message} ${res.cep}`);
    }
  } else {
    log.warning(`${v}`);
  }
  return res;
}

function fn(v) {
  let getAllLex = (res) => getAll(res, v);
  return consulta(v).then(getAllLex).catch(getAllLex);
}

function update(d) {
  if(d.success) {
    return queryExec('UPDATE ?? SET ? WHERE ?', [
      'cepbr',
      {endereco: d.logradouro},
      {cep: d.cep}
    ]);
  } else {
    return Promise.resolve({affectedRows: 0});
  }
}

function run(q) {
  return co(function* (){
    let timeStart = Date.now();
    let ceps = yield queryExec(q);
    let numCeps = _(ceps).map('cep').value();
    let promisesConsulta = numCeps.map(series(fn));
    let dados = yield promisesConsulta;
    let promisesUpdate = dados.map(update);
    let updates = yield promisesUpdate;
    let total = numCeps.length;
    return {
      start: timeStart,
      total: total,
      falha: _.sum(dados, (obj) => !obj.success),
      update: _.sum(updates, 'affectedRows'),
    };
  });
}

function results(res) {
  let timeEnd = Date.now();
  let tempoExec = (timeEnd - res.start);
  let s = moment.duration(tempoExec).asSeconds();
  let i = moment.duration(tempoExec).minutes();
  let h = moment.duration(tempoExec).hours();
  let msgs = [
    `Total de ceps:       ${res.total}`,
    `Falha na consulta:   ${res.falha}`,
    `Atualizados na base: ${res.update}`,
    `h | i | s:           ${h} | ${i} | ${s}`
  ];
  for (let msg of msgs) {
    process.stdout.write(`${msg} \n`);
  }
  process.exit(0);
}

function fail(err) {
  process.stdout.write(`${err} \n`);
  process.exit(1);
}

program
  .version('0.0.1')
  .description('Bot CEP')
  .option('-q, --query <type>', 'Faça sua própria query')
  .parse(process.argv);

let q = program.query ? program.query : false;
if(q) {
  run(q)
    .then(results)
    .catch(fail);
} else {
  process.stdout.write('Digite sua query!' + '\n');
  process.exit(0);
}
