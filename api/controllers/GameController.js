/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
 

var matchColors = ['#ffab91','#c5e1a5','#ef9a9a','#ffe082','#e6ee9c','#80cbc4','#fff59d','#ef9a9a','#bcaaa4','#80deea'];

module.exports = {

  'new': function(req, res) {
    res.locals.title = '建立遊戲';
    res.locals.rootClass = 'new';

    // 遊戲ID為時間的最後8碼，與先前重複的話先remove掉舊的
    var params = {id: String(new Date().getTime()).substr(-8), count: 1};

    Game.findOne({id: params.id})
    .exec(function(err, game) {
      if (!game) {
        Game.create(params)
        .exec(function (err, game) {
          return res.redirect('/new/' + params.id + '/' + params.count);
        });
      }
      else {
        Game.update({id: game.id}, {id: game.id, count: 1})
        .exec(function (er, ga) {
          return res.redirect('/new/' + params.id + '/' + params.count);
        });
      }
    });
    
  },

  'checkGameID': function(req, res) {
    Game.findOne({id: req.param('gid')})
    .exec(function(err, game) {
      if (!game) {
        return res.redirect('/error');
      }
      else {
        res.locals.gid = game.id;
        game.count = Number(game.count) + 1;
        Game.update({id: game.id}, game)
        .exec(function (er, ga) {
          ga = ga[0];
          return res.redirect('/wait/' + ga.id + '/' + ga.count);
        });
      }
    });
  },

  'wait': function(req, res) {
    Game.findOne({id: req.param('gid')})
    .exec(function(err, game) {
      if (!game) {
        return res.redirect('/error');
      }
      else if (!parseInt(req.param('pid')) || parseInt(req.param('pid')) < 1 || parseInt(req.param('pid')) > game.count) {
        return res.redirect('/error');
      }
      else {
        res.locals.title = '等待遊戲開始';
        res.locals.rootClass = 'wait';
        res.locals.gid = req.param('gid');
        res.locals.pid = req.param('pid');
        res.view();
      }
    });
  },

  'play': function(req, res) {
    Game.findOne({id: req.param('gid')})
    .exec(function(err, game) {
      if (!game) {
        return res.redirect('/error');
      }
      else if (!parseInt(req.param('pid')) || parseInt(req.param('pid')) < 1 || parseInt(req.param('pid')) > game.count) {
        return res.redirect('/error');
      }
      else {
        res.locals.title = '遊戲中';
        res.locals.rootClass = 'play';
        res.locals.gid = req.param('gid');
        res.locals.pid = req.param('pid');
        res.locals.match = game.match;
        res.locals.count = game.count;
        res.view();
      }
    });
  },

  'waiting': function(req, res) {
    //將對象socket加入該遊戲id的房間
    sails.sockets.join(req.socket, 'game_' + req.param('gid'));
    //取得目前人數
    Game.findOne({id: req.param('gid')}).exec(function(err, game) {
      
      //將遊戲人數廣播道該遊戲房間
      sails.sockets.broadcast('game_' + req.param('gid'), 'user_logged_in', {
        usercount: game.count
      });
    });

  },

  //當建立者按下開始鍵
  'start': function(req, res) {
    //直接依照total人數來決定順序
    Game.findOne({id: req.param('gid')})
    .exec(function(err, game) {
      var match, c, n;
      var random = true;

      // 只有一人時不得開始遊戲
      if (game.count < 2) {
        sails.sockets.broadcast('game_' + req.param('gid'), 'game_alert', {text: '不夠人數歐！'});
        return;
      }

      // 製作配對資料，將相當於人數的數字push進一個array，然後隨機打亂，然後再檢查是否會抽到自己。直到沒有重複時即為配對資料
      while (random) {
        match = [];
        c = game.count;
        n = 1;

        while (c--) {
          match[c] = n++;
        }
        match.sort(function() {return 0.5 - Math.random()})
        random = false;
        for (var i = 0; i < match.length; i++) {
          if (i == match[i] - 1) {
            random = true;
            break;
          }
        }
      }
      // 存配對的資料
      Game.update({id: game.id}, {match: match})
        .exec(function (er, ga) {
          ga = ga[0];
          sails.sockets.broadcast('game_' + req.param('gid'), 'game_start');
        });
    });


  },

  //遊戲頁的連線
  'playing': function(req, res) {
    sails.sockets.join(req.socket, 'game_' + req.param('gid'));
    sails.sockets.broadcast('game_' + req.param('gid'), 'your_turn_1');
  },

  //遊戲頁的連線
  'roll': function(req, res) {
    Game.findOne({id: req.param('gid')})
    .exec(function(err, ga) {
      var pid = Number(req.param('pid'));
      // 當還有下一位時，next為下一位的編號，沒有時為0
      var next = pid < ga.count ? pid + 1 : 0;
      sails.sockets.broadcast('game_' + req.param('gid'), 'onroll', {
        self: pid,
        target: ga.match[pid - 1],
        next: next,
        color: matchColors[pid - 1]
      });
    });
  }
  
  
};