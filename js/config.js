const CONFIG = {
    GOOGLE_BOOKS_API_KEY: '',
    API_BASE_URL: 'https://www.googleapis.com/books/v1/volumes',
    MAX_RESULTS: 40,
    CACHE_DURATION: 10 * 60 * 1000
};

window.CONFIG = CONFIG;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}