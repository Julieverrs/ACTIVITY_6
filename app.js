const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session'); // Add session

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up session
app.use(session({
  secret: 'your_secret_key', // Change this to a strong secret
  resave: false,
  saveUninitialized: true
}));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads'); // Set upload directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename the file
  }
});
const upload = multer({ storage });

// Create upload directory if it doesn't exist
const dir = './public/uploads';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Replace with your MySQL username
  password: '', // Replace with your MySQL password
  database: 'ecommerce'
});

db.connect(err => {
  if (err) throw err;
  console.log('Connected to the database.');
});

// Routes
app.get('/', (req, res) => res.render('index'));
app.get('/create-account', (req, res) => res.render('create-account'));
app.get('/login', (req, res) => {
  res.render('login', { errorMessage: undefined });
});
app.get('/home', (req, res) => res.render('home'));

// Men’s Apparel
app.get('/men-apparel', (req, res) => {
  db.query('SELECT * FROM products WHERE category = "men"', (err, results) => {
    if (err) throw err;
    res.render('men-apparel', { products: results });
  });
});

// Women’s Apparel
app.get('/women-apparel', (req, res) => {
  db.query('SELECT * FROM products WHERE category = "women"', (err, results) => {
    if (err) throw err;
    res.render('women-apparel', { products: results });
  });
});

// Profile
app.get('/profile', (req, res) => {
  if (!req.session.email) {
    return res.redirect('/login'); // Redirect if not logged in
  }
  res.render('profile', { email: req.session.email });
});

// Add Product Route
app.get('/add-product', (req, res) => res.render('add-product'));
app.post('/add-product', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.'); // Handle file upload error
  }

  const { productName, productPrice, productDescription, category } = req.body;
  const image = '/uploads/' + req.file.filename; // Set the image path

  // Insert data into the database
  db.query(
    'INSERT INTO products (name, category, price, description, image) VALUES (?, ?, ?, ?, ?)',
    [productName, category, productPrice, productDescription, image],
    (err) => {
      if (err) {
        console.error(err); // Log the error for debugging
        return res.status(500).send('Error adding product to the database.'); // Handle DB insertion error
      }
      res.redirect('/home'); // Redirect to the appropriate page after successful addition
    }
  );
});

// Cart Route
app.get('/cart', (req, res) => {
  db.query(
    'SELECT products.*, cart.id AS cart_id, COUNT(cart.product_id) as quantity FROM cart JOIN products ON cart.product_id = products.id GROUP BY cart.id',
    (err, results) => {
      if (err) throw err;
      res.render('cart', { cartItems: results });
    }
  );
});

// Add to Cart
app.post('/add-to-cart', (req, res) => {
  const productId = req.body.product_id; // Get the product ID from the form
  db.query('INSERT INTO cart (user_id, product_id) VALUES (?, ?)', [1, productId], (err) => { // Assume user_id is 1 for demo
    if (err) throw err;
    res.redirect('/home'); // Redirect back to Men’s Apparel or modify as needed
  });
});

// Remove from Cart
app.post('/remove-from-cart', (req, res) => {
  const cartId = req.body.cart_id; // Get the cart ID from the form
  db.query('DELETE FROM cart WHERE id = ?', [cartId], (err) => {
    if (err) throw err;
    res.redirect('/cart'); // Redirect back to cart
  });
});

// Handle account creation
app.post('/create-account', (req, res) => {
  const { name, email, password } = req.body;
  db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
  [name, email, password], (err) => {
    if (err) throw err;
    res.redirect('/login');
  });
});

// Handle login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.render('login', { errorMessage: 'Unregistered email. Please create an account.' });
    }

    const user = results[0];
    if (user.password !== password) {
      return res.render('login', { errorMessage: 'Incorrect password. Please try again.' });
    }

    req.session.email = user.email;
    res.redirect('/home');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) throw err;
    res.redirect('/login');
  });
});

// Search Route
app.get('/search', (req, res) => {
    const query = req.query.query;
    db.query('SELECT * FROM products WHERE name LIKE ?', [`%${query}%`], (err, results) => {
      if (err) throw err;
      res.render('search-results', { products: results, query });
    });
  });
// Search Suggestions Route
app.get('/search-suggestions', (req, res) => {
    const query = req.query.query;
    db.query('SELECT * FROM products WHERE name LIKE ?', [`%${query}%`], (err, results) => {
        if (err) throw err;
        res.json(results); // Send back the results as JSON
    });
});


// Product Details Route
app.get('/product/:id', (req, res) => {
  const productId = req.params.id;
  db.query('SELECT * FROM products WHERE id = ?', [productId], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      res.render('product-details', { product: results[0] });
    } else {
      res.send('Product not found');
    }
  });
});

// Update Quantity Route
app.post('/update-quantity', (req, res) => {
  const cartId = req.body.cart_id;
  const quantity = req.body.quantity;

  db.query('UPDATE cart SET quantity = ? WHERE id = ?', [quantity, cartId], (err) => {
    if (err) throw err;
    res.redirect('/cart');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
