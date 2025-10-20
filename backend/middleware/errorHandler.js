const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    // Log error for debugging (you can add proper logging later)
    console.error(err);

    res.status(statusCode).json({
        success: false,
        error: {
            message: process.env.NODE_ENV === 'development' ? message : 'Something went wrong',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

module.exports = errorHandler;