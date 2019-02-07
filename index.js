// to run master server: redis-server --port 6380
// to run slave server: redis-server (6379 by default)
// query db: 
// redis-cli -p <number of port>
// > hgetall <hash value(number of id for this implementation)> 

const redis = require('redis');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const masterPort = 6380;
const slavePort = 6379;
// define const TTL in s (1 min) - protocol in s
const ttl = 60;

// create master and slave servers (slave for caching)
var master = redis.createClient({port:masterPort});
var slave = redis.createClient();  // port 6379 by default

// middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

function server_connect(name, port) {
    name.on('connect', function() {
        console.log(`Redis connected on port ${port}`);
    });
    name.on('error', function (err) {
        console.log('Something went wrong ' + err);
    });
}

// connect to redis 
server_connect(master, '6380');
server_connect(slave, '6379');


// running client to query redis
app.listen(3000, () => {
    console.log('express server is running at port 3000...');
})

// add invalidate cache handler with TTL (in mseconds)
// add TTL field in data JSON object (or in header)
// slave server (local cache) send TTL in headers on a get request
// slave have to verify TTL on get response
// timestamp: (TTL + current time) when store object
// condition: if (current timestamp < timestamp from object) -> get from master server
app.get('/', (req, res) => {
    res.send("use PUT /:id to update data in db and GET /:id to fetch data with posted id");
});

app.get('/:id', (req, res) => {
    // looking for data from cache (slave server)
    var id = req.params.id;
    // get a callback function
    getDataFromCache(slave, id).then((data) => {
        //console.log(data.data);
        res.setHeader('ttl', ttl); // send ttl in seconds in headers
        res.status(200);
        var returnedJson = {"data": data.data};
        res.send(returnedJson);    // send only data, without timestamp  
    })
    .catch(() => {
        res.setHeader('ttl', ttl);
        res.status(404);
        res.send("key not found")
    });
    
});

// generate object string for key value 
app.post('/:id', (req, res) => {
    // on post we send data also on both master and slave servers
    var timestamp = Date.now() + (ttl*1000);
    var id = req.params.id;
    slave.hmset(id, ['data', `some basic data for object with id: ${id}`, 'timestamp', timestamp], (err, reply) => {
        if (err) {
            console.log(err);
        }
        console.log(reply);
    })
    master.hmset(id, ['data', `some basic data for object with id: ${id}`, 'timestamp', timestamp], (err, reply) => {
        if (err) {
            console.log(err);
        }
        console.log(reply);
    })
        res.redirect('/');
});

// update or create object with key value
app.put('/:id', (req, res) => {
    // on put we send data also on both master and slave servers
    var timestamp = Date.now() + (ttl*1000);
    var id = req.params.id;
    console.log(req.body.data);
    // hmset owerrite values if they already exists in the hash, if key doesn't
    // exist, a new key holding a hash is created
    slave.hmset(id, ['data', `some basic data for object with id: ${id} : ${req.body}`, 'timestamp', timestamp], (err, reply) => {
        if (err) {
            console.log(err);
        }
        console.log(reply);
    })
    master.hmset(id, ['data', `some basic data for object with id: ${id} : ${req.body}`, 'timestamp', timestamp], (err, reply) => {
        if (err) {
            console.log(err);
        }
        console.log(reply);
    })
        res.redirect('/');
});


function getDataFromCache(server, id) {
    return new Promise((resolve, reject) => {
        var currentTime = Date.now();
        server.hgetall(id, (err, obj) => {
            if (!obj) {
                console.log("data with this id don't exist");
                return reject();  
            }
            // check if ttl is expired
            if (obj.timestamp < currentTime) {
                console.log("ttl expired - fetch from master...")
                var timestamp = currentTime + (ttl*1000);
                server.hmset(id, 'timestamp', timestamp);
                getDataFromMaster(master, id).then(data => {
                    return resolve(data);
                })
            }
            else {
                console.log("fetch from cache...")
                return resolve(obj);
            }
           
        })
    })
}

function getDataFromMaster(server, id) {
    return new Promise((resolve, reject) => {
        var currentTime = Date.now();
        var timestamp = currentTime + (ttl*1000);  
        server.hmset(id, 'timestamp', timestamp);   // update timestamp
        server.hgetall(id, (err, obj) => {
            if (!obj) {
                console.log("data with this id don't exist")
                return reject();
            }
            return resolve(obj);
        })
    })
}


