var express = require('express');
var router = express.Router();
const { getDB } = require('../utils/db');
const { ObjectId } = require('mongodb');
var Razorpay = require('razorpay')

const instance = new Razorpay({
  key_id: 'rzp_test_abtbHcG3uQOFIj',
  key_secret: 'wvOtb8LH8Sb3sY6MJvuxGI44'
});

// Home page
router.get('/', async function (req, res) {
  try {
    const db = getDB();
    const products = await db.collection('product').find().toArray();

    if (req.session.logged && req.session.user) {
      const cart = await db.collection(req.session.user._id).find({ what: 'cart' }).toArray();
      const count = cart.length;
      res.render('index', { user: req.session.user, products, count });
    } else {
      res.render('index', { user: null, products, count: false });
    }
  } catch (err) {
    console.error('Error loading homepage:', err.message);
    res.status(500).send(`Error loading homepage.${err.message}`);
  }
});

// Signup
router.get('/signup', (req, res) => {
  if (req.session.logged && req.session.user) {
    return res.redirect('/');
  }
  res.render('signup', { admin: false });
});

router.post('/signup', async (req, res) => {
  try {
    const db = getDB();
    const { confirm, password, name, email } = req.body;

    if (password !== confirm) {
      return res.render('signup', { admin: false, err: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.render('signup', { admin: false, err: 'Password must be at least 6 characters long.' });
    }
    if (!name || !email || !password || !confirm) {
      return res.render('signup', { admin: false, err: 'All fields are required.' });
    }

    const existingUser = await db.collection('user').findOne({ email });
    if (existingUser) {
      return res.render('signup', { admin: false, err: 'Email already exists.' });
    }

    await db.collection('user').insertOne({ name, email, password });
    const user = await db.collection('user').findOne({ email });

    req.session.logged = true;
    req.session.user = user;
    res.redirect('/');
  } catch (err) {
    console.error('Error during signup:', err.message);
    res.status(500).send('Error during signup.');
  }
});

// Login
router.get('/login', (req, res) => {
  if (req.session.logged && req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { admin: false });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDB();
    const user = await db.collection('user').findOne({ email, password });

    if (user) {
      req.session.logged = true;
      req.session.user = user;
      res.redirect('/');
    } else {
      res.render('login', { admin: false, err: 'Invalid email or password.' });
    }
  } catch (err) {
    console.error('Error during login:', err.message);
    res.status(500).send('Error during login.');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error during logout:', err.message);
      return res.status(500).send('Error logging out.');
    }
    res.redirect('/');
  });
});

// Cart
router.get('/cart', async (req, res) => {
  if (!req.session.logged || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    const db = getDB();
    const cart = await db.collection(req.session.user._id).find({ what: 'cart' }).toArray();
    let details = [];
    let total = 0;

    for (const item of cart) {
      const product = await db.collection('product').findOne({ _id: new ObjectId(item.id) });
      if (product) {
        product.quantity = item.quantity;
        total += product.price * item.quantity;
        details.push(product);
      }
    }

    res.render('cart', { user: req.session.user, cart: details, total, count: cart.length });
  } catch (err) {
    console.error('Error loading cart:', err.message);
    res.status(500).send('Error loading cart.');
  }
});

// Add to Cart
router.get('/add-to-cart/:prodId/:userId', async (req, res) => {
  if (!req.session.logged || !req.session.user) {
    return res.redirect('/signup');
  }

  try {
    const { prodId, userId } = req.params;
    const db = getDB();

    const item = await db.collection(userId).findOne({ id: prodId, what: 'cart' });
    if (item) {
      await db.collection(userId).updateOne({ id: prodId, what: 'cart' }, { $inc: { quantity: 1 } });
    } else {
      await db.collection(userId).insertOne({ id: prodId, quantity: 1, what: 'cart' });
    }

    const cart = await db.collection(userId).find({ what: 'cart' }).toArray();
    res.json({ status: true, count: cart.length });
  } catch (err) {
    console.error('Error adding to cart:', err.message);
    res.json({ status: false, error: err.message });
  }
});

// Delete from Cart
router.get('/delete/:prodId/:userId', async (req, res) => {
  if (!req.session.logged || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    const { prodId, userId } = req.params;
    const db = getDB();

    await db.collection(userId).deleteOne({ id: prodId, what: 'cart' });
    res.redirect('/cart');
  } catch (err) {
    console.error('Error deleting item from cart:', err.message);
    res.status(500).send('Error deleting item from cart.');
  }
});

// Change Quantity
router.get('/change-quantity/:prodId/:userId/:quantity', async (req, res) => {
  try {
    const { prodId, userId, quantity } = req.params;
    const db = getDB();
    const qtyChange = parseInt(quantity, 10);

    const item = await db.collection(userId).findOne({ id: prodId, what: 'cart' });
    if (item) {
      const newQty = item.quantity + qtyChange;

      if (newQty <= 0) {
        await db.collection(userId).deleteOne({ id: prodId, what: 'cart' });
        return res.json({ status: true, delete: true });
      }

      await db.collection(userId).updateOne({ id: prodId, what: 'cart' }, { $set: { quantity: newQty } });
      res.json({ status: true, delete: false, quantity: newQty });
    } else {
      res.json({ status: false, error: 'Item not found' });
    }
  } catch (err) {
    console.error('Error changing quantity:', err.message);
    res.json({ status: false, error: err.message });
  }
});

// Place Order Page
router.get('/place-order', async (req, res) => {
  if (!req.session.logged || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    const db = getDB();
    const cart = await db.collection(req.session.user._id).find({ what: 'cart' }).toArray();
    let details = [];
    let total = 0;

    for (const item of cart) {
      const product = await db.collection('product').findOne({ _id: new ObjectId(item.id) });
      if (product) {
        product.quantity = item.quantity;
        total += product.price * item.quantity;
        details.push(product);
      }
    }

    res.render('place-order', { user: req.session.user, cartItems: details, total });
  } catch (err) {
    console.error('Error loading cart:', err.message);
    res.status(500).send('Error loading cart.');
  }
});

// Place Order POST (Handle Payment)
router.post('/place-order', async (req, res) => {
  let status = req.body.paymentMethod === 'cod' ? 'placed' : 'pending';

  // Check if user is logged in
  if (!req.session || !req.session.logged || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    req.session.details = req.body
      const db = getDB();
    const cart = await db.collection(req.session.user._id).find({ what: 'cart' }).toArray();

    if (cart.length === 0) {
      return res.status(400).json({ status: false, error: 'Cart is empty.' });
    }

    const productIds = cart.map((item) => new ObjectId(item.id));
    const existingProducts = await db.collection('product').find({ _id: { $in: productIds } }).toArray();
    const existingProductIds = new Set(existingProducts.map((p) => p._id.toString()));

    let details = [];
    let total = 0;

    for (const item of cart) {
      if (!existingProductIds.has(item.id)) {
        console.warn(`Product with ID ${item.id} not found.`);
        continue; // Skip missing products
      }

      const product = existingProducts.find((p) => p._id.toString() === item.id);
      product.quantity = item.quantity;
      total += product.price * item.quantity;
      details.push(product);
    }

    if (details.length === 0) {
      return res.status(400).json({ status: false, error: 'No valid products in the cart.' });
    }

    if (req.body.paymentMethod === 'razorpay') {
      console.log('pass')
      // Create Razorpay Order
      const options = {
        amount: total * 100, // Razorpay expects the amount in paise (1 INR = 100 paise)
        currency: 'INR',
        receipt: `order_${new Date().getTime()}`,
      };

      instance.orders.create(options, async (err, order) => {
        if (err) {
          console.error('Error creating Razorpay order:', err);
          return res.status(500).json({ status: false, error: 'Error creating Razorpay order.' });
        }

        // Store order details in DB
        await db.collection('orders').insertOne({
          userId: req.session.user._id,
          products: cart,
          total,
          status: 'pending',
          paymentId: order.id,
        });
        
        
        res.json({
          status: true,
          orderId: order.id,
          amount: total * 100,
          currency: 'INR',
          paymentMethod: 'razorpay'
        });
      });
    } else if (req.body.paymentMethod === 'cod') {
      // Store order details with 'placed' status for Cash on Delivery
      await db.collection('orders').insertOne({
        userId: req.session.user._id,
        products: cart,
        total,
        status: 'placed',
        paymentId: 'cod',
      });

      // Clear the cart after order is placed
      await db.collection(req.session.user._id).deleteMany({ what: 'cart' });

      res.json({ status: true, message: 'Order placed successfully. Please await delivery.' });
    }
  } catch (err) {
    console.error('Error placing order:', err.message);
    res.status(500).json({ status: false, error: 'Error placing order.' });
  }
});

// Handle Razorpay Payment Success
router.post('/payment-success', async (req, res) => {
  try {
    console.log(req.body)
    const paymentId = req.body.razorpay_payment_id;
    const orderId = req.body.razorpay_order_id;
   req.body = req.session.details
   const db = getDB();
    const cart = await db.collection(req.session.user._id).find({ what: 'cart' }).toArray();

    if (cart.length === 0) {
      return res.status(400).json({ status: false, error: 'Cart is empty.' });
    }

    const productIds = cart.map((item) => new ObjectId(item.id));
    const existingProducts = await db.collection('product').find({ _id: { $in: productIds } }).toArray();
    const existingProductIds = new Set(existingProducts.map((p) => p._id.toString()));

    let details = [];
    let total = 0;

    for (const item of cart) {
      if (!existingProductIds.has(item.id)) {
        console.warn(`Product with ID ${item.id} not found.`);
        continue; // Skip missing products
      }

      const product = existingProducts.find((p) => p._id.toString() === item.id);
      product.quantity = item.quantity;
      total += product.price * item.quantity;
      details.push(product);
    }

    if (details.length === 0) {
      return res.status(400).json({ status: false, error: 'No valid products in the cart.' });
    }

    const admins = await db.collection('admin').find().toArray();
    if (admins.length === 0) {
      throw new Error('No admins found in the database.');
    }

    let lastResult = null;
    for (let admin of admins) {
      console.log(admin)
      const toOne = []
      for (let product of details) {
        console.log(product)
        if (admin._id == product.admin) {
          toOne.push(product)
          console.log('pass')
        }
      }
      console.log(toOne)
      if (toOne.length === 0) {
        continue;
      }
      console.log(admin)
      const orderData = {
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone,
          address: req.body.address,
          city: req.body.city,
          country: req.body.country,
          pincode: req.body.pincode,
          user: req.session.user._id,
          date: new Date(),
          prod: toOne,
          what: 'order',
          how: req.body.paymentMethod,
          progress: 'none',
      };
      
      // Ensure the collection name is a string
      const collectionName = admin._id.toString();
      
      const result = await db.collection(collectionName).insertOne(orderData);
      lastResult = result;
      req.session.insert = result.insertedId
      req.session.adminId = admin._id
      console.log(result)

      let r = await db.collection(req.session.user._id).insertOne({
        ...orderData,
        orderId: result.insertedId,
        progress: 'none',
      });
      req.session.inserted = r.insertedId
    }
    if (!paymentId || !orderId) {
      return res.status(400).json({ status: false, error: 'Payment ID or Order ID missing.' });
    }

    
    
    const order = await db.collection('orders').findOne({ paymentId: orderId });
    if (!order) {
      return res.status(404).json({ status: false, error: 'Order not found.' });
    }

    // Verify the payment details with Razorpay (Optional step, depending on your flow)
    const paymentVerification = await instance.payments.fetch(paymentId);

    if (paymentVerification.status === 'captured') {
      // Update the order status to 'paid'
      await db.collection('orders').updateOne(
        { paymentId: orderId },
        { $set: { status: 'paid', paymentDetails: paymentVerification } }
      );

      // Clear the user's cart after successful payment
      await db.collection(req.session.user._id).deleteMany({ what: 'cart' });

      res.json({ status: true, message: 'Payment successful. Order is now confirmed.' });
    } else {
      await db.collection(req.session.user._id).deleteMany({ what: 'order' , _id : new ObjectId(req.session.inserted)});
      await db.collection(req.session.adminId).deleteMany({ what: 'order' , _id : new ObjectId(req.session.insert)});
      res.status(400).json({ status: false, error: 'Payment failed.' });
    }
  } catch (err) {
    console.error('Error during payment success:', err.message);
    res.status(500).json({ status: false, error: 'Error during payment verification.' });
  }
});

router.get('/success', async (req, res) => {
  res.render('success', {success:true,id: req.session.insert})
});


router.get('/failure', async (req, res) => {
  res.render('failure')
});
  
  
// Handle Razorpay Payment Failure
router.post('/payment-failure', async (req, res) => {
  let db = getDB()
  await db.collection(req.session.user._id).deleteMany({ what: 'order' , _id : new ObjectId(req.session.inserted)});
  await db.collection(req.session.adminId).deleteMany({ what: 'order' , _id : new ObjectId(req.session.insert)});
  console.error('Payment failed:', req.body);
  res.status(500).json({ status: false, message: 'Payment failed. Please try again.' });
});

router.get('/orders', async (req, res) => {
  if (!req.session || !req.session.logged || !req.session.user) {
    return res.redirect('/login');
  }
  let user = req.session.user
  let db = getDB()
  
  let orders = await db.collection(user._id).find({what: 'order'}).toArray()
  res.render('orders', {orders, user , logged: req.session.logged, count: orders.length})
});

router.get('/order-details/:id', async (req, res) => {
  if (!req.session || !req.session.logged || !req.session.user) {
    return res.redirect('/login');
  }
  let user = req.session.user
  let db = getDB()
  
  let order = await db.collection(user._id).findOne({ _id: new ObjectId(req.params.id), what: 'order' });
  console.log(order);
  let progres;
  if (order.progress === 'none') {
    progres = 10
  } else if (order.progress === 'received') {
    progres = 40
  } else if (order.progress === 'shipped') {
    progres = 70
  } else if (order.progress === 'deliveried') {
    progres = 100
  }
  
  let cancel = order.progress === 'deliveried' ? false : true
  
  res.render('order-details', { ...order, user, logged: req.session.logged, progres, cancel });
});
  
  
router.get('/edit-order/:orderId', async (req, res) => {
  if (req.session.logged && req.session.user) {
      let db = getDB()
      console.log(req.session.user)
      console.log(req.params.orderId)
      let order = await db.collection(req.session.user._id).findOne({what: 'order',orderId: new ObjectId(req.params.orderId)})
      console.log(order)
      res.render('edit-order', { ...order });
    } else {
      res.redirect('/login')
    }
  
});


router.post('/edit-order/:orderId', async (req, res) => {
  if (!req.session.logged && !req.session.user) {
    return res.redirect('/');
  }
  let db = getDB()
  let updatedFields = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      country: req.body.country,
      pincode: req.body.pincode,
    };

  
  
  
    const ord = await db.collection(req.session.user._id).findOne({ what: 'order', orderId: new ObjectId(req.params.orderId)});
    
    const cart = []
    
    for (const eachprod of ord.prod) {
      let id = eachprod._id.toString()
      let quantity = eachprod.quantity
      cart.push({id,quantity})
    }

    if (cart.length === 0) {
      return res.status(400).json({ status: false, error: 'Cart is empty.' });
    }

    const productIds = cart.map((item) => new ObjectId(item.id));
    const existingProducts = await db.collection('product').find({ _id: { $in: productIds } }).toArray();
    const existingProductIds = new Set(existingProducts.map((p) => p._id.toString()));

    let details = [];
    let total = 0;

    for (const item of cart) {
      if (!existingProductIds.has(item.id)) {
        console.warn(`Product with ID ${item.id} not found.`);
        continue; // Skip missing products
      }

      const product = existingProducts.find((p) => p._id.toString() === item.id);
      product.quantity = item.quantity;
      total += product.price * item.quantity;
      details.push(product);
    }

    if (details.length === 0) {
      return res.status(400).json({ status: false, error: 'No valid products in the cart.' });
    }

    const admins = await db.collection('admin').find().toArray();
    if (admins.length === 0) {
      throw new Error('No admins found in the database.');
    }

    let lastResult = null;
    for (let admin of admins) {
      console.log(admin)
      const toOne = []
      for (let product of details) {
        console.log(product)
        if (admin._id == product.admin) {
          toOne.push(product)
          console.log('pass')
        }
      }
      console.log(toOne)
      if (toOne.length === 0) {
        continue;
      }
      console.log(admin)
      
      // Ensure the collection name is a string
      const collectionName = admin._id.toString();
      
      const result = await db.collection(req.session.user._id).updateOne({orderId: new ObjectId(req.params.orderId)}, { $set: updatedFields } )

      await db.collection(req.session.user._id).updateOne({orderId: new ObjectId(req.params.orderId)}, { $set: { ...updatedFields,
              progress: 'none',
            }
      })
    }
    
    
  res.render('success', {edit:true, id: req.params.orderId})
});

router.get('/delete-order/:orderId', async (req, res) => {
  if (!req.session.logged && !req.session.user) {
    return res.redirect('/login');
  }
  
  let db = getDB()
  
  
  const ord = await db.collection(req.session.user._id).findOne({ what: 'order', orderId: new ObjectId(req.params.orderId)});
    
    const cart = []
    
    for (const eachprod of ord.prod) {
      let id = eachprod._id.toString()
      let quantity = eachprod.quantity
      cart.push({id,quantity})
    }

    if (cart.length === 0) {
      return res.status(400).json({ status: false, error: 'Cart is empty.' });
    }

    const productIds = cart.map((item) => new ObjectId(item.id));
    const existingProducts = await db.collection('product').find({ _id: { $in: productIds } }).toArray();
    const existingProductIds = new Set(existingProducts.map((p) => p._id.toString()));

    let details = [];
    let total = 0;

    for (const item of cart) {
      if (!existingProductIds.has(item.id)) {
        console.warn(`Product with ID ${item.id} not found.`);
        continue; // Skip missing products
      }

      const product = existingProducts.find((p) => p._id.toString() === item.id);
      product.quantity = item.quantity;
      total += product.price * item.quantity;
      details.push(product);
    }

    if (details.length === 0) {
      return res.status(400).json({ status: false, error: 'No valid products in the cart.' });
    }

    const admins = await db.collection('admin').find().toArray();
    if (admins.length === 0) {
      throw new Error('No admins found in the database.');
    }

    let lastResult = null;
    for (let admin of admins) {
      console.log(admin)
      const toOne = []
      for (let product of details) {
        console.log(product)
        if (admin._id == product.admin) {
          toOne.push(product)
          console.log('pass')
        }
      }
      console.log(toOne)
      if (toOne.length === 0) {
        continue;
      }
      console.log(admin)
      
      // Ensure the collection name is a string
      const collectionName = admin._id.toString();
      
      await db.collection(req.session.user._id).deleteOne({orderId: new ObjectId(req.params.orderId)})

      await db.collection(req.session.user._id).deleteOne({orderId: new ObjectId(req.params.orderId)})
    }
    
    
  res.render('success', {delete: true, id: req.params.orderId})
});

module.exports = router;