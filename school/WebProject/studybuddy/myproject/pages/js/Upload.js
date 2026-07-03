const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.send('File uploaded successfully!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
    //console.log(`Server running on http://localhost:${PORT}`);
});
