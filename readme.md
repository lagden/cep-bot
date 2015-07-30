# CEP Bot

> Fills automatically a mysql database with the zip code information


## Install

```
npm i
```


## Usage

```
npm start "SELECT cep from cepbr WHERE uf='DF' LIMIT 5" > geral.log
```

You can track progress using `tail -f consulta.log`


## License

MIT © [Thiago Lagden](http://lagden.in)
