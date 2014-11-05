'use strict';

var fs = require('fs');
var program = require('commander');

program
  .command('bots')
  .description('Retrieve and write the list of bots to disk')
  .action(function () {
    var bots = require('./lib/bots.js');

    bots(function (err, list) {
      if (err) {
        return console.error(err);
      }

      console.log('Found', list.length, 'bots.');

      fs.writeFile('./bots.json', JSON.stringify(list, null, 2), function (err) {
        if (err) {
          console.log(err);
        }

        console.log('Finished.');
      });
    });
  });

program.parse(process.argv);
