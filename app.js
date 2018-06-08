const express = require('express');
const app = express();
const server = require('http').Server(app);
const path = require('path');
const pug = require('pug');
const MongoClient = require('mongodb').MongoClient;

const url = "mongodb://localhost:27017/";

const mongoose = require('mongoose');

var playerSchema = mongoose.Schema({
    username : String,
    time : Number,
    result : Number
});

var Player = mongoose.model("Player", playerSchema);
var db = mongoose.connect("mongodb://localhost/turtlesgame");


app.locals.pretty = true;
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname + '/views'));
app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
    res.render('index.pug');
});

app.get('/turtles', function(req, res){
    Player.find({result: {$exists: true}},function(err, players){
        if(err) return console.error(err);
        res.render('turtles', {players: players});
    }).sort({result: 1}).limit(5);
    
});

app.get('/jsgame', function(req, res){
    res.render('jsgame.pug');
});

app.get(/.*/, function(req, res){
    res.end("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Error</title></head><body><h1>www.vinaro.me</h1><h2>Error 404 : </h2><p>The requested URL " + req.url + " was not found on this server.</p></body></html>")
});

server.listen(app.get('port'), function(){
    console.log('Server listening on port ' + app.get('port'));
});

var uniqueId = function() {
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return randomLetter + Date.now();
  };
  

const io = require('socket.io').listen(server);
users = {};
var tracks = [null, null, null, null];
var numberPlayers = 0;
var arrived = 0;

io.sockets.on('connection', function(socket){
    
    var user = false;

    socket.on('testusername', function(data){
        var testUsername = 0;
        console.log(data.username);
        for (prop in users){
                console.log(users[prop].username);
                if(users[prop].username.toLowerCase().trim() === data.username.toLowerCase().trim()) testUsername = 1;
        };
        console.log(testUsername);
        socket.emit('testUsernameResult', {usernameExists : testUsername});
    });

        // New user

        socket.on('createUser', function(identified){
            if(numberPlayers < 4) {
                console.log(identified);
                numberPlayers++;
                console.log(numberPlayers);
                if(numberPlayers == 2) timergame();

                user = identified;
                user.id = uniqueId();
                for (var i = 0; i < tracks.length ; i++){
                    if(tracks[i] === null){
                        tracks[i] = 1;
                        user.track = i;
                        break;
                    }
                }
                users[user.id] = user;
                console.log(user);
                socket.emit('tomyself', user)
                socket.broadcast.emit('newuser', user)

                for (prop in users){
                        socket.emit('users', users[prop] );
                };
            } else {
                socket.broadcast.emit('roomfull');
            }

    });

    // update player position

    socket.on('sendPosition', function(position){
        console.log(position);
        socket.broadcast.emit('updatePosition', position);
    });

    // send timing once player arrived

    socket.on('sendscore', function(data){
        arrived ++;
        if (arrived == numberPlayers){
            clearInterval(stopit);
            io.sockets.emit('restart');
        };
        console.log(user.username);
        MongoClient.connect(url, function(err, db) {
            if (err) throw err;
            var dbo = db.db("turtlesgame");
            var addResult = { username: user.username, result: data.result };
            dbo.collection("players").insertOne(addResult, function(err, res) {
              if (err) throw err;
              console.log("document inserted");
              db.close();
            });
          });

        socket.broadcast.emit('updatescore', {id : data.id, result: data.result});
    });

    // Disconnected player

    socket.on('disconnect', function(){
        if(!user){
            return false;
        };
        arrived--;
        numberPlayers--;
        console.log(numberPlayers);

        if (numberPlayers == 1){
            clearInterval(stopit);
        };

        console.log(user);
        console.log(user.username + ' s\'est deconnecte')
        tracks[user.track] = null;
        delete users[user.id];
        io.sockets.emit('discusers', user);
    });
});

   // Chronometre server
   var stopit;

   var stopwatch = function (){
    var start = new Date();
    stopit = setInterval(function(){

        var now = new Date();
        io.sockets.emit('timestamp', {timestamp: now - start});
    }, 10); 
   }

   var timergame = function(){
       var lasting = 60;
       var startgame = setInterval( function(){
           if (lasting == 0){
                clearInterval(startgame);
                stopwatch();
           };
            io.sockets.emit('timer', {timer: lasting});
        lasting--;
       }, 1000)
   };
