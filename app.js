const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const app = express();
const port = 5000;

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/css', express.static(path.join(__dirname, 'frontend/public/css')));
app.use('/images', express.static(path.join(__dirname, 'frontend/public/images')));
app.use('/js', express.static(path.join(__dirname, 'frontend/public/js')));

// Set up EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/views'));
app.set('layout', path.join(__dirname, 'frontend/components/layouts/Loginlayout.ejs'));

// Routes
app.get('/', (req, res) => {
    res.render('login'); // frontend/views/login.ejs
});

// Start server
app.listen(port, () => console.info(`App listening on port ${port}`));
