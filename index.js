require('dotenv').config();
const express = require('express');
const redis = require('redis');
const shortid = require('shortid');

const app = express();
app.use(express.json());

const redisClients = [
  redis.createClient({ url: `redis://${process.env.REDIS_HOST_1}:${process.env.REDIS_PORT_1}` }),
  redis.createClient({ url: `redis://${process.env.REDIS_HOST_2}:${process.env.REDIS_PORT_2}` }),
  redis.createClient({ url: `redis://${process.env.REDIS_HOST_3}:${process.env.REDIS_PORT_3}` })
];

// Connect all Redis clients
async function connectRedisClients() {
  try {
    await Promise.all(redisClients.map(client => client.connect()));
    console.log('All Redis clients connected successfully');
  } catch (error) {
    console.error('Redis connection error:', error);
    process.exit(1);
  }
}

// Initialize Redis connections
connectRedisClients();

// Hash function to distribute keys among Redis clients
function getRedisClient(key) {
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return redisClients[hash % redisClients.length];
}

// Endpoint to shorten a URL
app.post('/shorten', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).send('URL is required');

    const shortId = shortid.generate();
    const redisClient = getRedisClient(shortId);

    await redisClient.set(shortId, url);
    res.json({ shortUrl: `http://localhost:${process.env.PORT}/${shortId}` });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to retrieve the original URL
app.get('/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    const redisClient = getRedisClient(shortId);

    const url = await redisClient.get(shortId);
    if (!url) {
      return res.status(404).send('URL not found');
    }
    res.redirect(url);
  } catch (error) {
    console.error('Error retrieving URL:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});