const fn = require('./functions');  // import functions
const redis = require('redis');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const masterPort = 6380;
const slavePort = 6379;
// define TTL in s (1 min) - protocol in s
const ttl = 60;

// create master and slave servers (slave for caching)
var master = redis.createClient({port:masterPort});
var slave = redis.createClient();  // port 6379 by default

// middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


// connect to redis 
fn.server_connect(master, '6380');
fn.server_connect(slave, '6379');

// running client to query redis
app.listen(3000, () => {
    console.log('express server is running at port 3000...');
})

// default route
app.get('/', (req, res) => {
    res.send("use PUT /:id to update data in db and GET /:id to fetch data with posted id");
});

// get data of key passed in url
app.get('/:id', (req, res) => {
    var id = req.params.id;
    // looking for data from cache
    fn.getDataFromCache(slave, id).then((data) => {
        // check if ttl is expired
        var expired_time = Math.floor(Date.now()/1000) - data.timestamp;
        if (expired_time >= ttl) {
            console.log("ttl expired - fetch from master...")
            fn.getDataFromMaster(master, id)
            .then((data) => {
                // then update cache and return data to user
                fn.updateCache(slave, id);
                fn.returnData(data, ttl, res);
            })
            .catch((err) => {  // error if no key found on a master
                res.status(404);
                res.send("key not found");
            })
        }
        else {
             // else return data to user from cache
            fn.returnData(data, ttl - expired_time, res);
        }
    })
    .catch(() => {  // no object in cache
        fn.getDataFromMaster(master, id)
        .then((data) => {
            // then update cache and return data to user
            fn.updateCache(slave, id);
            fn.returnData(data, ttl, res);
        })
        .catch(() => {  // error if no key found on a master
            res.status(404);
            res.send("key not found");
        })
    });
});

// generate object string for key passed in url
app.post('/:id', (req, res) => {
    // on post we send data also on both master and slave servers
    var timestamp = Math.floor(Date.now()/1000);
    var id = req.params.id;
    slave.hmset(id, ['data', `some basic data for object with id: ${id}`, 'timestamp', timestamp], (err, reply) => {
        if (err) {
            console.log(err);
        }
        console.log(reply);
    })
    master.hmset(id, ['data', `some basic data for object with id: ${id}`], (err, reply) => {
        if (err) {
            console.log(err);
        }
        console.log(reply);
    })
    res.redirect('/');
});

// update or create object with key passed in url
app.put('/:id', (req, res) => {
    // on put we send data also on both master and slave servers
    var timestamp = Math.floor(Date.now()/1000);
    var id = req.params.id;
    //  check for invalid body:
    if (req.body.data && req.body.data != null){
        // hmset owerrite values if they already exists in the hash, if key doesn't
        // exist, a new key holding a hash is created
        slave.hmset(id, ['data', req.body.data, 'timestamp', timestamp], (err, reply) => {
            if (err) {
                console.log(err);
            }
            console.log(reply);
        })
        master.hmset(id, ['data', req.body.data], (err, reply) => {
            if (err) {
                console.log(err);
            }
            console.log(reply);
        })
        res.redirect('/');
    }
    else {
        res.status(400);
        res.send("Invalid body");
    }
});


