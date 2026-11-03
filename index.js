
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
    throw err;
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db('booknook');
const booksCollection = db.collection('books');
const borrowsCollection = db.collection('borrows');

// Add Book
app.post('/add-book', async (req, res) => {
  try {
    const {
      bookTitle,
      authorName,
      category,
      totalCopies,
      bookImageUrl,
      shortDescription,
      userName,
      userEmail,
    } = req.body;

    if (
      !bookTitle ||
      !authorName ||
      !category ||
      !bookImageUrl ||
      !userEmail ||
      !userName
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields.',
      });
    }

    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      return res.status(400).json({
        success: false,
        message: 'Total copies must be at least 1.',
      });
    }

    const bookData = {
      bookTitle,
      authorName,
      category,
      totalCopies,
      bookImageUrl,
      shortDescription: shortDescription || "",
      userName,
      userEmail,
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(bookData);

    res.status(201).json({
      success: true,
      message: 'Book added successfully',
      book: {
        _id: result.insertedId,
        ...bookData,
      },
    });
  } catch (err) {
    console.error("Add Book Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get All Books
app.get('/all-books', async (req, res) => {
  try {
    const result = await booksCollection.find().toArray();
    res.json({ success: true, books: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Single Book
app.get('/all-book/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID',
      });
    }

    const result = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    res.json({ success: true, book: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get My Books
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

// Edit Book
app.put('/edit-book/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid book ID",
      });
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: req.body,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Book not found",
      });
    }

    const updatedBook = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send({
      success: true,
      book: updatedBook,
    });
  } catch (error) {
    console.error("Edit Book Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to update book",
    });
  }
});

// Delete Book
app.delete('/delete-book/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID',
      });
    }

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    res.json({
      success: true,
      message: 'Book deleted successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Borrow Book
app.post('/borrow-book', async (req, res) => {
  try {
    const {
      bookId,
      bookTitle,
      authorName,
      bookImageUrl,
      borrowerName,
      borrowerEmail,
      borrowedAt,
      returnBy,
    } = req.body;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID',
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(bookId),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    if (book.totalCopies <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No copies left',
      });
    }

    await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { totalCopies: -1 } }
    );

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
      createdAt: new Date(),
    };

    const result = await borrowsCollection.insertOne(borrowData);

    res.json({
      success: true,
      id: result.insertedId,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Return Book
app.post('/return-book', async (req, res) => {
  try {
    const { bookId, borrowerEmail } = req.body;

    const borrowResult = await borrowsCollection.updateOne(
      { bookId, borrowerEmail, returned: false },
      { $set: { returned: true, returnedAt: new Date() } }
    );

    if (borrowResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active borrow record not found',
      });
    }

    await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { totalCopies: 1 } }
    );

    res.json({
      success: true,
      message: 'Book returned successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Decrement Copies
app.patch('/decrement-copies/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID',
      });
    }

    const updated = await booksCollection.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        totalCopies: { $gt: 0 },
      },
      { $inc: { totalCopies: -1 } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Book not found or no copies left',
      });
    }

    res.json({
      success: true,
      totalCopies: updated.totalCopies,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Home Route
app.get('/', (req, res) => {
  res.send('Hello World Shahin! This is my first Node.js server.');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
