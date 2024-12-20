const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const logger = require('morgan');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const createError = require('http-errors');

const adminRouter = require('./routes/admin');
const usersRouter = require('./routes/user');
const masterAdminRouter = require('./routes/master-admin');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(session({
    secret: 'e2b8a1f1cabc2d4f8c6e7d8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c',
    resave: false,
    saveUninitialized: true,
    cookie: {
       maxAge: 1000 * 60 * 60 * 24 * 15,
       httpOnly: true,
       secure: true, // Use HTTPS
       sameSite: 'lax'
  }
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());
const hbs = require('hbs'); // or handlebars
// Register the partials directory
hbs.registerPartials(path.join(__dirname, '/views/partials'));

app.use('/', usersRouter);
app.use('/', adminRouter);
app.use('/', masterAdminRouter);

app.use((req, res, next) => {
    next(createError(404));
});

app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;