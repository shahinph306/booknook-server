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
const borrowsCollection = db.collection('borrows');

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

// ✅ বুক করলে — কপি কমানো + borrow রেকর্ড
app.post('/borrow-book', async (req, res) => {
  try {
    const { bookId, bookTitle, authorName, bookImageUrl, borrowerName, borrowerEmail, borrowedAt, returnBy } = req.body;

    // ১. বইটি খুঁজে বের করুন
    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (book.totalCopies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies left' });
    }

    // ২. কপি ১ কমান
    await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { totalCopies: -1 } }
    );

    // ৩. borrow রেকর্ড তৈরি
    const borrowData = {
      bookId,
      bookTitle,
      authorName,
      bookImageUrl,
      borrowerName,
      borrowerEmail,
      borrowedAt,
      returnBy,
      returned: false,
      createdAt: new Date()
    };

    const result = await borrowsCollection.insertOne(borrowData);

    res.json({ success: true, id: result.insertedId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ রিটার্ন করলে — কপি বাড়ানো
app.post('/return-book', async (req, res) => {
  try {
    const { bookId, borrowerEmail } = req.body;

    // ১. borrow রেকর্ড আপডেট করুন
    await borrowsCollection.updateOne(
      { bookId, borrowerEmail, returned: false },
      { $set: { returned: true, returnedAt: new Date() } }
    );

    // ২. কপি ১ বাড়ান
    await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { totalCopies: 1 } }
    );

    res.json({ success: true, message: 'Book returned successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ পুরোনো PATCH রুটটি সংশোধন করা হয়েছে
app.patch('/decrement-copies/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (book.totalCopies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies left' });
    }

    const updated = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $inc: { totalCopies: -1 } },
      { returnDocument: 'after' }
    );

    res.json({ success: true, totalCopies: updated.totalCopies });
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
