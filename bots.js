'use strict';

var async = require('async');
var botUtilities = require('bot-utilities');
var fs = require('fs');
var MemoizeCache = require('level-cache-tools').MemoizeCache;
var moment = require('moment');
var path = require('path');
var Twit = require('twit');
var _ = require('lodash');

var twit = new Twit(botUtilities.getTwitterAuthFromEnv());

var botLists = [
  '01101O10/lists/bot-list',
  'beaugunderson/lists/image-input-bots',
  'beaugunderson/lists/my-bots',
  'BooDooPerson/lists/bots',
  'botALLY/lists/omnibots',
  'ckolderup/lists/the-fall-of-humanity',
  'dbaker_h/lists/glitch-bots',
  'Gangles/lists/twitter-bots',
  'inky/lists/bots',
  'nickfletchr/lists/image-bots',
  'sleepgoth/lists/bots',
  'thricedotted/lists/butt-bots',
  'thricedotted/lists/thricedotted-bottes',
  'tinysubversions/lists/darius-kazemi-s-bots',
  'tullyhansen/lists/bots'
];

function cachePath(name) {
  return path.join(__dirname, 'caches', name);
}

var members = new MemoizeCache(cachePath('list-members'), function (list, cb) {
  list = list.split('/lists/');

  twit.get('lists/members', {
    owner_screen_name: list[0],
    slug: list[1],
    count: 5000,
    skip_status: true
  }, function (err, data) {
    // Rather than just pass cb here we discard the third argument, 'response',
    // which isn't serializable.
    cb(err, data);
  });
});

var RE_USERNAME = /(?:^|[^A-Za-z0-9])(@\w{1,15})\b/g;
var RE_HASHTAG = /(?:^|[^A-Za-z0-9])(#[A-Za-z0-9_]+)\b/g;

function matches(re, text) {
  var results = [];
  var match;

  while ((match = re.exec(text)) !== null) {
    results.push(match[1]);
  }

  return results;
}

function usernames(text) {
  return matches(RE_USERNAME, text);
}

function hashtags(bot) {
  var results = [
    matches(RE_HASHTAG, bot.description),
    matches(RE_HASHTAG, bot.location)
  ];

  return _(results)
    .flatten()
    .uniq()
    .value();
}

// Get expanded URLs from the entities' description and url attributes
function urls(entities) {
  return _(entities)
    .map(function (source) {
      return _.map(source.urls, function (urls) {
        return urls.expanded_url;
      });
    })
    .compact()
    .flatten()
    .value();
}

async.map(botLists, function (list, cbMap) {
  members(list, function (err, data) {
    if (err) {
      return cbMap(err);
    }

    var bots = data.users.filter(function (bot) {
      // We'll use this in the next step too
      bot.created_at = moment(new Date(bot.created_at));

      return !bot.created_at.isBefore('2014-01-01');
    }).map(function (bot) {
      return {
        id: bot.id_str,
        name: bot.name,
        screen_name: bot.screen_name,
        description: bot.description,
        urls: urls(bot.entities),
        usernames: usernames(bot.description),
        hashtags: hashtags(bot),
        location: bot.location,
        created: bot.created_at.format('l'),
        statuses: bot.statuses_count,
        listed: bot.listed_count,
        followers: bot.followers_count
      };
    });

    cbMap(null, bots);
  });
}, function (err, bots) {
  if (err) {
    return console.log(err);
  }

  bots = _(bots)
    .flatten()
    .uniq(function (bot) {
      return bot.screen_name;
    })
    .value();

  console.log('Found', bots.length, 'bots.');

  fs.writeFile('./bots.json', JSON.stringify(bots, null, 2), function (err) {
    if (err) {
      console.log(err);
    }

    console.log('Finished.');
  });
});
