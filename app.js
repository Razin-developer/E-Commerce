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

const MongoStore = require('connect-mongo');

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB,
        collectionName: 'sessions',
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
        httpOnly: true,
        secure: false, // Set to true in production
        sameSite: 'lax',
    },
}));
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