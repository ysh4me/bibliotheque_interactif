class StorageService {
    constructor() {
        this.STORAGE_KEY = 'bibliotheque_books';
        this.SETTINGS_KEY = 'bibliotheque_settings';
        this.VERSION_KEY = 'bibliotheque_version';
        this.CURRENT_VERSION = '1.0.0';
        
        this.defaultColumns = {
            'to-read': { id: 'to-read', title: 'À lire', books: [], order: 1 },
            'reading': { id: 'reading', title: 'En cours', books: [], order: 2 },
            'read': { id: 'read', title: 'Lu', books: [], order: 3 },
            'favorites': { id: 'favorites', title: 'Favoris', books: [], order: 4 }
        };
        
        this.init();
    }

    init() {
        this.checkAndMigrate();
        this.cleanupCorruptedData();
    }

    checkAndMigrate() {
        const savedVersion = localStorage.getItem(this.VERSION_KEY);
        if (!savedVersion) {
            localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
        }
    }

    cleanupCorruptedData() {
        try {
            const books = this.getBooks();
            let needsCleanup = false;
            
            Object.keys(books).forEach(columnId => {
                if (!Array.isArray(books[columnId].books)) {
                    books[columnId].books = [];
                    needsCleanup = true;
                }
                
                books[columnId].books = books[columnId].books.filter(book => {
                    if (!book || !book.id || !book.title) {
                        needsCleanup = true;
                        return false;
                    }
                    return true;
                });
            });
            
            if (needsCleanup) {
                this.saveBooks(this.extractBooksOnly(books));
            }
        } catch (error) {
            this.resetToDefault();
        }
    }

    saveBooks(booksData) {
        try {
            const validatedData = this.validateBooksData(booksData);
            
            const dataToSave = {
                ...validatedData,
                _metadata: {
                    lastSaved: new Date().toISOString(),
                    version: this.CURRENT_VERSION,
                    totalBooks: this.countTotalBooks(validatedData)
                }
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.handleStorageQuotaExceeded();
            }
            return false;
        }
    }

    getBooks() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            
            if (!data) {
                return { ...this.defaultColumns };
            }
            
            const parsedData = JSON.parse(data);
            const { _metadata, ...booksData } = parsedData;
            
            const result = { ...this.defaultColumns };
            
            Object.keys(booksData).forEach(columnId => {
                if (result[columnId]) {
                    result[columnId].books = booksData[columnId] || [];
                }
            });
            
            return result;
        } catch (error) {
            return { ...this.defaultColumns };
        }
    }

    validateBooksData(booksData) {
        const validated = {};
        
        Object.keys(this.defaultColumns).forEach(columnId => {
            validated[columnId] = [];
            
            if (booksData[columnId] && Array.isArray(booksData[columnId])) {
                validated[columnId] = booksData[columnId].filter(book => {
                    return book && 
                           typeof book.id === 'string' && 
                           typeof book.title === 'string' &&
                           book.id.length > 0 &&
                           book.title.length > 0;
                });
            }
        });
        
        return validated;
    }

    countTotalBooks(booksData) {
        return Object.values(booksData).reduce((total, books) => {
            return total + (Array.isArray(books) ? books.length : 0);
        }, 0);
    }

    addBook(columnId, book) {
        try {
            const allBooks = this.getBooks();
            
            if (!allBooks[columnId]) {
                return false;
            }
            
            const existingBook = allBooks[columnId].books.find(b => b.id === book.id);
            if (existingBook) {
                return false;
            }
            
            const bookWithMetadata = {
                ...book,
                status: columnId,
                dateAdded: book.dateAdded || new Date().toISOString(),
                dateStatusChanged: new Date().toISOString()
            };
            
            allBooks[columnId].books.push(bookWithMetadata);
            return this.saveBooks(this.extractBooksOnly(allBooks));
        } catch (error) {
            return false;
        }
    }

    moveBook(bookId, fromColumn, toColumn) {
        try {
            const allBooks = this.getBooks();
            
            if (!allBooks[fromColumn] || !allBooks[toColumn]) {
                return false;
            }
            
            const sourceBooks = allBooks[fromColumn].books;
            const bookIndex = sourceBooks.findIndex(book => book.id === bookId);
            
            if (bookIndex === -1) {
                return false;
            }
            
            const [book] = sourceBooks.splice(bookIndex, 1);
            
            book.status = toColumn;
            book.dateStatusChanged = new Date().toISOString();
            
            const destBooks = allBooks[toColumn].books;
            const existingInDest = destBooks.find(b => b.id === bookId);
            
            if (existingInDest) {
                const existingIndex = destBooks.findIndex(b => b.id === bookId);
                destBooks[existingIndex] = book;
            } else {
                destBooks.push(book);
            }
            
            return this.saveBooks(this.extractBooksOnly(allBooks));
        } catch (error) {
            return false;
        }
    }

    updateBook(bookId, updates) {
        try {
            const allBooks = this.getBooks();
            let bookFound = false;
            
            Object.keys(allBooks).forEach(columnId => {
                const books = allBooks[columnId].books;
                const bookIndex = books.findIndex(book => book.id === bookId);
                
                if (bookIndex >= 0) {
                    books[bookIndex] = {
                        ...books[bookIndex],
                        ...updates,
                        dateModified: new Date().toISOString()
                    };
                    bookFound = true;
                }
            });
            
            if (!bookFound) {
                return false;
            }
            
            return this.saveBooks(this.extractBooksOnly(allBooks));
        } catch (error) {
            return false;
        }
    }

    deleteBook(bookId, columnId = null) {
        try {
            const allBooks = this.getBooks();
            let deletedBook = null;
            
            if (columnId) {
                if (allBooks[columnId]) {
                    const books = allBooks[columnId].books;
                    const bookIndex = books.findIndex(book => book.id === bookId);
                    
                    if (bookIndex >= 0) {
                        deletedBook = books.splice(bookIndex, 1)[0];
                    }
                }
            } else {
                Object.keys(allBooks).forEach(colId => {
                    const books = allBooks[colId].books;
                    const bookIndex = books.findIndex(book => book.id === bookId);
                    
                    if (bookIndex >= 0) {
                        deletedBook = books.splice(bookIndex, 1)[0];
                    }
                });
            }
            
            if (!deletedBook) {
                return false;
            }
            
            return this.saveBooks(this.extractBooksOnly(allBooks));
        } catch (error) {
            return false;
        }
    }

    searchBooks(query, columns = null) {
        try {
            const allBooks = this.getBooks();
            const searchTerms = query.toLowerCase().split(' ');
            const results = [];
            
            const columnsToSearch = columns || Object.keys(allBooks);
            
            columnsToSearch.forEach(columnId => {
                if (allBooks[columnId] && allBooks[columnId].books) {
                    allBooks[columnId].books.forEach(book => {
                        const searchText = [
                            book.title,
                            ...(book.authors || []),
                            book.description || '',
                            ...(book.categories || [])
                        ].join(' ').toLowerCase();
                        
                        const matches = searchTerms.every(term => 
                            searchText.includes(term)
                        );
                        
                        if (matches) {
                            results.push({
                                ...book,
                                columnId: columnId
                            });
                        }
                    });
                }
            });
            
            return results;
        } catch (error) {
            return [];
        }
    }

    extractBooksOnly(booksData) {
        const result = {};
        Object.keys(booksData).forEach(columnId => {
            result[columnId] = booksData[columnId].books || [];
        });
        return result;
    }

    saveSettings(settings) {
        try {
            const defaultSettings = {
                theme: 'light',
                booksPerColumn: 20,
                autoSave: true,
                notifications: true,
                sortBy: 'dateAdded',
                sortOrder: 'desc'
            };
            
            const validatedSettings = { ...defaultSettings, ...settings };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(validatedSettings));
            return true;
        } catch (error) {
            return false;
        }
    }

    getSettings() {
        try {
            const data = localStorage.getItem(this.SETTINGS_KEY);
            const defaultSettings = {
                theme: 'light',
                booksPerColumn: 20,
                autoSave: true,
                notifications: true,
                sortBy: 'dateAdded',
                sortOrder: 'desc'
            };
            
            if (data) {
                return { ...defaultSettings, ...JSON.parse(data) };
            }
            return { ...defaultSettings };
        } catch (error) {
            return {
                theme: 'light',
                booksPerColumn: 20,
                autoSave: true,
                notifications: true,
                sortBy: 'dateAdded',
                sortOrder: 'desc'
            };
        }
    }

    getStats() {
        try {
            const allBooks = this.getBooks();
            const stats = {
                columns: {},
                totalBooks: 0,
                ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                categories: {},
                authors: {},
                dates: { oldestBook: null, newestBook: null }
            };
            
            let allBooksFlat = [];
            
            Object.keys(allBooks).forEach(columnId => {
                const books = allBooks[columnId].books || [];
                stats.columns[columnId] = {
                    count: books.length,
                    title: allBooks[columnId].title
                };
                stats.totalBooks += books.length;
                
                allBooksFlat = allBooksFlat.concat(books.map(book => ({
                    ...book,
                    column: columnId
                })));
            });
            
            allBooksFlat.forEach(book => {
                if (book.rating && stats.ratings[book.rating] !== undefined) {
                    stats.ratings[book.rating]++;
                }
                
                if (book.categories) {
                    book.categories.forEach(category => {
                        stats.categories[category] = (stats.categories[category] || 0) + 1;
                    });
                }
                
                if (book.authors) {
                    book.authors.forEach(author => {
                        stats.authors[author] = (stats.authors[author] || 0) + 1;
                    });
                }
                
                if (book.dateAdded) {
                    const date = new Date(book.dateAdded);
                    if (!stats.dates.oldestBook || date < new Date(stats.dates.oldestBook)) {
                        stats.dates.oldestBook = book.dateAdded;
                    }
                    if (!stats.dates.newestBook || date > new Date(stats.dates.newestBook)) {
                        stats.dates.newestBook = book.dateAdded;
                    }
                }
            });
            
            return stats;
        } catch (error) {
            return null;
        }
    }

    handleStorageQuotaExceeded() {
        if (window.uiService) {
            window.uiService.showMessage(
                'Espace de stockage insuffisant. Veuillez supprimer quelques livres.', 
                'warning'
            );
        }
    }

    exportData() {
        try {
            return {
                books: this.getBooks(),
                settings: this.getSettings(),
                stats: this.getStats(),
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: this.CURRENT_VERSION,
                    source: 'bibliotheque-en-ligne'
                }
            };
        } catch (error) {
            return null;
        }
    }

    importData(data) {
        try {
            if (data.books) {
                const success = this.saveBooks(this.extractBooksOnly(data.books));
                if (!success) return false;
            }
            
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    resetToDefault() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.SETTINGS_KEY);
            return true;
        } catch (error) {
            return false;
        }
    }

    clearAll() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('bibliotheque_')) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}

const storageService = new StorageService();
window.storageService = storageService;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageService;
}