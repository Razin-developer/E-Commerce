var express = require('express');
var router = express.Router();
const { getDB } = require('../utils/db');
const { ObjectId } = require('mongodb');

/* GET admin page */
router.get('/admin', async (req, res) => {
  try {
    if (req.session.logged && req.session.admin) {
      const db = getDB();
      const products = await db
        .collection(req.session.admin._id)
        .find({ what: 'product' })
        .toArray();
      res.render('admin/index', { logged: true ,admin: req.session.admin, details: products });
    } else {
      res.redirect('/admin-login');
    }
  } catch (error) {
    console.error('Error fetching admin page:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Admin signup page */
router.get('/admin-signup', (req, res) => {
  if (req.session.logged && req.session.admin) {
    res.redirect('/admin');
  } else {
    res.render('signup', { admin: true });
  }
});

/* Handle admin signup */
router.post('/admin-signup', async (req, res) => {
  try {
    const { confirm, password, name, email } = req.body;
    if (confirm !== password) {
      return res.render('signup', { admin: true, err: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.render('signup', { admin: true, err: 'Password must be at least 6 characters long' });
    }

    const db = getDB();
    const adminData = { name, email, password };

    // Insert admin data
    const result = await db.collection('admin').insertOne(adminData);
    const admin = await db.collection('admin').findOne({ _id: result.insertedId });

    req.session.logged = true;
    req.session.admin = admin;

    res.redirect('/admin');
  } catch (error) {
    console.error('Error during admin signup:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Admin login page */
router.get('/admin-login', (req, res) => {
  if (req.session.logged && req.session.admin) {
    res.redirect('/admin');
  } else {
    res.render('login', { admin: true });
  }
});

/* Handle admin login */
router.post('/admin-login', async (req, res) => {
  try {
    const db = getDB();
    const admin = await db.collection('admin').findOne(req.body);

    if (admin) {
      req.session.admin = admin;
      req.session.logged = true;
      res.redirect('/admin');
    } else {
      res.render('login', { admin: true, err: 'Admin not found or invalid credentials' });
    }
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Handle admin logout */
router.get('/admin-logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      res.status(500).send('Logout failed');
    } else {
      res.redirect('/admin-login');
    }
  });
});

/* Add product page */
router.get('/add-product', (req, res) => {
  if (req.session.logged && req.session.admin) {
    res.render('admin/add-product', { id: req.session.admin._id });
  } else {
    res.redirect('/admin-login');
  }
});

/* Handle add product */
router.post('/add-product/:id', async (req, res) => {
  try {
    const db = getDB();
    const adminId = req.params.id;
    const product = { ...req.body, admin: adminId, what: 'product' };

    const result = await db.collection('product').insertOne(product);
    const productId = result.insertedId;

    await db.collection(adminId).insertOne({ ...product, _id: productId });

    if (req.files && req.files.image) {
      const image = req.files.image;
      await image.mv(`./public/images/products/${productId}.jpg`);
    }

    res.redirect('/admin');
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Edit product page */
router.get('/edit-product/:prodId/:adminId', async (req, res) => {
  try {
    const db = getDB();
    const product = await db.collection('product').findOne({ _id: new ObjectId(req.params.prodId) });

    res.render('admin/edit-product', { product, adminId: req.params.adminId });
  } catch (error) {
    console.error('Error fetching product for editing:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Handle edit product */
router.post('/edit-product/:prodId/:adminId', async (req, res) => {
  try {
    const db = getDB();
    const { prodId, adminId } = req.params;

    let updatedFields = {
      name: req.body.name,
      category: req.body.category,
      des: req.body.des,
      price: req.body.price,
      admin: adminId,
    };

    await db.collection('product').updateOne({ _id: new ObjectId(prodId) }, { $set: updatedFields });

     updatedFields = {
      name: req.body.name,
      category: req.body.category,
      des: req.body.des,
      price: req.body.price,
      what: 'product',
    };
    
    await db.collection(adminId).updateOne({ _id: new ObjectId(prodId) }, { $set: updatedFields });

    if (req.files && req.files.image) {
      const image = req.files.image;
      await image.mv(`./public/images/products/${prodId}.jpg`);
    }

    res.redirect('/admin');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Handle delete product */
router.get('/delete-product/:prodId/:adminId', async (req, res) => {
  try {
    const db = getDB();
    const { prodId, adminId } = req.params;

    await db.collection('product').deleteOne({ _id: new ObjectId(prodId) });
    await db.collection(adminId).deleteOne({ _id: new ObjectId(prodId) });

    res.redirect('/admin');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/admin-orders', async (req, res) => {
  console.log(`${req.session.logged}\n${req.session.admin}`)
  if (req.session.logged && req.session.admin) {
  let db = getDB()
  let order = await db.collection(req.session.admin._id).find({what: 'order'}).toArray()
  let all = await db.collection(req.session.admin._id).find().toArray()
  console.log(order)
  console.log(all)
  res.render('admin/orders', { logged: true ,admin: req.session.admin, order });
  } else {
    res.redirect('/admin-login');
  }
})

router.get('/admin-order-details/:orderId', async (req, res) => {
  console.log(`${req.session.logged}\n${req.session.admin}`)
  if (req.session.logged && req.session.admin) {
  let orderId = req.params.orderId;
  let db = getDB()
  let order = await db.collection(req.session.admin._id).findOne({_id: new ObjectId(orderId), what: 'order'})
  console.log(order)
  console.log(order.prod)
  if (order.progress === 'none' || !order.progress) {
    res.render('admin/order-details',{ order,logged: req.session.logged, admin: req.session.admin,none:true})
  } else if (order.progress === 'received') {
     res.render('admin/order-details',{ order,logged: req.session.logged, admin: req.session.admin, received: true})
  } else if (order.progress === 'shipped') {
     res.render('admin/order-details',{ order,logged: req.session.logged, admin: req.session.admin,shipped: true})
  } else if (order.progress === 'deliveried') {
     res.render('admin/order-details',{ order,logged: req.session.logged, admin: req.session.admin,deliveried: true})
  } 
  } else {
    res.redirect('/admin-login');
  }
});

router.post('/admin-update-order/:orderId', async (req, res) => {
  let orderId = req.params.orderId
  let db = getDB()
  console.log(req.body)
  await db.collection(req.session.admin._id).updateOne(
    {_id: new ObjectId(orderId)},
    { $set : {progress: req.body.progress}})
  let order =  await db.collection(req.session.admin._id).findOne(
    {what: 'order', _id: new ObjectId(orderId)})
  await db.collection(order.user).updateOne(
    {orderId: new ObjectId(orderId)},
    { $set : {progress: req.body.progress}})
  console.log('pass')
  res.json({status:true})
});

router.post('/admin-delete-order/:orderId', async (req, res) => {
  let orderId = req.params.orderId
  let db = getDB()
  console.log(req.body)
  let admin = db.collection(req.session.admin._id).deleteOne(
    {_id: new ObjectId(orderId)})
  console.log('pass')
  res.json({status:true})
});


module.exports = router;