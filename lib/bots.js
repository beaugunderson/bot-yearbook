'use strict';

var async = require('async');
var botUtilities = require('bot-utilities');
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
  'dphiffer/lists/impractical',
  'Gangles/lists/twitter-bots',
  'HarryGiles/lists/everyword-orgy',
  'inky/lists/bots',
  'looocas/lists/my-bot-garden',
  'mambocab/lists/great-bots',
  'mcmoots/lists/one-word-wonders',
  'negatendo/lists/bot-net',
  'nickfletchr/lists/image-bots',
  'RobotDramatico/lists/infinitos-monos',
  'sleepgoth/lists/bots',
  'thricedotted/lists/butt-bots',
  'thricedotted/lists/thricedotted-bottes',
  'tinysubversions/lists/darius-kazemi-s-bots',
  'tullyhansen/lists/bots'
];

function cachePath(name) {
  return path.join(path.dirname(require.main.filename), 'caches', name);
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

function botMatches(re, bot) {
  return _([bot.description, bot.location])
    .map(_.partial(matches, re))
    .flatten()
    .uniq()
    .value();
}

// Get expanded URLs from the entities' description and url attributes
function urls(entities) {
  return _(entities)
    .map(function (source) {
      return _.pluck(source.urls, 'expanded_url');
    })
    .compact()
    .flatten()
    .uniq()
    .value();
}

module.exports = function (cb) {
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
          usernames: botMatches(RE_USERNAME, bot),
          hashtags: botMatches(RE_HASHTAG, bot),
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
      return cb(err);
    }

    bots = _(bots)
      .flatten()
      .uniq(function (bot) {
        return bot.screen_name;
      })
      .value();

    cb(null, bots);
  });
};
