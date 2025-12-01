const mongoose = require('mongoose');
/* eslint-disable no-console */

/**
 * Get the active MongoDB URI
 * Supports switching between two databases via MONGODB_ACTIVE or fallback
 */
function getMongoURI() {
    // Option 1: Explicitly set which database to use
    const activeDB = process.env.MONGODB_ACTIVE; // 'primary' or 'secondary'

    if (activeDB === 'secondary' && process.env.MONGODB_URI_SECONDARY) {
        console.log('📊 Using SECONDARY MongoDB (MONGODB_URI_SECONDARY)');
        return process.env.MONGODB_URI_SECONDARY;
    }

    if (activeDB === 'primary' && process.env.MONGODB_URI_PRIMARY) {
        console.log('📊 Using PRIMARY MongoDB (MONGODB_URI_PRIMARY)');
        return process.env.MONGODB_URI_PRIMARY;
    }

    // Option 2: Use MONGODB_URI (backward compatible)
    if (process.env.MONGODB_URI) {
        console.log('📊 Using MongoDB (MONGODB_URI)');
        return process.env.MONGODB_URI;
    }

    // Option 3: Try primary, then secondary
    if (process.env.MONGODB_URI_PRIMARY) {
        console.log('📊 Using PRIMARY MongoDB (MONGODB_URI_PRIMARY)');
        return process.env.MONGODB_URI_PRIMARY;
    }

    if (process.env.MONGODB_URI_SECONDARY) {
        console.log('📊 Using SECONDARY MongoDB (MONGODB_URI_SECONDARY)');
        return process.env.MONGODB_URI_SECONDARY;
    }

    throw new Error('No MongoDB URI found. Set MONGODB_URI, MONGODB_URI_PRIMARY, or MONGODB_URI_SECONDARY');
}

const connectDB = async () => {
    try {
        // Disable mongoose buffering before connecting (fail fast if not connected)
        mongoose.set('bufferCommands', false);

        // Get the active MongoDB URI
        const mongoURI = getMongoURI();

        // Optimize connection settings for better performance
        const conn = await mongoose.connect(mongoURI, {
            // Connection pool settings (increased for better performance)
            maxPoolSize: 20, // Maximum number of connections in the pool (increased from 10)
            minPoolSize: 5, // Minimum number of connections to maintain (increased from 2)
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity

            // Timeout settings (optimized for faster response)
            serverSelectionTimeoutMS: 5000, // Reduced from 10s for faster failover
            socketTimeoutMS: 30000, // Reduced from 45s for faster timeout detection
            connectTimeoutMS: 5000, // Reduced from 10s for faster connection

            // Other optimizations
            retryWrites: true, // Retry write operations on network errors
            retryReads: true, // Retry read operations on network errors
            // Compression for faster data transfer
            compressors: ['zlib'],
            zlibCompressionLevel: 6
        });

        const host = conn.connection.host;
        const dbName = conn.connection.db.databaseName;
        console.log(`✅ MongoDB Connected: ${host}`);
        console.log(`📊 Database: ${dbName}`);

        // Show which URI is being used (masked for security)
        const maskedURI = mongoURI.replace(/:[^:@]+@/, ':****@');
        console.log(`🔗 Connection: ${maskedURI}`);

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

        // If primary fails and secondary exists, try secondary as fallback
        if (process.env.MONGODB_URI_SECONDARY && process.env.MONGODB_URI_PRIMARY) {
            console.log('⚠️  Primary database failed. Attempting fallback to secondary...');
            try {
                const fallbackURI = process.env.MONGODB_URI_SECONDARY;
                await mongoose.connect(fallbackURI, {
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    connectTimeoutMS: 10000,
                    retryWrites: true,
                    retryReads: true,
                });
                console.log('✅ Fallback to secondary database successful!');
                console.log(`🔗 Using: ${fallbackURI.replace(/:[^:@]+@/, ':****@')}`);
                return;
            } catch (fallbackError) {
                console.error('❌ Fallback to secondary also failed:', fallbackError.message);
            }
        }

        process.exit(1);
    }
};

module.exports = connectDB;