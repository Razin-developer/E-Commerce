var express = require("express");
var router = express.Router();
const { getDB } = require("../utils/db");
const { ObjectId } = require("mongodb");

// render pages
router.get("/master-admin", async (req, res) => {
  let db = getDB();
  let users = await db.collection("user").find().toArray();
  let admins = await db.collection("admin").find().toArray();
  let products = await db.collection("product").find().toArray();
  res.render("master/index", {
    user: users.length,
    admin: admins.length,
    product: products.length
  });
});

router.get("/master-user", async (req, res) => {
  let db = getDB();
  let users = await db.collection("user").find().toArray();
  console.log(users);
  res.render("master/user", { users });
});

router.get("/master-admins", async (req, res) => {
  let db = getDB();
  let admins = await db.collection("admin").find().toArray();
  res.render("master/admin", { admins });
});

router.get("/master-product", async (req, res) => {
  let db = getDB();
  let products = await db.collection("product").find().toArray();
  console.log(products);
  res.render("master/product", { products });
});

router.get("/master-cart", async (req, res) => {
  try {
    let details = [];
    let db = getDB();
    let users = await db.collection("user").find().toArray();
    for (const user of users) {
      const cart = await db
        .collection(user._id.toString())
        .find({ what: "cart" })
        .toArray();
      if (cart.length > 0) {
        details.push({ ...user, cart, no: cart.length });
      }
    }

    console.log(details);
    res.render("master/cart", { details });
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

router.get("/master-order", async (req, res) => {
  try {
    let details = [];
    let db = getDB();
    let admins = await db.collection("admin").find().toArray();
    for (const admin of admins) {
      const order = await db
        .collection(admin._id.toString())
        .find({ what: "order" })
        .toArray();
      if (order.length > 0) {
        details.push({ ...admin, order, no: order.length });
      }
    }
    res.render("master/order", { details });
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

// delete All Route
router.get("/master-delete-all-user", async (req, res) => {
  let db = getDB();
  await db.collection("user").deleteMany();
  res.redirect("/master-user");
});

router.get("/master-delete-all-admin", async (req, res) => {
  let db = getDB();
  await db.collection("admin").deleteMany();
  res.redirect("/master-admins");
});

router.get("/master-delete-all-product", async (req, res) => {
  let db = getDB();
  await db.collection("product").deleteMany();
  res.redirect("/master-product");
});

router.get("/master-delete-all-cart", async (req, res) => {
  try {
    let db = getDB();
    let users = await db.collection("user").find().toArray();
    for (const user of users) {
      await db.collection(user._id.toString()).deleteMany({ what: "cart" });
    }
    res.render("master/cart");
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

router.get("/master-delete-all-order", async (req, res) => {
  try {
    let db = getDB();
    let admins = await db.collection("admin").find().toArray();
    let users = await db.collection("user").find().toArray();
    let deleteOrders;
    for (const admin of admins) {
      deleteOrders = await db
        .collection(admin._id.toString())
        .find({ what: "order" })
        .toArray();
      await db.collection(admin._id.toString()).deleteMany({ what: "order" });
    }
    for (const each of deleteOrders) {
      await db
        .collection(each.user)
        .deleteMany({ orderId: each._id, what: "order" });
    }

    res.render("master/order");
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

// delete Some Route

// delete Some user Route
router.get("/delete-user/:id", async (req, res) => {
  let db = getDB();
  await db.collection("user").deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect("/master-user");
});

// delete Some admin Route
router.get("/delete-admin/:id", async (req, res) => {
  let db = getDB();
  await db.collection("admin").deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect("/master-admins");
});

// delete Some product Route
router.get("/master-edit-product/:prodId/:adminId", async (req, res) => {
  try {
    const db = getDB();
    const product = await db
      .collection("product")
      .findOne({ _id: new ObjectId(req.params.prodId) });

    res.render("master/edit-product", { product, adminId: req.params.adminId });
  } catch (error) {
    console.error("Error fetching product for editing:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/master-edit-product/:prodId/:adminId", async (req, res) => {
  try {
    const db = getDB();
    const { prodId, adminId } = req.params;

    let updatedFields = {
      name: req.body.name,
      category: req.body.category,
      des: req.body.des,
      price: req.body.price,
      admin: adminId
    };

    await db
      .collection("product")
      .updateOne({ _id: new ObjectId(prodId) }, { $set: updatedFields });

    updatedFields = {
      name: req.body.name,
      category: req.body.category,
      des: req.body.des,
      price: req.body.price,
      what: "product"
    };

    await db
      .collection(adminId)
      .updateOne({ _id: new ObjectId(prodId) }, { $set: updatedFields });

    if (req.files && req.files.image) {
      const image = req.files.image;
      await image.mv(`./public/images/products/${prodId}.jpg`);
    }

    res.redirect("/master-product");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/master-delete-product/:prodId/:adminId", async (req, res) => {
  try {
    const db = getDB();
    const { prodId, adminId } = req.params;

    await db.collection("product").deleteOne({ _id: new ObjectId(prodId) });
    await db.collection(adminId).deleteOne({ _id: new ObjectId(prodId) });

    res.redirect("/master-product");
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).send("Internal Server Error");
  }
});

// delete Some cart Route
router.get("/master-view-products/:id", async (req, res) => {
  try {
    const db = getDB();
    const cart = await db
      .collection(req.params.id)
      .find({ what: "cart" })
      .toArray();
    let details = [];
    let total = 0;

    for (const item of cart) {
      const product = await db
        .collection("product")
        .findOne({ _id: new ObjectId(item.id) });
      if (product) {
        product.quantity = item.quantity;
        total += product.price * item.quantity;
        details.push(product);
      }
    }

    res.render("master/cart-products", {
      cart: details,
      total,
      user: req.params.id
    });
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

router.get("/delete-one-cart/:prodId/:userId", async (req, res) => {
  try {
    const db = getDB();
    const cart = await db
      .collection(req.params.userId)
      .deleteOne({ what: "cart", id: req.params.prodId });

    res.redirect(`/master-view-products/${req.params.userId}`);
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

router.get("/master-delete-cart/:userId", async (req, res) => {
  try {
    const db = getDB();
    const cart = await db
      .collection(req.params.userId)
      .deleteMany({ what: "cart" });

    res.redirect(`/master-cart`);
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

// delete Some order Route
router.get("/master-view-orders/:id", async (req, res) => {
  try {
    const db = getDB();
    const orders = await db
      .collection(req.params.id)
      .find({ what: "order" })
      .toArray();

    res.render("master/order-details-sub", { orders, admin: req.params.id });
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

router.get("/master-order-details/:adminId/:id", async (req, res) => {
  try {
    const db = getDB();
    const order = await db
      .collection(req.params.adminId)
      .findOne({ _id: new ObjectId(req.params.id), what: "order" });
    console.log({ ...order });
    if (order.progress === "none" || !order.progress) {
      res.render("master/order-details", {
        order,
        none: true,
        admin: req.params.adminId
      });
    } else if (order.progress === "received") {
      res.render("master/order-details", {
        order,
        received: true,
        admin: req.params.adminId
      });
    } else if (order.progress === "shipped") {
      res.render("master/order-details", {
        order,
        shipped: true,
        admin: req.params.adminId
      });
    } else if (order.progress === "deliveried") {
      res.render("master/order-details", {
        order,
        deliveried: true,
        admin: req.params.adminId
      });
    }
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).send("Error loading cart.");
  }
});

router.post("/master-update-order/:orderId/:adminId", async (req, res) => {
  let orderId = req.params.orderId;
  let db = getDB();
  console.log(req.body);
  await db
    .collection(req.params.adminId)
    .updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { progress: req.body.progress } }
    );
  let order = await db
    .collection(req.params.adminId)
    .findOne({ what: "order", _id: new ObjectId(orderId) });
  await db
    .collection(order.user)
    .updateOne(
      { orderId: new ObjectId(orderId) },
      { $set: { progress: req.body.progress } }
    );
  console.log("pass");
  res.json({ status: true });
});

router.post("/master-delete-order/:orderId/:adminId", async (req, res) => {
  let orderId = req.params.orderId;
  let db = getDB();
  console.log(req.body);
  let admin = await db
    .collection(req.params.adminId)
    .findOne({ _id: new ObjectId(orderId) });
  await db
    .collection(req.params.adminId)
    .deleteOne({ _id: new ObjectId(orderId) });
  let de = await db
    .collection(admin.user)
    .deleteOne({ _id: new ObjectId(orderId) });
  console.log(de);
  res.json({ status: true });
});

router.get("/master-delete-orders/:adminId", async (req, res) => {
  let adminId = req.params.adminId;
  let db = getDB();
  let orders = await db.collection(adminId).find({ what: "order" }).toArray();
  await db.collection(req.params.adminId).deleteMany({ what: "order" });
  for (const order of orders) {
    let de = await db
      .collection(order.user)
      .deleteOne({ orderId: new ObjectId(order._id) });
    console.log(de);
  }
  res.json({ status: true });
});

module.exports = router;
