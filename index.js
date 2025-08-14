
 
const express = require('express');
const cors = require('cors');
const { ObjectId, MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
 const jwt = require('jsonwebtoken');
// const mongoose = require('mongoose');
// mongoose.set('useCreateIndex', true);
const nodemailer = require('nodemailer');
// const stripe = require("stripe")('your-key');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zapyzlw.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);

// MongoDB client setup
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
});

async function run() {
    try {
        const carsCollection = client.db('vehica').collection('cars');
        const orderCollection = client.db('vehica').collection('orders2');
        const userCollection = client.db('vehica').collection('users2');
        const newCollection = client.db('vehica').collection('newCars');
        const paymentCollection = client.db('vehica').collection('payments');

        // Get all cars with optional search
        app.get('/cars', async (req, res) => {
            let query = {};
            const search = req.query.search;

            if (search?.length) {
                query = {
                    $text: {
                        $search: search
                    }
                };
            }

            const order = req.query.order === 'asc' ? 1 : -1;
            const cursor = carsCollection.find(query).sort({ price: order });
            const cars = await cursor.toArray();
            res.send(cars);
        });

        // Get car by ID
        app.get('/cars/:id', async (req, res) => {
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid ID format' });
            }

            const query = { _id: new ObjectId(id) };
            const car = await carsCollection.findOne(query);
            res.send(car);
        });

        // Add new car
        app.post('/newCars', async (req, res) => {
            const car = req.body;
            const result = await newCollection.insertOne(car);
            res.send(result);
        });

        app.get('/newCars', async (req, res) => {
            const result = await newCollection.find({}).toArray();
            res.send(result);
        });

        // Orders API
        app.get('/orders2', async (req, res) => {
            let query = {};
            if (req.query.email) {
                query = { email: req.query.email };
            }
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        });

        app.post('/orders2', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });



        app.post('/jwt', (req, res) => {
  try {
    const { email } = req.body; // only include what you need
    if (!email) {
      return res.status(400).send({ error: "Email is required" });
    }

    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
    res.send({ token });
  } catch (err) {
    console.error("JWT signing error:", err);
    res.status(500).send({ error: "Failed to generate token" });
  }
});
app.get('/jwt', async (req, res) => {
  const email = req.query.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);

  if (user) {
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
    return res.send({ accessToken: token });
  } else {
    return res.status(403).send({ accessToken: '' });
  }
});


        app.patch('/orders2/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid ID format' });
            }

            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: { status }
            };
            const result = await orderCollection.updateOne(query, updatedDoc);
            res.send(result);
        });

       

        app.get('/users2/admin/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;

  // Only allow requester to check their own admin status
  if (req.decoded.email !== email) {
    return res.status(403).json({ isAdmin: false, message: 'Forbidden access' });
  }

  const user = await userCollection.findOne({ email });
  res.json({ isAdmin: user?.role === 'admin' });
});

        // Add user
        app.post('/users2', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
}


app.put('/users2/admin/:id', verifyJWT, async (req, res) => {
  // ... validate id ...

  const requesterEmail = req.decoded.email;
  const requesterAccount = await userCollection.findOne({ email: requesterEmail });

  if (requesterAccount?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can make others admin' });
  }

 
});



async function makeAdminByEmail() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const userCollection = client.db('vehica').collection('users2');
    const result = await userCollection.updateOne(
      { email: "cseteam@gmail.con" },    // filter by email here
      { $set: { role: "admin" } }        // update role to admin
    );
    console.log('Update result:', result);
  } catch (err) {
    console.error('Error making admin:', err);
  } finally {
    await client.close();
  }
}

makeAdminByEmail().catch(console.error);


        app.get('/users2', async (req, res) => {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        });

        // Special cars (only name field)
        app.get('/specialCars', async (req, res) => {
            const result = await newCollection.find({}).project({ name: 1 }).toArray();
            res.send(result);
        });

       
       app.delete('/newCars/:id', async (req, res) => {
  console.log("DELETE request received for ID:", req.params.id);

  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    console.log("Invalid ID format");
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const query = { _id: new ObjectId(id) };

  try {
    const result = await newCollection.deleteOne(query);
    console.log("MongoDB delete result:", result);
    
    res.status(200).json({ message: "Deleted successfully",
       deletedCount: result.deletedCount });

  } catch (err) {
    console.error("Error deleting:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





        
    } finally {
        
    }
}

run().catch(error => console.error(error));

// Default route
app.get('/', (req, res) => {
    res.send('vehica-car server');
});

app.listen(port, () => {
    console.log(`vehica car running on: ${port}`);
});
