1. Install Redis
2. In a folder with files run the command to install all dependencies in node modules: npm i
3. In my program I use 2 redis-server: master to simulate the main server and slave to simulate cache
4. Run master server: redis-server --port 6380
5. Run slave server: redis-server (6379 by default)
6. Run command: node index.js (to start server on port 3000)
7. Use follow url:
	- POST /:id to add a new record with :id as key value
	- PUT /:id to modify key or create a new one. Required body in JSON format with "data" field as key: {"data": "some updated data"}
	- GET /:id to fetch a record with :id as key value

