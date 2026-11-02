// import express from 'express';
// import { MongoClient, ObjectId } from 'mongodb';
// import 'dotenv/config'
// import cors from 'cors';
// const app = express();
// const PORT = 8000


// app.use(cors());
// app.use(express.json());

// const client = new MongoClient(process.env.MONGODB_URI,);

// export async function connectToMongoDB() {
//   try {
//     await client.connect();
//     console.log("You successfully connected to MongoDB!");
//     return client;
//   } catch (err) {
//     console.dir(err);
//   }
// }

// const mongoClient = await connectToMongoDB();
// const db = mongoClient.db('booknook');
// const booksCollection = db.collection('books');

// app.post('/add-book', async (req, res)=>{
//   const data = req.body;
//   const result = await booksCollection.insertOne(data);
//   console.log(result);
//   res.send(result)
//   // res.send(result)
// })
// app.get('/all-books', async (req, res)=>{
//   const result = await booksCollection.find().toArray();
//   res.send(result)
// }),

// app.get('/all-book/:id', async (req, res)=>{
//   const {id} = req.params;
//   const result = await booksCollection.findOne({_id: new ObjectId(id)});
//   res.send(result)
// })

// app.get('/', (req, res) => {
//     res.send('Hello World Shahin! This is my first Node.js server.');
// });

// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });













import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from 'cors';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db('booknook');
const booksCollection = db.collection('books');
app.post('/add-book', async (req, res) => {
  try {
    const data = req.body;
    const result = await booksCollection.insertOne({
      ...data,
      createdAt: new Date() 
    });
    res.status(201).json({
      success: true,
      message: 'Book added successfully',
      book: { _id: result.insertedId, ...data, createdAt: new Date() }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/all-books', async (req, res) => {
  try {
    const result = await booksCollection.find().toArray();
    res.json({ success: true, books: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/all-book/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    res.json({ success: true, book: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ব্যবহারকারীর নিজের সব বই
app.get('/my-books/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const books = await booksCollection
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, books });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ বই এডিট/আপডেট
app.put('/edit-book/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const result = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, book: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ বই ডিলিট
app.delete('/delete-book/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Hello World Shahin! This is my first Node.js server.');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});