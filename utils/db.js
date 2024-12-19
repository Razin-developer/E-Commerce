const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB; // Replace with your MongoDB connection string
const client = new MongoClient(uri);

let db;

async function connectToDB() {
    try {
        if (!db) {
            await client.connect();
            db = client.db("ecommerce"); // Replace with your database name
            console.log("Connected to MongoDB");
        }
        return db;
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

function getDB() {
    if (!db) {
        throw new Error("Database not connected. Call connectToDB first.");
    }
    return db;
}

module.exports = { connectToDB, getDB };