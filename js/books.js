class BookManager {
    constructor() {
        this.storageService = window.storageService;
        this.apiService = window.apiService;
        this.uiService = window.uiService;
        
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            draggedBookId: null,
            sourceColumn: null,
            placeholder: null
        };
        
        this.init();
    }

    init() {
        this.loadMyBooks();
        this.setupEventListeners();

        setTimeout(() => {
            this.initializeDragAndDrop();
        }, 100);
    }

    loadMyBooks() {
        try {
            const booksData = this.storageService.getBooks();
            this.clearAllColumns();
            
            Object.keys(booksData).forEach(columnId => {
                const books = booksData[columnId].books || [];
                books.forEach(book => {
                    this.displayBook(book, columnId);
                });
            });
            
            this.updateEmptyStates();
        } catch (error) {
            this.uiService.showMessage('Erreur lors du chargement des livres', 'error');
        }
    }

    addGoogleBookToMyLibrary(googleBook, targetColumn = 'to-read') {
        try {
            if (this.isBookInMyLibrary(googleBook.id)) {
                this.uiService.showMessage('Ce livre est déjà dans votre bibliothèque !', 'warning');
                return false;
            }
            
            const myBook = {
                ...googleBook,
                status: targetColumn,
                rating: 0,
                comment: '',
                progress: 0,
                dateAdded: new Date().toISOString(),
                dateStatusChanged: new Date().toISOString(),
                source: 'google-books'
            };
            
            const success = this.storageService.addBook(targetColumn, myBook);
            
            if (success) {
                this.loadMyBooks();
                this.uiService.showMessage(`Livre ajouté à "${this.getColumnTitle(targetColumn)}" !`, 'success');
            }
            
            return success;
        } catch (error) {
            this.uiService.showMessage('Erreur lors de l\'ajout du livre', 'error');
            return false;
        }
    }

    isBookInMyLibrary(bookId) {
        const booksData = this.storageService.getBooks();
        for (const columnData of Object.values(booksData)) {
            if (columnData.books.some(book => book.id === bookId)) {
                return true;
            }
        }
        return false;
    }

    createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'book-card bg-white rounded-lg shadow p-3 cursor-grab transition-all duration-300 hover:shadow-md';
        card.setAttribute('data-book-id', book.id);
        card.setAttribute('data-column', book.status);
        card.setAttribute('draggable', 'true');
        
        const authors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors || 'Auteur inconnu';
        const starsHtml = this.generateStarsDisplay(book.rating || 0);
        
        card.innerHTML = `
            <div class="flex space-x-3">
                <img src="${book.thumbnail || 'assets/images/placeholder.jpg'}" 
                     alt="${book.title}" 
                     class="w-12 h-16 object-cover rounded flex-shrink-0"
                     onerror="this.src='assets/images/placeholder.jpg'">
                
                <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-sm text-gray-900 line-clamp-2 mb-1" title="${book.title}">
                        ${book.title}
                    </h3>
                    <p class="text-xs text-gray-600 line-clamp-1 mb-1" title="${authors}">
                        ${authors}
                    </p>
                    
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center space-x-1">
                            ${starsHtml}
                        </div>
                        
                        <div class="flex space-x-1">
                            <button class="text-blue-500 hover:text-blue-700 text-xs p-1" 
                                    data-action="view" data-book-id="${book.id}" title="Voir détails">
                                👁️
                            </button>
                            <button class="text-red-500 hover:text-red-700 text-xs p-1" 
                                    data-action="delete" data-book-id="${book.id}" title="Supprimer">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    ${book.status === 'reading' && book.progress ? this.generateProgressBar(book.progress) : ''}
                    ${book.comment ? `<p class="text-xs text-gray-500 mt-1 line-clamp-2" title="${book.comment}">💬 ${book.comment}</p>` : ''}
                </div>
            </div>
        `;
        
        return card;
    }

    generateStarsDisplay(rating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const filled = i <= rating;
            starsHtml += `<span class="text-xs ${filled ? 'text-yellow-400' : 'text-gray-300'}">⭐</span>`;
        }
        return starsHtml;
    }

    generateProgressBar(progress) {
        return `
            <div class="mt-2">
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                    <div class="bg-blue-500 h-1.5 rounded-full transition-all" style="width: ${progress}%"></div>
                </div>
                <span class="text-xs text-gray-500">${progress}%</span>
            </div>
        `;
    }

    displayBook(book, columnId) {
        const column = document.getElementById(`column-${columnId}`);
        if (!column) return;
        
        const bookCard = this.createBookCard(book);
        column.appendChild(bookCard);
        
        this.setupBookCardEvents(bookCard);
        this.setupCardDragEvents(bookCard);
    }

    setupBookCardEvents(card) {
        const viewBtn = card.querySelector('[data-action="view"]');
        const deleteBtn = card.querySelector('[data-action="delete"]');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookId = viewBtn.getAttribute('data-book-id');
                this.viewBookDetails(bookId);
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookId = deleteBtn.getAttribute('data-book-id');
                this.deleteBook(bookId);
            });
        }
        
        card.addEventListener('dblclick', () => {
            const bookId = card.getAttribute('data-book-id');
            this.viewBookDetails(bookId);
        });
    }

    setupCardDragEvents(card) {
        card.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, card);
        });
        
        card.addEventListener('dragend', (e) => {
            this.cleanupDrag();
        });
    }

    updateMyBookData(bookId, updates) {
        try {
            const success = this.storageService.updateBook(bookId, {
                ...updates,
                dateModified: new Date().toISOString()
            });
            
            if (success) {
                this.loadMyBooks();
                this.uiService.showMessage('Livre mis à jour !', 'success');
            }
            
            return success;
        } catch (error) {
            this.uiService.showMessage('Erreur lors de la mise à jour', 'error');
            return false;
        }
    }

    moveBook(bookId, fromColumn, toColumn) {
        try {
            const success = this.storageService.moveBook(bookId, fromColumn, toColumn);
            
            if (success) {
                this.loadMyBooks();
                this.uiService.showMessage(`Livre déplacé vers "${this.getColumnTitle(toColumn)}"`, 'success');
            }
            
            return success;
        } catch (error) {
            this.uiService.showMessage('Erreur lors du déplacement', 'error');
            this.loadMyBooks();
            return false;
        }
    }

    deleteBook(bookId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce livre ?')) {
            const success = this.storageService.deleteBook(bookId);
            
            if (success) {
                this.loadMyBooks();
                this.uiService.showMessage('Livre supprimé !', 'success');
            }
        }
    }

    viewBookDetails(bookId) {
        try {
            const book = this.findBookById(bookId);
            if (!book) {
                throw new Error('Livre non trouvé');
            }
            
            this.uiService.openBookModal(book);
        } catch (error) {
            this.uiService.showMessage('Erreur lors de l\'affichage des détails', 'error');
        }
    }

    findBookById(bookId) {
        const booksData = this.storageService.getBooks();
        for (const columnData of Object.values(booksData)) {
            const book = columnData.books.find(b => b.id === bookId);
            if (book) return book;
        }
        return null;
    }

    searchInMyLibrary(query) {
        try {
            if (!query || query.trim().length < 2) {
                this.loadMyBooks();
                return;
            }
            
            const results = this.storageService.searchBooks(query.trim());
            this.clearAllColumns();
            
            results.forEach(book => {
                this.displayBook(book, book.columnId);
            });
            
            this.updateEmptyStates();
        } catch (error) {
            this.uiService.showMessage('Erreur lors de la recherche', 'error');
        }
    }

    setupEventListeners() {
        document.addEventListener('bookAdded', (e) => {
            this.addGoogleBookToMyLibrary(e.detail.book);
        });
        
        document.addEventListener('bookUpdated', (e) => {
            const { bookId, rating, comment, status, progress } = e.detail;
            
            const updates = {};
            if (rating !== undefined) updates.rating = rating;
            if (comment !== undefined) updates.comment = comment;
            if (progress !== undefined) updates.progress = parseInt(progress);
            
            this.updateMyBookData(bookId, updates);
            
            if (status && status !== this.getCurrentBookStatus(bookId)) {
                this.moveBook(bookId, this.getCurrentBookStatus(bookId), status);
            }
        });
        
        document.addEventListener('bookDeleted', (e) => {
            this.deleteBook(e.detail.bookId);
        });
        
        document.addEventListener('searchLibrary', (e) => {
            this.searchInMyLibrary(e.detail.query);
        });
    }

    getCurrentBookStatus(bookId) {
        const book = this.findBookById(bookId);
        return book ? book.status : null;
    }

    initializeDragAndDrop() {        
        const columns = document.querySelectorAll('[data-column]');
        
        if (columns.length === 0) {
            setTimeout(() => this.initializeDragAndDrop(), 500);
            return;
        }

        columns.forEach(column => {
            this.setupColumnDropEvents(column);
        });
    }

    setupColumnDropEvents(column) {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.handleDragOver(e, column);
        });
        
        column.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.uiService.addDropHoverClass(column);
        });
        
        column.addEventListener('dragleave', (e) => {
            if (!column.contains(e.relatedTarget)) {
                this.uiService.removeDropHoverClass(column);
            }
        });
        
        column.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleDrop(e, column);
        });
    }

    handleDragStart(e, card) {
        this.dragState.isDragging = true;
        this.dragState.draggedElement = card;
        this.dragState.draggedBookId = card.getAttribute('data-book-id');
        this.dragState.sourceColumn = card.getAttribute('data-column');
        
        this.uiService.addDragClasses(card);
        this.createPlaceholder(card);
    }

    createPlaceholder(card) {
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = '120px';
        placeholder.style.backgroundColor = '#f3f4f6';
        placeholder.style.border = '2px dashed #d1d5db';
        placeholder.style.borderRadius = '8px';
        placeholder.style.margin = '8px 0';
        
        this.dragState.placeholder = placeholder;
        card.parentNode.insertBefore(placeholder, card.nextSibling);
    }

    handleDragOver(e, column) {
        if (!this.dragState.isDragging) return;
        
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = this.getDragAfterElement(column, e.clientY);
        
        if (afterElement == null) {
            column.appendChild(this.dragState.placeholder);
        } else {
            column.insertBefore(this.dragState.placeholder, afterElement);
        }
    }

    handleDrop(e, column) {
        if (!this.dragState.isDragging) return;
        
        const targetColumn = column.getAttribute('data-column');
        const bookId = this.dragState.draggedBookId;
        const sourceColumn = this.dragState.sourceColumn;
        
        this.cleanupDrag();
        
        if (sourceColumn !== targetColumn) {
            this.moveBook(bookId, sourceColumn, targetColumn);
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.book-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    cleanupDrag() {
        if (this.dragState.placeholder && this.dragState.placeholder.parentNode) {
            this.dragState.placeholder.parentNode.removeChild(this.dragState.placeholder);
        }
        
        if (this.dragState.draggedElement) {
            this.uiService.removeDragClasses(this.dragState.draggedElement);
        }
        
        document.querySelectorAll('[data-column]').forEach(column => {
            this.uiService.removeDropHoverClass(column);
        });
        
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            draggedBookId: null,
            sourceColumn: null,
            placeholder: null
        };
    }

    getColumnTitle(columnId) {
        const titles = {
            'to-read': 'À lire',
            'reading': 'En cours',
            'read': 'Lu',
            'favorites': 'Favoris'
        };
        return titles[columnId] || columnId;
    }

    clearAllColumns() {
        const columns = ['to-read', 'reading', 'read', 'favorites'];
        columns.forEach(columnId => {
            const column = document.getElementById(`column-${columnId}`);
            if (column) {
                column.innerHTML = '';
            }
        });
    }

    updateEmptyStates() {
        const columns = ['to-read', 'reading', 'read', 'favorites'];
        columns.forEach(columnId => {
            const column = document.getElementById(`column-${columnId}`);
            if (column) {
                this.uiService.updateEmptyColumnState(column);
            }
        });
    }

        cleanup() {
        
        if (this.dragState.draggedElement) {
            this.dragState.draggedElement = null;
        }
        
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            draggedBookId: null,
            sourceColumn: null,
            placeholder: null
        };
        
    }

    getStats() {
        return this.storageService.getStats();
    }
}

const bookManager = new BookManager();
window.bookManager = bookManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookManager;
}