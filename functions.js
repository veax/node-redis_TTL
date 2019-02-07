module.exports = {
    server_connect: function (name, port) {
        name.on('connect', function() {
            console.log(`Redis connected on port ${port}`);
        });
        name.on('error', function (err) {
            console.log('Something went wrong ' + err);
        });
    },

    getDataFromCache: function (server, id) {
        return new Promise((resolve, reject) => {
            server.hgetall(id, (err, obj) => {
                if (!obj) {
                    console.log("data with this id don't exist in cache");
                    return reject();  
                }
                console.log("fetch from cache...")
                return resolve(obj);           
            })
        })
    },

    getDataFromMaster: function (server, id) {
        return new Promise((resolve, reject) => {
            server.hgetall(id, (err, obj) => {
                if (!obj) {
                    console.log("data with this id don't exist on master")
                    return reject();
                }
                console.log("fetch from master...")
                return resolve(obj);
            })
        })
    },

    updateCache: function(slave, id) {
        return new Promise((resolve, reject) => {
            // then update data on cache
            slave.hmset(id, ['timestamp', Math.floor(Date.now()/1000)], (err, reply) => {
                if (err) {
                    console.log(err);
                    return reject();
                }
                console.log(reply);
            })
            return resolve();
        })
    },

    returnData: function (data, ttl_time, res) {
        // then return data to user
        res.setHeader('ttl', ttl_time); // send refreshed ttl in seconds in headers
        res.status(200);
        var returnedJson = {"data": data.data};
        res.send(returnedJson); 
    }
}









