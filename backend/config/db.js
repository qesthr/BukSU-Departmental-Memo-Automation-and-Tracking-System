const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Disable mongoose buffering before connecting (fail fast if not connected)
        mongoose.set('bufferCommands', false);
        
        // Optimize connection settings for better performance
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Connection pool settings
            maxPoolSize: 10, // Maximum number of connections in the pool
            minPoolSize: 2, // Minimum number of connections to maintain
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            
            // Timeout settings
            serverSelectionTimeoutMS: 10000, // How long to try selecting a server (10 seconds)
            socketTimeoutMS: 45000, // How long to wait for socket operations (45 seconds)
            connectTimeoutMS: 10000, // How long to wait for initial connection (10 seconds)
            
            // Other optimizations
            retryWrites: true, // Retry write operations on network errors
            retryReads: true, // Retry read operations on network errors
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Monitor connection events for debugging
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;