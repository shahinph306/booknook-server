
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing in environment variables");
}

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Important: Allow larger image data
app.use(express.json({ limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`\n➡️ ${req.method} ${req.url}`);

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    console.log("Request Body:", req.body);
  }

  next();
});

// MongoDB
const client = new MongoClient(mongoUri);

let booksCollection;
let borrowsCollection;

async function connectToMongoDB() {
  await client.connect();

  const db = client.db("booknook");

  booksCollection = db.collection("books");
  borrowsCollection = db.collection("borrows");

  console.log("✅ MongoDB Connected Successfully!");
  console.log("📚 Database: booknook");
}

// =====================================
// ADD BOOK
// =====================================
app.post("/add-book", async (req, res) => {
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

    // Validate required fields
    if (
      !bookTitle?.trim() ||
      !authorName?.trim() ||
      !category?.trim() ||
      !bookImageUrl?.trim() ||
      !userName?.trim() ||
      !userEmail?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    const copies = Number(totalCopies);

    if (!Number.isInteger(copies) || copies < 1) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be at least 1.",
      });
    }

    const bookData = {
      bookTitle: bookTitle.trim(),
      authorName: authorName.trim(),
      category: category.trim(),
      totalCopies: copies,
      bookImageUrl: bookImageUrl.trim(),
      shortDescription: shortDescription?.trim() || "",
      userName: userName.trim(),
      userEmail: userEmail.trim().toLowerCase(),
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(bookData);

    console.log("✅ BOOK ADDED:", result.insertedId);

    return res.status(201).json({
      success: true,
      message: "Book added successfully!",
      book: {
        _id: result.insertedId,
        ...bookData,
      },
    });
  } catch (error) {
    console.error("❌ Add Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add book.",
    });
  }
});

// =====================================
// GET ALL BOOKS
// =====================================
app.get("/all-books", async (req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      books,
    });
  } catch (error) {
    console.error("❌ Get All Books Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================
// GET SINGLE BOOK
// =====================================
app.get("/all-book/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    return res.status(200).json({
      success: true,
      book,
    });
  } catch (error) {
    console.error("❌ Get Single Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================
// GET MY BOOKS
// =====================================
app.get("/my-books/:userEmail", async (req, res) => {
  try {
    const userEmail = decodeURIComponent(req.params.userEmail)
      .trim()
      .toLowerCase();

    const books = await booksCollection
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      books,
    });
  } catch (error) {
    console.error("❌ Get My Books Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================
// GET MY BORROWS
// =====================================
app.get("/api/my-borrows", async (req, res) => {
  try {
    const userEmail = req.headers["x-user-email"];

    if (!userEmail || typeof userEmail !== "string") {
      return res.status(400).json({
        success: false,
        message: "User email is required.",
      });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    const borrows = await borrowsCollection
      .find({ borrowerEmail: normalizedEmail })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      borrows,
    });
  } catch (error) {
    console.error("❌ Get My Borrows Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load borrows.",
    });
  }
});

// =====================================
// EDIT BOOK
// =====================================
app.put("/edit-book/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;

    if (updateData.totalCopies !== undefined) {
      const copies = Number(updateData.totalCopies);

      if (!Number.isInteger(copies) || copies < 0) {
        return res.status(400).json({
          success: false,
          message: "Total copies cannot be negative.",
        });
      }

      updateData.totalCopies = copies;
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    const updatedBook = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      book: updatedBook,
    });
  } catch (error) {
    console.error("❌ Edit Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================
// DELETE BOOK
// =====================================
app.delete("/delete-book/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Delete Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================
// BORROW BOOK
// =====================================
app.post("/borrow-book", async (req, res) => {
  try {
    const {
      bookId,
      borrowerName,
      borrowerEmail,
      borrowedAt,
      returnBy,
      bookImageUrl,
    } = req.body;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    if (
      !borrowerName?.trim() ||
      !borrowerEmail?.trim() ||
      !borrowedAt ||
      !returnBy
    ) {
      return res.status(400).json({
        success: false,
        message: "Borrower information is missing.",
      });
    }

    const normalizedEmail = borrowerEmail.trim().toLowerCase();
    const objectBookId = new ObjectId(bookId);

    // Prevent duplicate active borrow
    const existingBorrow = await borrowsCollection.findOne({
      bookId: String(bookId),
      borrowerEmail: normalizedEmail,
      returned: { $ne: true },
    });

    if (existingBorrow) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book.",
      });
    }

    // Atomically decrease available copies
    const updateResult = await booksCollection.updateOne(
      {
        _id: objectBookId,
        totalCopies: { $gt: 0 },
      },
      {
        $inc: { totalCopies: -1 },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Book not found or no copies available.",
      });
    }

    const book = await booksCollection.findOne({
      _id: objectBookId,
    });

    const borrowData = {
      bookId: String(bookId),
      bookTitle: book.bookTitle,
      authorName: book.authorName,
      bookImageUrl: bookImageUrl || book.bookImageUrl || "",
      borrowerName: borrowerName.trim(),
      borrowerEmail: normalizedEmail,
      borrowedAt,
      returnBy,
      returned: false,
      createdAt: new Date(),
    };

    try {
      const result = await borrowsCollection.insertOne(borrowData);

      return res.status(201).json({
        success: true,
        message: "Book borrowed successfully.",
        borrowId: result.insertedId,
        borrow: {
          _id: result.insertedId,
          ...borrowData,
        },
      });
    } catch (insertError) {
      // Restore copy if borrow insertion fails
      await booksCollection.updateOne(
        { _id: objectBookId },
        { $inc: { totalCopies: 1 } }
      );

      throw insertError;
    }
  } catch (error) {
    console.error("❌ Borrow Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to borrow book.",
    });
  }
});

// =====================================
// RETURN BOOK
// =====================================
app.post("/return-book", async (req, res) => {
  try {
    const { bookId, borrowerEmail } = req.body;

    if (!bookId || !borrowerEmail) {
      return res.status(400).json({
        success: false,
        message: "Book ID and borrower email are required.",
      });
    }

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const normalizedEmail = borrowerEmail.trim().toLowerCase();

    const borrowRecord = await borrowsCollection.findOne({
      bookId: String(bookId),
      borrowerEmail: normalizedEmail,
      returned: { $ne: true },
    });

    if (!borrowRecord) {
      return res.status(404).json({
        success: false,
        message: "Active borrow record not found or already returned.",
      });
    }

    // Mark as returned only once
    const returnResult = await borrowsCollection.updateOne(
      {
        _id: borrowRecord._id,
        returned: { $ne: true },
      },
      {
        $set: {
          returned: true,
          returnedAt: new Date(),
        },
      }
    );

    if (returnResult.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "This book has already been returned.",
      });
    }

    const copyResult = await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { totalCopies: 1 } }
    );

    if (copyResult.matchedCount === 0) {
      await borrowsCollection.updateOne(
        { _id: borrowRecord._id },
        {
          $set: { returned: false },
          $unset: { returnedAt: "" },
        }
      );

      return res.status(404).json({
        success: false,
        message: "Book not found in database.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Book returned successfully.",
    });
  } catch (error) {
    console.error("❌ Return Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to return book.",
    });
  }
});

// =====================================
// DECREMENT COPIES
// =====================================
app.patch("/decrement-copies/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const result = await booksCollection.updateOne(
      {
        _id: new ObjectId(id),
        totalCopies: { $gt: 0 },
      },
      {
        $inc: { totalCopies: -1 },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Book not found or no copies left.",
      });
    }

    const updatedBook = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      totalCopies: updatedBook.totalCopies,
    });
  } catch (error) {
    console.error("❌ Decrement Copies Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================
// HOME ROUTE
// =====================================
app.get("/", (req, res) => {
  res.send("BookNook Backend Server is Running!");
});

// =====================================
// START SERVER
// =====================================
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server Startup Failed:", error);
    process.exit(1);
  }
}

startServer();
